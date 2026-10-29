"""User profile routes.

Provides endpoints to create, fetch, and update patient demographic profiles.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_user_service
from app.core.logger import setup_logger
from app.schemas.user import UserProfileInput, UserProfileOutput
from app.services.user_service import UserService

logger = setup_logger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "",
    response_model=UserProfileOutput,
    status_code=status.HTTP_200_OK,
    summary="Create or update user profile",
    description="Save patient demographic and clinical characteristics to PostgreSQL.",
)
async def upsert_user_profile(
    payload: UserProfileInput,
    user_service: UserService = Depends(get_user_service),
) -> UserProfileOutput:
    """Save or update user demographic profile."""
    try:
        user = await user_service.upsert_user(payload)
        return UserProfileOutput(
            id=user.id,
            user_id=user.user_id,
            age=user.age,
            gender=user.gender,
            height_cm=user.height_cm,
            weight_kg=user.weight_kg,
            bmi=user.bmi,
            smoking=user.smoking,
            diabetes=user.diabetes,
            hypertension=user.hypertension,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
    except Exception as exc:
        logger.exception("Failed to save user profile for %s", payload.user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save user profile",
        ) from exc


@router.get(
    "/{user_id}",
    response_model=UserProfileOutput,
    summary="Get user profile",
    description="Fetch patient demographic profile by user_id string.",
)
async def get_user_profile(
    user_id: str,
    user_service: UserService = Depends(get_user_service),
) -> UserProfileOutput:
    """Retrieve user demographic profile."""
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found",
        )
    return UserProfileOutput(
        id=user.id,
        user_id=user.user_id,
        age=user.age,
        gender=user.gender,
        height_cm=user.height_cm,
        weight_kg=user.weight_kg,
        bmi=user.bmi,
        smoking=user.smoking,
        diabetes=user.diabetes,
        hypertension=user.hypertension,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
