# Projectile System

This document explains how to create and customize projectiles in Polygon.

## Quick Start

To create a new projectile, extend the `Projectile` class and override `SetDefaults()`:

```typescript
import { Projectile } from './Projectile'

export class MyProjectile extends Projectile {
  SetDefaults() {
    this.damage = 25
    this.speed = 500
    this.size = 8
    this.color = 0xff0000 // red
  }
}
```

That's it! The projectile will automatically:
- Spawn and fly towards the target
- Deal damage when hitting enemies
- Despawn when it leaves the screen or times out

---

## Available Stats

Set these in your `SetDefaults()` method:

| Stat | Default | Description |
|------|---------|-------------|
| `damage` | 10 | How much damage dealt on hit |
| `speed` | 400 | Movement speed (pixels per second) |
| `size` | 5 | Radius in pixels (affects hitbox and visuals) |
| `pierce` | 0 | How many enemies it passes through (0 = destroys on first hit) |
| `color` | 0x00ffff | Hex color (e.g. `0xff0000` for red, `0x00ff00` for green) |
| `glowAlpha` | 0.3 | Glow transparency (0 = invisible, 1 = solid) |
| `glowScale` | 1.5 | Glow size multiplier (1.5 = 50% larger than projectile) |
| `timeLeft` | 60000 | Lifetime in milliseconds before auto-despawn |

---

## Lifecycle Hooks

Override these methods to customize behavior:

### `SetDefaults()`
**Required.** Called once when the projectile is created. Set your stats here.

```typescript
SetDefaults() {
  this.damage = 50
  this.speed = 300
  this.pierce = 3
  this.timeLeft = 5000 // 5 seconds
}
```

### `Draw()`
**Optional.** Called once after spawning. Customize the projectile's appearance.

Use `this.graphics` to draw shapes. The projectile is drawn at (0, 0) - the graphics will automatically move with the projectile.

```typescript
Draw() {
  // Draw a square instead of circle
  this.graphics.fillStyle(this.color, 1)
  this.graphics.fillRect(-this.size, -this.size, this.size * 2, this.size * 2)
}
```

```typescript
Draw() {
  // Draw a triangle (arrow shape)
  this.graphics.fillStyle(this.color, 1)
  this.graphics.beginPath()
  this.graphics.moveTo(this.size, 0)           // tip
  this.graphics.lineTo(-this.size, -this.size) // top-left
  this.graphics.lineTo(-this.size, this.size)  // bottom-left
  this.graphics.closePath()
  this.graphics.fillPath()
}
```

### `AI()`
**Optional.** Called every frame. Use to create custom movement patterns.

You have access to:
- `this.positionX`, `this.positionY` - current position
- `this.velocityX`, `this.velocityY` - current velocity (modify these to change direction)
- `this.speed` - your defined speed
- `this.scene` - the Phaser scene (for timers, effects, etc.)

Helper methods:
- `this.distanceTo(x, y)` - get distance to a point
- `this.angleTo(x, y)` - get angle to a point (radians)
- `this.moveTowards(x, y)` - set velocity to move towards a point

```typescript
// Homing projectile example
AI() {
  const enemy = this.findNearestEnemy()
  if (enemy) {
    this.moveTowards(enemy.x, enemy.y)
  }
}
```

```typescript
// Wavy/sine movement example
private waveOffset = 0

AI() {
  this.waveOffset += 0.1
  const waveAmount = Math.sin(this.waveOffset) * 50

  // Add perpendicular wave motion
  const perpAngle = this.rotation + Math.PI / 2
  this.velocityX += Math.cos(perpAngle) * waveAmount * 0.1
  this.velocityY += Math.sin(perpAngle) * waveAmount * 0.1
}
```

### `OnHitNPC(enemy)`
**Optional.** Called when the projectile hits an enemy. Return `true` to deal damage, `false` to ignore the hit.

```typescript
// Apply a burn effect on hit
OnHitNPC(enemy) {
  enemy.applyDebuff('burn', 3000) // burn for 3 seconds
  return true // still deal damage
}
```

```typescript
// Lifesteal - heal player on hit
OnHitNPC(enemy) {
  const healAmount = this.damage * 0.2 // 20% lifesteal
  this.scene.events.emit('heal-player', healAmount)
  return true
}
```

```typescript
// Only damage certain enemy types
OnHitNPC(enemy) {
  if (enemy.type === 'ghost') {
    return false // can't hit ghosts
  }
  return true
}
```

### `OnKill()`
**Optional.** Called when the projectile is destroyed (hit something, timed out, or left screen).

```typescript
// Explosion effect
OnKill() {
  const explosion = this.scene.add.circle(
    this.positionX,
    this.positionY,
    50,
    0xff4400,
    0.6
  )

  this.scene.tweens.add({
    targets: explosion,
    alpha: 0,
    scale: 2,
    duration: 200,
    onComplete: () => explosion.destroy()
  })
}
```

