import { TextureGenerator } from '../../utils/TextureGenerator'
import { Enemy } from './Enemy'
import { TrailRenderer } from '../../utils/TrailRenderer'
// import { EnemyBullet } from '../projectiles/enemy_projectiles/EnemyBullet'
import { DodecahedronBullet } from '../projectiles/enemy_projectiles/DodecahedronBullet'

export class Dodecahedron extends Enemy {
  private invincible: boolean = false
  // spawn animation variables
  private spawnImmunityDuration: number = 1000 // 1 second in milliseconds
  private spawnStartTime: number = 0
  private spawnScale = 1.3

  // onHit() variables
  private hitColor = 0xb067f5
  private hitColorTimer: Phaser.Time.TimerEvent | null = null
  private readonly defaultColor = 0x8a2be2

  // phase tracker
  private phase: number = 1
  private phaseStyle: number = 0
  // Phase 1, Phase Style 0: Move towards player
  // Phase 1, Phase Style 1: Dash towards player
  // Phase 1, Phase Style 2: Idle movement
  // Phase 1, Phase Style 3: Bullet Storm with slow movement
  // Phase 1, Phase Style 4: Random location teleport
  private phaseStartTime: number = 0
  private phaseStyleDuration: number = 6000 // 6 seconds in milliseconds

  // phase one variables
  private dashing: boolean = false
  private dashDuration: number = 800
  private dashCooldownDuration: number = 350
  private dashCount: number = 0
  private dashSpeed: number = 500
  private dashDirection: number = 0 // Store dash direction so it doesn't follow player
  private dashStartTime: number = 0
  private dashCooldownStartTime: number = 0
  private showTrail: boolean = false

  private shotBulletCounter: number = 0
  private shotBulletInterval: number = 750 // milliseconds between shots in bullet storm

  private maxTeleportDistance: number = 300
  private minTeleportDistance: number = 100
  private teleportWindUpDuration: number = 500 // milliseconds
  private teleportWindDownDuration: number = 500 // milliseconds


  SetDefaults(): void {
    this.health = 16000
    this.speed = 60
    this.damage = 130
    this.sides = 12
    this.radius = 80
    this.color = this.defaultColor
    this.scoreChance = 1
    this.speedCap = 1
    this.isBoss = true
    this.knockbackResistance = 1
    this.barWidth = 60
    this.barHeight = 8
    this.scale = 1.0
    this.doOldPositionTracking = true
    this.doOldRotationTracking = true
    this.oldTrackingCounter = 1
    this.oldTrackingInterval = 100
    
  }

  AI(_playerX: number, _playerY: number): void {
    const now = this.scene.time.now

    // spawn animation
    if (this.spawnStartTime === 0) {
      // Start animation on first frame
      this.spawnStartTime = now
      this.spawnAnimation()
    }

    // spawn invincibility (time-based: 1000ms = 1 second)
    const spawnElapsed = now - this.spawnStartTime
    if (spawnElapsed < this.spawnImmunityDuration) {
      this.invincible = true
    } else {
      this.invincible = false
    }

    if (this.phase === 1)
    {
      this.PhaseOne(_playerX, _playerY)
    }
    else
    {

    }
  }

