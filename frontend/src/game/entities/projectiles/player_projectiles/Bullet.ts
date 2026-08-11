import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'
import { UpgradeSystem, UpgradeModifierSystem, UpgradeEffectSystem } from '../../../systems/upgrades'
import { UpgradeTargetID, UpgradeStatID, SoundID, UpgradeEffectID } from '../../../data/ID'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { getDefaultVolume } from '../../../core/AudioRegistry'
import { Particle } from '../../particles/Particle'
import { SparkParticle, StreakParticle, SmokeParticle, ShardParticle } from '../../particles/BasicParticles'

/**
 * Standard bullet projectile.
 * Fast, small, deals moderate damage.
 */
export class Bullet extends Projectile {

    private particleTimer: number = 0
  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.pierce = 1
    this.color = COLORS.bullet
    this.timeLeft = 3000 // milliseconds
    this.knockback = 7 // Push enemies back on hit
    this.spawnSound = SoundID.BulletShot
    this.cooldown = 300
  }

  OnHitNPC(_enemy: any): boolean {

    for (let i = 0; i < 3; i++) {

      Particle.NewParticle(SparkParticle, this.positionX, this.positionY, 
        this.velocityX * Phaser.Math.Between(0.1, 0.2), 
        this.velocityY * Phaser.Math.Between(0.1, 0.2), 
      {
        color: this.color,
        timeLeft: 300,
        scale: 0.75,
        radius: 1.5
      })
    }
    return true
  }
  OnObstacleCollide(obstacle?: Phaser.GameObjects.GameObject): boolean
  {
    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying(SoundID.BulletCollide))
    {
      this.scene.sound.stopByKey(SoundID.BulletCollide)
    }
    this.scene.sound.play(SoundID.BulletCollide, { volume: getDefaultVolume(SoundID.BulletCollide) })
    //

    // Impact scatter. randomAngle draws each angle independently instead of
    // giving every spark an evenly-spaced slot, so the spray clumps unevenly
    // like a real ricochet rather than reading as a radial starburst.
    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(3, 5), {
      randomAngle: true,
      speed: 120,
      speedVariance: 0.2,
      color: this.color,
      timeLeft: 300,
      scale: 1,
      radius: 1.5
    })

    // We handle the ricochet upgrade here: bounce instead of dying if owned.
    if (obstacle && UpgradeEffectSystem.hasEffect(UpgradeEffectID.Ricochet)) {
      this.ricochet(obstacle)
      return false
    }
    return true
  }

  AI(): void {

    // Simple sparkle:
    if (this.particleTimer % 10 === 0) {
      Particle.NewParticle(SparkParticle, this.positionX, this.positionY, 
        this.velocityX * Phaser.Math.Between(0.1, 0.2), 
        this.velocityY * Phaser.Math.Between(0.1, 0.2), 
      {
        color: this.color,
        timeLeft: 300,
        scale: 0.5,
        radius: 1.5
      })
    }

    // Streak trail: one every 4th frame, aimed along the bullet's heading
    /*
    if (this.particleTimer % 4 === 0) {
      const streak = Particle.NewParticlePerfect(StreakParticle, this.positionX, this.positionY, 0, 0, {
        timeLeft: 300,
        color: this.color,
        rotation: this.rotation
      })
      // 12px long, 3px thick. Pool returns null when full, so null-check.
      if (streak) streak.SetStreak(12, 2)
    }
    */

      // Shard trail: one every 15th frame, random rotation
      /*
    if (this.particleTimer % 15 === 0) {
      Particle.NewParticlePerfect(ShardParticle, this.positionX, this.positionY, 0, 0, {
        timeLeft: 300,
        color: this.color,
        rotation: this.rotation
      })
    }
      */
    this.particleTimer++
  }

}

/**
 * EXAMPLE
 * Homing bullet - tracks nearest enemy.
 */
export class HomingBullet extends Projectile {

  /*
  Spawns with 100% of its damage then decreased to 40% of its damage over half its life. After hitting its target, take a 20% (before upgrades) damage 
  reduction to the original 100% base damage. Flow looks like this:
  */

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

  // value to determine the flat damage reduction AFTER hitting an enemy
  private hitEnemyDamageReduction: number = 0.3
  // Number of enemies already hit this bullet's lifetime (pierce). Reduction compounds per hit past the first.
  private hitCount: number = 0

