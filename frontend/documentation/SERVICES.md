# Services

Services live in `frontend/src/game/services/`. They handle persistence, backend communication, and offline play. The configured Axios instance lives in `frontend/src/config/axios.ts`.

---

## Axios (config/axios.ts)

A configured `axios` instance shared by all services.

**Request interceptor:** Automatically injects `Authorization: Bearer <token>` from `localStorage.token` on every outgoing request.

**Response interceptor:** On a `401 Unauthorized` response, clears `localStorage.token` and redirects to `/login` — unless the request was to an auth endpoint (`/auth/login`, `/auth/register`), which handles its own error.

---

## SaveTypes.ts

TypeScript interfaces and enums that define the shape of all save data, both frontend-facing and backend-facing (snake_case variants). This file has no runtime behaviour — it is documentation for the data contract between the client and server.

### Save categories

| Category | When saved | Blocked after death? | Endpoint |
|----------|------------|----------------------|----------|
| `GameStats` | Wave completion | Yes | `POST /api/saves/game-stats` |
| `Points` | Wave completion, upgrade purchase, death | No | `POST /api/saves/points` |
| `Upgrades` | Upgrade purchase | No (mid-wave is blocked) | `POST /api/saves/upgrades` |
| `DeathState` | Once on death | N/A (written once) | `POST /api/saves/death-state` |
| `PlayerState` | Bundled with GameStats | Yes | (no separate endpoint) |

### Key types

- `UpgradeEntry` – `{ upgradeId, purchasedAt, waveNumber }`. Order is preserved to allow correct stat reconstruction on load.
- `DeathFrozenState` – `{ frozenAt, wavesCompleted, enemiesKilled, timeSurvived, pointsAtDeath }`. Immutable once set.
- `FullGameSave` – composite of all five categories plus `canContinue` and `lastSavedAt`. Used for `GET /api/saves/full`.
- `WaveSnapshot` – anti-cheat token + pre-wave locked state.

---

## SaveManager

**File:** `SaveManager.ts`  
**Export:** `SaveManager` (singleton)

Coordinates all backend save operations. Every method has a guard that checks `isInitialized` before writing to prevent overwriting a loaded save with empty data.

### Session initialization

| Method | Description |
|--------|-------------|
| `initialize()` | Called by `GameManager.reset()` on new game. Clears death state and upgrade history. |
| `restoreFromLoad(upgradeHistory)` | Called after loading a saved game. Preserves the upgrade history for correct future saves. |

### Upgrade tracking

| Method | Description |
|--------|-------------|
| `recordUpgradePurchase(upgradeId, wave)` | Appends an `UpgradeEntry` to the in-memory history. Call this every time the player buys an upgrade. |
| `getUpgradeHistory()` | Returns the full ordered `UpgradesSaveData` struct. |
| `getUpgradeIds()` | Returns just the IDs in purchase order. |

### Death state management

| Method | Description |
|--------|-------------|
| `freezeDeathState()` | Captures the exact moment of death (wave, kills, time, points). Can only run once per session; subsequent calls return the cached value. Called immediately in `GameManager.takeDamage()` before anything else. |
| `isDeathStateFrozen()` | Whether death has occurred. |
| `getDeathState()` | Returns the frozen state or `null`. |

### Individual save methods

Each save method has guards that block inappropriate saves:

| Method | Guards |
|--------|--------|
| `saveGameStats()` | Blocked if dead or wave is active |
| `savePoints()` | Blocked if wave is active (prevents mid-wave point farming) |
| `saveUpgrades()` | Blocked if wave is active (unless dead) |
| `saveDeathState()` | Requires death state to exist |

### Composite save triggers

| Method | Saves |
|--------|-------|
| `saveOnWaveComplete()` | GameStats + Points + Upgrades (if alive) |
| `saveOnDeath()` | DeathState + Points + Upgrades |
| `saveOnUpgradePurchase()` | Points + Upgrades |
| `saveOnQuit()` | All (if alive) or Points + Upgrades (if dead) |

### Load operations

| Method | Description |
|--------|-------------|
| `loadFullGame()` | `GET /api/saves/full`. Returns `null` if no save exists or `can_continue` is `false`. Transforms snake_case backend fields to camelCase. |
| `hasSavedGame()` | `GET /api/saves/validate-load`. Returns `{ exists, wave }`. |
| `restoreGameState(savedData)` | Applies a loaded `FullGameSave` to `GameManager` — sets wave, player stats, applied upgrades, and seed. Also calls `restoreFromLoad()`. |

---

## WaveValidation

**File:** `WaveValidation.ts`  
**Export:** `waveValidation` (singleton of `WaveValidationService`)

Manages per-wave communication with the backend: starts waves (gets a token + offered upgrades), records gameplay telemetry, and submits wave completion for server-side validation.

In **offline/sandbox mode** (no `localStorage.token`) or when the player is dead, all backend calls are silently skipped and local logic replaces them.

### Wave lifecycle

| Method | Online behavior | Offline behavior |
|--------|----------------|-----------------|
| `startWave(waveNumber, seed)` | `POST /api/waves/start` → gets `waveToken` and `offeredUpgrades` | Generates 3 local upgrades weighted by rarity; returns cached offers |
| `completeWave(waveNumber)` | `POST /api/waves/complete` with telemetry payload | Returns `{ success: true }` immediately |
| `selectUpgrade(upgradeId, wave)` | `POST /api/waves/select-upgrade` → returns authoritative new points | Deducts cost locally, returns new points |
| `rerollUpgrades(wave, cost)` | `POST /api/waves/reroll` → returns new offered upgrades + points | Deducts cost locally, generates 3 new random upgrades |

### Telemetry collected per wave

| Field | Description |
|-------|-------------|
| `frameSamples` | Player position/velocity/health sampled every 30 frames (up to 200 samples, sub-sampled if over limit) |
| `enemyDeaths` | Type, position, and frame of each enemy kill |
| `totalKills` | Kill count for the wave |
| `totalDamage` | Total damage dealt to enemies |
| `damageTaken` | Total damage the player received |

Recording is blocked after player death to prevent dead-state data from inflating or corrupting validation.

---

## LocalSaveManager

**File:** `LocalSaveManager.ts`

Pure functions for the sandbox copy-paste save system. Requires no backend.

| Function | Description |
|----------|-------------|
| `exportLocalSave()` | Builds a `FullGameSave` from current `SaveManager` and `GameManager` state, serializes it to a JSON string. |
| `importLocalSave(raw)` | Parses and validates a JSON string. Returns `null` on parse errors or missing required fields. |
| `applyLocalSave(save)` | Calls `GameManager.reset()` then `SaveManager.restoreGameState(save)` to apply the loaded data to the running game. |
| `summarizeLocalSave()` | Returns a short human-readable summary: `"Wave N • M upgrades • P points"`. |

These functions use the same `FullGameSave` shape as the backend save so that `SaveManager.restoreGameState()` works without modification for both online and offline loads.