  // ************ Phase Methods ************ //
  //
  //
  PhaseOne(_playerX: number, _playerY: number): void 
  {
    const now = this.scene.time.now
    
    // Initialize phase start time on first call
    if (this.phaseStartTime === 0) {
      this.phaseStartTime = now
    }

    // Check if phase duration has elapsed (time-based, not frame-based)
    const phaseElapsed = now - this.phaseStartTime
    
    if (this.phaseStyle === 0) // Idle movement towards player
    {
      this.phaseStyleDuration = 6000
      this.moveTowards(_playerX, _playerY)
      // Transition to next phase style after duration
      if (phaseElapsed >= this.phaseStyleDuration)  // 6000ms = 6 seconds (frame-rate independent)
      {
        console.log(`Phase transition at ${phaseElapsed}ms (expected ${this.phaseStyleDuration}ms)`)
        this.phaseStyle = (this.phaseStyle + 1) % 5
        this.phaseStartTime = now  // Reset timer for dash phase
        this.dashCount = 0
      }
    }
    else if (this.phaseStyle === 1) // dash towards player
    {
      // Transition to next phase after dashes are done
      if (this.dashCount >= 3)
      {
        this.phaseStyle = (this.phaseStyle + 1) % 5
        this.phaseStartTime = now  // Reset timer for move phase
        this.dashCount = 0
      }

      // dash logic
      if (!this.dashing && this.dashCount < 3 && this.dashCooldownStartTime === 0) // START DASH
      {
        this.dashing = true
        this.showTrail = true
        this.dashStartTime = now
        // Calculate dash direction ONCE when starting dash (fixed direction)
        this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, _playerX, _playerY)
      }
      if (this.dashing && this.dashCount < 3) // DASH
      {
        // Use the pre-calculated dash direction
        this.velocityX = Math.cos(this.dashDirection) * this.dashSpeed
        this.velocityY = Math.sin(this.dashDirection) * this.dashSpeed
        this.rotation = this.dashDirection + Math.PI / 2

        const dashElapsed = now - this.dashStartTime
        if (dashElapsed >= this.dashDuration)
        {
          this.dashing = false
          this.showTrail = false
          this.dashCount++
          this.dashCooldownStartTime = now
          this.velocityX = 0
          this.velocityY = 0
        }
      }
      if (!this.dashing && this.dashCooldownStartTime > 0 && this.dashCount < 3)
      {
        const cooldownElapsed = now - this.dashCooldownStartTime
        if (cooldownElapsed >= this.dashCooldownDuration)
        {
          this.dashCooldownStartTime = 0
        }
          this.velocityX = 0
          this.velocityY = 0
      }
    }
    else if (this.phaseStyle === 2) // post-dash idle
    {
      this.phaseStyleDuration = 2000
      this.moveTowards(_playerX, _playerY)
      // Transition to next phase style after duration
      if (phaseElapsed >= this.phaseStyleDuration)  // 2000ms = 2 seconds (frame-rate independent)
      {
        console.log(`Phase transition at ${phaseElapsed}ms (expected ${this.phaseStyleDuration}ms)`)
        this.phaseStyle = (this.phaseStyle + 1) % 5
        this.phaseStartTime = now  // Reset timer for bullet storm phase
        this.dashCount = 0
      }
    }
    else if (this.phaseStyle === 3) // bullet storm with slow movement
    {
      // transition to next phase after shots are done
      if (this.shotBulletCounter >= 8)
      {
        this.phaseStyle = (this.phaseStyle + 1) % 5
        this.phaseStartTime = now  // Reset timer for move phase
        this.shotBulletCounter = 0
        this.speed = 60 // reset speed
      }
      else
      {
        // slow movement towards player
        this.speed = 30
        this.moveTowards(_playerX, _playerY)

        // shooting logic
        const shotElapsed = now - this.phaseStartTime
        if (shotElapsed >= this.shotBulletInterval * this.shotBulletCounter)
        {
          // Shoot bullet towards player
          this.ShootProjectileAtPlayer(this.damage * 3)
          this.shotBulletCounter++
        }
      }
    }
    else if (this.phaseStyle === 4) // random teleport
    {

      this.speed = 60 // reset speed
      const totalTeleportDuration = this.teleportWindUpDuration + this.teleportWindDownDuration
      const teleportStartScale = 0.7
      
      // console.log(`Teleport phase! Elapsed: ${phaseElapsed}ms`)
      
      // Wind up phase - shrink
      if (phaseElapsed < this.teleportWindUpDuration) {
        const windUpProgress = phaseElapsed / this.teleportWindUpDuration
        const targetScale = 1.0 - (windUpProgress * (1.0 - teleportStartScale))
        this.container.scale = targetScale
      }
      // Teleport happens at end of wind up
      else if (phaseElapsed === this.teleportWindUpDuration || (phaseElapsed >= this.teleportWindUpDuration && phaseElapsed < this.teleportWindUpDuration + 50)) {
        if (phaseElapsed < this.teleportWindUpDuration + 50) {
          console.log('Executing teleport!')
          // Teleport to random location relative to player, within distance bounds
          let teleportX: number
          let teleportY: number
          
          const angle = Math.random() * Math.PI * 2
          const distance = Phaser.Math.Between(this.minTeleportDistance, this.maxTeleportDistance)
            
          teleportX = _playerX + Math.cos(angle) * distance
          teleportY = _playerY + Math.sin(angle) * distance

          this.container.x = teleportX
          this.container.y = teleportY
          console.log(`Teleported to ${this.container.x}, ${this.container.y}`)

          // Reset velocity after teleport
          this.velocityX = 0
          this.velocityY = 0
        }
      }
      // Wind down phase - grow back
      else if (phaseElapsed >= this.teleportWindUpDuration && phaseElapsed < totalTeleportDuration) {
        const windDownProgress = (phaseElapsed - this.teleportWindUpDuration) / this.teleportWindDownDuration
        const targetScale = teleportStartScale + (windDownProgress * (1.0 - teleportStartScale))
        this.container.scale = targetScale
      }
      // Transition to next phase after total duration
      else if (phaseElapsed >= totalTeleportDuration) {
        console.log('Teleport phase complete, transitioning to next phase')
        this.container.scale = 1.0 // Ensure scale is reset
        this.phaseStyle = (this.phaseStyle + 1) % 5
        this.phaseStartTime = now  // Reset timer for move phase
      }
    }
  }

  // ************ Helper Methods ************ //
  //
  //
  ShootProjectileAtPlayer(damage: number): void {
    // Shoot from all 12 corners of the polygon
    for (let i = 0; i < this.sides; i++) {
      // Calculate angle for this corner
      const cornerAngle = (i / this.sides) * Math.PI * 2 + this.rotation
      
      // Calculate corner position
      const cornerX = this.x + this.radius * Math.cos(cornerAngle)
      const cornerY = this.y + this.radius * Math.sin(cornerAngle)

      // Calculate target point radially outward from corner
      const shootDistance = 500
      const targetCornerX = cornerX + Math.cos(cornerAngle) * shootDistance
      const targetCornerY = cornerY + Math.sin(cornerAngle) * shootDistance

      // Create and spawn projectile using centralized method
      const projectile = new DodecahedronBullet()
      projectile.SetDefaults()
      // Scale damage based on enemy's damage stat
      projectile.damage = damage
      // console.log(`Shooter spawning projectile with damage: ${projectile.damage} (enemy damage: ${this.damage})`)

      const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
      scene.spawnProjectile(projectile, cornerX, cornerY, targetCornerX, targetCornerY, 'enemy', this.id)
    }
  }


  // ************ OVERRIDES ************ //
  //
  //
  //
  OnHit(_damage: number, _source: any): boolean {

    // *** invincibility frames *** //
    if (this.invincible) {
      console.log(`Dodecahedron ${this.id} is invincible and ignored damage.`)
      return false
    }
    else{
      // *** hit animatiion *** //

      // Cancel previous hit timer if still active
      if (this.hitColorTimer) {
        this.hitColorTimer.remove()
      }

      // Flash hit color
      this.color = this.hitColor
      this.hitColorTimer = this.scene.time.delayedCall(100, () => {
        this.color = this.defaultColor
        this.hitColorTimer = null
      })
    }
    return true
  }

  private spawnAnimation(): void {
    // Animate scale from spawn size back to normal
    this.scene.tweens.add({
      targets: this.container,
      scale: {
        from: this.spawnScale,
        to: 1.0,
      },
      duration: this.spawnImmunityDuration, // Use time-based duration in milliseconds
      ease: 'Quad.easeOut',
    })

    // Animate color from white to default using a helper object
    const colorTween = { progress: 0 }
    this.scene.tweens.add({
      targets: colorTween,
      progress: 1,
      duration: this.spawnImmunityDuration, // Use time-based duration in milliseconds
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Interpolate between white (0xffffff) and default color
        this.color = Phaser.Display.Color.Interpolate.ColorWithColor(
          new Phaser.Display.Color(0xff, 0xff, 0xff),
          Phaser.Display.Color.HexStringToColor('#' + this.GetDefaults().color.toString(16).padStart(6, '0')),
          1,
          colorTween.progress
        ).color
      },
    })
  }

  PostDraw(): void {
      if (this.showTrail && this.oldPositionX.length > 0) {
        const textureKey = TextureGenerator.getOrCreatePolygon(this.scene, {
          radius: this.radius,
          sides: this.sides,
          fillColor: 0xd9d9d9,
          fillAlpha: 1.0,
          strokeWidth: 3,
          strokeColor: 0xffffff,
          strokeAlpha: 1.0
        })

        const positions = this.oldPositionX.map((x, i) => ({
          x,
          y: this.oldPositionY[i]
        }))

        TrailRenderer.renderTrail(this.scene, {
          positions,
          rotations: this.oldRotations,
          textureKey,
          tint: this.color,
          maxAlpha: 0.1,
          duration: 500,
          scale: this.scale,
          scaleDecay: true,
          minScale: 0.3
        })
      }
    }

  private GetDefaults() {
    return { color: 0x8a2be2 }
  }
}