```typescript
// Spawn child projectiles on death
OnKill() {
  this.scene.events.emit('spawn-projectiles', {
    type: 'fragment',
    x: this.positionX,
    y: this.positionY,
    count: 8,
    spreadAngle: Math.PI * 2 // full circle
  })
}
```

---

## Example Projectiles

### Basic Bullet
```typescript
export class Bullet extends Projectile {
  SetDefaults() {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.color = 0x00ffff
  }
}
```

### Heavy Piercing Shot
```typescript
export class HeavyShot extends Projectile {
  SetDefaults() {
    this.damage = 30
    this.speed = 250
    this.size = 12
    this.pierce = 5
    this.color = 0xff6600
  }

  Draw() {
    // Larger glow for heavy shot
    this.graphics.fillStyle(this.color, 1)
    this.graphics.fillCircle(0, 0, this.size)
    this.graphics.fillStyle(this.color, 0.5)
    this.graphics.fillCircle(0, 0, this.size * 2.5)
  }
}
```

### Homing Missile
```typescript
export class HomingMissile extends Projectile {
  private turnSpeed = 0.08

  SetDefaults() {
    this.damage = 20
    this.speed = 200
    this.size = 8
    this.color = 0x00ff00
    this.timeLeft = 4000
  }

  AI() {
    // Find nearest enemy
    const enemies = this.scene.children.list.filter(
      (obj: any) => obj.getData?.('isEnemy')
    )

    if (enemies.length === 0) return

    let nearest: any = null
    let nearestDist = Infinity

    for (const enemy of enemies) {
      const dist = this.distanceTo(enemy.x, enemy.y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = enemy
      }
    }

    if (nearest) {
      // Gradually turn towards target
      const targetAngle = this.angleTo(nearest.x, nearest.y)
      const currentAngle = Math.atan2(this.velocityY, this.velocityX)
      const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle)
      const newAngle = currentAngle + angleDiff * this.turnSpeed

      this.velocityX = Math.cos(newAngle) * this.speed
      this.velocityY = Math.sin(newAngle) * this.speed
      this.container.rotation = newAngle
    }
  }

  Draw() {
    // Triangle/arrow shape
    this.graphics.fillStyle(this.color, 1)
    this.graphics.beginPath()
    this.graphics.moveTo(this.size, 0)
    this.graphics.lineTo(-this.size, -this.size * 0.6)
    this.graphics.lineTo(-this.size * 0.5, 0)
    this.graphics.lineTo(-this.size, this.size * 0.6)
    this.graphics.closePath()
    this.graphics.fillPath()
  }

  OnKill() {
    // Small explosion on death
    const boom = this.scene.add.circle(this.positionX, this.positionY, 20, this.color, 0.5)
    this.scene.tweens.add({
      targets: boom,
      alpha: 0,
      scale: 2,
      duration: 150,
      onComplete: () => boom.destroy()
    })
  }
}
```

### Explosive Rocket
```typescript
export class Rocket extends Projectile {
  private explosionRadius = 80
  private explosionDamage = 40

  SetDefaults() {
    this.damage = 10 // direct hit damage
    this.speed = 300
    this.size = 10
    this.color = 0xff4400
  }

  OnKill() {
    // Big explosion
    const explosion = this.scene.add.graphics()
    explosion.fillStyle(0xff4400, 0.6)
    explosion.fillCircle(this.positionX, this.positionY, this.explosionRadius)

    this.scene.tweens.add({
      targets: explosion,
      alpha: 0,
      duration: 300,
      onComplete: () => explosion.destroy()
    })

    // Tell the game to deal AOE damage
    this.scene.events.emit('explosion', {
      x: this.positionX,
      y: this.positionY,
      radius: this.explosionRadius,
      damage: this.explosionDamage
    })
  }
}
```

---

## Tips

1. **Colors** are hex values: `0xRRGGBB`
   - Red: `0xff0000`
   - Green: `0x00ff00`
   - Blue: `0x0000ff`
   - Yellow: `0xffff00`
   - Cyan: `0x00ffff`
   - Orange: `0xff6600`

2. **Speed** is in pixels per second. The screen is 1280x720 by default, so:
   - 400 = crosses screen in ~3 seconds
   - 800 = crosses screen in ~1.5 seconds

3. **Pierce** of 0 means the projectile is destroyed on first hit. Pierce of 3 means it can hit 4 enemies total (first hit + 3 pierce).

4. **timeLeft** is useful for:
   - Short-lived effects (set to 500-1000ms)
   - Preventing projectiles from flying forever
   - Balancing powerful projectiles

5. **Drawing** is done at local coordinates (0, 0 is center of projectile). The graphics automatically move with the projectile.

6. **Events** are the best way to communicate with other systems:
   ```typescript
   this.scene.events.emit('my-event', { data: 'here' })
   ```
