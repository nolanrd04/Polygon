from typing import List, Dict, Any, Optional
from pydantic import Field
from app.models.base import BaseMongoModel, PyObjectId


class GameSave(BaseMongoModel):
    """
    Game save model for storing current run progress - one save per user.
    This is temporary data that gets deleted when starting a new game.
    All permanent stats are stored in PlayerStats.
    """

    user_id: PyObjectId = Field(...)

    # Current run state (temporary - reset on new game)
    current_wave: int = Field(default=1, ge=1)
    current_points: int = Field(default=0, ge=0)
    seed: int = Field(...)

    # Current player stats for this run (temporary)
    current_health: int = Field(default=100, ge=0)
    current_max_health: int = Field(default=100, ge=1)
    current_speed: int = Field(default=200, ge=0)
    current_polygon_sides: int = Field(default=3, ge=3, le=8)

    # Current run kill/damage tracking (resets on new game)
    current_kills: int = Field(default=0, ge=0)
    current_damage_dealt: int = Field(default=0, ge=0)

    # Upgrades applied in this run (resets on new game)
    current_upgrades: List[str] = Field(default_factory=list)

    # Attack stats per attack type
    attack_stats: Dict[str, Any] = Field(default_factory=lambda: {
        "bullet": {
            "damage": 10,
            "speed": 400,
            "cooldown": 200,
            "size": 1,
            "pierce": 0
        }
    })

    # Unlocked attacks
    unlocked_attacks: List[str] = Field(default_factory=lambda: ["bullet"])

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "current_wave": 5,
                "current_points": 1500,
                "seed": 12345,
                "current_health": 120,
                "current_max_health": 120,
                "current_speed": 220,
                "current_polygon_sides": 4,
                "current_kills": 50,
                "current_damage_dealt": 1200,
                "current_upgrades": ["health_1", "speed_1"],
                "attack_stats": {
                    "bullet": {
                        "damage": 15,
                        "speed": 450,
                        "cooldown": 180,
                        "size": 1.2,
                        "pierce": 1
                    }
                },
                "unlocked_attacks": ["bullet", "laser"]
            }
        }


class GameSaveResponse(BaseMongoModel):
    """Game save response model"""

    user_id: PyObjectId
    current_wave: int
    current_points: int
    seed: int
    current_health: int
    current_max_health: int
    current_speed: int
    current_polygon_sides: int
    current_kills: int
    current_damage_dealt: int
    current_upgrades: List[str]
    attack_stats: Dict[str, Any]
    unlocked_attacks: List[str]
