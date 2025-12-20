import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { EnemyManager } from '../systems/EnemyManager'
import { WaveManager } from '../systems/WaveManager'
import { CollisionManager } from '../systems/CollisionManager'
import { MapManager } from '../systems/MapManager'
import { EventBus } from '../core/EventBus'
import { GameManager } from '../core/GameManager'
import { GAME_WIDTH, GAME_HEIGHT } from '../core/GameConfig'
import { AttackType } from '../data/attackTypes'
import { Projectile } from '../entities/projectiles/Projectile'
import { UpgradeSystem, UpgradeEffectSystem, registerEffectHandlers, type UpgradeDefinition } from '../systems/upgrades'
import { TextureGenerator } from '../utils/TextureGenerator'

// Import all upgrade JSONs
import statUpgrades from '../data/upgrades/stat_upgrades.json'
import effectUpgrades from '../data/upgrades/effect_upgrades.json'
import variantUpgrades from '../data/upgrades/variant_upgrades.json'
import visualUpgrades from '../data/upgrades/visual_upgrades.json'
import abilityUpgrades from '../data/upgrades/ability_upgrades.json'

export class MainScene extends Phaser.Scene {
  player!: Player
  enemyManager!: EnemyManager
  waveManager!: WaveManager
  collisionManager!: CollisionManager
  mapManager!: MapManager

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>
  private debugGraphics!: Phaser.GameObjects.Graphics
  private showCollisionBoxes: boolean = false

  constructor() {
    super({ key: 'MainScene' })
  }

  create(): void {
    // Register effect handlers (once at game start)
    registerEffectHandlers()

    // Generate common sprite textures (MUST be done before creating entities)
    TextureGenerator.generateCommonTextures(this)

    // Initialize debug graphics
    this.debugGraphics = this.add.graphics()
    this.debugGraphics.setDepth(1000) // Render on top

    // Initialize map
    this.mapManager = new MapManager(this)
    this.mapManager.generateMap()

    // Get selected attack from sessionStorage (set by AttackSelectPage)
    const selectedAttack = (sessionStorage.getItem('selectedAttack') as AttackType) || 'bullet'

    // Initialize player at center with selected attack
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, selectedAttack)

