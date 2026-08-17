# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Python FastAPI backend for **Polygon**, a web-based action/tower-defense game where a polygon-shaped player fights waves of geometric enemies. Handles authentication, game state, anti-cheat validation, and progression.

**Stack:** Python 3, FastAPI, MongoDB (Motor async driver), JWT auth (python-jose), bcrypt, Pydantic v2

## Commands

```bash
# Start MongoDB
docker-compose up -d

# Install dependencies
pip install -r requirements.txt

# Run dev server (http://localhost:8000, docs at /docs)
uvicorn app.main:app --reload

# Health check
curl http://localhost:8000/api/health
```

No test framework or linter is currently configured.

## Architecture

Layered architecture with clear separation of concerns:

```
app/api/        → FastAPI route handlers (request validation, auth dependency injection)
app/services/   → Business logic (auth, wave validation, run management)
app/repositories/ → Data access (generic BaseRepository[T] with CRUD, model-specific repos)
app/models/     → Pydantic models (BaseMongoModel with auto timestamps, PyObjectId for MongoDB)
app/core/       → Config, database connection, security utils, game data definitions
```

**Entry point:** `app/main.py` — sets up FastAPI app, CORS (localhost:3000), routers, MongoDB connection lifecycle, and index creation on startup.

**API routes are prefixed:** `/api/auth`, `/api/users`, `/api/saves`, `/api/waves`

## Key Systems

### Authentication
JWT-based stateless auth. Passwords hashed with bcrypt. Protected endpoints use `Depends(get_current_user)` from `app/core/security.py`. Tokens expire in 24 hours.

### Wave Validation & Anti-Cheat
The core gameplay loop. Located primarily in `app/services/wave_service.py`:
1. Client calls `/api/waves/start` → server generates a 30-second one-time token with expected player stats
2. Client plays the wave, collecting frame samples
3. Client calls `/api/waves/complete` with frame data → server validates:
   - Token validity (not expired, not reused)
   - Movement speed (distance vs speed * time with 10% tolerance)
   - Damage dealt (within 20% of expected minimum)
   - Kill count (within 20% of wave's enemy count)
   - Upgrade legitimacy (only allowed upgrades used)
4. Failures get flagged in `flagged_waves` collection with severity levels; critical flags auto-ban

### Upgrade System
~100 upgrades defined in `app/core/upgrade_data.py`. Each has: id, type (stat_modifier/effect/variant/ability), target (player/attack/bullet/laser), rarity (common→legendary), stackability, dependencies (`dependentOn`), and conflicts (`incompatibleWith`, `replaces`).

### Run Analytics (GameRun)
Permanent per-run balancing dataset in the `game_runs` collection (`app/models/game_run.py`, `app/repositories/game_run_repository.py`). One `GameRun` document per playthrough with one embedded `WaveSnapshot` appended per validated wave completion (damage, kills, accuracy inputs, economy, upgrades, enemy health pool, anti-cheat flag context). Unlike `GameSave` (one-per-user, deleted on new game), `GameRun` is append-only and never deleted — it exists so per-wave metrics can be graphed across hundreds of runs for balancing.

Lifecycle, all inside `wave_service.py`: created by `start_wave()`'s wave-1 branch (which also marks any stale active run `abandoned`), grown by `_record_wave_snapshot()` from `_save_game_state()`, finalized (`status="dead"`, `final_wave`, denormalized totals) on the death submission. Reroll counts reach the snapshot via `$inc` counters on the wave's own `WaveValidationToken` (same exact-token-match pattern as bundle pickups). `death_cause` exists on the model but stays `None` until a proper death system records what killed the player. There is no query API — analysis runs locally via `scripts/analyze_runs.py` (per-wave trend tables/CSV/PNG plots, survival curves, pick rates, flag-severity exclusion filters). Full documentation: `documentation/RUN_ANALYTICS.md`.

### Enemy Data
Enemy health calculations and spawn rules in `app/core/enemy_data.py`. Used by anti-cheat to validate expected kill counts and damage.

## Patterns

- **Async everywhere:** All DB operations use Motor's async driver. Services and route handlers are async.
- **Dependency injection:** Database and auth via FastAPI's `Depends()`.
- **Generic repository:** `BaseRepository[T]` in `app/repositories/base.py` provides typed CRUD. Specific repos extend it.
- **Pydantic validation:** Models enforce constraints (field lengths, ranges). Custom validators for business rules.
- **One save per user:** Enforced by unique MongoDB index on `user_id`.
- **Database indexes:** Created automatically on startup in `app/main.py`.

## Configuration

Environment variables in `.env`:
- `MONGODB_URL` — MongoDB connection string (default: `mongodb://localhost:27017`)
- `MONGODB_DATABASE` — database name (default: `polygon_game`)

JWT and other settings in `app/core/config.py`. CORS allows `http://localhost:3000` (the frontend).
