# Anti-Cheat Wave Validation System

## Overview
Comprehensive server-side validation for wave completion to prevent cheating through frame-by-frame analysis, damage verification, and upgrade validation.

## System Components

### 1. Wave Start Flow
```
Client -> POST /api/waves/start
- Receives wave validation token (30s expiry)
- Receives offered upgrades (3 options) rolled by backend
- Token contains expected player stats and allowed upgrades
```

### 2. Wave Completion Flow
```
Client -> POST /api/waves/complete
- Submits token, frame data, kills, damage, enemy deaths
- Backend validates:
  ✓ Token validity (not expired, not reused)
  ✓ Player movement (10% tolerance based on speed/framerate)
  ✓ Damage dealt vs enemy health requirements
  ✓ Only allowed upgrades were used
  ✓ Kill counts match enemy spawns
  ✓ Enemy death locations are reasonable
- Flags suspicious activity with detailed reasons
- Updates player stats if valid
```

### 3. Upgrade Selection Flow
```
Client -> POST /api/waves/select-upgrade
- Submit selected upgrade ID from offered options
- Backend validates upgrade was actually offered
- Updates player's current_upgrades list
- Returns updated player stats
```

## Data Structures

### Frame Data Submission
```json
{
  "token": "abc123...",
  "wave": 5,
  "kills": 35,
  "total_damage": 1250,
  "frame_samples": [
    {
      "frame": 0,
      "timestamp": 0,
      "player": {"x": 400, "y": 300, "vx": 0, "vy": 0, "health": 100}
    },
    {
      "frame": 60,
      "timestamp": 1000,
      "player": {"x": 420, "y": 315, "vx": 150, "vy": 50, "health": 95}
    }
  ],
  "enemy_deaths": [
    {"type": "triangle", "x": 450, "y": 320, "frame": 45},
    {"type": "square", "x": 380, "y": 295, "frame": 89}
  ],
  "upgrades_used": ["damage_1", "speed_1"]
}
```

### Validation Checks

#### Movement Validation
- Calculate expected max distance per frame: `speed * (framerate_tolerance)`
- Allow 10% variance for framerate fluctuations
- Flag if player teleports or moves impossibly fast

#### Damage Validation
- Calculate minimum damage required based on enemy kills
- Allow 20% margin (overkill, missed shots)
- Flag if damage is impossibly low (suggests kill count manipulation)

#### Upgrade Validation
- Check all upgrade IDs against allowed_upgrades from token
- Verify upgrade dependencies are met
- Flag if unauthorized upgrades detected

#### Kill Validation
- Compare kill count against expected wave spawns
- Flag if kills exceed possible spawns
- Validate enemy types can spawn on that wave

## Flag Severity Levels

- **LOW**: Minor anomalies (15-25% deviation)
- **MEDIUM**: Suspicious patterns (25-50% deviation)
- **HIGH**: Clear cheating indicators (50-100% deviation)
- **CRITICAL**: Impossible values (>100% deviation, auto-ban)

## Admin Review System

Flagged waves stored in `admin.flagged_waves` collection with:
- User info and wave details
- All validation failures with specific reasons
- Expected vs actual values
- Deviation percentages
- Admin review status and actions
