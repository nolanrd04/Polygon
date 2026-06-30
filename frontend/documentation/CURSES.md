# Curses System

Curses are negative effects applied to the player that reduce character stats or capabilities. Unlike upgrades which improve the player, curses apply debuffs as penalties or rewards from certain game events (like boss drops or mid-wave loot bundles).

## Overview

- **Source**: Defined in `src/game/data/upgrades/curses.json`
- **Implementation**: Curses are upgrades with `curse: true` property
- **Application**: Applied through the same upgrade system as regular upgrades
- **Effects**: Typically use negative stat modifiers (negative `value` with `isMultiplier: true`)
- **Stackable**: Most curses can be stacked multiple times unless `stackable: false`

## Curse Structure

```json
{
  "id": "curse_identifier",
  "name": "Curse Name",
  "description": "Effect description",
  "rarity": "common",
  "attackType": "bullet",
  "type": "stat_modifier",
  "target": "attack",
  "stat": "damage",
  "value": -0.2,
  "isMultiplier": true,
  "stackable": true,
  "curse": true
}
```

### Key Properties

- **id**: Unique identifier for the curse
- **curse**: Must be `true` to mark as a curse (filters from regular upgrade rolls)
- **attackType**: *(Optional)* Restricts curse to specific attack types (e.g., `"bullet"`, `"laser"`)
  - If omitted, curse can be applied to any attack type
  - Filtering happens automatically in both backend and frontend
- **stackable**: Whether curse can be applied multiple times (default: `true`)
- **value**: Negative number for debuff effect
  - When `isMultiplier: true`, values are percentages (e.g., `-0.2` = -20%)
- **rarity**: Curse rarity level (`common`, `uncommon`, `rare`, `epic`, `legendary`)

## Attack Type Restrictions

To restrict a curse to a specific attack type, add the `attackType` field:

```json
{
  "id": "bullet_shatter",
  "name": "Bullet Shatter",
  "description": "-20% bullet damage",
  "attackType": "bullet",
  "type": "stat_modifier",
  "target": "attack",
  "stat": "damage",
  "value": -0.2,
  "isMultiplier": true,
  "curse": true
}
```

The filtering system will automatically prevent this curse from appearing unless the player has selected the bullet attack type. This applies to all curse sources (bundle drops, future post-wave selections, etc.).

## How Curses Are Applied

1. Curses are picked from bundles or other random events
2. The upgrade system validates that the curse applies to the current attack type
3. If valid, the curse is added to `playerStats.upgrades`
4. The stat modifier is calculated and applied to the player's attack stats
5. Multiple stackable curses accumulate their effects

## Adding a New Curse

1. Add curse definition to `curses.json`
2. Include all required properties (`id`, `name`, `description`, `type`, `stat`, `value`, `curse: true`)
3. If curse should only apply to specific attack types, add `attackType` field
4. Stats are automatically validated and applied through the existing upgrade system

No code changes needed for basic curse additions—the system handles validation and application automatically.