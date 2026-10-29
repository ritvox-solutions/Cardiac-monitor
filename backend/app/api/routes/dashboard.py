"""Dashboard and history endpoints.

``GET /dashboard/{user_id}`` — aggregated real-time view.
``GET /history/{user_id}`` — historical sensor data with period filtering.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_dashboard_service
from app.core.logger import setup_logger
from app.schemas.dashboard import DashboardResponse, HistoryResponse
from app.services.dashboard_service import DashboardService

logger = setup_logger(__name__)
router = APIRouter(tags=["Dashboard"])


@router.get(
    "/dashboard/{user_id}",
    response_model=DashboardResponse,
    summary="User dashboard",
    description=(
        "Return the latest heart rate, SpO₂, current risk level, DCSI, "
        "most recent prediction, and recent vital-sign history for *user_id*."
    ),
)
async def get_dashboard(
    user_id: str,
    dashboard: DashboardService = Depends(get_dashboard_service),
) -> DashboardResponse:
    """Aggregate dashboard data for a single user."""
    try:
        result = await dashboard.get_dashboard(user_id)
    except Exception as exc:
        logger.exception("Dashboard fetch failed for %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard data",
        ) from exc

    logger.info("Dashboard returned for user=%s (%s readings)", user_id, result.history_count)
    return result


@router.get(
    "/history/{user_id}",
    response_model=HistoryResponse,
    summary="Historical sensor data",
    description=(
        "Return historical sensor readings for *user_id*, filtered by "
        "a time period: ``day``, ``week`` (default), or ``month``."
    ),
)
async def get_history(
    user_id: str,
    period: str = Query("week", pattern="^(day|week|month)$"),
    dashboard: DashboardService = Depends(get_dashboard_service),
) -> HistoryResponse:
    """Fetch historical sensor readings within a time window."""
    try:
        result = await dashboard.get_history(user_id, period)
    except Exception as exc:
        logger.exception("History fetch failed for %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch history",
        ) from exc

    logger.info(
        "History returned for user=%s period=%s (%s readings)",
        user_id, period, result.total,
    )
    return result
