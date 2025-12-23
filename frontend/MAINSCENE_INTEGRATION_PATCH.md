# MainScene Integration Patch

This file documents the changes needed to integrate wave validation into MainScene.ts

## 1. Add Import (near line 12)

```typescript
import { waveValidation } from '../services/WaveValidation'
```

## 2. Add to update() method - After line 148 (inside update method, early on)

```typescript
update(_time: number, delta: number): void {
  if (GameManager.getState().isPaused) return

  // INCREMENT FRAME COUNTER FOR WAVE VALIDATION
  waveValidation.incrementFrame()

  // SAMPLE FRAME DATA EVERY 30 FRAMES (about 2x per second at 60fps)
  if (waveValidation.getStats().frameCount % 30 === 0) {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    waveValidation.sampleFrame(
      this.player.x,
      this.player.y,
      playerBody.velocity.x,
      playerBody.velocity.y,
      GameManager.getPlayerStats().health
    )
  }

  // ... rest of update method continues as normal
```

## 3. Modify applyUpgrade() method - Around line 327

Replace the success block (after `const success = UpgradeSystem.applyUpgrade(upgrade)`) with:

```typescript
if (success) {
  console.log(`Applied upgrade: ${upgrade.name}${skipCost ? ' (DEV - FREE)' : ''}`)

  // VALIDATE WITH BACKEND (skip for dev tools)
  if (!skipCost) {
    const currentWave = GameManager.getWave()
    waveValidation.selectUpgrade(upgradeId, currentWave).then(validated => {
      if (!validated) {
        console.warn('Backend rejected upgrade selection - possible desync')
      }
    })
  }

  // Deduct points (skip for dev tools)
  if (!skipCost && cost > 0) {
    GameManager.addPoints(-cost)
  }

  // ... rest of the success block continues as normal
```

## 4. Track Enemy Deaths

Add this to the EnemyManager.ts file (or create an event listener in MainScene):

In EnemyManager.ts, find the `removeEnemy()` method or where enemies are killed, and add:

```typescript
// When an enemy dies, record it
import { waveValidation } from '../services/WaveValidation'

// In removeEnemy() or wherever enemy death is handled:
waveValidation.recordEnemyDeath(enemy.constructor.name, enemy.x, enemy.y)
```

## 5. Track Damage

In CollisionManager.ts or wherever damage is dealt, add:

```typescript
import { waveValidation } from '../services/WaveValidation'

// After dealing damage to enemy:
waveValidation.recordDamage(damageDealt)
```

## Alternative: Use EventBus

If you prefer not to modify EnemyManager and CollisionManager directly, add event listeners in MainScene:

```typescript
// In MainScene.create(), add:
EventBus.on('enemy-killed', (data: { type: string; x: number; y: number }) => {
  waveValidation.recordEnemyDeath(data.type, data.x, data.y)
})

EventBus.on('damage-dealt', (damage: number) => {
  waveValidation.recordDamage(damage)
})

// Then emit these events from EnemyManager and CollisionManager:
EventBus.emit('enemy-killed', { type: enemy.constructor.name, x: enemy.x, y: enemy.y })
EventBus.emit('damage-dealt', damageAmount)
```

## Summary of Changes

1. **Import waveValidation service**
2. **In update()**: Increment frame counter and sample frames
3. **In applyUpgrade()**: Validate upgrade selection with backend
4. **Track enemy deaths**: Either directly or via EventBus
5. **Track damage dealt**: Either directly or via EventBus

These changes enable the anti-cheat system while maintaining all existing functionality.
