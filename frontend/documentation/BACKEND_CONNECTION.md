# Backend Connection

This document covers how the frontend communicates with the backend: the Axios configuration, authentication, and every API endpoint the game calls.

---

## Axios instance

**File:** `frontend/src/config/axios.ts`

All HTTP requests go through a single shared Axios instance exported as the default from this file. It has two interceptors:

**Request interceptor** — reads `localStorage.getItem('token')` and, if present, sets `Authorization: Bearer <token>` on every outgoing request. No manual token management is required at call sites.

**Response interceptor** — on a 401 response, clears the token from `localStorage` and redirects to `/login` via `window.location.href`. Auth endpoints (`/auth/login`, `/auth/register`) are exempted from this redirect so they can handle their own error display.

The instance also exposes `isAxiosError` from the Axios base so callers can type-narrow errors without importing from Axios directly.

---

## Authentication

Tokens are stored in `localStorage` under the key `token`. They are set by the auth pages after a successful login or registration response. The Axios interceptor picks them up automatically — no context or prop drilling required.

A missing token is treated as offline/sandbox mode throughout the game (see [OFFLINE_MODE.md](OFFLINE_MODE.md)).

---

## API endpoints

### Wave lifecycle

| Endpoint | Method | Caller | Purpose |
|----------|--------|--------|---------|
| `/api/waves/start` | POST | `WaveValidationService.startWave()` | Begin a wave — returns a short-lived token and the upgrade pool for that wave |
| `/api/waves/complete` | POST | `WaveValidationService.completeWave()` | Submit telemetry for validation — requires the wave token |
| `/api/waves/select-upgrade` | POST | `WaveValidationService.selectUpgrade()` | Purchase an upgrade — backend deducts cost and returns the new authoritative point total |
| `/api/waves/reroll` | POST | `WaveValidationService.rerollUpgrades()` | Reroll the upgrade pool — backend deducts cost and returns a fresh pool + new point total |

#### `/api/waves/start` request body
```json
{
  "wave_number": 5,
  "seed": 1234567890
}
```

#### `/api/waves/start` response
```json
{
  "token": "<jwt-wave-token>",
  "offered_upgrades": [...],
  "expires_in": 600
}
```

The `token` field is stored in `WaveValidationService.waveToken` and must be included in the matching `completeWave` call.

#### `/api/waves/complete` request body
```json
{
  "token": "<wave-token>",
  "wave": 5,
  "kills": 42,
  "total_damage": 18500,
  "current_health": 80,
  "damage_taken": 20,
  "frame_samples": [...],
  "enemy_deaths": [...],
  "upgrades_used": ["bullet_damage_1", "bullet_speed_1"]
}
```

`frame_samples` are sub-sampled (every other entry kept) if the array exceeds 200 entries to cap payload size. Each sample has `{ frame, timestamp, player: { x, y, vx, vy, health } }`.

`enemy_deaths` are `{ type, x, y, frame }` objects recorded whenever `WaveValidationService.recordEnemyDeath()` is called by `CollisionManager`.

---

### Save CRUD

All save endpoints require `Authorization: Bearer <token>`.

| Endpoint | Method | Caller | Purpose |
|----------|--------|--------|---------|
| `/api/saves/game-stats` | POST | `SaveManager.saveGameStats()` | Persist wave number, kills, seed, time survived, and player state |
| `/api/saves/points` | POST | `SaveManager.savePoints()` | Persist current point total |
| `/api/saves/upgrades` | POST | `SaveManager.saveUpgrades()` | Persist ordered upgrade purchase history |
| `/api/saves/death-state` | POST | `SaveManager.saveDeathState()` | Write the immutable death snapshot (waves completed, enemies killed, time survived, points at death) |
| `/api/saves/full` | GET | `SaveManager.loadFullGame()` | Load the complete save; returns `null`-equivalent if no save or `can_continue = false` |
| `/api/saves/validate-load` | GET | `SaveManager.hasSavedGame()` | Lightweight check for save existence and continuability |
| `/api/saves/` | DELETE | `MainMenu` (new game flow) | Wipe the existing save before starting fresh |

#### Save endpoint request bodies

`/api/saves/game-stats`
```json
{
  "current_wave": 5,
  "current_kills": 42,
  "seed": 1234567890,
  "time_survived": 180,
  "current_health": 80,
  "current_max_health": 100,
  "current_speed": 200,
  "current_polygon_sides": 4,
  "unlocked_attacks": ["bullet"]
}
```

`/api/saves/upgrades`
```json
{
  "purchase_history": [
    { "upgrade_id": "bullet_damage_1", "purchased_at": 1714000000000, "wave_number": 2 }
  ]
}
```

`/api/saves/death-state`
```json
{
  "frozen_at": 1714000000000,
  "waves_completed": 4,
  "enemies_killed": 38,
  "time_survived": 175,
  "points_at_death": 50
}
```

#### `/api/saves/full` response shape (backend snake_case)
```json
{
  "can_continue": true,
  "last_saved_at": 1714000000000,
  "game_stats": { "current_wave": 5, "current_kills": 42, "seed": ..., "time_survived": 180 },
  "points": { "current_points": 120 },
  "upgrades": { "purchase_history": [...] },
  "player_state": { "current_health": 80, "current_max_health": 100, ... },
  "death_state": null
}
```

`SaveManager.loadFullGame()` transforms this into the camelCase `FullGameSave` shape used internally. If `can_continue` is `false`, `loadFullGame()` returns `null` and the main menu shows the game-over state.

---

## Auth endpoints

Authentication is handled by the React auth pages, not the game itself. The backend routes are:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Returns a Bearer token on success |
| `/auth/register` | POST | Creates account and returns a Bearer token |

These endpoints are exempted from the 401-redirect logic in the Axios response interceptor.
