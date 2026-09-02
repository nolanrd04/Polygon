import Phaser from 'phaser'
import { Particle } from './Particle'
import { LightingSystem } from '../../../game/systems/LightingSystem'
import { LightingIntensityID } from '../../../game/data/ID'

/**
 * ============================================================================
 * Built-in particle types
 * ============================================================================
 *
 * General-purpose "dust types" meant to be spawned directly and re-tinted at
 * the call site, the way Terraria code reaches for a handful of common
 * DustIDs. Every one of them is driven purely by fields set in SetDefaults(),
 * so they cost nothing per frame beyond the base motion integration.
 *
 * Use these as templates for your own types. See
 * `frontend/documentation/PARTICLE.md` for worked examples and the full field
 * reference.
 */

/**
 * Small bright circle that shoots outward, slows down hard and fades.
 * The default choice for impacts, muzzle flashes and death bursts.
 */
export class SparkParticle extends Particle {
  SetDefaults(): void {
    this.sides = 1
    this.radius = 2.5
    this.color = 0xffffff
    this.timeLeft = 400
    this.fadeOutTime = 300
    this.friction = 0.3 // Sheds ~1-friction% of its speed per second
    this.additive = true
  }

  OnSpawn(): void {
    this.scale *= Phaser.Math.FloatBetween(0.6, 1.3)
    this.timeLeft *= Phaser.Math.FloatBetween(0.7, 1.3)
    this.maxTimeLeft = this.timeLeft
  }

  PostDraw(): void {
    LightingSystem.AddLight(this.posX, this.posY, this.color, LightingIntensityID.Projectile * this.radius / 2.5 * this.sprite.alpha)
  }
}

/**
 * Soft circle that drifts, expands and fades out. Good for exhaust trails,
 * dissipating clouds and explosion afterglow.
 */
export class SmokeParticle extends Particle {
  SetDefaults(): void {
    this.sides = 1
    this.radius = 6
    this.color = 0x888888
    this.alpha = 0.45
    this.timeLeft = 900
    this.fadeInTime = 100
    this.fadeOutTime = 600
    this.friction = 0.3
    this.scaleVelocity = 1.2 // Expands as it dissipates
    this.rotationVelocity = Phaser.Math.FloatBetween(-1, 1)
  }

  OnSpawn(): void {
    this.scale *= Phaser.Math.FloatBetween(0.7, 1.2)
  }
}

/**
 * Spinning triangular shard with one long spike - debris flung off a
 * destroyed entity. Demonstrates the irregular-polygon shape fields.
 */
export class ShardParticle extends Particle {
  SetDefaults(): void {
    this.sides = 3
    // A dart: one vertex pushed out to the full radius for the tip, with the
    // two base vertices pulled in and swung wide so the shape actually fills
    // its radius. Vertices bunched into a narrow arc (e.g. [30, 30, 300])
    // produce a sliver only a pixel or two across - see the notes on `angles`
    // in Particle.ts.
    this.angles = [130, 100, 130]
    this.vertexRadii = [1, 0.5, 0.5]
    this.radius = 10
    this.color = 0xffffff
    this.timeLeft = 700
    this.fadeOutTime = 400
    this.friction = 0.4
    this.scaleVelocity = -0.8 // Shrinks away
  }

  OnSpawn(): void {
    this.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
    this.rotationVelocity = Phaser.Math.FloatBetween(-8, 8)
  }
}

/**
 * Squashed ellipse stretched along its direction of travel - a streak of
 * motion rather than a point. Rotates to face its own velocity.
 */
export class StreakParticle extends Particle {
  SetDefaults(): void {
    this.sides = 2
    this.ellipseRatio = 0.25
    this.radius = 7
    this.color = 0xffffff
    this.timeLeft = 250
    this.fadeOutTime = 250
    this.friction = 0.2
    this.scaleVelocity = -1.5
    this.additive = true
  }

  AI(): void {
    // Keep the long axis aligned with travel direction as drag bends the path
    if (this.velocityX !== 0 || this.velocityY !== 0) {
      this.rotation = Math.atan2(this.velocityY, this.velocityX)
    }
  }
}