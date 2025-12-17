import { Enemy } from './Enemy'

export class Diamond extends Enemy {
    private baseSpeed: number = 100
    private maxDashSpeed: number = 500
    private waitFrames: number = 240 // ~4 seconds at 60fps
    private dashFrames: number = 60 // ~1 second at 60fps
    private recoverFrames: number = 60 // ~1 second at 60fps
    private frameCounter: number = 0
    private dashDirection: number = 0 // Store direction for dash

  SetDefaults(): void {
    this.health = 50
    this.speed = 100
    this.damage = 50
    this.sides = 4
    this.radius = 25
    this.color = 0xfcf003
    this.scoreChance = .45
    this.speedCap = 2.5
    this.doOldPositionTracking = true
    this.oldTrackingCounter = 3
    this.oldTrackingInterval = 100
    this.scale = .65
    this.baseSpeed = this.speed
    this.frameCounter = 0
  }

  PreAI(): boolean {
      return true
  }

  AI(playerX: number, playerY: number): void {
    const totalFrames = this.waitFrames + this.dashFrames + this.recoverFrames
    
    // Phase 1: Wait at base speed (0 - waitFrames)
    if (this.frameCounter < this.waitFrames) {
      this.speed = this.baseSpeed
      // Continue moving towards player during wait phase
      this.moveTowards(playerX, playerY)
    }
    // Phase 2: Dash up (waitFrames - waitFrames + dashFrames)
    else if (this.frameCounter < this.waitFrames + this.dashFrames) {
      // Capture dash direction at start of dash phase
      if (this.frameCounter === this.waitFrames) {
        this.dashDirection = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      }
      
      const dashProgress = (this.frameCounter - this.waitFrames) / this.dashFrames
      this.speed = Phaser.Math.Linear(this.baseSpeed, this.maxDashSpeed, dashProgress)
      
      // Move in fixed dash direction
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2
    }
    // Phase 3: Recover (waitFrames + dashFrames - total)
    else {
      const recoverProgress = (this.frameCounter - this.waitFrames - this.dashFrames) / this.recoverFrames
      this.speed = Phaser.Math.Linear(this.maxDashSpeed, this.baseSpeed, recoverProgress)
      // Maintain dash direction while slowing down
      this.velocityX = Math.cos(this.dashDirection) * this.speed
      this.velocityY = Math.sin(this.dashDirection) * this.speed
      this.rotation = this.dashDirection + Math.PI / 2
    }

    // Increment frame counter and reset when cycle completes
    this.frameCounter++
    if (this.frameCounter >= totalFrames) {
      this.frameCounter = 0
    }
  }

  Draw(): void {
    this.graphics.clear()

    // Create diamond vertices (rhombus shape)
    const diamondVertices: Phaser.Math.Vector2[] = [
      new Phaser.Math.Vector2(0, -this.radius),           // Top
      new Phaser.Math.Vector2(this.radius * 0.6, 0),      // Right
      new Phaser.Math.Vector2(0, this.radius),            // Bottom
      new Phaser.Math.Vector2(-this.radius * 0.6, 0)      // Left
    ]

    
    // Draw trail effect at old positions
    if (this.doOldPositionTracking && this.oldPositionX.length > 0) {
      // Draw each trail diamond with increasing opacity (older = more transparent)
      for (let i = 0; i < this.oldPositionX.length; i++) {
        const opacity = ((i + 1) / this.oldPositionX.length) * 0.3  // Max 30% opacity
        
        // Calculate offset in world space
        let offsetX = this.oldPositionX[i] - this.x
        let offsetY = this.oldPositionY[i] - this.y

        // Reverse-rotate the offset to compensate for container rotation
        const cos = Math.cos(-this.rotation)
        const sin = Math.sin(-this.rotation)
        const rotatedOffsetX = offsetX * cos - offsetY * sin
        const rotatedOffsetY = offsetX * sin + offsetY * cos

        this.graphics.fillStyle(this.color, opacity)
        this.graphics.beginPath()
        this.graphics.moveTo(diamondVertices[0].x + rotatedOffsetX, diamondVertices[0].y + rotatedOffsetY)
        for (let j = 1; j < diamondVertices.length; j++) {
          this.graphics.lineTo(diamondVertices[j].x + rotatedOffsetX, diamondVertices[j].y + rotatedOffsetY)
        }
        this.graphics.closePath()
        this.graphics.fillPath()
      }
    }

    // Draw main diamond (fully opaque)
    this.graphics.fillStyle(this.color, 1)
    this.graphics.lineStyle(2, 0xffffff, 1)

    this.graphics.beginPath()
    this.graphics.moveTo(diamondVertices[0].x, diamondVertices[0].y)
    for (let i = 1; i < diamondVertices.length; i++) {
      this.graphics.lineTo(diamondVertices[i].x, diamondVertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()
  }
}