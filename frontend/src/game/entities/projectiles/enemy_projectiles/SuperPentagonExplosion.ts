import { Projectile } from '../Projectile'

export class SuperPentagonExplosion extends Projectile {
  SetDefaults(): void {
    this.damage = 10
    this.speed = 0
    this.size = 40
    this.pierce = 999999
    this.color = 0xed7d37
    this.timeLeft = 200
    this.hitEnemyCooldown = 500 // longer than timeLeft so each enemy is only hit once
    this.canCutTiles = true
  }

  PreDraw(): boolean {
    this.swapToCustomCircle({ fillAlpha: 0.7 })
    return true
  }

  Draw(): void {
    const elapsed = this.scene.time.now - this.spawnTime
    this.sprite.setAlpha(Math.max(0, 1 - elapsed / this.timeLeft))
  }
}