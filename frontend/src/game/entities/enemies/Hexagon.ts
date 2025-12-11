import { Enemy } from './Enemy'

/**
 * Hexagon enemy - tanky boss-like enemy with shield ability.
 */
export class Hexagon extends Enemy {
  private shielded: boolean = false
  private shieldTimer: number = 0
  private shieldCooldown: number = 5000
  private shieldDuration: number = 2000

  SetDefaults(): void {
    this.health = 1000
    this.speed = 52
    this.damage = 100
    this.sides = 6
    this.radius = 30
    this.color = 0xff00ff
    this.scoreChance = .6
    this.speedCap = 1.3  // Very low cap (tank, shouldn't be fast)
  }

  AI(_playerX: number, _playerY: number): void {
    const now = this.scene.time.now

    // Activate shield periodically
    if (!this.shielded && now - this.shieldTimer > this.shieldCooldown) {
      this.shielded = true
      this.shieldTimer = now
      this._drawShielded()

      this.scene.time.delayedCall(this.shieldDuration, () => {
        this.shielded = false
        this.Draw()
      })
    }
  }

  OnHit(_damage: number, _source: any): boolean {
    if (this.shielded) {
      // Blocked by shield
      return false
    }
    return true
  }

  private _drawShielded(): void {
    this.Draw()
    // Add shield visual
    this.graphics.lineStyle(3, 0x00ffff, 0.8)
    this.graphics.strokeCircle(0, 0, this.radius + 5)
  }
}
