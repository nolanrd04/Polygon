# Offline Mode (Sandbox)

Offline mode — also called sandbox mode — lets the game run without a backend. Progress is not validated or persisted to a server. It is activated automatically when there is no auth token and can also be triggered deliberately from the main menu.

---

## How offline mode is detected

Every function in `WaveValidationService` and `SaveManager` checks the same condition at the top of the function:

```ts
const token = localStorage.getItem('token')
const isOfflineMode = !token
```

No explicit offline flag is stored. Absence of a token is the definition of offline mode. This means:
- Logging out while mid-game silently converts the session to sandbox.
- Starting the app without ever logging in goes directly to sandbox if you choose "Play Offline."

---

## Triggering sandbox from the main menu

**File:** `frontend/src/pages/MainMenu.tsx`

The **PLAY OFFLINE** button does two things before navigating to the game:

1. Sets `isDead = true` in `GameManager.getPlayerStats()`.
2. Does **not** set an auth token.

Setting `isDead = true` is the sandbox trigger used by `WaveValidationService`. Even after death, the game normally enters a "sandbox continues" state, so the same flag is reused here. The effect is that all backend calls in `WaveValidation` short-circuit immediately and run local logic instead.

---

## What changes in sandbox mode

### Wave start

`WaveValidationService.startWave()` skips the `POST /api/waves/start` call. Instead it resets local tracking state and, if no upgrades have been offered yet, generates 3 upgrades locally using the same logic the backend would use:

1. Merges all four upgrade JSON files into one pool.
2. Filters out upgrades that are already owned (non-stackable), at max stacks, wrong attack type, missing dependencies, incompatible, or replacing an existing variant.
3. Rolls a rarity using `NormalDifficulty.getRarityWeights(waveNumber)` — the same wave-based probability table the backend uses.
4. Picks 3 distinct upgrades from the rolled rarities, up to 100 attempts.

The resulting array is cached in `offeredUpgrades` for the rest of the offline session. On subsequent waves the same cached array is returned unless a reroll is performed.

No wave token is issued — `waveToken` stays `null`.

### Wave completion

`WaveValidationService.completeWave()` skips the `POST /api/waves/complete` call and returns `{ success: true }` immediately so the game flow is not blocked.

### Upgrade selection

`WaveValidationService.selectUpgrade()` skips `POST /api/waves/select-upgrade`. Instead it:
1. Looks up the upgrade's `cost` in the local JSON pool.
2. Subtracts the cost from `GameManager.getPlayerStats().points` directly.
3. Returns `{ success: true, newPoints }` with the locally computed value.

The backend never becomes authoritative for points in offline mode.

### Upgrade reroll

`WaveValidationService.rerollUpgrades()` skips `POST /api/waves/reroll`. It deducts the reroll cost locally, regenerates 3 upgrades using the same rarity-weighted local selection algorithm, updates `offeredUpgrades`, and returns the new pool with the new point total.

### Save system

All five save endpoints (`/api/saves/*`) are guarded by `isInitialized` and auth token checks in `SaveManager`. With no token, every individual save method returns `{ success: false, error: 'NO_AUTH' }` immediately. The composite methods (`saveOnWaveComplete`, `saveOnDeath`, etc.) run these methods in parallel and silently discard the failures.

Nothing is persisted to the backend during an offline session.

---

## Local save (copy-paste)

**File:** `frontend/src/game/services/LocalSaveManager.ts`

Offline players can still save and restore progress using a copy-paste JSON system:

| Function | Description |
|----------|-------------|
| `exportLocalSave()` | Serializes the current `FullGameSave` to a pretty-printed JSON string |
| `importLocalSave(raw)` | Parses a JSON string; validates required fields; returns `FullGameSave` or `null` |
| `applyLocalSave(save)` | Calls `GameManager.reset()` then `SaveManager.restoreGameState(save)` |
| `summarizeLocalSave()` | Returns a human-readable header: `"Wave 5 • 3 upgrades • 120 points"` |

The exported JSON uses the same `FullGameSave` shape as the backend's `/api/saves/full` response (after camelCase transformation). This means `SaveManager.restoreGameState()` handles both backend loads and local imports through the same code path. The upgrade purchase history array preserves insertion order so stats are reconstructed identically on restore.

`importLocalSave` rejects the paste if any of `gameStats`, `points`, `upgrades`, `playerState`, or `upgrades.purchaseHistory` are missing.

---

## What sandbox mode does NOT change

- The full game loop runs normally — waves, enemies, collision, upgrades, the death sequence.
- `NormalDifficulty` is used for all wave pacing and rarity weights — sandbox difficulty is identical to online.
- All upgrade effects, stat modifiers, and ability logic apply normally.
- The death state is still frozen via `SaveManager.freezeDeathState()` — it just is never sent to a server.
