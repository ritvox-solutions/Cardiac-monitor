"""Service for storing and querying sensor data."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import setup_logger
from app.models.postgres_models import SensorDataORM
from app.schemas.sensor import SensorDataInput
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.prediction_service import PredictionService

logger = setup_logger(__name__)


class SensorService:
    """CRUD operations for the ``sensor_data`` table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._predictor = PredictionService()

    async def store_reading(
        self, payload: SensorDataInput, user_profile: dict | None = None
    ) -> dict:
        """Store a sensor reading and return a prediction.

        Parameters
        ----------
        payload : SensorDataInput
            Raw sensor data from the device.
        user_profile : dict | None
            Optional user demographic profile (merged for prediction).

        Returns
        -------
        dict
            Inserted row id with an optional prediction.
        """
        now = payload.timestamp or datetime.now(timezone.utc)

        sensor_orm = SensorDataORM(
            user_id=payload.user_id,
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            heart_rate_variability=payload.heart_rate_variability,
            activity_level=payload.activity_level,
            sleep_hours=payload.sleep_hours,
            stress_level=payload.stress_level,
            latitude=payload.latitude,
            longitude=payload.longitude,
            timestamp=now,
        )

        self._session.add(sensor_orm)
        await self._session.commit()
        await self._session.refresh(sensor_orm)

        logger.info(
            "Sensor data stored: user=%s hr=%s spo2=%s",
            payload.user_id, payload.heart_rate, payload.spo2,
        )

        prediction: PredictionOutput | None = None
        try:
            if user_profile:
                pred_input = self._build_prediction_input(payload, user_profile)
                prediction = self._predictor.predict(pred_input)
        except Exception as exc:
            logger.warning("Prediction from sensor data failed: %s", exc)

        return {
            "id": sensor_orm.id,
            "user_id": payload.user_id,
            "heart_rate": payload.heart_rate,
            "spo2": payload.spo2,
            "stored": True,
            "prediction": prediction.model_dump() if prediction else None,
        }

    async def get_user_readings(
        self,
        user_id: str,
        limit: int = 50,
        skip: int = 0,
    ) -> list[dict]:
        """Fetch recent sensor readings for a user, newest first."""
        result = await self._session.execute(
            select(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
            .order_by(SensorDataORM.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )
        rows = result.scalars().all()
        readings = [_orm_to_dict(r) for r in rows]
        logger.debug("Fetched %s readings for user=%s", len(readings), user_id)
        return readings

    async def get_readings_in_range(
        self,
        user_id: str,
        since: datetime,
        until: datetime | None = None,
        limit: int = 500,
    ) -> list[dict]:
        """Fetch readings within a time range, oldest first (for charting)."""
        stmt = (
            select(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
            .where(SensorDataORM.timestamp >= since)
            .order_by(SensorDataORM.timestamp.asc())
            .limit(limit)
        )
        if until is not None:
            stmt = stmt.where(SensorDataORM.timestamp <= until)

        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [_orm_to_dict(r) for r in rows]

    async def count_readings(self, user_id: str) -> int:
        from sqlalchemy import func as sql_func

        result = await self._session.execute(
            select(sql_func.count())
            .select_from(SensorDataORM)
            .where(SensorDataORM.user_id == user_id)
        )
        return result.scalar() or 0

    @staticmethod
    def _build_prediction_input(
        sensor: SensorDataInput,
        profile: dict,
    ) -> PredictionInput:
        """Merge sensor readings with user profile to create a prediction input."""
        return PredictionInput(
            age=profile.get("age", 30),
            gender=profile.get("gender", "Male"),
            height_cm=profile.get("height_cm", 170.0),
            weight_kg=profile.get("weight_kg", 70.0),
            bmi=profile.get("bmi", 24.0),
            heart_rate=sensor.heart_rate,
            spo2=sensor.spo2,
            activity_level=sensor.activity_level or "Lightly Active",
            sleep_hours=sensor.sleep_hours or 7.0,
            stress_level=sensor.stress_level or 30,
            smoking=profile.get("smoking", False),
            diabetes=profile.get("diabetes", False),
            hypertension=profile.get("hypertension", False),
            heart_rate_variability=sensor.heart_rate_variability,
        )


def _orm_to_dict(row) -> dict:
    if row is None:
        return {}
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}
