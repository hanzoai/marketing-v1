"""Base class for ad platform integrations."""

from abc import ABC, abstractmethod
from typing import Any

from ..core.models import Campaign, Audience, Creative


class AdPlatform(ABC):
    """Abstract base class for ad platform integrations."""

    name: str = "base"

    @abstractmethod
    async def create_campaign(self, campaign: Campaign) -> str:
        """Create a campaign on the platform. Returns platform campaign ID."""
        ...

    @abstractmethod
    async def update_campaign(self, platform_id: str, campaign: Campaign) -> bool:
        """Update an existing campaign."""
        ...

    @abstractmethod
    async def pause_campaign(self, platform_id: str) -> bool:
        """Pause a campaign."""
        ...

    @abstractmethod
    async def resume_campaign(self, platform_id: str) -> bool:
        """Resume a paused campaign."""
        ...

    @abstractmethod
    async def get_metrics(
        self,
        platform_id: str,
        start_date: str,
        end_date: str,
    ) -> dict[str, Any]:
        """Get campaign metrics."""
        ...

    @abstractmethod
    async def create_audience(self, audience: Audience) -> str:
        """Create a custom audience. Returns platform audience ID."""
        ...

    @abstractmethod
    async def upload_creative(self, creative: Creative) -> str:
        """Upload a creative asset. Returns platform creative ID."""
        ...

    @abstractmethod
    async def get_account_balance(self) -> float:
        """Get account balance/spend limit."""
        ...

    async def sync_metrics_to_datastore(
        self,
        platform_id: str,
        start_date: str,
        end_date: str,
    ) -> int:
        """Sync metrics to the datastore. Returns rows inserted."""
        metrics = await self.get_metrics(platform_id, start_date, end_date)
        # Implementation would insert into the datastore
        return 0
