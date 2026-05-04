# Syncing Data Between Frontend and Backend

The game has two modes:

- **Offline mode** — runs entirely on the frontend. The frontend's data files are the only thing that matters.
- **Online mode** — the backend validates wave completions, upgrade rolls, damage, kills, etc. against its **own** copies of the same data.

Because the backend has independent copies, **any time you change a gameplay value on the frontend, the matching backend constant must be updated as well.** If they drift, the backend will either reject legitimate plays (false-positive bans / "wave validation failed") or accept cheated values.

There is intentionally no automatic sync script. Updates are done manually (or by asking an AI assistant to do the diff and propagate the changes).

---

## Source of truth

For every value listed below, **the frontend is the source of truth.** Edit it on the frontend first, then mirror the change to the backend.

---

## What needs to stay in sync

### 1. Upgrades

| Frontend | Backend |
|---|---|
| `frontend/src/game/data/upgrades/stat_upgrades.json` | `backend/app/core/upgrade_data.py` → `UPGRADES` dict |
| `frontend/src/game/data/upgrades/effect_upgrades.json` | (same) |
| `frontend/src/game/data/upgrades/variant_upgrades.json` | (same) |
| `frontend/src/game/data/upgrades/visual_upgrades.json` | (same) |
| `frontend/src/game/data/upgrades/ability_upgrades.json` | (same) |

Trigger an update when you:
- add a new upgrade
- remove an upgrade
- change any field on an existing upgrade (`value`, `cost`, `rarity`, `maxStacks`, `stackable`, `dependentOn`, `replaces`, `incompatibleWith`, `attackType`, `description`, `name`, etc.)

Every upgrade entry in the JSON should have a matching key in `UPGRADES` with the same fields. Convert JSON booleans (`true`/`false`) to Python (`True`/`False`).

### 2. Rarity weights

Rarity weights are **per-wave**: each wave has its own distribution across the five rarities (common → legendary). A fallback distribution is used for waves not explicitly listed (typically late-game).

| Frontend | Backend |
|---|---|
| `frontend/src/game/systems/difficulty/Normal.ts` → `RARITY_WEIGHTS_BY_WAVE` and `FALLBACK_RARITY_WEIGHTS` | `backend/app/core/upgrade_data.py` → `RARITY_WEIGHTS_BY_WAVE` and `FALLBACK_RARITY_WEIGHTS` |

Trigger an update when you:
- change the weights for any wave
- add or remove a wave entry
- change the fallback distribution

Each wave's weights (and the fallback) must sum to 1.0. Both files have a comment pointing at the other — keep the tables row-for-row identical.

### 3. Enemy base stats

Per-enemy stats live on the frontend in each enemy class's `SetDefaults()` method:

- `frontend/src/game/entities/enemies/Triangle.ts`
- `frontend/src/game/entities/enemies/Square.ts`
- `frontend/src/game/entities/enemies/SuperTriangle.ts`
- `frontend/src/game/entities/enemies/SuperSquare.ts`
- `frontend/src/game/entities/enemies/Pentagon.ts`
- `frontend/src/game/entities/enemies/Hexagon.ts`
- `frontend/src/game/entities/enemies/Diamond.ts`
- `frontend/src/game/entities/enemies/Octogon.ts`
- `frontend/src/game/entities/enemies/Dodecahedron.ts`

These map to constants in `backend/app/core/enemy_data.py`:

| Frontend (`SetDefaults()`) | Backend |
|---|---|
| `this.health` | `ENEMY_BASE_HEALTH` |
| `this.damage` | `ENEMY_BASE_DAMAGE` |
| Hexagon's `this.maxShieldHealth = this.health * 0.65` | `HEXAGON_SHIELD_RATIO` |

Trigger an update when you:
- change any enemy's base `health` or `damage`
- add a new enemy type (also add a min-wave entry — see #5)
- remove an enemy type
- change Hexagon's shield ratio

### 4. Wave scaling formula

| Frontend | Backend |
|---|---|
| `frontend/src/game/systems/EnemyManager.ts` → `scaleEnemyStats()` (`Math.exp(wave / 8)`) | `backend/app/core/enemy_data.py` → `get_wave_multiplier()` (`math.exp(wave / 8)`) |

Trigger an update when you change the divisor (or change to a different scaling formula). The backend formula must match exactly.

### 5. Spawn rules (per-wave eligibility)

| Frontend | Backend |
|---|---|
| `frontend/src/game/systems/difficulty/Normal.ts` → `SPAWN_WEIGHTS` and `SCHEDULED_BOSS_SPAWNS` | `backend/app/core/enemy_data.py` → `ENEMY_MIN_WAVE`, `BOSS_WAVES`, `BOSS_ONLY_ENEMIES` |

Trigger an update when you:
- introduce an enemy on a new earliest wave (update `ENEMY_MIN_WAVE`)
- change which waves spawn bosses (update `BOSS_WAVES`)
- make an enemy boss-only or no-longer-boss-only (update `BOSS_ONLY_ENEMIES`)
- add a new difficulty (currently only `Normal` exists; if more are added, the backend currently only validates against `Normal`)

The backend uses the *minimum* wave an enemy can appear on. If you bring an enemy in earlier in `SPAWN_WEIGHTS`, lower its `ENEMY_MIN_WAVE` value to match — otherwise the backend will reject the spawn.

---

## Workflow when changing values

1. Edit the value(s) on the frontend.
2. Run/play-test the change locally in offline mode.
3. Open the matching backend file from the table above and mirror the change.
4. Restart the backend (`uvicorn app.main:app --reload` picks up automatically) and play one wave in online mode to confirm wave validation still passes.

If wave validation fails after a change, the backend almost always has a stale value — re-diff it against the frontend.

---

## What does *not* need syncing

These are frontend-only and never seen by the backend validator:

- Visuals: colors, radii, sprite sides, glow intensities (the `color`, `radius`, `sides`, `intensity` fields).
- Cosmetic upgrade fields: `visual_effect` upgrades' rendering details.
- Movement caps, hitbox sizes, tweens, particle effects.
- UI strings (everything in `frontend/src/components/`).

If you're unsure whether a field is gameplay or cosmetic, check whether it appears in `backend/app/core/upgrade_data.py` or `backend/app/core/enemy_data.py` — if it does, sync it; if it doesn't, it's frontend-only.
