import { Enemy } from './Enemy'
import { TextureGenerator } from '../../utils/TextureGenerator'

/**
 * Hexagon enemy - tanky boss-like enemy with shield ability.
 * Has a health-based shield that blocks damage until depleted.
 */
export class Hexagon extends Enemy {
  private shielded: boolean = false
  private shieldHealth: number = 0
  private maxShieldHealth: number = 0
  private shieldRechargeDelay: number = 5000 // Time before shield can recharge after breaking
  private lastShieldBreakTime: number = 0
  private shieldSprite: Phaser.GameObjects.Sprite | null = null

  SetDefaults(): void {
    this.health = 800
    this.speed = 52
    this.damage = 100
    this.sides = 6
    this.radius = 30
    this.color = 0xff00ff
    this.scoreChance = .65
    this.speedCap = 4.5
    this.knockbackResistance = 0.8
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
  }

  OnHit(_damage: number, _source: any): boolean {
    if (this.shielded) {
      // Shield absorbs the damage
      this.shieldHealth -= _damage
      console.log(`Hexagon ${this.id} shield hit: ${_damage} damage, shield health: ${this.shieldHealth}/${this.maxShieldHealth}`)

      if (this.shieldHealth <= 0) {
        // Shield is broken
        console.log(`Hexagon ${this.id} shield broken!`)
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
    console.log(`Hexagon ${this.id} shield activated: ${this.shieldHealth} HP`)

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
    const alpha = 0.4 + (shieldPercent * 0.4) // 0.4 to 0.8

    // Update sprite alpha (no redrawing needed!)
    this.shieldSprite.setAlpha(alpha)
  }
}
