"""Native HTTP client for Hanzo Datastore.

Datastore serves an HTTP interface on port 8123. This client covers the surface this
service uses: a parameterised SELECT returning rows.

Two details are load-bearing:

* Parameters bind **server-side**. Callers write ``{name:Type}`` placeholders and pass
  values in ``parameters``; the values travel as ``param_<name>`` query arguments and
  never touch the SQL text, so no statement is assembled here.
* Values are typed from the ``meta`` block the server returns. The JSON formats quote
  64-bit integers and decimals as strings to preserve precision, so a column's declared
  type — not its JSON representation — decides the Python type.

``X-Datastore-*`` auth headers and the ``{name:Type}`` placeholder syntax are the server's
wire contract rather than branding, and are spelled as the protocol defines them.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import settings

__all__ = ["Client", "DatastoreError", "QueryResult", "client"]


class DatastoreError(RuntimeError):
    """Datastore rejected a query, or could not be reached."""


_INTEGER = frozenset(
    {
        "Int8",
        "Int16",
        "Int32",
        "Int64",
        "Int128",
        "Int256",
        "UInt8",
        "UInt16",
        "UInt32",
        "UInt64",
        "UInt128",
        "UInt256",
    }
)
_FLOAT = frozenset({"Float32", "Float64"})
_WRAPPERS = ("Nullable(", "LowCardinality(")


def _unwrap(type_name: str) -> str:
    """Strip Nullable()/LowCardinality() down to the type they carry."""
    name = type_name.strip()
    while True:
        for wrapper in _WRAPPERS:
            if name.startswith(wrapper) and name.endswith(")"):
                name = name[len(wrapper) : -1].strip()
                break
        else:
            return name


def _coerce(type_name: str, value: Any) -> Any:
    """Type a JSON value by the column type the server declared.

    Composite types (Array, Map, Tuple) and temporal types pass through untouched:
    callers that need them parse them themselves.
    """
    if value is None:
        return None
    base = _unwrap(type_name).split("(", 1)[0]
    if base in _INTEGER:
        return int(value)
    if base in _FLOAT or base.startswith("Decimal"):
        return float(value)
    return value


def _encode(value: Any) -> str:
    """Render a parameter for the server to parse into its declared type."""
    if value is None:
        return "\\N"
    if isinstance(value, bool):
        return "1" if value else "0"
    return str(value)


@dataclass(frozen=True, slots=True)
class QueryResult:
    """Rows from a SELECT, with the columns the server reported."""

    result_rows: list[list[Any]] = field(default_factory=list)
    column_names: tuple[str, ...] = ()
    column_types: tuple[str, ...] = ()

    def __len__(self) -> int:
        return len(self.result_rows)


class Client:
    """Queries one Datastore over HTTP."""

    def __init__(
        self,
        url: str,
        database: str,
        username: str = "",
        password: str = "",
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._database = database
        self._http = httpx.Client(
            base_url=url.rstrip("/"),
            timeout=timeout,
            transport=transport,
            headers={"X-Datastore-User": username, "X-Datastore-Key": password},
        )

    def query(self, sql: str, parameters: Mapping[str, Any] | None = None) -> QueryResult:
        """Run a SELECT and return its rows.

        Placeholders in `sql` are the server's own ``{name:Type}`` form; `parameters`
        supplies their values. Raises DatastoreError if the query is rejected.
        """
        args = {"database": self._database, "default_format": "JSONCompact"}
        for name, value in (parameters or {}).items():
            args[f"param_{name}"] = _encode(value)

        try:
            response = self._http.post("/", content=sql.encode(), params=args)
        except httpx.HTTPError as exc:
            raise DatastoreError(f"datastore unreachable: {exc}") from exc

        if response.status_code != httpx.codes.OK:
            raise DatastoreError(
                f"datastore returned {response.status_code}: {response.text[:500]}"
            )

        if not response.content:
            return QueryResult()

        try:
            payload = response.json()
        except ValueError as exc:
            raise DatastoreError(f"datastore returned malformed JSON: {exc}") from exc

        meta = payload.get("meta", [])
        names = tuple(str(column["name"]) for column in meta)
        types = tuple(str(column["type"]) for column in meta)
        rows = [
            [_coerce(types[index], value) for index, value in enumerate(row)]
            for row in payload.get("data", [])
        ]
        return QueryResult(result_rows=rows, column_names=names, column_types=types)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> Client:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def client() -> Client:
    """Client for the datastore this service is configured against."""
    return Client(
        url=settings.datastore_url,
        database=settings.datastore_db,
        username=settings.datastore_user,
        password=settings.datastore_password,
    )
