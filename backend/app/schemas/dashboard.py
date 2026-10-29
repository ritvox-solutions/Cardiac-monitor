"""Dashboard and history response schemas."""

from datetime import datetime

from pydantic import BaseModel


class VitalSnapshot(BaseModel):
    """A single vital-signs reading for history views."""

    heart_rate: int
    spo2: float
    heart_rate_variability: int
    timestamp: datetime | None = None


class DashboardResponse(BaseModel):
    """Aggregated dashboard data for a single user."""

    user_id: str
    latest_heart_rate: int | None = None
    latest_spo2: float | None = None
    current_risk_level: str | None = None
    current_risk_score: float | None = None
    current_dcsi: float | None = None
    latest_prediction: dict | None = None
    recent_readings: list[VitalSnapshot] = []
    history_count: int = 0


class HistoryResponse(BaseModel):
    """Paginated historical sensor data for a user."""

    user_id: str
    period: str
    readings: list[VitalSnapshot] = []
    total: int = 0
