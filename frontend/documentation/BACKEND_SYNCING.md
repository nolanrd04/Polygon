# Backend Syncing Guide

This document outlines the process for synchronizing backend data when frontend game data is updated. It serves as a reference for future syncs and helps prevent data mismatches between frontend and backend.

---

## Table of Contents

1. [Overview](#overview)
2. [When to Sync](#when-to-sync)
3. [What to Monitor](#what-to-monitor)
4. [Sync Process](#sync-process)
5. [File-by-File Mapping](#file-by-file-mapping)
6. [Validation Checklist](#validation-checklist)
7. [Testing](#testing)
8. [Common Pitfalls](#common-pitfalls)

---

## Overview

The Polygon game has two layers of data:

- **Frontend** (`frontend/src/game/data/` and entity files): Defines all upgrades, enemies, difficulties, and game mechanics
- **Backend** (`backend/app/core/`): Validates wave completion, enforces anti-cheat, and persists save state

Data consistency is critical. If the frontend changes an upgrade's damage value but the backend isn't updated, the anti-cheat validation will reject valid waves or accept cheated waves.

---

## When to Sync

Sync the backend whenever **any of these files change**:

| File | Why Sync? | Frequency |
|------|-----------|-----------|
| `frontend/src/game/data/upgrades/*.json` | Upgrade values, rarities, new upgrades | ⚠️ Often (balancing) |
| `frontend/src/game/entities/enemies/*.ts` | Enemy health, damage, spawn rules | ⚠️ Often (balancing) |
| `frontend/src/game/systems/difficulty/Normal.ts` | Wave scaling, rarity weights, spawn timing | ⚠️ Often (difficulty changes) |
| `frontend/src/game/systems/MainScene.ts` | Curse roll probability, upgrade mechanics | ⚠️ Often (game loop changes) |
| `frontend/src/game/data/attackTypes.ts` | Attack type definitions | ℹ️ Rarely (system change) |
| `frontend/src/game/systems/upgrades/EffectHandlers.ts` | Effect ID changes, new effects | ⚠️ Occasionally (new mechanics) |

**Pro tip:** Use `git log --oneline -- <file>` to see what changed since last sync.

---

## What to Monitor

### A. Upgrade System

**Track:** ID, type, target, stat, value, rarity, stackability, dependencies, effects.

```json
// Example: If frontend upgrades a damage boost
{
  "id": "damage_2",
  "value": 0.008,  // ← Changed from 0.005
  "rarity": "uncommon"
}
```

**Backend file:** `backend/app/core/upgrade_data.py` → `UPGRADES` dictionary

**What to update:**
- Numeric values (damage, health, speed, etc.)
- Rarity (affects wave rolling)
- `stackable` and `maxStacks`
- Effect IDs (must match `EffectHandlers.ts`)
- Dependencies and incompatibilities
- Add/remove entries when new upgrades ship or old ones are deleted

---

### B. Enemy Data

**Track:** Health, damage, spawn eligibility, visual properties.

```typescript
// Example: If frontend increases octagon health
SetDefaults(): void {
  this.health = 1500  // ← Changed from 1200
  this.color = 0xff8b1f
}
```

**Backend file:** `backend/app/core/enemy_data.py`

**What to update:**
- Base health in `ENEMY_BASE_HEALTH`
- Base damage in `ENEMY_BASE_DAMAGE` (used for validation context)
- Minimum wave eligibility in `ENEMY_MIN_WAVE` (if a new enemy is added or an existing one's wave threshold changes)
- Comments/documentation for major behavioral changes

**Note:** Enemy AI behavior (movement, attacks, special abilities) is client-side only and does NOT require backend updates. Examples: Pentagon teleport, Hexagon shield mechanics.

---

### C. Difficulty & Wave Scaling

**Track:** Rarity weight distributions, spawn counts, wave multipliers.

```typescript
// Example: If rarity weights change per wave
RARITY_WEIGHTS_BY_WAVE = {
  1: {"common": 0.50, "uncommon": 0.35, "rare": 0.15, ...}  // ← Updated
}
```

**Backend file:** `backend/app/core/upgrade_data.py` → `RARITY_WEIGHTS_BY_WAVE`

**What to update:**
- Per-wave rarity weight distributions (must sum to 1.0 per row)
- Fallback weights for waves beyond 30
- Enemy spawn rules (if moved from one file to another)

---

### D. Game Mechanics

**Track:** Curse probability, effect triggers, validation logic.

```typescript
// Example: If curse roll probability changes
// 30% curse / 70% upgrade per bundle item
```

**Backend file:** Varies — mostly informational. Anti-cheat validation (`backend/app/services/wave_service.py`) may need updates if:
- Upgrade calculation changes (e.g., modifier formula)
- New effect types are added
- Curse handling changes

**What to update:** Comments and documentation in anti-cheat logic to reflect new rules.

---

## Sync Process

### Step 1: Identify Changes

```bash
# Find what changed since last sync
git log --oneline -20 -- frontend/src/game/data/ frontend/src/game/entities/enemies/ frontend/src/game/systems/

# Show diffs for specific files
git diff <last-sync-commit> HEAD -- frontend/src/game/data/upgrades/stat_upgrades.json
git diff <last-sync-commit> HEAD -- frontend/src/game/entities/enemies/Octogon.ts
git diff <last-sync-commit> HEAD -- frontend/src/game/systems/difficulty/Normal.ts
```

### Step 2: Create Sync Work List

Generate a detailed list of all changes (see `BACKEND_SYNC_WORK.md` for example format):

- Upgrades changed (with old/new values)
- Upgrades added (with complete definition)
- Upgrades removed (with reason)
- Enemies changed (stats, colors, behavior)
- Difficulty changes (weights, spawn rules)

### Step 3: Update Backend Files

Open the relevant backend file and apply changes:

**Most common:** `backend/app/core/upgrade_data.py`

```python
# UPDATE: Existing upgrade
"damage_2": {
  ...
  "value": 0.008,  # ← Change this
  ...
}

# ADD: New upgrade
"new_curse": {
  "id": "new_curse",
  "name": "New Curse",
  "description": "...",
  "rarity": "rare",
  "type": "stat_modifier",
  "target": "attack",
  "stat": "damage",
  "value": -0.01,
  "isMultiplier": True,
  "stackable": True,
  "maxStacks": 99999,
  "cost": 0,
  "curse": True  # ← Mark curses
},

# REMOVE: Old upgrade
# "removed_upgrade": {...},  # ← Comment out or delete
```

### Step 4: Validate Structure

Ensure all backend changes match frontend definitions:

- IDs are identical (case-sensitive)
- Types match (stat_modifier, effect, variant, ability, visual_effect)
- Targets match (attack, bullet, player, laser, etc.)
- Rarity values are valid (common, uncommon, rare, epic, legendary)
- Effect IDs reference real effects (check `EffectHandlers.ts`)
- Dependencies resolve to valid upgrade IDs

**Script to help validate:**

```bash
# Check that all effect IDs in backend have handlers in frontend
grep -o '"effect": "[^"]*"' backend/app/core/upgrade_data.py | sort -u
grep -o 'registerEffect(.*"' frontend/src/game/systems/upgrades/EffectHandlers.ts | sort -u
```

### Step 5: Run Backend Tests (if available)

```bash
# Start MongoDB
docker-compose up -d

# Install dependencies
pip install -r backend/requirements.txt

# Run any upgrade validation tests
python -m pytest backend/tests/ -k upgrade -v  # (if tests exist)

# Or manually test:
python -c "from app.core.upgrade_data import UPGRADES; print(f'Total upgrades: {len(UPGRADES)}')"
```

### Step 6: Test Frontend ↔ Backend Communication

Start a game and verify:

1. **Wave Start:** Client receives expected upgrade pool for the wave (with new upgrades)
2. **Upgrade Selection:** Client can select new upgrades without 422 (validation) errors
3. **Wave Complete:** Anti-cheat accepts new upgrade IDs in `upgrades_used` array
4. **Stat Application:** New upgrade values affect gameplay (test damage, health, etc.)

### Step 7: Commit and Deploy

```bash
# Commit backend changes
git add backend/app/core/upgrade_data.py backend/app/core/enemy_data.py
git commit -m "Sync backend with frontend (commit <hash>): Updated <N> upgrades, added <M> curses, etc."

# Push and deploy
git push origin <branch>
```

---

## File-by-File Mapping

### Frontend ↔ Backend Data Map

| Frontend File | Backend File | What to Sync |
|---|---|---|
| `frontend/src/game/data/upgrades/stat_upgrades.json` | `backend/app/core/upgrade_data.py` | All stat modifier definitions |
| `frontend/src/game/data/upgrades/effect_upgrades.json` | `backend/app/core/upgrade_data.py` | All effect upgrade definitions |
| `frontend/src/game/data/upgrades/ability_upgrades.json` | `backend/app/core/upgrade_data.py` | All ability definitions |
| `frontend/src/game/data/upgrades/variant_upgrades.json` | `backend/app/core/upgrade_data.py` | All variant definitions |
| `frontend/src/game/data/upgrades/visual_upgrades.json` | `backend/app/core/upgrade_data.py` | Visual effect definitions (for completeness) |
| `frontend/src/game/data/upgrades/curses.json` | `backend/app/core/upgrade_data.py` | All curse definitions |
| `frontend/src/game/entities/enemies/*.ts` | `backend/app/core/enemy_data.py` | Health, damage, wave eligibility |
| `frontend/src/game/systems/difficulty/Normal.ts` | `backend/app/core/upgrade_data.py` | Rarity weights, spawn rules |
| `frontend/src/game/systems/upgrades/EffectHandlers.ts` | `backend/app/core/upgrade_data.py` | Effect ID validation |

---

## Validation Checklist

Before deploying backend changes, use this checklist:

### Data Integrity

- [ ] All upgrade IDs in `UPGRADES` are unique
- [ ] All rarity values are one of: common, uncommon, rare, epic, legendary
- [ ] All type values are one of: stat_modifier, effect, variant, ability, visual_effect
- [ ] All effect IDs reference real effects in `EffectHandlers.ts` (frontend)
- [ ] All dependencies (`dependentOn`) reference valid upgrade IDs
- [ ] All incompatibilities (`incompatibleWith`, `replaces`) reference valid upgrade IDs
- [ ] No numeric values are null or missing (should be 0 or actual number)

### Enemy Data

- [ ] All enemy types match those used in spawn rules
- [ ] Health values are positive integers
- [ ] Minimum wave eligibility makes sense (wave 1 exists before wave 10)
- [ ] Boss-only enemies are in `BOSS_ONLY_ENEMIES` set
- [ ] Wave multiplier formula matches frontend (`Math.exp(wave / 8)`)

### Rarity Weights

- [ ] Each wave's rarity weights sum to 1.0 (or very close, e.g., 0.9999 due to floating point)
- [ ] Weights are non-negative
- [ ] Early waves favor common over epic/legendary
- [ ] Later waves (20+) include all rarities

### Syntax

- [ ] No Python syntax errors: `python -m py_compile backend/app/core/upgrade_data.py`
- [ ] JSON/dict structures are valid (matching fields, no trailing commas)
- [ ] No unmatched quotes or parentheses

---

## Testing

### Unit Tests (if available)

```bash
# Run upgrade validation
python -c "
from app.core.upgrade_data import UPGRADES
from app.services.wave_service import WaveValidationService

# Check all upgrades load
assert len(UPGRADES) > 0, 'No upgrades loaded'

# Check rarity distribution
for wave in range(1, 31):
    weights = get_rarity_weights(wave)
    total = sum(weights.values())
    assert 0.99 < total < 1.01, f'Wave {wave} weights sum to {total}, expected 1.0'
"
```

### Integration Tests

1. **Start a wave:**
   ```bash
   POST /api/waves/start
   {
     "wave_number": 1,
     "seed": 12345
   }
   ```
   Verify response includes new upgrades in `offered_upgrades`.

2. **Complete a wave with new upgrades:**
   ```bash
   POST /api/waves/complete
   {
     "token": "...",
     "wave": 1,
     "upgrades_used": ["new_damage_upgrade", "new_curse_1"],
     ...
   }
   ```
   Verify 200 OK (not 422 validation error).

3. **Check anti-cheat validation:**
   - Submit with invalid upgrade ID → expect 422
   - Submit with duplicate curse IDs → expect valid (curses can stack)
   - Submit with cursed + blessed same stat → expect valid (modifiers stack)

### Manual Testing (Recommended)

1. **Start a fresh game locally:**
   - Backend running (`uvicorn app.main:app --reload`)
   - Frontend running (`npm start`)
   - MongoDB running (`docker-compose up -d`)

2. **Play through wave 1:**
   - Verify bundle contains at least one new upgrade/curse
   - Select new upgrade, verify it applies without errors

3. **Play through wave 5–10:**
   - Verify new upgrades appear with correct rarity
   - Select multiple instances of stackable upgrade
   - Verify numeric values (damage, health, etc.) are applied correctly

4. **Play through wave 20+ (if new epic/legendary upgrades):**
   - Verify high-rarity upgrades appear

5. **Check anti-cheat logs:**
   - Complete waves with new upgrades
   - Verify no "unknown upgrade" warnings in backend logs
   - Check `flagged_waves` collection for spurious flags

---

## Common Pitfalls

### 1. Effect ID Mismatch

**Problem:** Frontend uses `"protection"` but backend has `"armor"`.

**Result:** Anti-cheat doesn't recognize the upgrade as valid.

**Prevention:** After updating effect names in frontend, search backend for old effect ID and replace everywhere.

```bash
grep -r "armor" backend/app/core/upgrade_data.py
# Replace all instances with "protection"
```

### 2. Rarity Weights Don't Sum to 1.0

**Problem:** After editing rarity weights, row sums to 0.98 or 1.02.

**Result:** Upgrade rolling is biased; some rarity brackets are under/over-represented.

**Prevention:** After changing weights, verify they sum to 1.0:

```python
for wave, weights in RARITY_WEIGHTS_BY_WAVE.items():
    total = sum(weights.values())
    if not 0.9999 < total < 1.0001:
        print(f"Wave {wave}: {total}")
```

### 3. Forgetting Dependencies

**Problem:** Add upgrade `"triple_dash"` but forget to mark `dependentOn: ["double_dash"]`.

**Result:** Players can get triple dash without double dash first.

**Prevention:** Cross-check frontend JSON for all `dependentOn` fields before copying to backend.

### 4. Numeric Type Mismatch

**Problem:** Frontend has `"value": 0.008` (float) but backend has `"value": 8` (int).

**Result:** Validation passes but upgrade effect is wrong (100× or 0.01× multiplier).

**Prevention:** Always match the exact numeric value and type (int vs float) from frontend.

```python
# ✅ Correct
"damage_2": {"value": 0.008, "isMultiplier": True},

# ❌ Wrong
"damage_2": {"value": 8, "isMultiplier": True},  # 800x multiplier instead of 0.8%
```

### 5. Case Sensitivity in IDs

**Problem:** Frontend has `"id": "Double_Dash"` (PascalCase), backend has `"double_dash"` (snake_case).

**Result:** Anti-cheat rejects valid waves with "unknown upgrade" error.

**Prevention:** Always use `snake_case` for upgrade IDs. Use grep to verify:

```bash
grep -o '"id": "[^"]*"' frontend/src/game/data/upgrades/*.json | sort -u
grep -o '"[a-z_0-9]*":' backend/app/core/upgrade_data.py | sort -u
```

### 6. Missing Curse Flag

**Problem:** Add a curse definition but forget `"curse": True`.

**Result:** Curse appears in regular upgrade pool, not curse pool (30% vs 70% chance).

**Prevention:** Always include `"curse": True` and `"cost": 0` for all curse upgrades.

### 7. Enemies Added to Spawn Pool But Not `ENEMY_BASE_HEALTH`

**Problem:** Frontend adds new enemy type to `SPAWN_WEIGHTS` but backend doesn't have `ENEMY_BASE_HEALTH["new_enemy"]`.

**Result:** Anti-cheat crashes or fails validation when new enemy spawns.

**Prevention:** If a new enemy is added, immediately add entries to:
- `ENEMY_BASE_HEALTH`
- `ENEMY_BASE_DAMAGE`
- `ENEMY_MIN_WAVE`

---

## Quick Reference

### Minimal Sync (Single Upgrade Change)

1. `git diff <last-commit> HEAD -- frontend/src/game/data/upgrades/stat_upgrades.json`
2. Find the changed upgrade in `backend/app/core/upgrade_data.py`
3. Update the value/rarity/description
4. Verify: `python -c "from app.core.upgrade_data import UPGRADES; print(UPGRADES['changed_id'])"`
5. Test: Start a game, select the upgrade, verify effect

### Full Sync (Multiple Changes)

1. Identify all changed files: `git log --oneline -10 -- frontend/src/game/data/ frontend/src/game/entities/ frontend/src/game/systems/`
2. For each file, run: `git diff <last-commit> HEAD -- <file>`
3. Create `BACKEND_SYNC_WORK.md` with all changes listed
4. Update `backend/app/core/upgrade_data.py` and `backend/app/core/enemy_data.py`
5. Run validation: `python backend/tests/validate_upgrades.py` (if exists)
6. Manual test: Play through waves 1, 5, 20
7. Commit with message: `Sync backend with frontend (commit <hash>): <summary>`

---

## Automated Sync Workflow

To keep frontend and backend in sync with minimal effort, use the `sync-check.sh` script in the repo root.

### Setup (One Time)

The script and git hook are already in place. No setup needed! Just start using them.

### Workflow

#### 1. Make Frontend Changes
Edit upgrade JSONs, enemy .ts files, or difficulty settings and commit:
```bash
git add frontend/src/game/data/upgrades/stat_upgrades.json
git commit -m "Nerf dash upgrades"
```

The **pre-commit hook** will remind you:
```
⚠️  Frontend data files detected in this commit:
Upgrades:
  • frontend/src/game/data/upgrades/stat_upgrades.json

Reminder: Don't forget to sync the backend!
Run: ./sync-check.sh to see what needs updating
```

#### 2. Check What Needs Syncing
```bash
./sync-check.sh
```

**Output:** Shows all changed files + generates `sync_reports/sync-report.json`
```
Changed Upgrade Files:
  • frontend/src/game/data/upgrades/stat_upgrades.json

Upgrade Changes Detected:
  File: frontend/src/game/data/upgrades/stat_upgrades.json
  - "value": 0.40,
  + "value": 0.15,

Summary: Changed: 1 upgrade file(s), 0 enemy file(s), 0 difficulty file(s)

Next steps:
  1. Review changes above and in sync-report.json
  2. Update backend files accordingly
  3. Run: ./sync-check.sh --mark to update sync marker
```

#### 3. Review the Report
- **Terminal output** shows the diff
- **`sync-report.json`** has structured data for programmatic access

#### 4. Manually Sync Backend
Edit `backend/app/core/upgrade_data.py` or `backend/app/core/enemy_data.py` with the changes shown in the report.

#### 5. Mark as Synced
```bash
./sync-check.sh --mark
```

This updates the `.sync-marker` file to the current commit. Now the next `sync-check.sh` run will only show *new* changes since this sync.

### Script Reference

```bash
# Check what needs syncing (generates sync-report.json)
./sync-check.sh

# Update marker after syncing backend
./sync-check.sh --mark
```

**Files created:**
- `.sync-marker` — Tracks the commit hash of the last backend sync
- `sync_reports/sync-report.json` — JSON report of what changed since last sync (auto-overwritten on each run)

**Pre-commit hook:** `.git/hooks/pre-commit`
- Runs before every commit
- Warns if you're committing frontend data changes
- Non-blocking (doesn't prevent commits)

---

## Questions?

If data is out of sync, check:

1. **Frontend:** `frontend/src/game/data/upgrades/*.json` and `frontend/src/game/entities/enemies/*.ts`
2. **Backend:** `backend/app/core/upgrade_data.py` and `backend/app/core/enemy_data.py`
3. **Logs:** Check backend validation logs (`flagged_waves` collection) for hint about which field is mismatched
4. **Git history:** `git log -- <file>` to find when it was last changed
