import { Enemy } from './Enemy'
import { AcidBullet } from '../projectiles/enemy_projectiles/AcidBullet'
import { TextureGenerator } from '../../utils/TextureGenerator'

/**
 * Square enemy - balanced stats.
 */
export class SuperSquare extends Enemy {

  private lastFireTime: number = 0
  private fireCooldown: number = 3000
  private hasOutline: boolean = false

  SetDefaults(): void {
    this.health = 120
    this.speed = 90
    this.damage = 30
    this.sides = 4
    this.radius = 20
    this.color = 0x33ff33
    this.scoreChance = 0.5
    this.speedCap = 2.45  // Normal cap (2x)
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
        radius: this.radius + 6,  // Larger radius for outline effect
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
    const now = this.scene.time.now
    if (now - this.lastFireTime >= this.fireCooldown) {
        this.lastFireTime = now
        // Create and spawn projectile using centralized method
        const projectile = new AcidBullet()
        projectile.SetDefaults()
        // Scale damage based on enemy's damage stat
        projectile.damage = this.damage
        
        const scene = this.scene as any
        scene.spawnProjectile(projectile, this.x, this.y, _playerX, _playerY, 'enemy', this.id)
    }
  }

}
