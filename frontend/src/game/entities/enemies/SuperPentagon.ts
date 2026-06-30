import { TextureGenerator } from '@/game/utils/TextureGenerator'
import { Enemy } from './Enemy'

export class SuperPentagon extends Enemy {
  private teleportTimer: number = 3000 // milliseconds
  private teleportWindUpDuration: number = 300 // milliseconds
  private teleportWindDownDuration: number = 300 // milliseconds
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
    this.scoreChance = 0.5
    this.speedCap = 1.5
    this.knockbackResistance = 0.8
    this.bundleDropChance = 0.12
  }

  AI(_playerX: number, _playerY: number): void
  {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, _playerX, _playerY)
    const now = this.scene.time.now

    // Always move towards player
    this.moveTowards(_playerX, _playerY)

    // Teleport countdown and logic
    if (distance < 400)
    {
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
      this.teleportTimer = 3000
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
        // Teleport to random location relative to player, at distance + 100
        const angle = Math.random() * Math.PI * 2
        let teleportDistance = distance
        if (distance < 200)
        {
          teleportDistance = distance + 100
        }

        const teleportX = _playerX + Math.cos(angle) * teleportDistance
        const teleportY = _playerY + Math.sin(angle) * teleportDistance

        this.container.x = teleportX
        this.container.y = teleportY

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
        this.teleportTimer = 3000 // Reset timer
      }
    }
    
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
