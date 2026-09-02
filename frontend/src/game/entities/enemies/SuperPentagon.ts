import { TextureGenerator } from '../../utils/TextureGenerator'
import { SuperPentagonExplosionDetonation } from '../projectiles/enemy_projectiles/SuperPentagonExplosionDetonation'
import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'
import { Particle, SparkParticle } from '../particles'

export class SuperPentagon extends Enemy {
  private teleportX: number = 0
  private teleportY: number = 0
  private hasTeleportLocation: boolean = false
  private minTeleportDistance: number = 50
  private maxTeleportDistance: number = 250
  private teleportTimer: number = 2000 // milliseconds
  private teleportWindUpDuration: number = 100 // milliseconds
  private teleportWindDownDuration: number = 100 // milliseconds
  private teleportStartScale = 0.7
  private isTeleporting: boolean = false
  private teleportStartTime: number = 0
  private hasOutline: boolean = false

  SetDefaults(): void {
    this.health = 750
    this.speed = 100
    this.damage = 100
    this.sides = 5
    this.radius = 20
    this.color = 0xff8b1f
    this.scoreChance = 0.15
    this.speedCap = 3
    this.knockbackResistance = 0.5
    this.bundleDropChance = 0.0 // use difficulty drop chance
  }

  AI(_playerX: number, _playerY: number): void
  {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, _playerX, _playerY)
    const now = this.scene.time.now

    // Always move towards player
    this.moveTowards(_playerX, _playerY)

    // Teleport countdown and logic
    if (distance > 200)
    {
      // get teleport location relative to player if not already set
      if (!this.hasTeleportLocation)
      {
        // get random location near the player, within visible range
        const angle = Math.random() * Math.PI * 2
        const teleportDistance = Phaser.Math.Between(this.minTeleportDistance, this.maxTeleportDistance)

        this.teleportX = _playerX + Math.cos(angle) * teleportDistance
        this.teleportY = _playerY + Math.sin(angle) * teleportDistance
        this.hasTeleportLocation = true
      }

      // visualize teleport target location with particles
      for (let i = 0; i < Phaser.Math.Between(3, 6); i++)
      {
        const particleAngle = Phaser.Math.FloatBetween(0, Math.PI * 2)
        const particleDist = this.radius * Math.sqrt(Phaser.Math.FloatBetween(0, 1))

        Particle.NewParticle(SparkParticle,
          this.teleportX + Math.cos(particleAngle) * particleDist,
          this.teleportY + Math.sin(particleAngle) * particleDist,
          0,
          0,
          {
            radius: Phaser.Math.Between(1, 3),
            color: this.color,
            additive: true,
            alpha: Phaser.Math.FloatBetween(0.3, 0.9),
          }
        )
      }

      if (!this.isTeleporting)
      {
        this.teleportTimer -= this.scene.game.loop.delta
        if (this.teleportTimer <= 0)
        {
          this.isTeleporting = true
          this.teleportStartTime = now
        }
      }
    }
    else
    {
      // Reset timer when out of range
      this.teleportTimer = 1500
    }

    // Handle teleport animation
    if (this.isTeleporting)
    {
      const teleportElapsed = now - this.teleportStartTime
      const totalTeleportDuration = this.teleportWindUpDuration + this.teleportWindDownDuration

      // Wind up phase - shrink
      if (teleportElapsed < this.teleportWindUpDuration) {
        const windUpProgress = teleportElapsed / this.teleportWindUpDuration
        const targetScale = 1.0 - (windUpProgress * (1.0 - this.teleportStartScale))
        this.container.scale = targetScale
      }
      // Teleport happens at end of wind up
      else if (teleportElapsed >= this.teleportWindUpDuration && teleportElapsed < this.teleportWindUpDuration + 50) {
        this.container.x = this.teleportX
        this.container.y = this.teleportY

        // Reset velocity after teleport
        this.velocityX = 0
        this.velocityY = 0
      }
      // Wind down phase - grow back
      else if (teleportElapsed >= this.teleportWindUpDuration && teleportElapsed < totalTeleportDuration) {
        const windDownProgress = (teleportElapsed - this.teleportWindUpDuration) / this.teleportWindDownDuration
        const targetScale = this.teleportStartScale + (windDownProgress * (1.0 - this.teleportStartScale))
        this.container.scale = targetScale
      }
      // Complete teleport
      else if (teleportElapsed >= totalTeleportDuration) {
        this.container.scale = 1.0
        this.isTeleporting = false
        this.hasTeleportLocation = false
        this.teleportTimer = 1500 // Reset timer
      }
    }
    
  }

  OnDeath(): void {
    const projectile = new SuperPentagonExplosionDetonation()
    projectile.SetDefaults()
    // Scale damage based on enemy's damage stat
    projectile.damage = this.damage

    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    scene.spawnProjectile(projectile, this.x, this.y, 0, 0, 'enemy', this.id)
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
  

  /**
   * Emissive glow, sized to the enemy so bigger shapes light more of the room.
   *
   * Uses this.color, not a stored default: the damage flash tints the SPRITE and
   * leaves this.color alone (Enemy.takeDamage), so the light will not strobe white
   * on every hit.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity * this.radius / 35)
  }
}
