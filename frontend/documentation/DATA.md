# Data

Game data lives in `frontend/src/game/data/`.

---

## Attack Types

**File:** `attackTypes.ts`

Defines the `AttackType` union type and a `ATTACK_INFO` record used by the UI to display names and descriptions.

The five attack types are:

| ID | Name | Description |
|----|------|-------------|
| `bullet` | Bullet | Rapid-fire projectiles. Supports multishot, pierce, homing, explosive, and heavy variants. The only fully implemented attack type. |
| `laser` | Laser | Instant hitscan beam that pierces enemies. |
| `zapper` | Zapper | Chain lightning that jumps between nearby enemies. |
| `flamer` | Flamer | Continuous cone of fire for close-range crowd control. |
| `spinner` | Spinner | Deploys a spinning blade hitbox around the player. |

The attack type is selected on `AttackSelectPage` and stored in `sessionStorage`. `MainScene` passes it to the `Player` constructor.

---

## Upgrades

**Current System:** one file per upgrade (77) under `frontend/src/game/upgrades/`, organized into `stat_modifiers/`, `effects/`, `variants/`, `abilities/`, `visual_effects/`, `curses/`. Each exports a declarative `UpgradeDef` (browsed/offered by UI code) and an `Upgrade` subclass (behavior, dispatched by the engine — see [UPGRADE_MANAGER.md](./UPGRADE_MANAGER.md)). The backend mirror is code-generated data, not a parallel implementation: `backend/app/core/data/upgrades.json` is generated from these defs via `scripts/upgrade_defs_sync.py --write` and should never be hand-edited. See [UPGRADES.md](./UPGRADES.md) for the full architecture and [CURSES.md](./CURSES.md) / [UPGRADE_BUNDLE.md](./UPGRADE_BUNDLE.md) for curses and bundle pickups specifically.

**Legacy System:** the original JSON upgrade definitions (`stat_upgrades.json`, `effect_upgrades.json`, `variant_upgrades.json`, `ability_upgrades.json`, `visual_upgrades.json`, `curses.json`) now live under `frontend/src/game/data/upgrades/legacy/` and are not read by any code path — kept for historical reference only. Their shape (`target`/`stat`/`type` string fields, a flat array per category) is superseded by the current `UpgradeDef` shape (`targetClass`/`fieldInTargetClass`/`upgradeType` enums, one TS class per upgrade). Don't use the legacy files as a reference for current behavior.

---

## Rarity

All upgrades have a `rarity` field: `common`, `uncommon`, `rare`, `epic`, or `legendary`. Rarity controls how likely an upgrade is to appear in the post-wave roll. The probability table is defined per wave in `Normal.ts` and mirrored in the backend's `upgrade_data.py`. Common upgrades are most frequent in early waves; the distribution gradually shifts toward higher rarities as waves progress.
