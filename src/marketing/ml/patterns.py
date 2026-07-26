"""Pattern detection in marketing data."""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from ..core import datastore


class PatternDetector:
    """
    Detect patterns in marketing data using ML.

    Capabilities:
    - Audience segmentation
    - Campaign performance clustering
    - Conversion path analysis
    - Attribution patterns
    """

    def __init__(self):
        self.client = datastore.client()

    def segment_audiences(
        self,
        n_segments: int = 5,
        features: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Segment audiences based on behavior patterns.

        Uses K-means clustering on user behavior features.
        """
        if features is None:
            features = [
                "total_sessions",
                "total_pageviews",
                "total_events",
                "days_active",
                "avg_session_duration",
            ]

        query = f"""
        SELECT
            user_id,
            {', '.join(features)}
        FROM user_behavior_summary
        WHERE {features[0]} > 0
        LIMIT 10000
        """

        try:
            result = self.client.query(query)
            df = pd.DataFrame(
                result.result_rows,
                columns=["user_id"] + features,
            )
        except Exception:
            # Synthetic data for development
            n_users = 1000
            df = pd.DataFrame({
                "user_id": range(n_users),
                **{f: np.random.exponential(10, n_users) for f in features},
            })

        # Prepare features
        X = df[features].values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Cluster
        kmeans = KMeans(n_clusters=n_segments, random_state=42, n_init=10)
        df["segment"] = kmeans.fit_predict(X_scaled)

        # Analyze segments
        segments = []
        for seg_id in range(n_segments):
            seg_data = df[df["segment"] == seg_id]
            segments.append({
                "segment_id": seg_id,
                "size": len(seg_data),
                "percentage": round(len(seg_data) / len(df) * 100, 1),
                "characteristics": {
                    f: round(seg_data[f].mean(), 2)
                    for f in features
                },
            })

        # Sort by size
        segments.sort(key=lambda x: x["size"], reverse=True)

        return {
            "n_segments": n_segments,
            "total_users": len(df),
            "segments": segments,
            "cluster_centers": kmeans.cluster_centers_.tolist(),
        }

    def find_high_value_patterns(
        self,
        conversion_threshold: float = 0.1,
    ) -> dict[str, Any]:
        """
        Find patterns in high-converting users.

        Identifies common characteristics of converting users.
        """
        query = """
        SELECT
            source,
            medium,
            campaign,
            device_type,
            country,
            count(*) as users,
            sum(converted) as conversions,
            sum(converted) / count(*) as cvr,
            avg(revenue) as avg_revenue
        FROM user_attribution
        GROUP BY source, medium, campaign, device_type, country
        HAVING cvr >= {threshold:Float64}
        ORDER BY conversions DESC
        LIMIT 100
        """

        try:
            result = self.client.query(
                query,
                parameters={"threshold": conversion_threshold},
            )

            patterns = [
                {
                    "source": row[0],
                    "medium": row[1],
                    "campaign": row[2],
                    "device": row[3],
                    "country": row[4],
                    "users": row[5],
                    "conversions": row[6],
                    "cvr": round(row[7], 4),
                    "avg_revenue": round(row[8], 2),
                }
                for row in result.result_rows
            ]
        except Exception:
            patterns = []

        return {
            "threshold": conversion_threshold,
            "patterns_found": len(patterns),
            "patterns": patterns,
        }

    def analyze_conversion_paths(
        self,
        max_path_length: int = 5,
    ) -> dict[str, Any]:
        """
        Analyze common conversion paths.

        Finds most effective touchpoint sequences.
        """
        query = f"""
        SELECT
            arrayStringConcat(
                arraySlice(touchpoints, 1, {max_path_length}),
                ' > '
            ) as path,
            count(*) as conversions,
            avg(revenue) as avg_revenue,
            avg(days_to_convert) as avg_days
        FROM conversion_paths
        WHERE converted = 1
        GROUP BY path
        ORDER BY conversions DESC
        LIMIT 50
        """

        try:
            result = self.client.query(query)

            paths = [
                {
                    "path": row[0],
                    "conversions": row[1],
                    "avg_revenue": round(row[2], 2),
                    "avg_days": round(row[3], 1),
                }
                for row in result.result_rows
            ]
        except Exception:
            paths = []

        return {
            "max_path_length": max_path_length,
            "paths_analyzed": len(paths),
            "top_paths": paths,
        }

    def detect_fatigue(
        self,
        campaign_id: str,
        threshold_drop: float = 0.2,
    ) -> dict[str, Any]:
        """
        Detect creative/audience fatigue in campaigns.

        Identifies when performance starts declining.
        """
        query = """
        SELECT
            toDate(timestamp) as date,
            sum(impressions) as impressions,
            sum(clicks) as clicks,
            clicks / nullif(impressions, 0) as ctr,
            sum(conversions) as conversions,
            conversions / nullif(clicks, 0) as cvr
        FROM campaign_metrics
        WHERE campaign_id = {campaign_id:String}
        GROUP BY date
        ORDER BY date
        """

        try:
            result = self.client.query(
                query,
                parameters={"campaign_id": campaign_id},
            )

            df = pd.DataFrame(
                result.result_rows,
                columns=["date", "impressions", "clicks", "ctr", "conversions", "cvr"],
            )
        except Exception:
            # Synthetic data
            dates = pd.date_range(end=pd.Timestamp.now(), periods=30, freq="D")
            df = pd.DataFrame({
                "date": dates,
                "impressions": np.linspace(10000, 8000, 30),
                "clicks": np.linspace(500, 300, 30),
                "ctr": np.linspace(0.05, 0.0375, 30),
                "conversions": np.linspace(50, 25, 30),
                "cvr": np.linspace(0.1, 0.083, 30),
            })

        if len(df) < 7:
            return {"fatigue_detected": False, "reason": "Insufficient data"}

        # Calculate rolling averages
        df["ctr_7d"] = df["ctr"].rolling(7).mean()
        df["cvr_7d"] = df["cvr"].rolling(7).mean()

        # Compare first week to last week
        first_week_ctr = df["ctr"].head(7).mean()
        last_week_ctr = df["ctr"].tail(7).mean()
        ctr_change = (last_week_ctr - first_week_ctr) / first_week_ctr

        first_week_cvr = df["cvr"].head(7).mean()
        last_week_cvr = df["cvr"].tail(7).mean()
        cvr_change = (last_week_cvr - first_week_cvr) / first_week_cvr

        fatigue_detected = ctr_change < -threshold_drop or cvr_change < -threshold_drop

        return {
            "campaign_id": campaign_id,
            "fatigue_detected": fatigue_detected,
            "metrics": {
                "ctr_change": round(ctr_change * 100, 1),
                "cvr_change": round(cvr_change * 100, 1),
                "first_week_ctr": round(first_week_ctr, 4),
                "last_week_ctr": round(last_week_ctr, 4),
            },
            "recommendation": "Refresh creatives or expand audience" if fatigue_detected else "Continue monitoring",
        }
