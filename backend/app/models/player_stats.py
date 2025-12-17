from typing import Optional, Dict, Any, List
from pydantic import Field
from app.models.base import BaseMongoModel, PyObjectId


class PlayerStats(BaseMongoModel):
    """Player statistics and game progress model"""

    user_id: PyObjectId = Field(...)
    level: int = Field(default=1, ge=1)
    experience: int = Field(default=0, ge=0)
    highest_wave: int = Field(default=0, ge=0)
    total_kills: int = Field(default=0, ge=0)
    total_damage_dealt: int = Field(default=0, ge=0)
    games_played: int = Field(default=0, ge=0)
    games_won: int = Field(default=0, ge=0)
    total_playtime_seconds: int = Field(default=0, ge=0)

    # Current run data (for active game sessions)
    current_wave: int = Field(default=0, ge=0)
    current_upgrades: List[str] = Field(default_factory=list)  # Applied upgrade IDs
    current_seed: int | None = Field(default=None)

    # Custom game data (flexible for future additions)
    custom_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "level": 5,
                "experience": 1250,
                "highest_wave": 15,
                "total_kills": 532,
                "games_played": 23,
                "games_won": 7,
                "total_playtime_seconds": 7200,
                "custom_data": {
                    "favorite_weapon": "laser",
                    "achievements": ["first_win", "wave_10"]
                }
            }
        }


class PlayerStatsResponse(BaseMongoModel):
    """Player statistics response model"""

    user_id: PyObjectId
    level: int
    experience: int
    highest_wave: int
    total_kills: int
    games_played: int
    games_won: int
    total_playtime_seconds: int
    custom_data: Optional[Dict[str, Any]] = None

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439012",
                "user_id": "507f1f77bcf86cd799439011",
                "level": 5,
                "experience": 1250,
                "highest_wave": 15,
                "total_kills": 532,
                "games_played": 23,
                "games_won": 7,
                "total_playtime_seconds": 7200,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
