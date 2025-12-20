// import Phaser from 'phaser'
import { Projectile } from '../Projectile'
import { COLORS } from '../../../core/GameConfig'

/**
 * Flame projectile - short range cone of fire.
 * Continuous damage while active.
 */
export class Flame extends Projectile {
  /** How far the flame reaches */
  range: number = 100

  /** Cone spread angle in radians */
  coneSpread: number = 0.5

  SetDefaults(): void {
    this.damage = 3 // Low damage but continuous
    this.speed = 0 // Doesn't move, attached to player
    this.size = 5
    this.pierce = 999 // Hits all enemies in cone
    this.color = COLORS.flamer
    this.timeLeft = 50 // Very short, refreshed each frame while firing
  }


  AI(): void {
    this.velocityX = 0
    this.velocityY = 0
  }
}
