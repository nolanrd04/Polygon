from typing import Dict

from app.core.difficulty.base import Difficulty
from app.core.difficulty.normal import NormalDifficulty

DIFFICULTIES: Dict[str, Difficulty] = {
    "normal": NormalDifficulty(),
}


def get_difficulty(difficulty_id: str) -> Difficulty:
    return DIFFICULTIES.get(difficulty_id, DIFFICULTIES["normal"])
