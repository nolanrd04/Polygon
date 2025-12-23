# Wave Validation Anti-Cheat System - Integration Complete

## Overview
The comprehensive wave validation and anti-cheat system has been fully integrated into the Polygon game. The system validates gameplay through server-authoritative upgrade rolling, frame-by-frame movement tracking, damage validation, and enemy death verification.

## System Architecture

### Backend Components

**API Endpoints** (`backend/app/api/waves.py`):
- `POST /api/waves/start` - Start wave, roll upgrades, issue 30-second token
- `POST /api/waves/complete` - Submit wave data for validation
- `POST /api/waves/select-upgrade` - Validate upgrade selection

**Services** (`backend/app/services/wave_service.py`):
- `WaveService` - Core validation logic including:
  - Upgrade rolling with rarity weights
  - Frame-by-frame movement validation (10% tolerance)
  - Damage vs enemy health verification
  - Kill count validation
  - Multi-severity flagging system

**Data Models**:
- `upgrade_data.py` - All 40+ upgrades matching frontend JSON files
- `enemy_data.py` - Enemy health calculations matching frontend exactly
- `WaveValidationToken` - 30-second cryptographic tokens
- `FlaggedWave` - Suspicious activity storage with detailed reasons

**Validation Features**:
- Enemy health matches frontend: `Math.exp(wave / 6)` multiplier
- Hexagon shields (65% of health) accounted for
- Movement validation with framerate tolerance
- Upgrade dependency checking
- Stack limit enforcement
- Attack type filtering

### Frontend Components

**Services** (`frontend/src/game/services/WaveValidation.ts`):
- `WaveValidationService` - Tracks and submits wave data:
  - Frame sampling (every 30 frames)
  - Enemy death recording
  - Damage tracking
  - Wave start/complete API calls

**Integration Points**:

1. **MainScene.ts** - Frame sampling and event tracking
   ```typescript
   // Increment frame counter
   waveValidation.incrementFrame()

   // Sample every 30 frames
   if (waveValidation.getStats().frameCount % 30 === 0) {
     waveValidation.sampleFrame(x, y, vx, vy, health)
   }

   // Listen for events
   EventBus.on('enemy-killed', (data) => waveValidation.recordEnemyDeath(...))
   EventBus.on('damage-dealt', (damage) => waveValidation.recordDamage(damage))
   ```

2. **Enemy.ts** - Emit kill events
   ```typescript
   private _die(): void {
     EventBus.emit('enemy-killed', {
       type: this.constructor.name,
       x: this.x,
       y: this.y
     })
   }
   ```

3. **CollisionManager.ts** - Emit damage events
   ```typescript
   killed = enemy.takeDamage(finalDamage)
   EventBus.emit('damage-dealt', finalDamage)
   ```

4. **WaveManager.ts** - Wave lifecycle
   ```typescript
   async startNextWave() {
     const seed = Math.floor(Math.random() * 1000000)
     const offeredUpgrades = await waveValidation.startWave(wave, seed)
   }

   async completeWave() {
     const result = await waveValidation.completeWave(wave)
   }
   ```

5. **UpgradeModal.tsx** - Display backend upgrades
   ```typescript
   const loadBackendUpgrades = () => {
     const offeredUpgradeIds = waveValidation.getOfferedUpgrades()
     // Map IDs to full upgrade objects
   }
   ```

## Complete Wave Flow

### 1. Wave Start
1. Player clicks "START WAVE"
2. WaveManager generates random seed
3. Backend API call: `/api/waves/start` with wave number and seed
4. Backend:
   - Creates 30-second validation token
   - Rolls 3 upgrades based on player's current upgrades and attack type
   - Returns token and offered upgrade IDs
5. Frontend stores token and offered upgrades
6. UpgradeModal displays backend-rolled upgrades

### 2. During Wave
1. Every frame:
   - `waveValidation.incrementFrame()` increments counter
2. Every 30 frames:
   - Sample player position, velocity, and health
   - Store in `frameSamples` array
3. When enemy dies:
   - Enemy.ts emits 'enemy-killed' event
   - MainScene records: enemy type, x, y, frame number
4. When damage is dealt:
   - CollisionManager.ts emits 'damage-dealt' event
   - MainScene records total damage

### 3. Upgrade Selection (Between Waves)
1. Player clicks upgrade
2. Frontend emits 'upgrade-selected' event
3. MainScene.applyUpgrade() validates with backend
4. Backend API call: `/api/waves/select-upgrade`
5. Backend verifies upgrade was offered and is valid
6. If valid, upgrade applied; if not, warning logged

### 4. Wave Complete
1. All enemies killed
2. WaveManager.completeWave() called
3. Backend API call: `/api/waves/complete` with:
   - Token (30-second validation)
   - Wave number
   - Total kills and damage
   - Frame samples (position/velocity/health)
   - Enemy deaths (type, location, frame)
   - Upgrades used
