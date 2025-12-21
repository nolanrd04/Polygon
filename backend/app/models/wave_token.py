from typing import List, Dict, Any
from datetime import datetime, timedelta
from pydantic import Field
from app.models.base import BaseMongoModel, PyObjectId


class WaveValidationToken(BaseMongoModel):
    """Token for validating wave completion submissions"""

    user_id: PyObjectId = Field(...)
    wave_number: int = Field(..., ge=1)
    token: str = Field(...)  # JWT-style token
    expires_at: datetime = Field(...)

    # Expected game state
    expected_player_stats: Dict[str, Any] = Field(...)
    allowed_upgrades: List[str] = Field(default_factory=list)  # upgrade IDs
    offered_upgrades: List[str] = Field(default_factory=list)  # Upgrades offered this wave
    seed: int = Field(...)

    # Validation tracking
    used: bool = Field(default=False)
    used_at: datetime | None = Field(default=None)

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "wave_number": 5,
                "token": "eyJhbGc...",
                "expires_at": "2024-01-01T00:00:30",
                "expected_player_stats": {
                    "health": 100,
                    "max_health": 100,
                    "speed": 200,
                    "damage": 10
                },
                "allowed_upgrades": ["health_1", "speed_1"],
                "offered_upgrades": ["damage_1", "fire_rate_1", "pierce_1"],
                "seed": 12345,
                "used": False
            }
        }

    @staticmethod
    def create_token_string(user_id: str, wave_number: int) -> str:
        """Create a unique token string"""
        import hashlib
        import secrets

        nonce = secrets.token_hex(16)
        data = f"{user_id}:{wave_number}:{nonce}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()

    @classmethod
    def create_for_wave(
        cls,
        user_id: PyObjectId,
        wave_number: int,
        player_stats: Dict[str, Any],
        current_upgrades: List[str],
        offered_upgrades: List[str],
        seed: int,
        expiry_seconds: int = 30
    ) -> "WaveValidationToken":
        """Create a new wave validation token"""
        token_string = cls.create_token_string(str(user_id), wave_number)
        expires_at = datetime.utcnow() + timedelta(seconds=expiry_seconds)

        return cls(
            user_id=user_id,
            wave_number=wave_number,
            token=token_string,
            expires_at=expires_at,
            expected_player_stats=player_stats,
            allowed_upgrades=current_upgrades,
            offered_upgrades=offered_upgrades,
            seed=seed
        )

    def is_valid(self) -> bool:
        """Check if token is still valid (only checks if used, not expiry time)"""
        return not self.used

    def mark_used(self):
        """Mark token as used"""
        self.used = True
        self.used_at = datetime.utcnow()
