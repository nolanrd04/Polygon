import Phaser from 'phaser'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/GameConfig'

interface Obstacle {
  x: number
  y: number
  radius: number
  sides: number
  color: number
  hitboxSize?: number  // Optional, defaults to 1.0
}

export class MapManager {
  private scene: Phaser.Scene
  private obstacles: Phaser.GameObjects.Group
  private obstacleData: Obstacle[] = []
  private seed: number

  constructor(scene: Phaser.Scene, seed?: number) {
    this.scene = scene
    this.seed = seed || Date.now()
    this.obstacles = scene.add.group()
  }

  generateMap(biome: string = 'default'): void {
    this.clear()

    // Seeded random for reproducibility
    const random = this.seededRandom(this.seed)

    const config = this.getBiomeConfig(biome)

    // Generate obstacles
    const obstacleCount = config.obstacleCount
    const safeRadius = 150 // Safe zone around player spawn

    for (let i = 0; i < obstacleCount; i++) {
      let x: number, y: number
      let attempts = 0

      // Find valid position (not in safe zone, not overlapping)
      do {
        x = random() * (WORLD_WIDTH - 100) + 50
        y = random() * (WORLD_HEIGHT - 100) + 50
        attempts++
      } while (
        this.isInSafeZone(x, y, safeRadius) ||
        (this.isOverlapping(x, y, config.obstacleSize) && attempts < 50)
      )

      if (attempts < 50) {
        const sides = Math.floor(random() * 4) + 3
        const obstacle: Obstacle = {
          x,
          y,
          radius: config.obstacleSize * (0.5 + random() * 0.5),
          sides,
          color: config.obstacleColor,
          hitboxSize: this.calculateHitboxSize(sides)
        }

        this.obstacleData.push(obstacle)
        this.createObstacle(obstacle)
      }
    }

    // Draw background grid
    this.drawBackground(config)
  }

  private getBiomeConfig(biome: string): {
    obstacleCount: number
    obstacleSize: number
    obstacleColor: number
    backgroundColor: number
    gridColor: number
  } {
    const biomes: Record<string, ReturnType<typeof this.getBiomeConfig>> = {
      default: {
        obstacleCount: 60,  // Increased for larger map (was 15 for 1280x720)
        obstacleSize: 40,
        obstacleColor: 0x333344,
        backgroundColor: 0x0a0a0f,
        gridColor: 0x1a1a2f
      },
      void: {
        obstacleCount: 20,
        obstacleSize: 35,
        obstacleColor: 0x220033,
        backgroundColor: 0x050508,
        gridColor: 0x110022
      },
      neon: {
        obstacleCount: 12,
        obstacleSize: 45,
        obstacleColor: 0x002244,
        backgroundColor: 0x000510,
        gridColor: 0x003355
      }
    }

    return biomes[biome] || biomes.default
  }

  private isInSafeZone(x: number, y: number, safeRadius: number): boolean {
    const centerX = WORLD_WIDTH / 2
    const centerY = WORLD_HEIGHT / 2
    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
    return dist < safeRadius
  }

  private isOverlapping(x: number, y: number, radius: number): boolean {
    for (const obstacle of this.obstacleData) {
      const dist = Math.sqrt(Math.pow(x - obstacle.x, 2) + Math.pow(y - obstacle.y, 2))
      if (dist < radius + obstacle.radius + 20) {
        return true
      }
    }
    return false
  }

  private createObstacle(obstacle: Obstacle): void {
    const graphics = this.scene.add.graphics()

    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / obstacle.sides

    for (let i = 0; i < obstacle.sides; i++) {
      const angle = angleStep * i
      vertices.push(new Phaser.Math.Vector2(
        obstacle.x + Math.cos(angle) * obstacle.radius,
        obstacle.y + Math.sin(angle) * obstacle.radius
      ))
    }

    graphics.fillStyle(obstacle.color, 1)
    graphics.lineStyle(2, 0x555566, 1)

    graphics.beginPath()
    graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()

    this.obstacles.add(graphics)

    // Add physics body for collision
    const hitboxSize = obstacle.hitboxSize || 1.0
    const hitboxRadius = obstacle.radius * hitboxSize
    const body = this.scene.add.circle(obstacle.x, obstacle.y, hitboxRadius)
    body.setVisible(false)
    this.scene.physics.add.existing(body, true) // Static body

    // Ensure the physics body is set as a circle with correct radius
    const physicsBody = body.body as Phaser.Physics.Arcade.Body
    physicsBody.setCircle(hitboxRadius)

    this.obstacles.add(body)
  }

  private drawBackground(config: { backgroundColor: number; gridColor: number }): void {
    const graphics = this.scene.add.graphics()
    graphics.setDepth(-10)

    // Background
    graphics.fillStyle(config.backgroundColor, 1)
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    // Grid
    graphics.lineStyle(1, config.gridColor, 0.3)
    const gridSize = 50

    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
      graphics.beginPath()
      graphics.moveTo(x, 0)
      graphics.lineTo(x, WORLD_HEIGHT)
      graphics.strokePath()
    }

    for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(WORLD_WIDTH, y)
      graphics.strokePath()
    }
  }

  private seededRandom(seed: number): () => number {
    let s = seed
    return () => {
      s = Math.sin(s) * 10000
      return s - Math.floor(s)
    }
  }

  getObstacles(): Phaser.GameObjects.Group {
    return this.obstacles
  }

  getObstacleData(): Obstacle[] {
    return this.obstacleData
  }

  clear(): void {
    this.obstacles.clear(true, true)
    this.obstacleData = []
  }

  setSeed(seed: number): void {
    this.seed = seed
  }

  /**
   * Calculate hitbox size based on number of sides.
   * Triangles (3 sides) get 0.8, scaling up to 1.0 for 8-sided polygons.
   */
  private calculateHitboxSize(sides: number): number {
    const minSides = 3
    const maxSides = 8
    const minHitbox = 0.65
    const maxHitbox = 1.0

    // Clamp sides to range
    const clampedSides = Math.max(minSides, Math.min(maxSides, sides))

    // Linear interpolation from 0.8 to 1.0
    const t = (clampedSides - minSides) / (maxSides - minSides)
    return minHitbox + t * (maxHitbox - minHitbox)
  }
}
