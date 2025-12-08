from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, saves, users
from app.core.database import create_tables

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


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/")
async def root():
    return {"message": "Polygon Game API", "version": "0.1.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
