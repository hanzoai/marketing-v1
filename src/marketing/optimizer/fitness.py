"""Fitness evaluation using real campaign data from the datastore."""

from typing import Any

from ..core import datastore


class FitnessEvaluator:
    """
    Evaluates campaign fitness using historical data from the datastore.

    Queries analytics data to score campaign parameters based on:
    - Conversion rate
    - Cost per acquisition (CPA)
    - Return on ad spend (ROAS)
    - Click-through rate (CTR)
    - Engagement rate
    """

    def __init__(self):
        self.client = datastore.client()

    def get_historical_performance(
        self,
        platform: str,
        days: int = 30,
    ) -> dict[str, float]:
        """Get historical performance metrics for a platform."""
        query = f"""
        SELECT
            platform,
            sum(impressions) as total_impressions,
            sum(clicks) as total_clicks,
            sum(conversions) as total_conversions,
            sum(spend) as total_spend,
            sum(revenue) as total_revenue,
            total_clicks / nullif(total_impressions, 0) as ctr,
            total_conversions / nullif(total_clicks, 0) as cvr,
            total_spend / nullif(total_conversions, 0) as cpa,
            total_revenue / nullif(total_spend, 0) as roas
        FROM campaign_metrics
        WHERE platform = {platform:String}
          AND date >= today() - interval {days:UInt32} day
        GROUP BY platform
        """
        try:
            result = self.client.query(query, parameters={"platform": platform, "days": days})
            if result.result_rows:
                row = result.result_rows[0]
                return {
                    "impressions": row[1],
                    "clicks": row[2],
                    "conversions": row[3],
                    "spend": row[4],
                    "revenue": row[5],
                    "ctr": row[6] or 0,
                    "cvr": row[7] or 0,
                    "cpa": row[8] or 0,
                    "roas": row[9] or 0,
                }
        except Exception:
            pass

        return {"ctr": 0, "cvr": 0, "cpa": 0, "roas": 0}

    def evaluate_allocation(
        self,
        allocation: dict[str, dict[str, float]],
        target_roas: float = 2.0,
    ) -> float:
        """
        Evaluate a budget allocation strategy.

        Returns fitness score based on predicted ROAS.
        """
        total_predicted_revenue = 0.0
        total_spend = 0.0

        for platform, params in allocation.items():
            budget = params.get("budget", 0)
            bid_mult = params.get("bid_multiplier", 1.0)

            # Get historical performance
            perf = self.get_historical_performance(platform)

            # Predict performance with bid multiplier
            predicted_roas = perf.get("roas", 1.0) * (1 + (bid_mult - 1) * 0.5)
            predicted_revenue = budget * predicted_roas

            total_predicted_revenue += predicted_revenue
            total_spend += budget

        if total_spend == 0:
            return 0.0

        predicted_roas = total_predicted_revenue / total_spend

        # Score relative to target ROAS
        return min(predicted_roas / target_roas, 2.0)

    def evaluate_creative(
        self,
        creative_params: dict[str, Any],
        audience_id: str,
    ) -> float:
        """Evaluate creative performance prediction."""
        query = """
        SELECT
            avg(ctr) as avg_ctr,
            avg(engagement_rate) as avg_engagement
        FROM creative_performance
        WHERE audience_id = {audience_id:String}
          AND creative_type = {creative_type:String}
        """
        try:
            result = self.client.query(
                query,
                parameters={
                    "audience_id": audience_id,
                    "creative_type": creative_params.get("type", "image"),
                },
            )
            if result.result_rows:
                row = result.result_rows[0]
                return (row[0] or 0) + (row[1] or 0)
        except Exception:
            pass

        return 0.5  # Default score
