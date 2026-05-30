# Online Mode

Online mode is active whenever `localStorage.getItem('token')` returns a non-empty string. In this mode the backend is authoritative for points and upgrade validation, wave telemetry is submitted for anti-cheat checks, and progress is saved across five independent categories.

---

## Wave token system

Each wave is bookended by two backend calls that form a validation envelope.

### Wave start — `POST /api/waves/start`

Called by `WaveValidationService.startWave()` at the beginning of every wave. The request includes the wave number and the map seed. The backend responds with:

- A short-lived **wave token** (JWT) that expires in a fixed window (reported in `expires_in` seconds).
- The **offered upgrades** for this wave — three upgrade objects chosen server-side using the same rarity weights as `NormalDifficulty.getRarityWeights()`.

The token is stored privately in `WaveValidationService.waveToken`. All wave stats (kills, damage dealt, damage taken, player positions) are accumulated locally during the wave.

### In-wave telemetry collection

While the wave runs, `WaveValidationService` records:

| Method | Trigger | What it stores |
|--------|---------|----------------|
| `sampleFrame(x, y, vx, vy, health)` | Every N frames from `MainScene` | `{ frame, timestamp, player }` — position and health snapshot |
| `recordEnemyDeath(type, x, y)` | `CollisionManager` on kill | `{ type, x, y, frame }` |
| `recordDamage(amount)` | Projectile hit handler | Running total of damage dealt |
| `recordDamageTaken(amount)` | `Player.takeDamage()` | Running total of damage received |

Frame samples are sub-sampled: if the array exceeds 200 entries, every other entry is dropped. This caps the payload size regardless of wave length.

All recording methods guard against post-death calls — if `GameManager.getPlayerStats().isDead` is true, they return immediately without updating state.

### Wave completion — `POST /api/waves/complete`

Called by `WaveValidationService.completeWave()` after `WaveManager` signals the wave is done. The payload includes the wave token plus all accumulated telemetry:

```
token, wave, kills, total_damage, current_health,
damage_taken, frame_samples, enemy_deaths, upgrades_used
```

The backend validates the telemetry against what it expects for the given wave, upgrade set, and seed. On success the token is cleared from `WaveValidationService` and the game proceeds to the between-wave upgrade screen.

If the call fails (network error, expired token, validation rejection), `completeWave()` returns `{ success: false, errors: [...] }`. The game currently logs the errors but continues — validation failures do not block the player.

---

## Upgrade selection

### `POST /api/waves/select-upgrade`

When the player buys an upgrade between waves, `WaveValidationService.selectUpgrade()` sends the upgrade ID and the current wave number. The backend:

1. Verifies the upgrade was in the offered pool for this wave.
2. Deducts the cost from the server-side point total.
3. Returns `{ success: true, current_points: <number> }`.

The frontend uses `current_points` from the response — not a locally computed value — to update `GameManager`. The backend is the single source of truth for the player's point balance in online mode.

### `POST /api/waves/reroll`

When the player pays to reroll the upgrade pool, the backend deducts the reroll cost and generates a new set of three upgrades server-side. The response contains `{ success: true, offered_upgrades: [...], current_points: <number> }`. `WaveValidationService` updates its `offeredUpgrades` cache and returns the new pool to the caller.

---

## Save system

**File:** `frontend/src/game/services/SaveManager.ts`

Progress is split into five independent save categories. Each has its own endpoint and its own write rules.

| Category | Endpoint | Written when |
|----------|----------|--------------|
| `GameStats` | `POST /api/saves/game-stats` | Wave complete (alive only) |
| `Points` | `POST /api/saves/points` | Wave complete, upgrade purchase, death, quit |
| `Upgrades` | `POST /api/saves/upgrades` | Wave complete, upgrade purchase, death, quit |
| `DeathState` | `POST /api/saves/death-state` | Player death (once per session) |
| `PlayerState` | bundled into game-stats | Same as GameStats |

`Points` and `Upgrades` saves are blocked during an active wave (guarded by `gameState.isWaveActive`) unless death has already been frozen — this prevents mid-wave save exploits while still allowing end-of-run upgrade purchases to be recorded.

`GameStats` saves are blocked entirely after death.

`DeathState` is write-once per session. After `SaveManager.freezeDeathState()` is called, `deathStateFrozen` is set to `true` and all subsequent calls return the cached snapshot without touching the backend.

### Composite save operations

`SaveManager` bundles individual saves into event-driven composites that fire in parallel:

| Event | Saves fired |
|-------|-------------|
| `saveOnWaveComplete()` | GameStats + Points + Upgrades |
| `saveOnDeath()` | DeathState + Points + Upgrades |
| `saveOnUpgradePurchase()` | Points + Upgrades |
| `saveOnQuit()` | GameStats + Points + Upgrades (alive) or Points + Upgrades (dead) |

All three (or two) saves in each composite use `Promise.all()` — they run concurrently.

### Initialization guard

`SaveManager.isInitialized` is `false` until `initialize()` or `restoreFromLoad()` is called. All composite save methods check this flag first and return early if it is not set. This prevents blank data from overwriting a loaded save during the few frames between scene start and save restoration.

---

## Death state and freezing

The death state is a snapshot captured at the exact moment of death, before any async code runs:

```ts
GameManager.freezeDeathState()   // called first, in GameManager itself
SaveManager.freezeDeathState()   // called next, reads GameManager's frozen snapshot
```

`GameManager.freezeDeathState()` records the kill count and wave at the instant of death. `SaveManager.freezeDeathState()` reads that snapshot so that kills from in-flight projectiles arriving after the death event are not lost.

The frozen state contains: `frozenAt`, `wavesCompleted`, `enemiesKilled`, `timeSurvived`, `pointsAtDeath`. It cannot be overwritten — the flag `deathStateFrozen` makes all subsequent freeze calls return the existing object.

---

## Loading a saved game

`SaveManager.loadFullGame()` calls `GET /api/saves/full`. If the response has `can_continue: false`, the method returns `null` and the main menu shows the game-over state instead of a continue option.

On a successful load, `SaveManager.restoreGameState(save)` applies the data:

1. Sets the wave number in `GameManager`.
2. Restores all player stats (health, max health, speed, polygon sides, points, kills, unlocked attacks).
3. Calls `GameManager.setAppliedUpgrades()` with the ordered upgrade ID list from the purchase history.
4. Sets the map seed via `GameManager.setSeed()`.
5. Calls `SaveManager.restoreFromLoad()` to repopulate the local upgrade history so future saves are cumulative rather than starting from scratch.

`MainScene.applyUpgrade()` is then called for each upgrade in purchase order with `isRestore = true`, which suppresses cost deduction, sound effects, and backend sync — the upgrade effect is applied without any side effects.

---

## Online vs offline summary

| Behavior | Online | Offline/Sandbox |
|----------|--------|-----------------|
| Wave token | Issued by backend | Not issued |
| Offered upgrades | Backend-generated | Locally generated |
| Point balance | Backend-authoritative | Locally tracked |
| Reroll | Backend-processed | Locally processed |
| Telemetry | Submitted on wave complete | Discarded |
| Save persistence | 5-category backend saves | Local copy-paste JSON only |
| Death state | Sent to `/api/saves/death-state` | Not sent |
