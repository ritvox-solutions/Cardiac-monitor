"""Emergency alert and contacts endpoints.

Provides routes to trigger alerts, list user alerts, resolve alerts,
and manage emergency contacts in PostgreSQL.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_emergency_service
from app.core.logger import setup_logger
from app.schemas.emergency import (
    EmergencyAlertInput,
    EmergencyAlertOutput,
    EmergencyContactInput,
    EmergencyContactOutput,
)
from app.services.emergency_service import EmergencyService

logger = setup_logger(__name__)
router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.post(
    "",
    response_model=EmergencyAlertOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger emergency alert",
    description="Create an emergency alert with vital readings and location.",
)
async def create_emergency_alert(
    payload: EmergencyAlertInput,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> EmergencyAlertOutput:
    """Create and persist an emergency alert."""
    try:
        result = await emergency.create_alert(payload)
    except Exception as exc:
        logger.exception("Failed to create emergency alert")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process emergency alert",
        ) from exc

    logger.info(
        "Emergency alert stored: user=%s alert_id=%s",
        payload.user_id,
        result.id,
    )
    return result


@router.get(
    "/alerts/{user_id}",
    response_model=list[dict],
    summary="Get user alerts",
    description="Retrieve all emergency alerts triggered for a given user.",
)
async def get_user_alerts(
    user_id: str,
    limit: int = 20,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> list[dict]:
    """Retrieve alerts history for a user."""
    return await emergency.get_user_alerts(user_id=user_id, limit=limit)


@router.post(
    "/resolve/{alert_id}",
    status_code=status.HTTP_200_OK,
    summary="Resolve alert",
    description="Mark an emergency alert as resolved.",
)
async def resolve_emergency_alert(
    alert_id: int,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> dict:
    """Resolve an active emergency alert."""
    await emergency.resolve_alert(alert_id)
    return {"id": alert_id, "status": "resolved"}


@router.get(
    "/contacts/{user_id}",
    response_model=list[EmergencyContactOutput],
    summary="Get emergency contacts",
    description="Retrieve list of emergency contacts registered for a user.",
)
async def get_emergency_contacts(
    user_id: str,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> list[EmergencyContactOutput]:
    """Get emergency contacts for user."""
    contacts = await emergency.get_user_contacts(user_id)
    return [
        EmergencyContactOutput(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            relationship=c.relationship,
            phone=c.phone,
            email=c.email,
            created_at=c.created_at,
        )
        for c in contacts
    ]


@router.post(
    "/contacts",
    response_model=EmergencyContactOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Add emergency contact",
    description="Add a new contact person for emergency notifications.",
)
async def add_emergency_contact(
    payload: EmergencyContactInput,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> EmergencyContactOutput:
    """Add emergency contact."""
    try:
        contact = await emergency.add_contact(payload)
        return EmergencyContactOutput(
            id=contact.id,
            user_id=contact.user_id,
            name=contact.name,
            relationship=contact.relationship,
            phone=contact.phone,
            email=contact.email,
            created_at=contact.created_at,
        )
    except Exception as exc:
        logger.exception("Failed to add emergency contact")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add contact",
        ) from exc


@router.delete(
    "/contacts/{contact_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove emergency contact",
    description="Delete an emergency contact by ID.",
)
async def remove_emergency_contact(
    contact_id: int,
    emergency: EmergencyService = Depends(get_emergency_service),
) -> dict:
    """Remove emergency contact."""
    await emergency.remove_contact(contact_id)
    return {"deleted": True, "id": contact_id}
