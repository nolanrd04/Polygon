import { Enemy } from './Enemy'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'
import { Particle } from '../particles'
import { SparkParticle } from '../particles'

// spawned byt the super octogon on death, specifically tried to avoid the player so it can grow into a super octogon.
export class SuspiciousSquare extends Enemy {
    private spawnTime: number = 0
    private waitTimer: number = 3000 // wait this time (in ms) before it starts growing to a super octogon
    private canGrow: boolean = false
    private growStartTime: number = 0
    private growTimer: number = 5000 // time it takes to grow into a super octogon (in ms)
    private growScale: number = 1.75 // super octogon radius (35) / this radius (20)

  SetDefaults(): void {
    this.health = 200
    this.speed = 50
    this.damage = 0
    this.sides = 4
    this.radius = 20
    this.color = 0x4287f5
    this.scoreChance = 0.0
    this.speedCap = 3.5
    this.knockbackResistance = 0.9
    this.bundleDropChance = 0.0 // use difficulty drop chance
    
  }

  AI(_playerX: number, _playerY: number): void {
    if (this.spawnTime === 0) {
        this.spawnTime = this.scene.time.now
    }

    const now = this.scene.time.now

    // Wait for the waitTimer duration before starting to grow into a super octogon
    if (now - this.spawnTime > this.waitTimer && !this.canGrow) {
        this.canGrow = true
        this.growStartTime = now
    }

    if (this.canGrow) 
    {
        const growProgress = Math.min((now - this.growStartTime) / this.growTimer, 1)

        // this.scale is only read once, by Enemy._spawn, so assigning it here does
        // nothing by itself: push it to the container every frame. The body is not
        // scaled by the container, so resize the hitbox alongside it.
        this.scale = Phaser.Math.Linear(1, this.growScale, growProgress)
        this.container.setScale(this.scale)
        const hitboxRadius = this.radius * this.scale * this.hitboxSize
        this.body.setCircle(hitboxRadius)
        this.body.setOffset(-hitboxRadius, -hitboxRadius)


        Particle.Burst(SparkParticle, this.x, this.y, 4, {
            speed: 100,
            color: 0x4287f5,
            randomAngle: true
        })

        if (growProgress >= 1) {
            // Transform into a super octogon
            const scene = this.scene as any
            const minion = scene.enemyManager.spawnEnemy('super_octogon', this.x, this.y, false, false)
            minion.canSpawnMinions = false // prevent the spawned super octogon from spawning more suspicious squares
            this._destroy() // destroy the suspicious square
        }
    }
}

  moveTowards(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const targetVelX = -Math.cos(angle) * this.speed
    const targetVelY = -Math.sin(angle) * this.speed

    // Lerp velocity for smooth movement (0.15 = smoothing factor)
    const smoothing = 0.15
    this.velocityX = Phaser.Math.Linear(this.velocityX, targetVelX, smoothing)
    this.velocityY = Phaser.Math.Linear(this.velocityY, targetVelY, smoothing)

    // Lerp rotation for smooth turning
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, angle + Math.PI / 2, 0.1)
  }

  PreDraw(): boolean {
    this.sprite.setAlpha(0.5)
    return true
  }

  /**
   * Emissive glow, sized to the enemy so bigger shapes light more of the room.
   *
   * Uses this.color, not a stored default: the damage flash tints the SPRITE and
   * leaves this.color alone (Enemy.takeDamage), so the light will not strobe white
   * on every hit.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity * this.radius / 55)
  }
}
