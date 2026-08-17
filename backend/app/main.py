from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.api import auth, saves, users, waves
from app.core.config import settings
from app.core.limiter import limiter
from app.core.database import connect_to_mongo, close_mongo_connection, get_database
from app.repositories.user_repository import UserRepository
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.repositories.token_blacklist_repository import TokenBlacklistRepository

app = FastAPI(
    title="Polygon Game API",
    description="Backend API for the Polygon survival/tower-defense game",
    version="0.2.3"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Flatten pydantic's list-of-errors shape into a single string the frontend can render directly."""
    msg = exc.errors()[0]["msg"]
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return JSONResponse(status_code=422, content={"detail": msg})

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(saves.router, prefix="/api/saves", tags=["Game Saves"])
app.include_router(waves.router, prefix="/api/waves", tags=["Wave Validation"])


@app.on_event("startup")
async def startup():
    await connect_to_mongo()
    # Create indexes for collections
    db = get_database()
    from app.repositories.game_save_repository import GameSaveRepository
    from app.repositories.game_run_repository import GameRunRepository

    user_repo = UserRepository(db)
    player_stats_repo = PlayerStatsRepository(db)
    game_save_repo = GameSaveRepository(db)
    game_run_repo = GameRunRepository(db)
    token_blacklist_repo = TokenBlacklistRepository(db)

    await user_repo.create_indexes()
    await player_stats_repo.create_indexes()
    await game_save_repo.create_indexes()
    await game_run_repo.create_indexes()
    await token_blacklist_repo.create_indexes()


@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()


@app.get("/")
async def root():
    return {"message": "Polygon Game API", "version": "0.2.3"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
