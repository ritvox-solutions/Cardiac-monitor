"""Health-check endpoint.

``GET /health`` — returns application status, model load state,
database connectivity, and version.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session
from app.core.config import settings
from app.schemas.health import HealthResponse
from app.services.prediction_service import PredictionService

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    session: AsyncSession = Depends(get_db_session),
) -> HealthResponse:
    """Return the current health status of the API."""
    db_status = "connected"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    predictor = PredictionService()
    model_loaded = predictor.is_loaded()

    return HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        database=db_status,
        version=settings.APP_VERSION,
    )