4. Backend validates:
   - Token not expired (< 30 seconds)
   - Damage sufficient to kill reported enemies
   - Movement within 10% tolerance of player speed
   - No impossible velocity changes
   - Upgrades match allowed set
5. If suspicious, flag to `admin.flagged_waves` collection
6. Return success/failure to frontend

## Flagging System

**Severity Levels**:
- `low` - Minor anomalies (5-10% variance)
- `medium` - Moderate issues (10-25% variance)
- `high` - Significant violations (25-50% variance)
- `critical` - Blatant cheating (>50% variance or impossible actions)

**Flag Categories**:
- `movement` - Impossible speed or teleportation
- `damage` - Insufficient damage for kills
- `upgrades` - Using upgrades not offered
- `kills` - Wrong enemy types or counts

**Auto-Ban**:
- Critical severity flags trigger automatic account suspension
- All data stored for admin review

## Testing Checklist

To test the complete system:

1. **Start MongoDB**: `mongod` or Docker container
2. **Start Backend**: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload`
3. **Start Frontend**: `cd frontend && npm run dev`
4. **Create Account**: Register with username, first name, last name
5. **Start Game**: Select attack type
6. **Wave 1**:
   - Verify backend console shows token generation
   - Verify 3 upgrades displayed in modal
   - Verify upgrades are from backend (check console logs)
7. **During Wave**:
   - Open browser console
   - Verify frame sampling every 30 frames
   - Verify enemy-killed events emitted
   - Verify damage-dealt events emitted
8. **Complete Wave**:
   - Verify backend validates successfully
   - Check MongoDB `wave_validation_tokens` collection for token
   - Check `player_stats` for updated upgrades
9. **Test Flagging**:
   - Modify frontend to send impossible data (e.g., 0 damage but 100 kills)
   - Verify wave flagged in `admin.flagged_waves` collection
   - Verify detailed reasons in flag document

## Database Collections

- `users` - User accounts (username, hashed password, names)
- `player_stats` - Player progress (upgrades, wave, stats)
- `wave_validation_tokens` - 30-second tokens (auto-expire)
- `admin.flagged_waves` - Suspicious gameplay (detailed analysis)

## Security Features

- ✅ Server-authoritative upgrade rolling
- ✅ Cryptographic 30-second tokens prevent replay attacks
- ✅ Frame-by-frame movement validation
- ✅ Damage vs enemy health verification
- ✅ Kill count and enemy type validation
- ✅ Upgrade dependency and conflict checking
- ✅ Multi-severity flagging system
- ✅ Detailed admin review data
- ✅ Auto-ban for critical violations

## Files Modified

### Backend
- `backend/app/core/upgrade_data.py` - NEW: All 40+ upgrades
- `backend/app/core/enemy_data.py` - NEW: Enemy health calculations
- `backend/app/services/wave_service.py` - NEW: Validation logic
- `backend/app/api/waves.py` - NEW: Wave endpoints
- `backend/app/models/wave_token.py` - NEW: Token model
- `backend/app/models/flagged_wave.py` - NEW: Flag model
- `backend/app/models/player_stats.py` - MODIFIED: Added current_upgrades, current_wave, total_damage_dealt

### Frontend
- `frontend/src/game/services/WaveValidation.ts` - NEW: Validation service
- `frontend/src/game/scenes/MainScene.ts` - MODIFIED: Frame sampling, event listeners
- `frontend/src/game/entities/enemies/Enemy.ts` - MODIFIED: Emit 'enemy-killed' event
- `frontend/src/game/systems/CollisionManager.ts` - MODIFIED: Emit 'damage-dealt' event
- `frontend/src/game/systems/WaveManager.ts` - MODIFIED: Call wave start/complete API
- `frontend/src/components/UpgradeModal.tsx` - MODIFIED: Use backend upgrades

## Next Steps

1. Test the complete system end-to-end
2. Tune validation tolerances based on real gameplay data
3. Implement admin dashboard to review flagged waves
4. Add backend endpoint for reroll (currently reroll just reloads same upgrades)
5. Consider adding more validation metrics (projectile patterns, upgrade synergies)
6. Add rate limiting to prevent API spam
7. Implement session replay feature for flagged waves

## Notes

- Frame sampling rate is configurable (currently every 30 frames)
- Movement tolerance is 10% to account for framerate variance
- Tokens expire after 30 seconds to prevent token reuse
- All validation is non-blocking - game continues even if validation fails (but flags are recorded)
- Enemy health calculations match frontend exactly: `base_health * exp(wave / 6)`
- Hexagon shields are 65% of their health (from Hexagon.ts)
