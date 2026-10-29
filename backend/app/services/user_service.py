"""Service for user profile management."""

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import setup_logger
from app.models.postgres_models import UserORM
from app.schemas.user import UserProfileInput

logger = setup_logger(__name__)


class UserService:
    """CRUD operations for the ``users`` table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_user(self, user_id: str) -> UserORM | None:
        """Fetch user by user_id string."""
        stmt = select(UserORM).where(UserORM.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_user(self, payload: UserProfileInput) -> UserORM:
        """Create or update a user profile."""
        user = await self.get_user(payload.user_id)
        now = datetime.now(timezone.utc)

        if user is None:
            user = UserORM(
                user_id=payload.user_id,
                age=payload.age,
                gender=payload.gender,
                height_cm=payload.height_cm,
                weight_kg=payload.weight_kg,
                bmi=payload.bmi,
                smoking=payload.smoking,
                diabetes=payload.diabetes,
                hypertension=payload.hypertension,
                created_at=now,
            )
            self._session.add(user)
            logger.info("Created new user profile: %s", payload.user_id)
        else:
            user.age = payload.age
            user.gender = payload.gender
            user.height_cm = payload.height_cm
            user.weight_kg = payload.weight_kg
            user.bmi = payload.bmi
            user.smoking = payload.smoking
            user.diabetes = payload.diabetes
            user.hypertension = payload.hypertension
            user.updated_at = now
            logger.info("Updated existing user profile: %s", payload.user_id)

        await self._session.commit()
        await self._session.refresh(user)
        return user
