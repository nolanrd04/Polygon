import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'

/**
 * Standard bullet projectile.
 * Fast, small, deals moderate damage.
 */
export class Bullet extends Projectile {
  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.pierce = 0
    this.color = COLORS.bullet
    this.timeLeft = 3000 // milliseconds
  }
}

/**
 * EXAMPLE
 * Heavy bullet - slower but more damage and pierce.
 */
export class HeavyBullet extends Projectile {
  SetDefaults(): void {
    this.damage = 25
    this.speed = 300
    this.size = 8
    this.pierce = 2
    this.color = 0xff6600
  }

  Draw(): void {
    // Larger bullet with thicker glow
    this.graphics.fillStyle(this.color, 1)
    this.graphics.fillCircle(0, 0, this.size)

    this.graphics.fillStyle(this.color, 0.4)
    this.graphics.fillCircle(0, 0, this.size * 2)
  }
}

/**
 * EXAMPLE
 * Homing bullet - tracks nearest enemy.
 */
export class HomingBullet extends Projectile {
  private turnSpeed: number = 0.08 // Increased from 0.05 for better tracking
  // private _lastTargetId: number = -1
  private canHome: boolean = true
  private homeDelay: number = 125 // Delay before homing re-activates after hit (milliseconds)

  SetDefaults(): void {
    this.damage = 10
    this.damageMultiplier = 0.5
    this.speed = 300 // Increased from 250 for less circling
    this.size = 6
    this.pierce = 0
    this.color = 0x00ff00
    this.timeLeft = 3000 // Despawn after 3 seconds
  }

  AI(): void {
    // Check if homing cooldown has expired
    if (!this.canHome && this.scene.time.now >= this.homeDelay) {
      this.canHome = true
    }

    // Find nearest enemy and adjust velocity towards it
    const enemies = this.scene.children.list.filter(
      (obj: any) => obj.getData?.('isEnemy')
    )

    if (enemies.length === 0) return

    if (this.canHome)
    {
      let nearest: any = null
      let nearestDist = 300

      for (const enemy of enemies) {
        const e = enemy as Phaser.GameObjects.Container
        const enemyInstance = e.getData('enemyInstance')
        if (!enemyInstance || enemyInstance.isDestroyed) continue

        const dist = Phaser.Math.Distance.Between(this.positionX, this.positionY, e.x, e.y)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = e
        }
      }

      if (nearest) {
        const targetAngle = Phaser.Math.Angle.Between(this.positionX, this.positionY, nearest.x, nearest.y)
        const currentAngle = Math.atan2(this.velocityY, this.velocityX)

        // Gradually turn towards target
        const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle)
        const newAngle = currentAngle + angleDiff * this.turnSpeed

        this.velocityX = Math.cos(newAngle) * this.speed
        this.velocityY = Math.sin(newAngle) * this.speed
        this.container.rotation = newAngle
      }
    }
  }

  OnHitNPC(_enemy: any): boolean {
    // Disable homing temporarily after hitting to prevent sticking
    this.canHome = false
    this.homeDelay = this.scene.time.now + 500 // Re-enable homing after 500ms
    this.damage *= .5
    return true
  }

  Draw(): void {
    // Triangle shape for homing bullet
    this.graphics.fillStyle(this.color, 1)
    this.graphics.beginPath()
    this.graphics.moveTo(this.size, 0)
    this.graphics.lineTo(-this.size, -this.size * 0.6)
    this.graphics.lineTo(-this.size, this.size * 0.6)
    this.graphics.closePath()
    this.graphics.fillPath()

    // Glow
    this.graphics.fillStyle(this.color, 0.3)
    this.graphics.fillCircle(0, 0, this.size * 1.5)
  }
}

/**
 * EXAMPLE
 * Explosive bullet - explodes on death dealing AOE damage.
 */
export class ExplosiveBullet extends Projectile {
  private explosionRadius: number = 50

  SetDefaults(): void {
    this.damage = 20
    this.speed = 350
    this.size = 7
    this.pierce = 0
    this.color = 0xff4400
  }


  Draw(): void {
    // Pulsing effect
    this.graphics.fillStyle(this.color, 1)
    this.graphics.fillCircle(0, 0, this.size)

    this.graphics.fillStyle(0xffff00, 0.5)
    this.graphics.fillCircle(0, 0, this.size * 0.5)
  }

  OnHitNPC(_enemy: any): boolean {
    this.OnKill()
    return true
  }

  OnKill(): void {
    // Create explosion visual
    const explosion = this.scene.add.graphics()
    explosion.fillStyle(this.color, 0.6)
    explosion.fillCircle(this.positionX, this.positionY, this.explosionRadius)

    // Fade out
    this.scene.tweens.add({
      targets: explosion,
      alpha: 0,
      duration: 200,
      onComplete: () => explosion.destroy()
    })

    // Emit explosion event for AOE damage
    this.scene.events.emit('explosion-damage', {
      x: this.positionX,
      y: this.positionY,
      radius: this.explosionRadius,
      damage: this.damage * 0.5 // 50% of projectile damage
    })
  }
}
