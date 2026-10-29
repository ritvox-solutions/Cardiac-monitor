"""FastAPI dependency injection.

Provides reusable dependencies for database and service injection.
"""

from typing import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.postgres import get_db
from app.services.dashboard_service import DashboardService
from app.services.emergency_service import EmergencyService
from app.services.prediction_service import PredictionService
from app.services.sensor_service import SensorService
from app.services.user_service import UserService


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session per request."""
    async for session in get_db():
        yield session


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

def get_prediction_service() -> PredictionService:
    """Return the singleton prediction service."""
    return PredictionService()


async def get_sensor_service(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[SensorService, None]:
    """Provide a fresh SensorService per request."""
    yield SensorService(session)


async def get_dashboard_service(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[DashboardService, None]:
    """Provide a fresh DashboardService per request."""
    yield DashboardService(session)


async def get_emergency_service(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[EmergencyService, None]:
    """Provide a fresh EmergencyService per request."""
    yield EmergencyService(session)


async def get_user_service(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[UserService, None]:
    """Provide a fresh UserService per request."""
    yield UserService(session)


# ---------------------------------------------------------------------------
# Request info
# ---------------------------------------------------------------------------

def get_client_host(request: Request) -> str:
    """Extract the client's IP address."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
