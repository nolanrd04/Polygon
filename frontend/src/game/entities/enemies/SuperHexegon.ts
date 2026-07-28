import { Enemy } from './Enemy'
import { TextureGenerator } from '../../utils/TextureGenerator'
import { SuperHexagonProj } from '../projectiles/enemy_projectiles/SuperHexagonProj.ts'

/**
 * Super Hexagon enemy - tanky enemy with shield ability. Shield breaks into close range projectiles when broken.
 * The enemy itself fluctuates in opacity then when the shield is broken it shoots projectiles
 */
export class SuperHexagon extends Enemy {
  private shielded: boolean = false
  private shieldHealth: number = 0
  private maxShieldHealth: number = 0
  private shieldRechargeDelay: number = 5000 // Time before shield can recharge after breaking
  private lastShieldBreakTime: number = 0
  private shieldSprite: Phaser.GameObjects.Sprite | null = null
  private lastFireTime: number = 0
  private fireCooldown: number = 800
  private hasOutline: boolean = false

  SetDefaults(): void {
    this.health = 800
    this.speed = 62
    this.damage = 100
    this.sides = 6
    this.radius = 23
    this.color = 0xff00ff
    this.scoreChance = .65
    this.speedCap = 4.5
    this.knockbackResistance = 0.8
    this.bundleDropChance = 0.16
  }

  PreAI(): boolean {
    // Activate shield on first spawn only (maxShieldHealth will be 0 on first spawn)
    if (!this.shielded && this.maxShieldHealth === 0) {
      this.activateShield()
    }
    return true
  }

  applyKnockback(velocityX: number, velocityY: number): void {
    // Shield blocks knockback
    if (this.shielded) {
      return
    }
    super.applyKnockback(velocityX, velocityY)
  }

  AI(_playerX: number, _playerY: number): void {
    const now = this.scene.time.now

    // Try to recharge shield if it's broken and cooldown has passed
    if (!this.shielded && this.shieldHealth <= 0 && now - this.lastShieldBreakTime > this.shieldRechargeDelay) {
      this.activateShield()
    }
    else if (!this.shielded && now - this.lastShieldBreakTime <= this.shieldRechargeDelay)
    {
        // dont move, shoot projectiles
        this.velocityX = 0
        this.velocityY = 0
        if (now - this.lastFireTime > this.fireCooldown) {
            this.lastFireTime = now
            // Spawn acid explosion on death
            const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
            const proj = new SuperHexagonProj()
            proj.SetDefaults()
    
            // Scale explosion damage to match the bullet's scaled damage
            proj.damage = this.damage

            scene.spawnProjectile(proj, this.x, this.y, _playerX, _playerY, 'enemy', this.id)
        }
    }
  }

  OnHit(_damage: number, _source: any): boolean {
    if (this.shielded) {
      // Shield absorbs the damage
      this.shieldHealth -= _damage

      if (this.shieldHealth <= 0) {
        // Shield is broken
        this.deactivateShield()
      } else {
        // Shield is still active, update the visual
        this._updateShieldVisual()
      }

      return false // Don't damage the hexagon
    }
    return true // Normal damage
  }

  private activateShield(): void {
    this.shielded = true
    this.maxShieldHealth = this.health * 0.65
    this.shieldHealth = this.maxShieldHealth

    // Create shield visual as sprite using cached texture
    if (!this.shieldSprite) {
      const shieldTextureKey = TextureGenerator.getOrCreateCircle(this.scene, {
        radius: this.radius + 5,
        fillColor: 0x00ffff,
        fillAlpha: 0.2,
        strokeWidth: 3,
        strokeColor: 0x00ffff,
        strokeAlpha: 1.0
      })
      this.shieldSprite = this.scene.add.sprite(0, 0, shieldTextureKey)
      this.shieldSprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
      this.container.add(this.shieldSprite)
    }
    this._updateShieldVisual()
  }

  private deactivateShield(): void {
    this.shielded = false
    this.lastShieldBreakTime = this.scene.time.now

    // Remove shield visual
    if (this.shieldSprite) {
      this.shieldSprite.destroy()
      this.shieldSprite = null
    }
  }

  private _updateShieldVisual(): void {
    if (!this.shieldSprite) return

    // Shield opacity based on remaining health
    const shieldPercent = this.shieldHealth / this.maxShieldHealth
    const alpha = 0.3 + (shieldPercent * 0.7) // 0.3 to 1.0

    // Update sprite alpha (no redrawing needed!)
    this.shieldSprite.setAlpha(alpha)
  }

  PreDraw(): boolean {
    // become less opac the closer the shield is to breaking
    if (this.shielded && this.shieldHealth > 0) 
    {
      const shieldPercent = this.shieldHealth / this.maxShieldHealth
      const alpha = 0.3 + (shieldPercent * 0.7) // 0.3 to 1.0
      this.sprite.setAlpha(alpha)
    }
    else if (!this.shielded)
    {
        this.sprite.setAlpha(0.3)
    }
    else  
    {
      this.sprite.setAlpha(1.0)
    }
    return true
  }

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
}
