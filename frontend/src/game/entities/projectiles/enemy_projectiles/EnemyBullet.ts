import { Projectile } from '../Projectile'

export class EnemyBullet extends Projectile {

  SetDefaults(): void {
    this.damage = 10
    this.speed = 400
    this.size = 5
    this.pierce = 1
    this.color = 0xFF0000
    this.timeLeft = 3000 // milliseconds
  }
}