  private particleTimer: number = 0

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
    this.spawnSound = SoundID.BulletShot
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
        this.rotation = newAngle
      }
    }

    if (this.particleTimer % 16 === 0) {
      const streak = Particle.NewParticlePerfect(StreakParticle, this.positionX, this.positionY, 0, 0, {
        timeLeft: 300,
        color: this.color,
        rotation: this.rotation
      })
      // 12px long, 3px thick. Pool returns null when full, so null-check.
      if (streak) 
      {
        streak.SetStreak(12, 1)
      }
    }

    this.particleTimer++
  }

  private getDamageMultiplier(): number {
    const elapsedTime = this.scene.time.now - this.spawnTime
    const progress = Math.min(1, elapsedTime / this.timeLeft)

    // Only decay for first half of lifetime
    if (progress > 0.5) {
      return this.minimumDamageMultiplier
    }

    // Interpolate from max to min over first half
    const halfLifeProgress = progress / 0.5 // Convert to 0-1 range for first half
    return this.maximumSpawnDamageMultiplier - (halfLifeProgress * (this.maximumSpawnDamageMultiplier - this.minimumDamageMultiplier))
  }

  OnHitNPC(_enemy: any): boolean {
    console.log('Initial damage:', this.initialDamage, 'Current damage before hit:', this.damage, 'Damage multiplier:', this.getDamageMultiplier())
    // Disable homing temporarily after hitting to prevent sticking
    this.canHome = false
    this.homeDelay = this.scene.time.now + 500 // Re-enable homing after 500ms

    // Per-hit reduction compounds off the original damage (not the decayed value), and
    // only applies starting on the second hit (i.e. pierce past the first enemy).
    const pierceReduction = Math.pow(1 - this.hitEnemyDamageReduction, this.hitCount)
    this.damage = this.initialDamage * pierceReduction * this.getDamageMultiplier()
    this.hitCount++
    console.log('Damage after hit:', this.damage, 'Hit count:', this.hitCount, 'Pierce reduction factor:', pierceReduction)


    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(3, 5), {
      randomAngle: true,
      speed: 120,
      speedVariance: 0.2,
      color: this.color,
      timeLeft: 300,
      scale: 0.75,
      radius: 1.5
    })
    return true
  }

  OnObstacleCollide(_obstacle?: Phaser.GameObjects.GameObject): boolean {

    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying(SoundID.BulletCollide))
    {
      this.scene.sound.stopByKey(SoundID.BulletCollide)
    }
    this.scene.sound.play(SoundID.BulletCollide, { volume: getDefaultVolume(SoundID.BulletCollide) })
    //

    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(3, 5), {
      randomAngle: true,
      speed: 120,
      speedVariance: 0.2,
      color: this.color,
      timeLeft: 300,
      scale: 1,
      radius: 1.5
    })

    // HomingBullet is incompatible with the ricochet upgrade (see RicochetDef.incompatibleWith).
    return true
  }

}

/**
 * Explosive bullet - deals normal bullet damage on direct hit, then spawns a
 * BulletExplosion at the impact point for AOE damage.
 */
export class ExplosiveBullet extends Projectile {
  private particleTimer: number = 0
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

  AI(): void {
    if (this.particleTimer % 8 === 0) {
      let color: number = this.color
      let colorNum = Phaser.Math.Between(0, 2)
      if (colorNum === 0)
      {
        color = 0xffff00
      }

      Particle.NewParticle(SparkParticle, this.positionX + Phaser.Math.Between(-5, 5), this.positionY + Phaser.Math.Between(-5, 5), 0, 0, {
        timeLeft: 300,
        color: color,
        rotation: this.rotation,
        radius: 1.5,
      })
    }
    if (this.particleTimer % 16 === 0) {
      Particle.NewParticle(SmokeParticle, this.positionX, this.positionY, this.velocityX * 0.5, this.velocityY * 0.5, {
        timeLeft: 400,
        color: 0x555555,
        rotation: this.rotation,
        radius: 5.5,
      })
    }

    this.particleTimer++
  }

  private spawnExplosion(): void {
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new BulletExplosion()  
    explosion.SetDefaults()

    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying(SoundID.Explosion))
    {
      this.scene.sound.stopByKey(SoundID.Explosion)
    }
    this.scene.sound.play(SoundID.Explosion, { volume: getDefaultVolume(SoundID.Explosion) })
    //

