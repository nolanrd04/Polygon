import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'
import { UpgradeEffectSystem, UpgradeModifierSystem } from '../../../systems/upgrades'
import { TextureGenerator } from '../../../utils/TextureGenerator'

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
  private directionIndicator?: Phaser.GameObjects.Sprite
  private trackingDistance: number = 200
  private maximumSpawnDamageMultiplier: number = 1
  private minimumDamageMultiplier: number = 0.3
  private initialDamage: number = 0 // Will be set on first AI frame after upgrades applied
  private hasInitializedDamage: boolean = false

  // for ricochet detection

  SetDefaults(): void {
    this.damage = 10
    this.damageMultiplier = 1
    this.speed = 300 // Increased from 250 for less circling
    this.size = 6
    this.pierce = 1
    this.color = 0x00ff00
    this.timeLeft = 3000 // Despawn after 3 seconds
    this.knockback = 1 // Push enemies back on hit
    
    this.trackingDistance = UpgradeModifierSystem.applyModifiers('bullet', 'trackingDistance', this.trackingDistance)
    this.maximumSpawnDamageMultiplier = UpgradeModifierSystem.applyModifiers('bullet', 'maximumSpawnDamageMultiplier', this.maximumSpawnDamageMultiplier)
    this.minimumDamageMultiplier = UpgradeModifierSystem.applyModifiers('bullet', 'minimumDamageMultiplier', this.minimumDamageMultiplier)
    console.log('Maximum spawn damage multiplier:', this.maximumSpawnDamageMultiplier)
    console.log('Minimum damage multiplier:', this.minimumDamageMultiplier)
  }

  PreDraw(): boolean {
      if (this.sprite.texture.key.startsWith('circle_') && this.sprite.texture.key.includes('_fffffff_1_s')) {

      const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
        radius: this.size,
        fillColor: 0xffffff,
        fillAlpha: 0.5  // Single semi-transparent circle, no glow
      })

      const oldSprite = this.sprite
      this.sprite = this.scene.add.sprite(0, 0, textureKey)
      this.sprite.setTint(this.color)
      this.sprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
      this.container.add(this.sprite)
      oldSprite.destroy()

      // Add direction indicator (solid triangle pointing right)
      if (!this.directionIndicator) {
        const triangleTexture = TextureGenerator.getOrCreatePolygon(this.scene, {
          sides: 3,
          radius: this.size * 0.9,  // Smaller than the circle
          fillColor: this.color,
          fillAlpha: 1.0,  // Solid
          rotation: 0  // Point to the right
        })
        this.directionIndicator = this.scene.add.sprite(0, 0, triangleTexture)
        this.directionIndicator.setScale(TextureGenerator.getDisplayScale())
        this.container.add(this.directionIndicator)
      }
    }
    return true
  }

  AI(): void {
    // Capture the modified damage on first frame (after Player.applyUpgradeModifiers)
    if (!this.hasInitializedDamage) {
      this.initialDamage = this.damage
      this.hasInitializedDamage = true
    }

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
      let nearestDist = this.trackingDistance

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

  // private getDamageMultiplier(): number {
  //   const elapsedTime = this.scene.time.now - this.spawnTime
  //   const progress = Math.min(1, elapsedTime / this.timeLeft)

  //   // Only decay for first half of lifetime
  //   if (progress > 0.25) {
  //     return this.minimumDamageMultiplier
  //   }

  //   // Interpolate from max to min over first half
  //   const halfLifeProgress = progress / 0.25 // Convert to 0-1 range for first half
  //   return this.maximumSpawnDamageMultiplier - (halfLifeProgress * (this.maximumSpawnDamageMultiplier - this.minimumDamageMultiplier))
  // }

  OnHitNPC(_enemy: any): boolean {
    // Disable homing temporarily after hitting to prevent sticking
    this.canHome = false
    this.homeDelay = this.scene.time.now + 500 // Re-enable homing after 500ms
    
    // Apply damage decay based on time alive
    this.damage = this.initialDamage * this.minimumDamageMultiplier
    console.log('Collision damage (decayed):', this.damage)
    return true
  }

}

/**
 * EXAMPLE
 * Explosive bullet - explodes on death dealing AOE damage.
 */
export class ExplosiveBullet extends Projectile {
  private explosionRadius: number = 50
  private explosionDamage: number = 0 // Additional damage on top of bullet damage

  SetDefaults(): void {
    this.damage = 20
    this.speed = 350
    this.size = 7
    this.pierce = 1
    this.color = 0xff4400
    this.knockback = 75

    this.explosionRadius = UpgradeModifierSystem.applyModifiers('bullet', 'explosionRadius', this.explosionRadius)
    this.explosionDamage = UpgradeModifierSystem.applyModifiers('bullet', 'explosionDamage', 0)
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
    // Add the explosionDamage modifier on top (both additive and multiplicative mods)
    const baseDamage = this.damage + this.explosionDamage
    
    // Apply explosionDamage multiplicative modifiers if they exist
    const multiplicativeBonus = UpgradeModifierSystem.getMultiplicativeModifier('bullet', 'explosionDamage')
    const explosionDamage = baseDamage * (1 + multiplicativeBonus)

    // console.log('Explosive bullet explosion damage:', explosionDamage)

    // Create explosion visual using TextureGenerator
    const explosionTexture = TextureGenerator.getOrCreateCircle(this.scene, {
      radius: this.explosionRadius,
      fillColor: 0xffffff,
      fillAlpha: 0.4
    })

    const explosion = this.scene.add.sprite(this.positionX, this.positionY, explosionTexture)
    explosion.setTint(this.color)
    explosion.setScale(TextureGenerator.getDisplayScale())

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
