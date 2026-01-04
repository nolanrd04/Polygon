from datetime import timedelta
import logging
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import ValidationError
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.models.user import User
from app.models.player_stats import PlayerStats

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication-related business logic"""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(database)
        self.player_stats_repo = PlayerStatsRepository(database)

    async def register_user(
        self,
        username: str,
        first_name: str,
        last_name: str,
        password: str
    ) -> User:
        """Register a new user and create their player stats"""
        # Check if username exists
        if await self.user_repo.username_exists(username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

        # Create user with validation error handling
        try:
            user = User(
                username=username,
                first_name=first_name,
                last_name=last_name,
                hashed_password=get_password_hash(password)
            )
        except ValidationError as e:
            # Extract the first error message
            error_msg = e.errors()[0]['msg']
            # Remove "Value error, " prefix if present
            error_msg = error_msg.replace('Value error, ', '')
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )

        created_user = await self.user_repo.create(user)

        # Create initial player stats
        player_stats = PlayerStats(user_id=created_user.id)
        await self.player_stats_repo.create(player_stats)

        return created_user

    async def authenticate_user(self, username: str, password: str) -> str:
        """Authenticate user and return access token"""
        logger.info(f"Login attempt for username: {username}")
        
        user = await self.user_repo.find_by_username(username)

        if not user:
            logger.warning(f"Login failed: User '{username}' not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not verify_password(password, user.hashed_password):
            logger.warning(f"Login failed: Invalid password for user '{username}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"Login successful for user '{username}'")
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        return access_token

    async def check_username_availability(self, username: str) -> bool:
        """Check if a username is available (for real-time validation)"""
        return not await self.user_repo.username_exists(username)
