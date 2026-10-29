"""Sensor-data request / response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class SensorDataInput(BaseModel):
    """Live sensor reading received from the ESP32 wearable device."""

    user_id: str = Field(..., description="Unique patient identifier")
    # Transport readings must allow emergency bradycardia.  The ML endpoint
    # keeps its narrower model-safe range in PredictionInput.
    heart_rate: int = Field(..., ge=20, le=250)
    spo2: float = Field(..., ge=75, le=100)
    heart_rate_variability: int = Field(..., ge=10, le=130)
    activity_level: str | None = None
    sleep_hours: float | None = Field(None, ge=2, le=12)
    stress_level: int | None = Field(None, ge=0, le=100)
    latitude: float | None = None
    longitude: float | None = None
    timestamp: datetime | None = None


class SensorDataOutput(BaseModel):
    """Confirmation returned after storing a sensor reading."""

    id: int = Field(..., description="Database primary key")
    user_id: str
    heart_rate: int
    spo2: float
    stored: bool = True
    prediction: dict | None = None
