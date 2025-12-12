import { Enemy } from './Enemy'

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

  SetDefaults(): void {
    this.health = 575
    this.speed = 52
    this.damage = 100
    this.sides = 6
    this.radius = 30
    this.color = 0xff00ff
    this.scoreChance = .6
    this.speedCap = 1.3  // Very low cap (tank, shouldn't be fast)
  }

  PreAI(): boolean {
    // Activate shield on first update
    if (!this.shielded && this.shieldHealth <= 0) {
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
      
      if (this.shieldHealth <= 0) {
        // Shield is broken
        this.shielded = false
        this.lastShieldBreakTime = this.scene.time.now
        this.Draw() // Return to normal appearance
      } else {
        // Shield is still active, redraw it
        this._drawShielded()
      }
      
      return false // Don't damage the hexagon
    }
    return true // Normal damage
  }

  private activateShield(): void {
    this.shielded = true
    this.maxShieldHealth = this.health * 0.65
    this.shieldHealth = this.maxShieldHealth
    this._drawShielded()
  }

  private _drawShielded(): void {
    this.Draw()
    // Add shield visual
    this.graphics.lineStyle(3, 0x00ffff, 0.8)
    this.graphics.strokeCircle(0, 0, this.radius + 5)
  }
}
