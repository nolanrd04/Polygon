import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'
import { UpgradeSystem, UpgradeModifierSystem } from '../../../systems/upgrades'
import { UpgradeTargetID, UpgradeStatID } from '../../../data/ID'
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
    this.cooldown = 300
  }

  OnObstacleCollide(_obstacle?: Phaser.GameObjects.GameObject): void 
  {
    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying('bullet_tileCollide'))
    {
      this.scene.sound.stopByKey('bullet_tileCollide')
    }
    this.scene.sound.play('bullet_tileCollide', { volume: getDefaultVolume('bullet_tileCollide') })
    //
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
    this.cooldown = 300
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
  // Public so homing upgrades can adjust them in modifyProjectileSpawn
  trackingDistance: number = 200
  maximumSpawnDamageMultiplier: number = 1
  minimumDamageMultiplier: number = 0.4
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
    this.cooldown = 300
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
    this.hitEnemyCooldown = 250
    this.cooldown = 300
  }

  private spawnExplosion(): void {
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new BulletExplosion()  
    explosion.SetDefaults()

    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying('explosion'))
    {
      this.scene.sound.stopByKey('explosion')
    }
    this.scene.sound.play('explosion', { volume: getDefaultVolume('explosion') })
    //

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
 * Stationary AOE explosion. Spawned by ExplosiveBullet on impact (default
 * base spec) and by Chain Reaction on kill (custom base spec). Hits all
 * enemies within its radius once, then fades out.
 */
export class BulletExplosion extends Projectile {
  private readonly baseDamage: number
  private readonly baseRadius: number

  constructor(base: { damage: number; radius: number } = { damage: 10, radius: 50 }) {
    super()
    this.baseDamage = base.damage
    this.baseRadius = base.radius
  }

  SetDefaults(): void {
    // Base values; owned upgrades adjust them through the modifyExplosion hook
    const explosion = { damage: this.baseDamage, radius: this.baseRadius }
    UpgradeSystem.dispatchModifyExplosion(explosion)

    this.damage = explosion.damage
    this.speed = 0
    this.size = explosion.radius
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

export class BuckshotBullet extends Projectile 
{
  // acts as a spawn point for the other buckshot bullets, but doesn't hit enemies itself
  minPellets = 3
  maxPellets = 5
  chokeAngle = 40
  SetDefaults(): void {
    this.damage = 3
    this.speed = 0
    this.size = 1
    this.pierce = 1
    this.color = COLORS.bullet
    this.knockback = 0
    this.spawnSound = 'bullet_shot'
    this.timeLeft = 1
    this.cooldown = 300

    this._canHitEnemy = () => false // Prevents buckshot bullets from hitting enemies directly
  }

  OnSpawn(): void {
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const numPellets = Phaser.Math.Between(this.minPellets, this.maxPellets)

    for (let i = 0; i < numPellets; i++) {
      const angleOffset = Phaser.Math.Between(-this.chokeAngle / 2, this.chokeAngle / 2)
      const radianOffset = this.rotation + Phaser.Math.DegToRad(angleOffset) // this.rotation = the direction this bullet was actually fired in
      const targetX = this.positionX + Math.cos(radianOffset) * 1000 // Arbitrary long distance
      const targetY = this.positionY + Math.sin(radianOffset) * 1000

      const pellet = new BuckshotPellet()
      pellet.SetDefaults()
      pellet.damage = this.damage // Inherit damage from the main buckshot bullet

      // Pellets are spawned directly here instead of through Player.NewProjectile(), so they
      // never go through Player.applyUpgradeModifiers() — apply the same non-damage stats by hand
      // (damage is intentionally excluded; CollisionManager applies it once per hit instead).
      for (const stat of [UpgradeStatID.Speed, UpgradeStatID.Size, UpgradeStatID.Pierce, UpgradeStatID.TimeLeft] as const) {
        (pellet as Projectile)[stat] = UpgradeModifierSystem.applyModifiers(UpgradeTargetID.Bullet, stat, (pellet as Projectile)[stat])
      }

      scene.spawnProjectile(pellet, this.positionX, this.positionY, targetX, targetY, 'player', this.ownerId)
    }
  }

  draw(): void {
    // No visual representation for the central buckshot bullet
  }
}

export class BuckshotPellet extends Projectile
{
  SetDefaults(): void {
    this.damage = 3
    this.speed = 400
    this.size = 3
    this.pierce = 1
    this.color = COLORS.bullet
    this.knockback = 5
    this.timeLeft = 2000
  }

  OnSpawn(): void {
    this.timeLeft = Phaser.Math.Between(250, 1000)
  }
}