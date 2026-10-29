"""Service for managing emergency alerts."""

from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import setup_logger
from app.models.postgres_models import AlertORM, EmergencyContactORM
from app.schemas.emergency import (
    EmergencyAlertInput,
    EmergencyAlertOutput,
    EmergencyContactInput,
    EmergencyContactOutput,
)

logger = setup_logger(__name__)


class EmergencyService:
    """CRUD operations for the ``alerts`` table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_alert(self, payload: EmergencyAlertInput) -> EmergencyAlertOutput:
        """Create a new emergency alert and store it in PostgreSQL.

        Parameters
        ----------
        payload : EmergencyAlertInput
            Alert details from the mobile app or ESP32.

        Returns
        -------
        EmergencyAlertOutput
            Confirmation with the alert id.
        """
        now = payload.timestamp or datetime.now(timezone.utc)

        alert = AlertORM(
            user_id=payload.user_id,
            alert_type="emergency",
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            latitude=payload.latitude,
            longitude=payload.longitude,
            message=payload.message,
            status="active",
            created_at=now,
        )

        self._session.add(alert)
        await self._session.commit()
        await self._session.refresh(alert)

        logger.info(
            "Emergency alert created: user=%s alert_id=%s",
            payload.user_id,
            alert.id,
        )

        return EmergencyAlertOutput(
            id=alert.id,
            user_id=payload.user_id,
            status="active",
            acknowledged=True,
        )

    async def get_user_alerts(
        self,
        user_id: str,
        limit: int = 20,
        only_active: bool = False,
    ) -> list[dict]:
        """Return alerts for a user, newest first."""
        stmt = (
            select(AlertORM)
            .where(AlertORM.user_id == user_id)
            .order_by(AlertORM.created_at.desc())
            .limit(limit)
        )
        if only_active:
            stmt = stmt.where(AlertORM.status == "active")

        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [_alert_to_dict(r) for r in rows]

    async def resolve_alert(self, alert_id: int) -> bool:
        """Mark an alert as resolved."""
        await self._session.execute(
            update(AlertORM)
            .where(AlertORM.id == alert_id)
            .values(status="resolved")
        )
        await self._session.commit()
        return True

    async def get_user_contacts(self, user_id: str) -> list[EmergencyContactORM]:
        """Fetch all emergency contacts for a given user."""
        stmt = (
            select(EmergencyContactORM)
            .where(EmergencyContactORM.user_id == user_id)
            .order_by(EmergencyContactORM.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def add_contact(self, payload: EmergencyContactInput) -> EmergencyContactORM:
        """Add a new emergency contact."""
        contact = EmergencyContactORM(
            user_id=payload.user_id,
            name=payload.name,
            relationship=payload.relationship,
            phone=payload.phone,
            email=payload.email,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(contact)
        await self._session.commit()
        await self._session.refresh(contact)
        return contact

    async def remove_contact(self, contact_id: int) -> bool:
        """Delete an emergency contact by ID."""
        stmt = delete(EmergencyContactORM).where(EmergencyContactORM.id == contact_id)
        await self._session.execute(stmt)
        await self._session.commit()
        return True


def _alert_to_dict(alert: AlertORM) -> dict:
    return {c.name: getattr(alert, c.name) for c in alert.__table__.columns}