    scene.spawnProjectile(explosion, this.positionX, this.positionY, this.positionX, this.positionY, 'player', this.ownerId)
  }

  OnHitNPC(_enemy: any): boolean {
    this.spawnExplosion()
    return true
  }

  OnObstacleCollide(obstacle?: Phaser.GameObjects.GameObject): boolean {
    this.spawnExplosion()

    // We handle the ricochet upgrade here: bounce instead of dying if owned.
    if (obstacle && UpgradeEffectSystem.hasEffect(UpgradeEffectID.Ricochet)) {
      this.ricochet(obstacle)
      return false
    }
    return true
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

  OnSpawn(): void {
    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(8, 12), {
      randomAngle: true,
      speed: 200,
      speedVariance: 0.2,
      color: this.color,
      timeLeft: 300,
      scale: 0.75,
      radius: Phaser.Math.Between(1.5, 3)
    })
  }

  SetDefaults(): void {
    // Base values; owned upgrades adjust them through the modifyExplosion hook
    const explosion = { damage: this.baseDamage, radius: this.baseRadius }
    UpgradeSystem.dispatchModifyExplosion(explosion)

    // Explosion-specific scaling is fully resolved above; the only other
    // thing that legitimately applies to it is the universal "attack" bonus
    // (damage_*) — never the primary attack's own bullet_damage_* bonus,
    // which belongs to the bullet's own hit, not its side effects. This
    // mirrors Player.applyUpgradeModifiers so this.damage is final here too.
    this.damage = UpgradeModifierSystem.applyModifiers(UpgradeTargetID.Attack, UpgradeStatID.Damage, explosion.damage)
    this.damageSource = 'explosion'
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
    this.damage = 10
    this.speed = 0
    this.size = 1
    this.pierce = 1
    this.color = COLORS.bullet
    this.knockback = 0
    this.spawnSound = SoundID.Buckshot
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
      // Inherit the already-fully-resolved damage from the main buckshot
      // bullet - Player.applyUpgradeModifiers() ran on `this` before
      // OnSpawn() was called, so this.damage is final; no separate
      // resolution needed here.
      // Pellets are spawned directly here instead of through Player.NewProjectile(), so they
      // never go through Player.applyUpgradeModifiers() — apply the same non-damage stats by hand.
      for (const stat of [UpgradeStatID.Speed, UpgradeStatID.Size, UpgradeStatID.Pierce, UpgradeStatID.TimeLeft] as const) {
        (pellet as Projectile)[stat] = UpgradeModifierSystem.applyModifiers(UpgradeTargetID.Bullet, stat, (pellet as Projectile)[stat])
      }

      pellet.damage = this.damage * 0.3 // Each pellet does 30% of the main bullet's damage. Sounds low but see damage_report.py for min/max possible values and it makes more sense.

      scene.spawnProjectile(pellet, this.positionX, this.positionY, targetX, targetY, 'player', this.ownerId)
    }

    for (let i = 0; i < Phaser.Math.Between(5, 8); i++) {
      const direction = new Phaser.Math.Vector2(200, 0)
      direction.rotate(this.rotation + Phaser.Math.FloatBetween(-Math.PI / 8, Math.PI / 8))

      if (Phaser.Math.Between(0, 1) === 0) {
        Particle.NewParticle(SparkParticle, this.positionX, this.positionY,
          direction.x, direction.y, {
          color: this.color,
          timeLeft: 300,
          scale: 1.5,
          radius: 1.5
        })
      }
      else
      {
        Particle.NewParticle(ShardParticle, this.positionX, this.positionY,
          direction.x, direction.y, {
          color: this.color,
          timeLeft: 300,
          scale: 1.5,
          radius: 1.5
        })
      }
    }
  }

  Draw(): void {
    this.sprite.setAlpha(0) // Hide the main bullet sprite; only the pellets are visible
    this.sprite.setVisible(false)
  }
}

export class BuckshotPellet extends Projectile
{
  // private particleTimer: number = 0
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

  AI(): void {

    // if (this.particleTimer % 10 === 0) {
    //   Particle.NewParticle(SparkParticle, this.positionX, this.positionY, 
    //     this.velocityX * Phaser.Math.Between(0.1, 0.2), 
    //     this.velocityY * Phaser.Math.Between(0.1, 0.2), 
    //   {
    //     color: this.color,
    //     timeLeft: 300,
    //     scale: 0.5,
    //     radius: 2
    //   })
    // }
  }

  OnHitNPC(_enemy: any): boolean {

    for (let i = 0; i < 3; i++) {

      Particle.NewParticle(SparkParticle, this.positionX, this.positionY, 
        this.velocityX * Phaser.Math.Between(0.1, 0.2), 
        this.velocityY * Phaser.Math.Between(0.1, 0.2), 
      {
        color: this.color,
        timeLeft: 300,
        scale: 0.75,
        radius: 1.5
      })
    }
    return true
  }

  OnObstacleCollide(obstacle?: Phaser.GameObjects.GameObject): boolean {
    // all sound calls should have this check to prevent "sound stacking"
    //
    if (this.scene.sound.isPlaying(SoundID.BulletCollide))
    {
      this.scene.sound.stopByKey(SoundID.BulletCollide)
    }
    this.scene.sound.play(SoundID.BulletCollide, { volume: getDefaultVolume(SoundID.BulletCollide) })
    //

    Particle.Burst(SparkParticle, this.positionX, this.positionY, Phaser.Math.Between(3, 5), {
      randomAngle: true,
      speed: 120,
      speedVariance: 0.2,
      color: this.color,
      timeLeft: 300,
      scale: 1,
      radius: 1.5
    })

    // We handle the ricochet upgrade here: bounce instead of dying if owned.
    if (obstacle && UpgradeEffectSystem.hasEffect(UpgradeEffectID.Ricochet)) {
      this.ricochet(obstacle)
      return false
    }
    return true
  }
}