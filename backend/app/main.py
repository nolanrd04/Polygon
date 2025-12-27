from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, saves, users, waves, runs
from app.core.database import connect_to_mongo, close_mongo_connection, get_database
from app.repositories.user_repository import UserRepository
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.repositories.run_repository import RunRepository

app = FastAPI(
    title="Polygon Game API",
    description="Backend API for the Polygon survival/tower-defense game",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(saves.router, prefix="/api/saves", tags=["Game Saves"])
app.include_router(waves.router, prefix="/api/waves", tags=["Wave Validation"])
app.include_router(runs.router, prefix="/api/runs", tags=["Run Management"])


@app.on_event("startup")
async def startup():
    await connect_to_mongo()
    # Create indexes for collections
    db = get_database()
    from app.repositories.game_save_repository import GameSaveRepository

    user_repo = UserRepository(db)
    player_stats_repo = PlayerStatsRepository(db)
    game_save_repo = GameSaveRepository(db)

    await user_repo.create_indexes()
    await player_stats_repo.create_indexes()
    await game_save_repo.create_indexes()
    await RunRepository.create_indexes(db)


@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()


@app.get("/")
async def root():
    return {"message": "Polygon Game API", "version": "0.1.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
