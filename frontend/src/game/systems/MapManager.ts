import Phaser from 'phaser'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/GameConfig'
import { LightingSystem } from './LightingSystem'

interface Obstacle {
  x: number
  y: number
  radius: number
  sides: number
  color: number
  hitboxSize?: number  // Optional, defaults to 1.0
}

export class MapManager {
  /** World-pixel spacing of the background grid. Drawing and light baking share it. */
  private static readonly GRID_SIZE = 50

  /**
   * Self-illumination baked into the light map (see LightingSystem.BakeLight).
   * These are what keep unlit areas from being a featureless void: the grid
   * glows faintly on its own, so darkness still has structure. Keep them well
   * below a real light's intensity or the whole world flattens into haze.
   */
  private static readonly GRID_EMISSION = 0.50
  private static readonly OBSTACLE_EMISSION = 1

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

    // Hand the same geometry to the light map: what blocks light, and what emits it.
    this.bakeLighting(config)
  }

  /**
   * Register the map with the LightingSystem.
   *
   * Obstacles occlude AND emit; grid lines only emit. Baked light is not flooded,
   * so the grid stays a crisp lattice rather than bleeding into a uniform glow -
   * see LightingSystem.BakeLight.
   */
  private bakeLighting(config: { gridColor: number; obstacleColor: number }): void {
    LightingSystem.SetOccluders(this.obstacleData)
    LightingSystem.ClearBaked()

    for (const o of this.obstacleData) {
      LightingSystem.BakeLight(o.x, o.y, config.obstacleColor, MapManager.OBSTACLE_EMISSION, o.radius)
    }

    // Walk each grid line at light-tile resolution so the line is continuous in
    // the light map rather than a row of dots.
    //
    // skipSolid matters here: the grid is painted on the FLOOR, and the floor is
    // not there where an obstacle covers it. Without it, grid emission gets baked
    // into the obstacle's own tiles and shows through as bright bands running
    // across the obstacle - it renders below the light overlay, so it is
    // multiplied by whatever light lands on it. The drawn grid lines are already
    // hidden correctly (obstacles are opaque and sit above them); this is purely
    // about the light map agreeing with that.
    const step = LightingSystem.TileSize
    const g = MapManager.GRID_SIZE
    for (let x = 0; x <= WORLD_WIDTH; x += g) {
      for (let y = 0; y < WORLD_HEIGHT; y += step) {
        LightingSystem.BakeLight(x, y, config.gridColor, MapManager.GRID_EMISSION, 0, true)
      }
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += g) {
      for (let x = 0; x < WORLD_WIDTH; x += step) {
        LightingSystem.BakeLight(x, y, config.gridColor, MapManager.GRID_EMISSION, 0, true)
      }
    }
  }

  private getBiomeConfig(biome: string): {
    obstacleCount: number
    obstacleSize: number
    obstacleColor: number
    backgroundColor: number
    gridColor: number
  } {
    // ALBEDO, NOT FINAL COLOUR - AND ALSO THE EMISSION COLOUR.
    // LightingSystem multiplies a light map over the world, so each value here
    // is the colour a surface shows when FULLY LIT; unlit it is scaled down by
    // LightingSystem's `ambient` (0.10, set in MainScene).
    //
    // gridColor and obstacleColor do double duty: they are what the map is DRAWN
    // with (drawBackground / createObstacle) and also the colour of the light
    // those surfaces EMIT (bakeLighting). GRID_EMISSION / OBSTACLE_EMISSION scale
    // that light's intensity only - to give a surface a glow of a different hue
    // than itself, these would need to be split into separate emission colours.
    //
    // backgroundColor is the one to be careful with: it covers the entire screen,
    // so if `ambient` is raised much, brightness here stops reading as lighting
    // and becomes uniform haze over the whole frame. It is kept dark enough that
    // at ambient 0.10 it lands at ~0x040406. The GRID and OBSTACLES are what
    // light is meant to reveal, and they additionally emit light of their own -
    // see bakeLighting().
    //
    // Raise gridColor/obstacleColor to make lit areas pop harder; lower
    // `ambient` in MainScene to make unlit areas darker.
    const biomes: Record<string, ReturnType<typeof this.getBiomeConfig>> = {
      default: {
        obstacleCount: 60,  // Increased for larger map (was 15 for 1280x720)
        obstacleSize: 40,
        obstacleColor: 0x4a4a62,     // unlit ~0x070709 (was 0x333344)
        backgroundColor: 0x2a2a3a,   // unlit ~0x040406 (was 0x0a0a0f)
        gridColor: 0x7a7ab8          // unlit ~0x0c0c12 (was 0x1a1a2f)
      },
      void: {
        obstacleCount: 20,
        obstacleSize: 35,
        obstacleColor: 0x3d1a5c,     // unlit ~0x060209 (was 0x220033)
        backgroundColor: 0x16161f,   // unlit ~0x020203 (was 0x050508)
        gridColor: 0x5c1aa8          // unlit ~0x090311 (was 0x110022)
      },
      neon: {
        obstacleCount: 12,
        obstacleSize: 45,
        obstacleColor: 0x0a5c9e,     // unlit ~0x010910 (was 0x002244)
        backgroundColor: 0x102030,   // unlit ~0x020305 (was 0x000510)
        gridColor: 0x2a9ec4          // unlit ~0x041014 (was 0x003355)
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
    graphics.lineStyle(2, 0x6a6a88, 1)  // albedo; unlit ~0x282833 (was 0x555566)

    graphics.beginPath()
    graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()

    // Below LightingSystem.OVERLAY_DEPTH (-5) so obstacles are lit by the light
    // map, but above the background grid (-10).
    graphics.setDepth(-9)

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
    const gridSize = MapManager.GRID_SIZE

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
