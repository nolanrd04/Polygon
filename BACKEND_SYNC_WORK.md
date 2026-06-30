# Backend Sync Work List

**Date:** 2026-06-30  
**Last Frontend Sync:** Commit 39a7871 "Added more curses. Nerfed dash upgrades..."  
**Last Backend Sync:** Commit 5de1c6a (partial sync of upgrade weights)

---

## Overview

The frontend has been updated with several balance changes and new features since the backend was last synchronized. This document lists all the changes that need to be reflected in the backend.

---

## 1. Upgrade System Updates

### 1.1 Dash Upgrade Nerfs (3 upgrades affected)

**File affected:** `backend/app/core/upgrade_data.py`

| Upgrade ID | Change | Old Value | New Value |
|------------|--------|-----------|-----------|
| `dash_speed_1` | Value | 0.40 | 0.15 |
| `dash_speed_1` | Description | "+40% dash speed" | "+15% dash speed" |
| `dash_speed_2` | Value | 0.75 | 0.32 |
| `dash_speed_2` | Description | "+75% dash speed" | "+32% dash speed" |
| `dash_cooldown_1` | Value | -0.30 | -0.05 |
| `dash_cooldown_1` | Description | "-30% dash cooldown" | "-5% dash cooldown" |
| `dash_cooldown_2` | Value | -0.75 | -0.15 |
| `dash_cooldown_2` | Description | "-75% dash cooldown" | "-15% dash cooldown" |

### 1.2 Dash Cooldown Tier 3 Removal (1 upgrade removed)

**File affected:** `backend/app/core/upgrade_data.py`

- **Remove:** `dash_cooldown_3` (legendary tier, -0.90 cooldown reduction)
- **Reason:** Nerfed dash system, highest tier no longer needed

### 1.3 Armor Effect Rename (2 upgrades affected)

**File affected:** `backend/app/core/upgrade_data.py`

The backend effect ID needs to be changed from `"armor"` to `"protection"` for consistency with how the frontend handles damage reduction effects:

| Upgrade ID | Change | Old Value | New Value |
|------------|--------|-----------|-----------|
| `armor` | effect | "armor" | "protection" |
| `armor_2` | effect | "armor" | "protection" |

**Context:** The frontend's EffectHandlers uses `"protection"` as the effect ID for damage reduction. The backend must match this.

---

## 2. New Curse Upgrades (10 new curses)

**File affected:** `backend/app/core/upgrade_data.py`

Add these curse upgrades to the `UPGRADES` dictionary. All are marked with `"curse": true`:

### Shattered Bullet Curses (3)
- `shattered_bullet_1` (uncommon): -1 bullet damage
- `shattered_bullet_2` (rare): -3 bullet damage
- `shattered_bullet_3` (epic): -5 bullet damage

### Health Reduction Curses (5)
- `health_reduc_1` (common): -5 max health
- `health_reduc_2` (uncommon): -10 max health
- `health_reduc_3` (rare): -20 max health
- `health_reduc_4` (epic): -40 max health
- `health_reduc_5` (legendary): -80 max health

### Fragility Curses (2)
- `fragility_1` (rare): Increased damage taken by 1.25%
- `fragility_2` (epic): Increased damage taken by 3.5%

**Note:** Fragility curses use effect type with `"effect": "protection"` and **negative** effectValue (to increase damage taken, not reduce it).

---

## 3. Enemy Updates

### 3.1 Octagon Color Change

**File affected:** `backend/app/core/enemy_data.py` (documentation only)

- **Enemy:** Octagon
- **Change:** Color hex code
- **Old:** `0xff8b1f` (orange)
- **New:** `0x4287f5` (blue)
- **Backend impact:** Minimal — this is a visual-only change. Backend does not store enemy colors, but documentation should be updated for consistency.

### 3.2 Pentagon Behavior Addition (NEW FEATURE)

**File affected:** Frontend only — `frontend/src/game/entities/enemies/Pentagon.ts`

- **Feature:** Teleport attack when player within 400px
- **Mechanics:**
  - 3-second timer resets when player moves away
  - 300ms wind-up (scale down to 0.7)
  - Instant teleport to random location at distance from player
  - 300ms wind-down (scale back to 1.0)
- **Backend impact:** NONE — This is client-side AI behavior only. No validation or anti-cheat changes needed. Pentagon stats (health, damage, etc.) remain unchanged.

---

## 4. Game Mechanic Changes

### 4.1 Curse Appearance Rate

**File affected:** `frontend/src/game/systems/MainScene.ts` (MainScene.ts lines 148–152)

- **Change:** Curse appearance probability set to 30%
- **Mechanism:** When rolling bundle items after slot 1, each roll has 30% chance for curse, 70% chance for regular upgrade
- **Backend impact:** NONE — Curse selection happens client-side during wave completion. Backend validates the upgrades used but does not control the roll probability.

---

## 5. Validation & Testing Checklist

Before committing backend changes, verify:

### Upgrade Validation
- [ ] All 3 dash upgrades have correct new values
- [ ] `dash_cooldown_3` is removed from `UPGRADES` dict
- [ ] Armor upgrades now reference `"protection"` effect
- [ ] All 10 new curses are present with correct IDs, rarities, values
- [ ] Curse JSON structure matches existing curses (all fields present)
- [ ] No duplicate upgrade IDs

### Anti-Cheat Validation
- [ ] `WaveValidationService` can deserialize curses without errors
- [ ] Curse upgrades pass `UpgradeSystem.canApply()` validation (no unmet dependencies)
- [ ] Backend `/api/waves/complete` endpoint accepts curse IDs in `upgrades_used` array

### Testing
- [ ] Start a fresh game, complete wave 1, verify curse appears in bundle
- [ ] Select curse, verify damage is reduced (or health/bullet damage affected)
- [ ] Select dash ability, then dash upgrades, verify reduced speed/cooldown
- [ ] Check that armor upgrade still reduces damage taken (despite effect rename)

---

## 6. Deployment Order

1. Update `upgrade_data.py` with all 4 upgrade changes + 10 new curses
2. Run backend tests/validation
3. Deploy backend
4. Verify frontend can submit waves with new curse IDs without errors

---

## Files to Modify

```
backend/app/core/upgrade_data.py
  - Remove: dash_cooldown_3
  - Update: dash_speed_1, dash_speed_2, dash_cooldown_1, dash_cooldown_2
  - Update: armor, armor_2 (effect name)
  - Add: shattered_bullet_1-3, health_reduc_1-5, fragility_1-2

backend/app/core/enemy_data.py (documentation only)
  - Update: Octagon color note to reflect new blue color
  - Confirm: Pentagon AI behavior is client-side only (no backend changes)
```

---

## Summary

- **Upgrades to update:** 4 (3 nerfed, 1 effect rename)
- **Upgrades to remove:** 1 (dash_cooldown_3)
- **Upgrades to add:** 10 (new curses)
- **Enemies to update:** 1 visual change (Octagon), 1 AI change (Pentagon — client-side only)
- **Anti-cheat impact:** Minimal — only new curse IDs need to be recognized
- **Estimated backend work:** ~30 minutes (data entry + validation)
