"""Emergency alert request / response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class EmergencyAlertInput(BaseModel):
    """Payload for triggering an emergency alert (from the mobile app)."""

    user_id: str
    # Keep values below 40 valid so the documented bradycardia rule can fire.
    heart_rate: int | None = Field(None, ge=20, le=250)
    spo2: float | None = Field(None, ge=75, le=100)
    latitude: float | None = None
    longitude: float | None = None
    message: str | None = None
    timestamp: datetime | None = None


class EmergencyAlertOutput(BaseModel):
    """Confirmation returned after an emergency alert is processed."""

    id: int = Field(..., description="Database primary key")
    user_id: str
    status: str = "active"
    acknowledged: bool = True


class EmergencyContactInput(BaseModel):
    """Payload to add an emergency contact."""

    user_id: str
    name: str = Field(..., min_length=1, max_length=128)
    relationship: str = Field(..., min_length=1, max_length=64)
    phone: str = Field(..., min_length=5, max_length=32)
    email: str | None = None


class EmergencyContactOutput(EmergencyContactInput):
    """Contact representation returned to client."""

    id: int
    created_at: datetime

