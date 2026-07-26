"""Time series forecasting for marketing metrics."""

from typing import Any
from datetime import datetime, timedelta

import pandas as pd
import numpy as np
from prophet import Prophet

from ..core import datastore


class Forecaster:
    """
    Time series forecasting for marketing metrics.

    Uses Prophet for forecasting:
    - Revenue/ROAS trends
    - Traffic patterns
    - Conversion rate changes
    - Seasonal patterns
    """

    def __init__(self):
        self.client = datastore.client()

    def _get_historical_data(
        self,
        metric: str,
        platform: str | None = None,
        days: int = 90,
    ) -> pd.DataFrame:
        """Get historical data from the datastore."""
        platform_filter = f"AND platform = '{platform}'" if platform else ""

        query = f"""
        SELECT
            toDate(timestamp) as ds,
            sum({metric}) as y
        FROM campaign_metrics
        WHERE timestamp >= today() - interval {days} day
          {platform_filter}
        GROUP BY ds
        ORDER BY ds
        """

        try:
            result = self.client.query(query)
            df = pd.DataFrame(result.result_rows, columns=["ds", "y"])
            df["ds"] = pd.to_datetime(df["ds"])
            return df
        except Exception:
            # Return synthetic data for development
            dates = pd.date_range(
                end=datetime.now(),
                periods=days,
                freq="D",
            )
            return pd.DataFrame({
                "ds": dates,
                "y": np.random.normal(1000, 100, days),
            })

    def forecast_metric(
        self,
        metric: str,
        platform: str | None = None,
        days_ahead: int = 30,
        historical_days: int = 90,
    ) -> dict[str, Any]:
        """
        Forecast a metric into the future.

        Args:
            metric: Metric to forecast (spend, revenue, conversions, etc.)
            platform: Optional platform filter
            days_ahead: Number of days to forecast
            historical_days: Historical data to use

        Returns:
            Forecast with predictions and confidence intervals
        """
        # Get historical data
        df = self._get_historical_data(metric, platform, historical_days)

        if len(df) < 14:  # Need at least 2 weeks
            return {"error": "Insufficient historical data"}

        # Initialize and fit Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
        )
        model.fit(df)

        # Make future dataframe
        future = model.make_future_dataframe(periods=days_ahead)

        # Predict
        forecast = model.predict(future)

        # Extract forecast period only
        forecast_period = forecast.tail(days_ahead)

        return {
            "metric": metric,
            "platform": platform,
            "forecast": [
                {
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "predicted": round(row["yhat"], 2),
                    "lower": round(row["yhat_lower"], 2),
                    "upper": round(row["yhat_upper"], 2),
                }
                for _, row in forecast_period.iterrows()
            ],
            "summary": {
                "avg_predicted": round(forecast_period["yhat"].mean(), 2),
                "total_predicted": round(forecast_period["yhat"].sum(), 2),
                "trend": "up" if forecast_period["yhat"].iloc[-1] > forecast_period["yhat"].iloc[0] else "down",
            },
        }

    def forecast_budget_needs(
        self,
        target_revenue: float,
        platform: str | None = None,
        days_ahead: int = 30,
    ) -> dict[str, Any]:
        """
        Forecast budget needed to hit revenue target.

        Uses historical ROAS to estimate required spend.
        """
        # Get historical ROAS
        query = """
        SELECT
            sum(revenue) / nullif(sum(spend), 0) as roas
        FROM campaign_metrics
        WHERE timestamp >= today() - interval 30 day
        """

        if platform:
            query += f" AND platform = '{platform}'"

        try:
            result = self.client.query(query)
            historical_roas = result.result_rows[0][0] or 2.0
        except Exception:
            historical_roas = 2.0  # Default assumption

        # Calculate required spend
        required_spend = target_revenue / historical_roas

        # Forecast spend trajectory
        spend_forecast = self.forecast_metric("spend", platform, days_ahead)

        return {
            "target_revenue": target_revenue,
            "historical_roas": round(historical_roas, 2),
            "required_total_spend": round(required_spend, 2),
            "required_daily_spend": round(required_spend / days_ahead, 2),
            "current_trajectory": spend_forecast.get("summary", {}),
            "gap": round(
                required_spend - spend_forecast.get("summary", {}).get("total_predicted", 0),
                2,
            ),
        }

    def detect_anomalies(
        self,
        metric: str,
        platform: str | None = None,
        threshold: float = 2.0,
    ) -> list[dict[str, Any]]:
        """
        Detect anomalies in metric data.

        Uses Prophet's built-in anomaly detection.
        """
        df = self._get_historical_data(metric, platform, 90)

        if len(df) < 14:
            return []

        model = Prophet()
        model.fit(df)

        forecast = model.predict(df)

        # Merge actual with forecast
        df["yhat"] = forecast["yhat"].values
        df["yhat_lower"] = forecast["yhat_lower"].values
        df["yhat_upper"] = forecast["yhat_upper"].values

        # Find anomalies
        anomalies = []
        for _, row in df.iterrows():
            residual = abs(row["y"] - row["yhat"])
            uncertainty = (row["yhat_upper"] - row["yhat_lower"]) / 2

            if residual > threshold * uncertainty:
                anomalies.append({
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "actual": round(row["y"], 2),
                    "expected": round(row["yhat"], 2),
                    "deviation": round(residual, 2),
                    "direction": "high" if row["y"] > row["yhat"] else "low",
                })

        return anomalies
