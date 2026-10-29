"""Service for dashboard aggregation and historical queries."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func as sql_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import setup_logger
from app.models.postgres_models import PredictionORM, SensorDataORM
from app.schemas.dashboard import DashboardResponse, HistoryResponse, VitalSnapshot
from app.utils.dcsi import compute_dcsi

logger = setup_logger(__name__)


class DashboardService:
    """Aggregates user data for the dashboard and history views."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_dashboard(self, user_id: str) -> DashboardResponse:
        """Build the full dashboard response for *user_id*."""
        # Latest sensor reading
        result = await self._session.execute(
            select(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
            .order_by(SensorDataORM.timestamp.desc())
            .limit(1)
        )
        latest_reading = result.scalar_one_or_none()

        # Latest prediction
        result = await self._session.execute(
            select(PredictionORM)
            .where(PredictionORM.user_id == user_id)
            .order_by(PredictionORM.created_at.desc())
            .limit(1)
        )
        latest_pred = result.scalar_one_or_none()

        # Recent readings (last 20)
        result = await self._session.execute(
            select(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
            .order_by(SensorDataORM.timestamp.desc())
            .limit(20)
        )
        recent_raw_orms = result.scalars().all()

        recent_readings = [
            VitalSnapshot(
                heart_rate=r.heart_rate,
                spo2=r.spo2,
                heart_rate_variability=r.heart_rate_variability,
                timestamp=r.timestamp,
            )
            for r in recent_raw_orms
            if r.heart_rate is not None
        ]

        # DCSI from latest reading
        dcsi: float | None = None
        if latest_reading is not None:
            dcsi = compute_dcsi(
                heart_rate=latest_reading.heart_rate or 72,
                spo2=latest_reading.spo2 or 98.0,
                heart_rate_variability=latest_reading.heart_rate_variability or 50,
                activity_level=latest_reading.activity_level or "Lightly Active",
            )

        # Total count
        result = await self._session.execute(
            select(sql_func.count())
            .select_from(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
        )
        total_count = result.scalar() or 0

        return DashboardResponse(
            user_id=user_id,
            latest_heart_rate=latest_reading.heart_rate if latest_reading else None,
            latest_spo2=latest_reading.spo2 if latest_reading else None,
            current_risk_level=latest_pred.risk_level if latest_pred else None,
            current_risk_score=latest_pred.risk_score if latest_pred else None,
            current_dcsi=dcsi,
            latest_prediction=_pred_to_dict(latest_pred),
            recent_readings=recent_readings,
            history_count=total_count,
        )

    async def get_history(
        self,
        user_id: str,
        period: str = "week",
    ) -> HistoryResponse:
        """Return historical sensor readings filtered by a time window.

        Parameters
        ----------
        user_id : str
            Patient identifier.
        period : str
            One of ``"day"``, ``"week"``, ``"month"``.

        Returns
        -------
        HistoryResponse
        """
        now = datetime.now(timezone.utc)

        delta_map = {
            "day": timedelta(days=1),
            "week": timedelta(weeks=1),
            "month": timedelta(days=30),
        }
        delta = delta_map.get(period, timedelta(weeks=1))
        since = now - delta

        result = await self._session.execute(
            select(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
            .where(SensorDataORM.timestamp >= since)
            .where(SensorDataORM.timestamp <= now)
            .order_by(SensorDataORM.timestamp.desc())
            .limit(500)
        )
        raw_orms = result.scalars().all()

        readings = [
            VitalSnapshot(
                heart_rate=r.heart_rate,
                spo2=r.spo2,
                heart_rate_variability=r.heart_rate_variability,
                timestamp=r.timestamp,
            )
            for r in raw_orms
            if r.heart_rate is not None
        ]

        return HistoryResponse(
            user_id=user_id,
            period=period,
            readings=readings,
            total=len(readings),
        )


def _pred_to_dict(pred: PredictionORM | None) -> dict | None:
    if pred is None:
        return None
    return {
        "id": pred.id,
        "user_id": pred.user_id,
        "risk_level": pred.risk_level,
        "risk_score": pred.risk_score,
        "confidence": pred.confidence,
        "dcsi": pred.dcsi,
        "probabilities": pred.probabilities,
        "features_used": pred.features_used,
        "created_at": pred.created_at.isoformat() if pred.created_at else None,
    }
