# Wave Validation Anti-Cheat System - Implementation Guide

## ✅ What's Been Implemented

### Backend Components

#### 1. Models (`backend/app/models/`)
- **`wave_token.py`** - 30-second validation tokens for wave submissions
- **`flagged_wave.py`** - Stores suspicious activity with detailed flag reasons
- **`player_stats.py`** - Updated to store current upgrades and wave progress

#### 2. Core Logic (`backend/app/core/`)
- **`enemy_data.py`** - Enemy health calculations and spawn validation
- **`upgrade_data.py`** - Upgrade definitions and validation logic (NEEDS EXPANSION)

#### 3. Services (`backend/app/services/`)
- **`wave_service.py`** - Complete wave validation logic:
  - Token generation and validation
  - Upgrade rolling (backend-side)
  - Frame-by-frame movement validation (10% tolerance)
  - Damage verification
  - Kill count validation
  - Automatic flagging of suspicious activity

#### 4. API Endpoints (`backend/app/api/waves.py`)
- **POST `/api/waves/start`** - Start wave, get token + 3 rolled upgrades
- **POST `/api/waves/complete`** - Submit wave data for validation
- **POST `/api/waves/select-upgrade`** - Apply selected upgrade

## 🔧 What Needs To Be Done

### 1. Populate Upgrade Data
The file `backend/app/core/upgrade_data.py` currently has only 3 sample upgrades. You need to:

```python
# Copy ALL upgrades from your frontend JSON files:
# - frontend/src/game/data/upgrades/stat_upgrades.json
# - frontend/src/game/data/upgrades/effect_upgrades.json
# - frontend/src/game/data/upgrades/variant_upgrades.json
# - frontend/src/game/data/upgrades/visual_upgrades.json
# - frontend/src/game/data/upgrades/ability_upgrades.json

# Convert each upgrade to the Python dict format shown in the file
```

### 2. Sync Enemy Data
Update `backend/app/core/enemy_data.py` to match your frontend enemy definitions:
- Verify `ENEMY_BASE_HEALTH` values match frontend
- Verify `HEALTH_SCALING_PER_WAVE` matches frontend
- Update wave spawn rules to match `WaveManager`

### 3. Frontend Integration

#### A. Update Wave Start Flow
```typescript
// Before starting a wave, call the backend:
const response = await axios.post('/api/waves/start', {
  wave_number: currentWave,
  seed: gameSeed
})

const { token, offered_upgrades } = response.data

// Store token for wave completion
// Display offered_upgrades instead of rolling locally
```

#### B. Collect Frame Data During Wave
```typescript
// In MainScene.ts update loop, sample every ~30 frames:
if (this.frameCount % 30 === 0) {
  this.frameSamples.push({
    frame: this.frameCount,
    timestamp: Date.now() - this.waveStartTime,
    player: {
      x: player.x,
      y: player.y,
      vx: player.body.velocity.x,
      vy: player.body.velocity.y,
      health: player.health
    }
  })
}

// Track enemy deaths:
this.enemyDeaths.push({
  type: enemy.type,
  x: enemy.x,
  y: enemy.y,
  frame: this.frameCount
})
```

#### C. Submit Wave Completion
```typescript
// When wave ends:
const response = await axios.post('/api/waves/complete', {
  token: waveToken,
  wave: currentWave,
  kills: totalKills,
  total_damage: totalDamage,
  frame_samples: frameSamples,
  enemy_deaths: enemyDeaths,
  upgrades_used: GameManager.getAppliedUpgrades().map(u => u.id)
})

if (!response.data.success) {
  // Handle validation failure
  console.error('Wave validation failed:', response.data.errors)
}
```

#### D. Update UpgradeModal
Replace local upgrade rolling with backend-provided upgrades:
```typescript
// Remove generateOptions() logic
// Use upgrades from POST /api/waves/start response

const handleUpgradeClick = async (upgrade) => {
  await axios.post('/api/waves/select-upgrade', {
    upgrade_id: upgrade.id,
    wave: currentWave
  })

  // Apply upgrade locally
  UpgradeSystem.applyUpgrade(upgrade)
}
```

### 4. Enhanced Validations (Optional but Recommended)

#### Add to `wave_service.py`:
```python
def _validate_enemy_death_positions(self, enemy_deaths, map_bounds):
    """Verify enemies died within map boundaries"""

def _validate_upgrade_dependencies(self, upgrades_used, allowed_upgrades):
    """Deep validation of upgrade dependency chains"""

def _validate_frame_rate_consistency(self, frame_samples):
    """Flag if framerate varies suspiciously (anti-speed-hack)"""
```

### 5. Admin Panel (Future Enhancement)

Create admin endpoints to review flagged waves:
```python
# backend/app/api/admin.py
@router.get("/flagged-waves")
async def get_flagged_waves(skip: int = 0, limit: int = 50):
    """Get flagged waves for review"""

@router.post("/flagged-waves/{id}/review")
async def review_flagged_wave(id: str, action: str, notes: str):
    """Admin review action: dismiss, warn, or ban"""
```

## 📊 Database Collections

The system creates these MongoDB collections:
- `wave_validation_tokens` - Active and expired wave tokens
- `flagged_waves` - Suspicious activity for admin review
- `player_stats` - Updated with current_upgrades, current_wave

## 🔒 Security Notes

1. **Token Expiry**: Tokens expire in 30 seconds - adjust if needed
2. **Tolerance Levels**: Movement has 10% tolerance - tune based on testing
3. **Auto-Ban**: Critical flags trigger auto-ban - review carefully
4. **Damage Variance**: Currently allows 20% overkill margin

## 🧪 Testing

1. Start backend: `uvicorn app.main:app --reload`
2. Test wave start:
   ```bash
   curl -X POST http://localhost:8000/api/waves/start \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"wave_number": 1, "seed": 12345}'
   ```
3. Check MongoDB collections to verify data storage
4. Test with deliberately invalid data to verify flagging works

## ⚠️ Important Notes

- The current `upgrade_data.py` only has 3 sample upgrades - you MUST populate all upgrades
- Enemy health values must exactly match frontend or validation will fail
- Frame sampling rate affects validation accuracy - balance performance vs security
- Review flagged waves regularly to tune validation thresholds

## 📖 Next Steps

1. Copy all upgrade definitions to `upgrade_data.py`
2. Verify enemy data matches frontend
3. Update frontend to call `/api/waves/start` before each wave
4. Collect frame data during gameplay
5. Submit data to `/api/waves/complete` after each wave
6. Test thoroughly with normal gameplay
7. Test with cheated data to verify detection
8. Build admin panel to review flagged waves
