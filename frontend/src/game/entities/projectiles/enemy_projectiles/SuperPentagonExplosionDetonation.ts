import { Projectile } from '../Projectile'
import { SuperPentagonExplosion } from './SuperPentagonExplosion'
import { TextureGenerator } from '../../../utils/TextureGenerator'

export class SuperPentagonExplosionDetonation extends Projectile {
  private baseColor = 0xf74f25
  private bleepColor = 0xffc2b3
  SetDefaults(): void {
    this.damage = 0
    this.speed = 0
    this.size = 8
    this.pierce = 99999
    this.color = 0xf74f25
    this.timeLeft = 3100 // milliseconds
  }

  private lerpColor(colorA: number, colorB: number, t: number): number {
    const r1 = (colorA >> 16) & 0xff
    const g1 = (colorA >> 8) & 0xff
    const b1 = colorA & 0xff

    const r2 = (colorB >> 16) & 0xff
    const g2 = (colorB >> 8) & 0xff
    const b2 = colorB & 0xff

    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)

    return (r << 16) | (g << 8) | b
  }

  PreDraw(): boolean {
    const timeElapsed = this.scene.time.now - this.spawnTime
    let glowAlpha = 0.5
    let glowRadius = this.size * 0.7

    // Flash 3 times over the first 3 seconds
    if (timeElapsed < 3000) {
      const cycleTime = timeElapsed % 1000  // 0-1000ms repeating each cycle

      if (cycleTime < 250) {
        // Grow bright (0-250ms)
        this.color = this.lerpColor(this.baseColor, this.bleepColor, cycleTime / 250)
      } else if (cycleTime < 500) {
        // Grow dark (250-500ms)
        this.color = this.lerpColor(this.bleepColor, this.baseColor, (cycleTime - 250) / 250)
      } else {
        // Solid yellow with enhanced glow (500-1000ms)
        this.color = 0xffff00
        glowAlpha = 0.8
        glowRadius = this.size * 1.2
      }
    } else {
      this.color = this.baseColor
    }

    const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
      radius: this.size,
      fillColor: this.color,
      fillAlpha: 0.9,
      glowRadius: glowRadius,
      glowAlpha: glowAlpha,
      strokeColor: 0xffffff,
      strokeWidth: 2,
      strokeAlpha: 0.7
    })

    this.sprite.setTexture(textureKey)
    this.sprite.setTint(this.color)
    this.sprite.blendMode = Phaser.BlendModes.ADD

    return false
  }

  OnKill(): void {
    // Spawn acid explosion on death
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new SuperPentagonExplosion()
    explosion.SetDefaults()
    
    // Scale explosion damage to match the bullet's scaled damage
    explosion.damage = this.damage

    // Spawn at death location, doesn't travel anywhere
    scene.spawnProjectile(explosion, this.positionX, this.positionY, this.positionX, this.positionY, 'enemy', this.ownerId)
  }
}
