import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'
import { UpgradeEffectSystem, UpgradeModifierSystem } from '../../../systems/upgrades'

/**
 * Standard bullet projectile.
 * Fast, small, deals moderate damage.
 */
export class Bullet extends Projectile {

  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.pierce = 1
    this.color = COLORS.bullet
    this.timeLeft = 3000 // milliseconds
    this.knockback = 7 // Push enemies back on hit
  }


  OnObstacleCollide(): void {
    if (UpgradeEffectSystem.hasEffect('ricochet') && !this.canCutTiles) {
      this.currentPierceCount++
      
      // Simple bounce: reverse velocity on both axes
      // The physics engine will handle the actual bouncing
      this.velocityX = -this.velocityX
      this.velocityY = -this.velocityY
      
      // Stop if we've bounced too many times
      if (this.currentPierceCount >= this.pierce) {
        this._destroy()
      }
    }
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

  // for ricochet detection

  SetDefaults(): void {
    this.damage = 10
    this.damageMultiplier = 1
    this.speed = 300 // Increased from 250 for less circling
    this.size = 6
    this.pierce = 0
    this.color = 0x00ff00
    this.timeLeft = 3000 // Despawn after 3 seconds
    this.knockback = 1 // Push enemies back on hit
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

  OnObstacleCollide(): void {
    if (UpgradeEffectSystem.hasEffect('ricochet') && !this.canCutTiles) {
      this.currentPierceCount++
      
      // Simple bounce: reverse velocity on both axes
      // The physics engine will handle the actual bouncing
      this.velocityX = -this.velocityX
      this.velocityY = -this.velocityY
      
      // Stop if we've bounced too many times
      if (this.currentPierceCount >= this.pierce) {
        this._destroy()
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
    this.pierce = 1
    this.color = 0xff4400
    this.knockback = 75

    this.explosionRadius = UpgradeModifierSystem.applyModifiers('bullet', 'explosionRadius', this.explosionRadius)
  }

  OnObstacleCollide(): void {
    this.DoExplosionDamage()
    if (UpgradeEffectSystem.hasEffect('ricochet') && !this.canCutTiles) {
      this.currentPierceCount++
      
      // Simple bounce: reverse velocity on both axes
      // The physics engine will handle the actual bouncing
      this.velocityX = -this.velocityX
      this.velocityY = -this.velocityY
      
      
      
      // Stop if we've bounced too many times
      if (this.currentPierceCount >= this.pierce) {
        this._destroy()
      }
    }
  }

  OnHitNPC(_enemy: any): boolean {
    // Explode on every hit (important for pierce - should explode each time it hits)
    this.DoExplosionDamage()
    return false // Don't apply normal bullet damage since explosion handles it
  }

  OnKill(): void {
    // Don't explode on kill - we already exploded on hit
    // This prevents double explosion when projectile is finally destroyed
  }

  // class specific explosion damage logic
  DoExplosionDamage(): void {
    // Use this.damage directly - it's already been modified by Player.applyUpgradeModifiers()
    // No need for damageMultiplier here as it's already factored in
    const explosionDamage = this.damage

    // console.log('Explosive bullet explosion damage:', explosionDamage)

    // Create explosion visual
    const explosion = this.scene.add.graphics()
    explosion.fillStyle(this.color, 0.3)
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
      damage: explosionDamage
    })
  }

}
