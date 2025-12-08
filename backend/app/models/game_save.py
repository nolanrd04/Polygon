from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class GameSave(Base):
    __tablename__ = "game_saves"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    slot = Column(Integer, default=1)  # Multiple save slots per user

    # Game state
    wave = Column(Integer, default=1)
    points = Column(Integer, default=0)
    seed = Column(Integer)

    # Player stats (stored as JSON for flexibility)
    player_stats = Column(JSON, default={
        "health": 100,
        "maxHealth": 100,
        "speed": 200,
        "polygonSides": 3
    })

    # Upgrades applied (list of upgrade IDs)
    applied_upgrades = Column(JSON, default=[])

    # Attack stats per attack type
    attack_stats = Column(JSON, default={
        "bullet": {
            "damage": 10,
            "speed": 400,
            "cooldown": 200,
            "size": 1,
            "pierce": 0
        }
    })

    # Unlocked attacks
    unlocked_attacks = Column(JSON, default=["bullet"])

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="game_saves")
