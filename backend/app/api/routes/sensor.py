"""Sensor-data endpoint.

``POST /sensor-data`` — receives live readings from the ESP32 wearable,
persists them to PostgreSQL, and returns a prediction.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, get_sensor_service
from app.core.logger import setup_logger
from app.models.postgres_models import UserORM
from app.schemas.sensor import SensorDataInput, SensorDataOutput
from app.services.sensor_service import SensorService

logger = setup_logger(__name__)
router = APIRouter(tags=["Sensor"])


@router.post(
    "/sensor-data",
    response_model=SensorDataOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Store sensor data",
    description=(
        "Receive a real-time sensor reading from the ESP32 wearable device.  "
        "The data is stored in PostgreSQL and a cardiac risk prediction is returned "
        "if the user's demographic profile is available."
    ),
)
async def store_sensor_data(
    payload: SensorDataInput,
    sensor_service: SensorService = Depends(get_sensor_service),
    session: AsyncSession = Depends(get_db_session),
) -> SensorDataOutput:
    """Store a sensor reading and return a prediction."""
    user_profile = None
    try:
        result = await session.execute(
            select(UserORM).where(UserORM.user_id == payload.user_id)
        )
        user_obj = result.scalar_one_or_none()
        if user_obj:
            user_profile = {c.name: getattr(user_obj, c.name) for c in user_obj.__table__.columns}
    except Exception:
        logger.debug("No user profile found for %s", payload.user_id)

    try:
        result = await sensor_service.store_reading(payload, user_profile)
    except Exception as exc:
        logger.exception("Failed to store sensor data")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process sensor data",
        ) from exc

    return SensorDataOutput(
        id=result["id"],
        user_id=result["user_id"],
        heart_rate=result["heart_rate"],
        spo2=result["spo2"],
        stored=True,
        prediction=result.get("prediction"),
    )