    // Initialize managers
    this.enemyManager = new EnemyManager(this)
    this.waveManager = new WaveManager(this, this.enemyManager)
    this.collisionManager = new CollisionManager(
      this,
      this.player,
      this.enemyManager,
      this.mapManager.getObstacles() // Pass obstacles for collision detection
    )

    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    }

    // Pause on ESC
    this.input.keyboard!.on('keydown-ESC', () => {
      const state = GameManager.getState()
      if (state.isPaused) {
        GameManager.resume()
      } else {
        GameManager.pause()
      }
    })

    // Shield ability on E
    this.input.keyboard!.on('keydown-E', () => {
      this.player.activateShield()
    })

    // Dash ability on SPACE
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.player.dash()
    })

    // Listen for events
    EventBus.on('game-pause', () => this.scene.pause())
    EventBus.on('game-resume', () => this.scene.resume())
    EventBus.on('start-next-wave', () => this.waveManager.startNextWave())
    EventBus.on('upgrade-selected', (upgradeId) => {
      this.applyUpgrade(upgradeId)
    })
    EventBus.on('dev-apply-upgrade', (upgradeId) => {
      this.applyUpgrade(upgradeId, true) // Skip cost check for dev tools
    })
    EventBus.on('dev-remove-upgrade' as any, (upgradeId: string) => {
      UpgradeSystem.decrementUpgrade(upgradeId)
    })
    EventBus.on('evolution-milestone', () => {
      this.applyUpgrade('polygon_upgrade', true) // Apply Evolution upgrade for free
    })
    EventBus.on('toggle-collision-boxes' as any, (show: boolean) => {
      this.showCollisionBoxes = show
    })
    EventBus.on('set-wave' as any, (wave: number) => {
      this.enemyManager.clear()
      this.waveManager.setWave(wave)
    })
    EventBus.on('enemy-explode', (data: { x: number; y: number; radius: number; damage: number }) => {
      // Create explosion visual with a reddish color
      const explosion = this.add.graphics()
      explosion.fillStyle(0xff6b6b, 0.3)
      explosion.fillCircle(data.x, data.y, data.radius)

      // Fade out
      this.tweens.add({
        targets: explosion,
        alpha: 0,
        duration: 200,
        onComplete: () => explosion.destroy()
      })

      // Convert enemy-explode event to explosion-damage event so that blast radius and damage upgrades apply
      this.events.emit('explosion-damage', data)
    })
    EventBus.on('player-death', () => {
      // Display death message
      const deathText = this.add.text(
        20,
        GAME_HEIGHT - 20,
        'YOU DIED\nHealth reached 0',
        {
          fontSize: '24px',
          color: '#ffffff',
          align: 'left',
          fontStyle: 'bold'
        }
      )
      deathText.setOrigin(0, 1) // Anchor from bottom-left corner
      deathText.setDepth(10000) // Render on top of everything
    })

    // Clear projectiles at end of wave
    this.events.on('clear-projectiles', () => {
      this.player.clearProjectiles()
    })

    // Handle explosion damage
    this.events.on('explosion-damage', (data: { x: number; y: number; radius: number; damage: number }) => {
      const enemies = this.enemyManager.getEnemies()
      // console.log(`Explosion at (${Math.round(data.x)}, ${Math.round(data.y)}) radius=${data.radius} damage=${data.damage}, enemies in range:`)
      for (const enemy of enemies) {
        const dist = Phaser.Math.Distance.Between(data.x, data.y, enemy.x, enemy.y)
        if (dist <= data.radius) {
          // Calculate damage falloff based on distance from center
          // At center (dist=0): 100% damage
          // At edge (dist=radius): minimum damage (5% of base)
          const falloffFactor = Math.max(0.05, 1 - (dist / data.radius) * 0.95)
          const actualDamage = data.damage * falloffFactor
          
          // console.log(`  - Enemy ${enemy.id} at distance ${Math.round(dist)}, falloff=${falloffFactor.toFixed(2)}, dealing ${actualDamage.toFixed(1)} damage`)
          enemy.takeDamage(actualDamage)
        }
      }
    })

    // Handle ability state requests from UI
    EventBus.on('request-ability-state' as any, () => {
      const shieldCharges = UpgradeEffectSystem.getEffectValue('shield')
      const hasDash = UpgradeEffectSystem.hasAbility('dash')
      const dashCooldownProgress = this.player.getDashCooldownProgress()

      EventBus.emit('ability-state-update' as any, {
        shieldCharges,
        hasDash,
        dashCooldownProgress
      })
    })

    // Handle dev enemy spawning
    EventBus.on('dev-spawn-enemy' as any, (enemyType: string) => {
      // Spawn near player with some random offset
      const offsetX = Phaser.Math.Between(-200, 200)
      const offsetY = Phaser.Math.Between(-200, 200)
      const spawnX = this.player.x + offsetX
      const spawnY = this.player.y + offsetY

      this.enemyManager.spawnEnemy(enemyType, spawnX, spawnY)
    })

    // Handle enemy splitting on death
    EventBus.on('enemy-split' as any, (data: { x: number; y: number; spawnType?: string; count?: number }) => {
      const spawnType = data.spawnType || 'triangle'
      const count = data.count || 2
      for (let i = 0; i < count; i++) {
        this.enemyManager.spawnEnemy(spawnType, data.x, data.y)
      }
    })

    // Start with initial upgrade phase
    this.time.delayedCall(500, () => {
      // Give player starting points for initial upgrades
      GameManager.addPoints(70)
      // Show upgrade modal before wave 1
      EventBus.emit('show-upgrades')
    })
  }

  update(_time: number, delta: number): void {
    if (GameManager.getState().isPaused) return

    // Update effect system (for regeneration, etc.)
    UpgradeEffectSystem.onUpdate(delta)

    // Handle movement input
    let velocityX = 0
    let velocityY = 0

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      velocityX = -1
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      velocityX = 1
    }

    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
      velocityY = -1
    } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
      velocityY = 1
    }

    this.player.move(velocityX, velocityY)

    // Update player rotation to face mouse
    const pointer = this.input.activePointer
    this.player.rotateTowards(pointer.worldX, pointer.worldY)

    // Handle shooting
    if (this.input.activePointer.isDown) {
      this.player.shoot(pointer.worldX, pointer.worldY)
    }

    // Update player (for attack animations like spinner/flamer)
    this.player.update()

    // Update managers
    this.enemyManager.update(this.player.x, this.player.y)

    // Check wave completion
    if (this.waveManager.isWaveComplete()) {
      this.waveManager.completeWave()
    }

    // Draw collision boxes if enabled
    if (this.showCollisionBoxes) {
      this.drawCollisionBoxes()
    } else {
      this.debugGraphics.clear()
    }
  }

  /**
   * Centralized projectile spawning method.
   * Can be called by both Player and Enemy to spawn projectiles.
   */
  spawnProjectile(
    projectile: Projectile,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    owner: 'player' | 'enemy',
    ownerId: number
  ): Projectile {
    // Set ownership
    projectile.owner = owner
    projectile.ownerId = ownerId

    // Assign unique ID from GameManager
    projectile.id = GameManager.generateProjectileId()

    // Spawn the projectile
    const container = projectile._spawn(this, startX, startY, targetX, targetY)

    // Register with GameManager for tracking
    GameManager.addProjectile(projectile)

    // Add to the appropriate group based on owner
    if (owner === 'player') {
      this.player.getProjectileGroup().add(container)
    } else {
      this.enemyManager.addProjectile(projectile, container)
    }

    return projectile
  }

  private drawCollisionBoxes(): void {
    this.debugGraphics.clear()
    this.debugGraphics.lineStyle(2, 0x00ff00, 1)

    // Draw player collision box
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    this.debugGraphics.strokeCircle(
      this.player.x,
      this.player.y,
      playerBody.radius
    )

    // Draw enemy collision boxes
    const enemies = this.enemyManager.getEnemies()
    this.debugGraphics.lineStyle(2, 0xff0000, 1)
    for (const enemy of enemies) {
      if (!enemy.isDestroyed) {
        const container = enemy.getContainer()
        const body = container.body as Phaser.Physics.Arcade.Body
        if (body) {
          this.debugGraphics.strokeCircle(
            container.x,
            container.y,
            body.radius
          )
        }
      }
    }

    // Draw projectile collision boxes (both player and enemy)
    const projectiles = GameManager.getAllProjectiles()
    for (const projectile of projectiles) {
      if (!projectile.isDestroyed) {
        const container = projectile.getContainer()
        const body = container.body as Phaser.Physics.Arcade.Body
        if (body) {
          // Cyan for player projectiles, magenta for enemy projectiles
          const color = (projectile as any).owner === 'player' ? 0x00ffff : 0xff00ff
          this.debugGraphics.lineStyle(2, color, 1)
          this.debugGraphics.strokeCircle(
            container.x,
            container.y,
            body.radius
          )
        }
      }
    }

    // Draw obstacle collision boxes
    this.debugGraphics.lineStyle(2, 0xffff00, 1) // Yellow for obstacles
    const obstacles = this.mapManager.getObstacles()
    obstacles.getChildren().forEach((obj: any) => {
      if (obj.body && obj.visible === false) { // Only draw invisible physics bodies
        const circle = obj as Phaser.GameObjects.Arc
        const body = obj.body as Phaser.Physics.Arcade.Body
        // Use the circle's position (center) and the body's actual radius
        this.debugGraphics.strokeCircle(
          circle.x,
          circle.y,
          body.radius
        )
      }
    })
  }

  private applyUpgrade(upgradeId: string, skipCost: boolean = false): boolean {
    // Combine all upgrade sources
    const allUpgrades = [
      ...statUpgrades.upgrades,
      ...effectUpgrades.upgrades,
      ...variantUpgrades.upgrades,
      ...visualUpgrades.upgrades,
      ...abilityUpgrades.upgrades
    ] as UpgradeDefinition[]

    // Find the upgrade
    const upgrade = allUpgrades.find(u => u.id === upgradeId)

    if (!upgrade) {
      console.error(`Upgrade not found: ${upgradeId}`)
      return false
    }

    // Check if player can afford it (skip for dev tools)
    const stats = GameManager.getPlayerStats()
    const cost = upgrade.cost || 0

    if (!skipCost && stats.points < cost) {
      console.warn(`Not enough points for ${upgrade.name}. Need ${cost}, have ${stats.points}`)
      return false
    }

    // Apply the upgrade
    const success = UpgradeSystem.applyUpgrade(upgrade)

    if (success) {
      console.log(`Applied upgrade: ${upgrade.name}${skipCost ? ' (DEV - FREE)' : ''}`)

      // Deduct points (skip for dev tools)
      if (!skipCost && cost > 0) {
        GameManager.addPoints(-cost)
      }

      // Apply player stat changes immediately
      if (upgrade.type === 'stat_modifier' && upgrade.target === 'player') {
        if (upgrade.stat === 'maxHealth' && upgrade.value) {
          GameManager.updatePlayerStats({
            maxHealth: stats.maxHealth + upgrade.value,
            health: stats.health + upgrade.value // Also heal
          })
        } else if (upgrade.stat === 'speed' && upgrade.value) {
          GameManager.updatePlayerStats({
            speed: stats.speed + upgrade.value
          })
        } else if (upgrade.stat === 'polygonSides' && upgrade.value) {
          GameManager.updatePlayerStats({
            polygonSides: stats.polygonSides + upgrade.value
          })
          this.player.updatePolygon()
        }
      }
      return true
    } else {
      console.warn(`Could not apply upgrade: ${upgrade.name}`)
      return false
    }
  }
}
