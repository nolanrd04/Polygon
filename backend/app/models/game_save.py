from typing import List, Dict, Any, Optional
from pydantic import Field
from app.models.base import BaseMongoModel, PyObjectId


class GameSave(BaseMongoModel):
    """Game save model for storing player progress"""

    user_id: PyObjectId = Field(...)
    slot: int = Field(default=1, ge=1, le=5)  # Multiple save slots per user

    # Game state
    wave: int = Field(default=1, ge=1)
    points: int = Field(default=0, ge=0)
    seed: int = Field(...)

    # Player stats (stored as dict for flexibility)
    player_stats: Dict[str, Any] = Field(default_factory=lambda: {
        "health": 100,
        "maxHealth": 100,
        "speed": 200,
        "polygonSides": 3
    })

    # Upgrades applied (list of upgrade IDs)
    applied_upgrades: List[str] = Field(default_factory=list)

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
                "slot": 1,
                "wave": 5,
                "points": 1500,
                "seed": 12345,
                "player_stats": {
                    "health": 120,
                    "maxHealth": 120,
                    "speed": 220,
                    "polygonSides": 4
                },
                "applied_upgrades": ["health_1", "speed_1"],
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
    slot: int
    wave: int
    points: int
    seed: int
    player_stats: Dict[str, Any]
    applied_upgrades: List[str]
    attack_stats: Dict[str, Any]
    unlocked_attacks: List[str]
