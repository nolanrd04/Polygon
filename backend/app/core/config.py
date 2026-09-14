import json
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


# The backend's copy of the game version. frontend/version.json is the source
# of truth (vite.config.ts inlines it as __GAME_VERSION__); this copy is
# regenerated from it by scripts/version_sync.py, the same way the backend's
# upgrade/enemy/difficulty data mirrors the frontend's. Two files rather than
# one shared file because frontend and backend deploy separately - neither can
# reach up to the repo root at runtime.
#
# A committed file rather than .env: .env is gitignored here, so a version read
# from one would silently fall back to a placeholder in CI and on the host.
VERSION_FILE = Path(__file__).resolve().parents[2] / "version.json"


def _read_version() -> str:
    try:
        with open(VERSION_FILE) as f:
            return json.load(f)["version"]
    except (OSError, ValueError, KeyError):
        # Deliberately obvious rather than a plausible-looking number: a run
        # stamped 0.0.0-unknown in the analytics is a broken checkout, not a
        # release to compare balance data against.
        return "0.0.0-unknown"


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "polygon_game"

    # JWT — no default: an app-wide secret must never ship with an insecure fallback.
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # CORS — comma-separated list of allowed origins
    cors_origins: str = "http://localhost:3000"

    # App
    debug: bool = True

    # Game version, from version.json. Overridable by a GAME_VERSION env var
    # for one-off builds, but the file is the source of truth.
    game_version: str = _read_version()

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. "
                'Generate one with: python3 -c "import secrets; print(secrets.token_hex(32))"'
            )
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
