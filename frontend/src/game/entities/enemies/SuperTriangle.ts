import Phaser from 'phaser'
import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { EnemyBullet } from '../projectiles/enemy_projectiles/EnemyBullet'
import { TextureGenerator } from '../../utils/TextureGenerator'
import { SoundID, LightingRadiusID } from '../../../game/data/ID'
import { getDefaultVolume } from '../../../game/core/AudioRegistry'

export class SuperTriangle extends Enemy {
  private lastFireTime: number = 0
  private fireCooldown: number = 1000 // milliseconds
  private hasOutline: boolean = false

  SetDefaults(): void {
    this.health = 120
    this.speed = 50
    this.damage = 50
    this.sides = 3
    this.radius = 15
    this.color = 0xff0000
    this.scoreChance = 0.08
    this.speedCap = 6.5
    this.knockbackResistance = 0.8
    this.bundleDropChance = 0.0 // use difficulty drop chance
  }

  /**
   * Add outer outline sprite for Super variant
   */
  Draw(): void {
    super.Draw()

    // Create outer outline sprite if it doesn't exist
    if (!this.hasOutline) {
      // Generate outline texture on-demand with larger radius and no fill
      const outlineKey = TextureGenerator.getOrCreatePolygon(this.scene, {
        sides: this.sides,
        radius: this.radius + 8,  // Larger radius for outline effect
        fillColor: 0x000000,
        fillAlpha: 0,  // Transparent fill
        strokeWidth: 2,
        strokeColor: 0xffffff,
        strokeAlpha: 0.8
      })

      const outlineSprite = this.scene.add.sprite(0, 0, outlineKey)
      outlineSprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
      this.container.add(outlineSprite)
      this.hasOutline = true
    }
  }

  AI(_playerX: number, _playerY: number): void {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, _playerX, _playerY)

    if (distance > 400) {
      // Too far - move closer (base class already calls moveTowards, but we can adjust if needed)
    } else {
      // In range - stop moving and shoot
      this.velocityX = 0
      this.velocityY = 0

      // Check fire cooldown
      const now = this.scene.time.now
      if (now - this.lastFireTime >= this.fireCooldown) {
        this.lastFireTime = now

        // Create and spawn projectile using centralized method
        const projectile = new EnemyBullet()
        projectile.SetDefaults()
        // Scale damage based on enemy's damage stat
        projectile.damage = this.damage
        // console.log(`Shooter spawning projectile with damage: ${projectile.damage} (enemy damage: ${this.damage})`)

        const scene = this.scene as any
        scene.spawnProjectile(projectile, this.x, this.y, _playerX, _playerY, 'enemy', this.id)

        
        // all sound calls should have this check to prevent "sound stacking"
        //
        if (this.scene.sound.isPlaying(SoundID.EnemyShoot1))
        {
          this.scene.sound.stopByKey(SoundID.EnemyShoot1)
        }
        this.scene.sound.play(SoundID.EnemyShoot1, { volume: getDefaultVolume(SoundID.EnemyShoot1) })
        //
      }
    }
  }

  /**
   * Emissive glow, sized to the enemy so bigger shapes light more of the room.
   *
   * Uses this.color, not a stored default: the damage flash tints the SPRITE and
   * leaves this.color alone (Enemy.takeDamage), so the light will not strobe white
   * on every hit.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, 2, LightingRadiusID.PlayerRadius * this.radius / 15)
  }
}