import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'
import { UpgradeModifierSystem } from '../../../systems/upgrades'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { getDefaultVolume } from '../../../core/AudioRegistry'

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
    this.spawnSound = 'bullet_shot'
  }

  OnObstacleCollide(_obstacle?: Phaser.GameObjects.GameObject): void {
    this.scene.sound.play('bullet_tileCollide', { volume: getDefaultVolume('bullet_tileCollide') })
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
    this.spawnSound = 'bullet_shot'
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
  private minimumDamageMultiplier: number = 0.4
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
    this.spawnSound = 'bullet_shot'
    this.trackingDistance = UpgradeModifierSystem.applyModifiers('bullet', 'trackingDistance', this.trackingDistance)
    this.maximumSpawnDamageMultiplier = UpgradeModifierSystem.applyModifiers('bullet', 'maximumSpawnDamageMultiplier', this.maximumSpawnDamageMultiplier)
    this.minimumDamageMultiplier = UpgradeModifierSystem.applyModifiers('bullet', 'minimumDamageMultiplier', this.minimumDamageMultiplier)
    console.log('Maximum spawn damage multiplier:', this.maximumSpawnDamageMultiplier)
    console.log('Minimum damage multiplier:', this.minimumDamageMultiplier)
  }

  PreDraw(): boolean {
    this.swapToCustomCircle({ fillAlpha: 0.5 })

    if (!this.directionIndicator) {
      const triangleTexture = TextureGenerator.getOrCreatePolygon(this.scene, {
        sides: 3,
        radius: this.size * 0.9,
        fillColor: this.color,
        fillAlpha: 1.0,
        rotation: 0
      })
      this.directionIndicator = this.scene.add.sprite(0, 0, triangleTexture)
      this.directionIndicator.setScale(TextureGenerator.getDisplayScale())
      this.container.add(this.directionIndicator)
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
    // console.log('Collision damage (decayed):', this.damage)
    return true
  }

  OnObstacleCollide(_obstacle?: Phaser.GameObjects.GameObject): void {
    this.scene.sound.play('bullet_tileCollide', { volume: getDefaultVolume('bullet_tileCollide') })
  }

}

/**
 * Explosive bullet - deals normal bullet damage on direct hit, then spawns a
 * BulletExplosion at the impact point for AOE damage.
 */
export class ExplosiveBullet extends Projectile {
  SetDefaults(): void {
    this.damage = 10
    this.speed = 350
    this.size = 7
    this.pierce = 1
    this.color = 0xff4400
    this.knockback = 75
    this.spawnSound = 'bullet_shot'
  }

  private spawnExplosion(): void {
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new BulletExplosion()
    explosion.SetDefaults()
    this.scene.sound.play('explosion', { volume: getDefaultVolume('explosion') })
    scene.spawnProjectile(explosion, this.positionX, this.positionY, this.positionX, this.positionY, 'player', this.ownerId)
  }

  OnHitNPC(_enemy: any): boolean {
    this.spawnExplosion()
    return true
  }

  OnObstacleCollide(): void {
    this.spawnExplosion()
  }
}

/**
 * Stationary AOE explosion spawned by ExplosiveBullet on impact.
 * Hits all enemies within its radius once, then fades out.
 */
export class BulletExplosion extends Projectile {
  SetDefaults(): void {
    this.damage = UpgradeModifierSystem.applyModifiers('bullet', 'explosionDamage', 10)
    this.speed = 0
    this.size = UpgradeModifierSystem.applyModifiers('bullet', 'explosionRadius', 50)
    this.pierce = 999999
    this.color = 0xff4400
    this.timeLeft = 200
    this.hitEnemyCooldown = 500 // longer than timeLeft so each enemy is only hit once
    this.canCutTiles = true
  }

  PreDraw(): boolean {
    this.swapToCustomCircle({ fillAlpha: 0.4 })
    return true
  }

  Draw(): void {
    const elapsed = this.scene.time.now - this.spawnTime
    this.sprite.setAlpha(Math.max(0, 1 - elapsed / this.timeLeft))
  }

  OnHitNPC(_enemy: any): boolean {
    return true
  }
}
