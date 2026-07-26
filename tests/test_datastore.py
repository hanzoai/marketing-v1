"""Tests for the native Datastore HTTP client."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from marketing.core import datastore
from marketing.core.config import settings
from marketing.core.datastore import Client, DatastoreError, QueryResult, _coerce, _unwrap

SRC = Path(__file__).resolve().parents[1] / "src" / "marketing"


def stub(
    payload: dict[str, Any] | None = None,
    status: int = 200,
    body: bytes | None = None,
) -> tuple[Client, list[httpx.Request]]:
    """A client whose transport records requests and replays a canned response."""
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if body is not None:
            return httpx.Response(status, content=body)
        return httpx.Response(status, json=payload if payload is not None else {})

    client = Client(
        url="http://datastore:8123",
        database="marketing",
        username="hanzo",
        password="secret",
        transport=httpx.MockTransport(handle),
    )
    return client, seen


def result(meta: list[tuple[str, str]], data: list[list[Any]]) -> dict[str, Any]:
    return {"meta": [{"name": n, "type": t} for n, t in meta], "data": data}


# --- type coercion ----------------------------------------------------------------


def test_unwrap_strips_nested_wrappers() -> None:
    assert _unwrap("String") == "String"
    assert _unwrap("Nullable(Int64)") == "Int64"
    assert _unwrap("LowCardinality(Nullable(String))") == "String"
    assert _unwrap("Nullable(Decimal(9, 2))") == "Decimal(9, 2)"


@pytest.mark.parametrize(
    ("type_name", "raw", "expected"),
    [
        # The server quotes 64-bit ints as strings to preserve precision.
        ("UInt64", "18446744073709551615", 18446744073709551615),
        ("Int64", "-9007199254740993", -9007199254740993),
        ("Int32", 42, 42),
        ("Nullable(UInt64)", "7", 7),
        # Decimals arrive as strings too.
        ("Decimal(18, 4)", "1234.5678", 1234.5678),
        ("Float64", 0.05, 0.05),
        ("Float64", "0.05", 0.05),
        ("Nullable(Float64)", None, None),
        # Everything else passes through untouched.
        ("String", "meta", "meta"),
        ("Date", "2026-07-26", "2026-07-26"),
        ("DateTime64(3)", "2026-07-26 10:00:00.000", "2026-07-26 10:00:00.000"),
        ("Array(UInt64)", ["1", "2"], ["1", "2"]),
        ("Map(String, UInt64)", {"a": "1"}, {"a": "1"}),
        ("Bool", True, True),
    ],
)
def test_coerce_types_by_declared_column_type(type_name: str, raw: Any, expected: Any) -> None:
    assert _coerce(type_name, raw) == expected


def test_quoted_integers_survive_as_exact_python_ints() -> None:
    """A 64-bit id must not lose its low bits by routing through float."""
    client, _ = stub(result([("id", "UInt64")], [["18446744073709551615"]]))
    row = client.query("SELECT id FROM t").result_rows[0]
    assert row[0] == 18446744073709551615
    assert isinstance(row[0], int)


def test_rows_are_typed_for_arithmetic() -> None:
    """Call sites do round()/arithmetic straight off result_rows."""
    client, _ = stub(
        result(
            [("clicks", "UInt64"), ("ctr", "Nullable(Float64)"), ("cpa", "Decimal(18, 4)")],
            [["500", 0.0512345, "12.5000"]],
        )
    )
    clicks, ctr, cpa = client.query("SELECT clicks, ctr, cpa FROM t").result_rows[0]
    assert clicks + 1 == 501
    assert round(ctr, 4) == 0.0512
    assert round(cpa, 2) == 12.5


# --- parameter binding ------------------------------------------------------------


def test_parameters_bind_server_side_and_never_enter_the_sql() -> None:
    sql = "SELECT * FROM t WHERE campaign_id = {campaign_id:String}"
    client, seen = stub(result([("x", "UInt8")], []))
    client.query(sql, parameters={"campaign_id": "abc"})

    assert seen[0].content.decode() == sql, "SQL must travel verbatim"
    assert seen[0].url.params["param_campaign_id"] == "abc"


def test_hostile_parameter_cannot_reach_the_statement() -> None:
    """Regression: values are query arguments, so no SQL is assembled client-side."""
    hostile = "x'; DROP TABLE campaign_metrics; --"
    sql = "SELECT * FROM t WHERE campaign_id = {campaign_id:String}"
    client, seen = stub(result([("x", "UInt8")], []))
    client.query(sql, parameters={"campaign_id": hostile})

    assert seen[0].content.decode() == sql
    assert "DROP TABLE" not in seen[0].content.decode()
    assert seen[0].url.params["param_campaign_id"] == hostile


@pytest.mark.parametrize(
    ("value", "encoded"),
    [(30, "30"), (0.1, "0.1"), ("meta", "meta"), (True, "1"), (False, "0"), (None, "\\N")],
)
def test_parameter_encoding(value: Any, encoded: str) -> None:
    client, seen = stub(result([], []))
    client.query("SELECT 1", parameters={"v": value})
    assert seen[0].url.params["param_v"] == encoded


def test_request_carries_auth_database_and_format() -> None:
    client, seen = stub(result([], []))
    client.query("SELECT 1")

    request = seen[0]
    assert request.headers["X-ClickHouse-User"] == "hanzo"
    assert request.headers["X-ClickHouse-Key"] == "secret"
    assert request.url.params["database"] == "marketing"
    assert request.url.params["default_format"] == "JSONCompact"
    assert request.method == "POST"


# --- results and failure ----------------------------------------------------------


def test_result_exposes_columns_and_rows() -> None:
    client, _ = stub(result([("ds", "Date"), ("y", "Float64")], [["2026-07-26", 1.5]]))
    got = client.query("SELECT ds, y FROM t")

    assert got.column_names == ("ds", "y")
    assert got.column_types == ("Date", "Float64")
    assert got.result_rows == [["2026-07-26", 1.5]]
    assert len(got) == 1


def test_empty_result_is_usable() -> None:
    client, _ = stub(result([("x", "UInt8")], []))
    got = client.query("SELECT x FROM t WHERE 0")
    assert got.result_rows == []
    assert not got.result_rows  # call sites test truthiness


def test_server_error_raises_with_server_text() -> None:
    client, _ = stub(status=400, body=b"Code: 47. Unknown expression identifier 'nope'")
    with pytest.raises(DatastoreError, match="Unknown expression identifier"):
        client.query("SELECT nope")


def test_unreachable_datastore_raises() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    client = Client(
        url="http://datastore:8123",
        database="marketing",
        transport=httpx.MockTransport(refuse),
    )
    with pytest.raises(DatastoreError, match="unreachable"):
        client.query("SELECT 1")


def test_empty_body_yields_empty_result() -> None:
    client, _ = stub(body=b"")
    assert client.query("SELECT 1") == QueryResult()


def test_malformed_json_raises() -> None:
    client, _ = stub(body=b"not json")
    with pytest.raises(DatastoreError, match="malformed JSON"):
        client.query("SELECT 1")


# --- wiring -----------------------------------------------------------------------


def test_factory_reads_configured_datastore() -> None:
    made = datastore.client()
    assert str(made._http.base_url) == settings.datastore_url
    assert made._http.headers["X-ClickHouse-User"] == settings.datastore_user
    made.close()


def test_default_datastore_host_is_the_canonical_service() -> None:
    """`datastore` is the Service name in namespace hanzo; `clickhouse` does not exist."""
    assert settings.datastore_url == "http://datastore:8123"


def test_no_pyformat_placeholders_remain_in_queries() -> None:
    """Server-side binding uses {name:Type}; a stray %(name)s would bind nothing."""
    stale = [
        path
        for path in SRC.rglob("*.py")
        if "%(" in path.read_text()
    ]
    assert stale == []


def test_driver_import_is_gone() -> None:
    offenders = [
        path for path in SRC.rglob("*.py") if "clickhouse_connect" in path.read_text()
    ]
    assert offenders == []


def test_client_is_closeable_as_a_context_manager() -> None:
    with stub(result([], []))[0] as client:
        assert client.query("SELECT 1").result_rows == []
