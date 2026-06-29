import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { EnemyManager } from '../systems/EnemyManager'
import { WaveManager } from '../systems/WaveManager'
import { CollisionManager } from '../systems/CollisionManager'
import { MapManager } from '../systems/MapManager'
import { EventBus } from '../core/EventBus'
import { GameManager } from '../core/GameManager'
import { GAME_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from '../core/GameConfig'
import { AttackType } from '../data/attackTypes'
import { Projectile } from '../entities/projectiles/Projectile'
import { UpgradeSystem, UpgradeEffectSystem, registerEffectHandlers, type UpgradeDefinition } from '../systems/upgrades'
import { TextureGenerator } from '../utils/TextureGenerator'
import { waveValidation } from '../services/WaveValidation'
import { SaveManager } from '../services/SaveManager'
import { getDefaultVolume, pauseBackgroundMusic, resumeBackgroundMusic, preloadAllAudio } from '../core/AudioRegistry'
import { TouchControlManager } from '../systems/TouchControlManager'
import { DroppedUpgradeBundle } from '../entities/upgrades/DroppedUpgradeBundle'
import type { Rarity, RarityWeights } from '../systems/difficulty/Difficulty'

// Import all upgrade JSONs
import statUpgrades from '../data/upgrades/stat_upgrades.json'
import effectUpgrades from '../data/upgrades/effect_upgrades.json'
import variantUpgrades from '../data/upgrades/variant_upgrades.json'
import visualUpgrades from '../data/upgrades/visual_upgrades.json'
import abilityUpgrades from '../data/upgrades/ability_upgrades.json'
import curses from '../data/upgrades/curses.json'

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
  private upgradeMenuOpen: boolean = false
  private touchControls!: TouchControlManager

  private bundleGroup!: Phaser.GameObjects.Group
  private activeBundles: DroppedUpgradeBundle[] = []

  constructor() {
    super({ key: 'MainScene' })
  }

  create(): void {

    // -------- INITIALIZATION -------- //
    // Register effect handlers (once at game start)
    registerEffectHandlers()

    // Load audio assets
    preloadAllAudio(this)

    // Generate common sprite textures (MUST be done before creating entities)
    TextureGenerator.generateCommonTextures(this)

    // Initialize debug graphics (such as hitbox visuals)
    this.debugGraphics = this.add.graphics()
    this.debugGraphics.setDepth(1000) // Render on top

    // Set up world bounds (larger than camera view for scrolling)
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    // Initialize map
    this.mapManager = new MapManager(this)
    this.mapManager.generateMap()

    // Get selected attack from sessionStorage (set by AttackSelectPage)
    const selectedAttack = (sessionStorage.getItem('selectedAttack') as AttackType) || 'bullet'

    // Initialize player at center with selected attack
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, selectedAttack)

    // Make camera follow player smoothly with pixel rounding to prevent jitter
    // roundPixels: true forces full pixel rounding to eliminate sub-pixel jitter
    // Higher lerp values (0.5) = tighter follow
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5)
    this.cameras.main.roundPixels = true

    // Ensure camera zoom is exactly 1.0 (integer zoom prevents jitter)
    this.cameras.main.setZoom(1.0)

    // Disable right-click context menu to prevent movement getting stuck
    this.input.mouse!.disableContextMenu()

    // Initialize managers
    this.enemyManager = new EnemyManager(this)
    this.waveManager = new WaveManager(this, this.enemyManager)
    this.collisionManager = new CollisionManager(
      this,
      this.player,
      this.enemyManager,
      this.mapManager.getObstacles() // Pass obstacles for collision detection
    )
    
    // -------- -------- -------- //

    // -------- UPGRADE BUNDLES -------- //
    // Upgrade Bundle group and player-bundle overlap
    this.bundleGroup = this.add.group()

    this.physics.add.overlap(
      this.player,
      this.bundleGroup,
      (_player, bundleContainer) => {
        const bundle = (bundleContainer as Phaser.GameObjects.Container).getData('bundleInstance') as DroppedUpgradeBundle
        if (!bundle || bundle.isDestroyed) return

        const { x, y } = bundle.getContainer()
        const upgradeValue = bundle.upgradeValue
        bundle.destroy()

        // Roll how many upgrades/curses this bundle contains (1–4).
        // All upgrades are picked now so canApply() reflects current state.
        const count = Math.floor(Math.random() * 4) + 1

        // Build rarity weights capped at the bundle's tier and re-normalized.
        // e.g. a rare bundle on wave 25 strips epic+legendary then rescales common/uncommon/rare to sum to 1.
        const rarityOrder: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
        const rawWeights = this.waveManager.getRarityWeights()
        let weightSum = 0
        for (let tier = 0; tier <= upgradeValue; tier++) weightSum += rawWeights[rarityOrder[tier]]
        const rollItemRarity = (): number => {
          let roll = Math.random() * weightSum
          for (let tier = 0; tier <= upgradeValue; tier++) {
            roll -= rawWeights[rarityOrder[tier]]
            if (roll <= 0) return tier
          }
          return 0
        }

        const pickedIds: string[] = []

        // First slot is always a regular upgrade at the bundle's rarity — guarantees
        // at least one matching-tier item per bundle. Falls back to lower tiers only
        // if the pool at that tier is exhausted.
        const firstId = this.pickRegularUpgrade(upgradeValue, pickedIds)
        if (firstId) pickedIds.push(firstId)

        // Remaining slots (if any) are each 50/50 curse or regular, no duplicates.
        for (let i = 1; i < count; i++) {
          const id = Math.random() < 0.5
            ? this.pickCurse(rollItemRarity(), pickedIds)
            : this.pickRegularUpgrade(rollItemRarity(), pickedIds)
          if (id) pickedIds.push(id)
        }

        if (pickedIds.length === 0) return

        const allUpgradeDefs = [
          ...statUpgrades.upgrades,
          ...effectUpgrades.upgrades,
          ...variantUpgrades.upgrades,
          ...visualUpgrades.upgrades,
          ...abilityUpgrades.upgrades,
          ...curses.curses,
        ] as UpgradeDefinition[]

        pickedIds.forEach((upgradeId, i) => {
          this.applyUpgrade(upgradeId, true)

          const def = allUpgradeDefs.find(u => u.id === upgradeId)
          if (def) {
            const rarityIndex = rarityOrder.indexOf(def.rarity as Rarity)
            this.showBundlePickupText(x, y, def.name, rarityIndex, def.curse, i * 220)
          }
        })
      }
    )
    // -------- -------- -------- //

    // -------- CONTROLS -------- //
    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    }

    // Pause on ESC - NOW HANDLED AT DOM LEVEL IN GamePage.tsx
    // (DOM handler works even when scene is paused, scene handler doesn't)
    // this.input.keyboard!.on('keydown-ESC', () => {
    //   const state = GameManager.getState()
    //   if (state.isPaused) {
    //     GameManager.resume()
    //   } else {
    //     GameManager.pause()
    //   }
    // })

    // Shield ability on E
    this.input.keyboard!.on('keydown-E', () => {
      this.player.activateShield()
    })

    // Dash ability on SPACE
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.player.dash()
    })

    // -------- -------- -------- //

    // -------- EVENTS -------- //
    // Listen for events
    EventBus.on('game-pause', () => {
      this.scene.pause()
      // Pause background music when game is paused
      pauseBackgroundMusic(this)
    })
    EventBus.on('game-resume', () => {
      this.scene.resume()
      resumeBackgroundMusic(this)
    })
    EventBus.on('start-next-wave', () => {
      this.upgradeMenuOpen = false
      this.input.activePointer.reset()
      this.waveManager.startNextWave()
    })
    EventBus.on('upgrade-selected', (upgradeId) => {
      this.applyUpgrade(upgradeId)
    })
    EventBus.on('upgrade-rerolled', () => {
      this.sound.play('upgrade_reroll', { volume: getDefaultVolume('upgrade_reroll') })
    })
    EventBus.on('show-upgrades', () => {
      this.upgradeMenuOpen = true
    })
    EventBus.on('dev-apply-upgrade', (upgradeId) => {
      this.applyUpgrade(upgradeId, true) // Skip cost check for dev tools
    })
    EventBus.on('dev-remove-upgrade' as any, (upgradeId: string) => {
      UpgradeSystem.decrementUpgrade(upgradeId)
    })
    EventBus.on('evolution-milestone', () => {
      this.applyUpgrade('polygon_upgrade', true, false) // Apply Evolution upgrade for free
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
      deathText.setScrollFactor(0) // Fix to screen space, don't move with camera
    })

    // Clear projectiles at end of wave
    this.events.on('clear-projectiles', () => {
      this.player.clearProjectiles()
    })

    // Handle explosion damage
    this.events.on('explosion-damage', (data: { x: number; y: number; radius: number; damage: number }) => {
      const enemies = this.enemyManager.getEnemies()
      for (const enemy of enemies) {
        const dist = Phaser.Math.Distance.Between(data.x, data.y, enemy.x, enemy.y)
        // Check if explosion radius overlaps with enemy hitbox
        // Damage is dealt if: distance <= explosion_radius + enemy_radius
        if (dist <= data.radius + enemy.radius) {
          enemy.takeDamage(data.damage)
        }
      }
    })

    // Handle ability state requests from UI
    EventBus.on('request-ability-state' as any, () => {
      const shieldCharges = UpgradeEffectSystem.getEffectValue('shield')
      const hasDash = UpgradeEffectSystem.hasAbility('dash')
      const dashCooldownProgress = this.player.getDashCooldownProgress()
      const maxDashCharges = this.player.getMaxDashCharges()
      const dashQueueProgress = this.player.getDashQueueProgress()
      const readyDashCharges = this.player.getReadyDashCharges()

      EventBus.emit('ability-state-update' as any, {
        shieldCharges,
        hasDash,
        dashCooldownProgress,
        maxDashCharges,
        dashQueueProgress,
        readyDashCharges
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

    // Upgrade bundle drop rolls
    EventBus.on('upgrade-bundle', (data: { x: number; y: number; bundleDropChance: number; forcedRarity?: number }) => {
      // forcedRarity bypasses drop chance and rarity roll — always spawns at the given tier
      if (data.forcedRarity !== undefined) {
        const bundle = new DroppedUpgradeBundle(this, data.x, data.y, data.forcedRarity)
        this.activeBundles.push(bundle)
        this.bundleGroup.add(bundle.getContainer())
        return
      }

      const dropChance = data.bundleDropChance > 0
        ? data.bundleDropChance
        : this.waveManager.getBundleDropChance()

      if (Math.random() > dropChance) return

      const rarityWeights = this.waveManager.getBundleRarityWeights()
      const upgradeValue = this.rollBundleRarity(rarityWeights)

      const bundle = new DroppedUpgradeBundle(this, data.x, data.y, upgradeValue)
      this.activeBundles.push(bundle)
      this.bundleGroup.add(bundle.getContainer())
    })

    // WAVE VALIDATION: Track enemy deaths
    EventBus.on('enemy-killed', (data: { type: string; x: number; y: number }) => {
      waveValidation.recordEnemyDeath(data.type, data.x, data.y)
    })

    // WAVE VALIDATION: Track damage dealt
    EventBus.on('damage-dealt', (damage: number) => {
      waveValidation.recordDamage(damage)
    })

    // -------- -------- -------- //

    // -------- TOUCH CONTROLS -------- //

    // Enable multi-touch (allow 4 simultaneous pointers for both joysticks + 2 ability buttons)
    this.input.addPointer(3)

    // No camera zoom - let the canvas fill the screen naturally with Scale.RESIZE
    // This keeps joystick positioning predictable in screen space

    // Initialize touch controls (mobile)
    this.touchControls = new TouchControlManager(this, this.player)

    // Clean up touch controls on shutdown
    this.events.on('shutdown', () => {
      if (this.touchControls) {
        this.touchControls.destroy()
      }
    })

    // -------- -------- -------- //

    // -------- GAME START -------- //
    // Start with initial upgrade phase
    this.time.delayedCall(500, async () => {
      const currentState = GameManager.getState()

      console.log('MainScene initializing - Current GameManager state:', {
        wave: currentState.wave,
        points: currentState.playerStats.points,
        seed: currentState.seed
      })

      // Determine wave number
      const waveNumber = currentState.wave || 1

      // CRITICAL: ALWAYS sync WaveManager with GameManager's wave
      // This ensures the correct wave is used regardless of how the game was loaded
      // WaveManager defaults to wave 1, so we must explicitly set it
      this.waveManager.setWave(waveNumber)
      console.log('Synced WaveManager to wave:', waveNumber)

      // Check if this is a loaded game by checking if GameManager already has points
      // SaveGameService restores points BEFORE MainScene runs, so if points > 0, it's a loaded game
      // Also check for wave > 1 or existing upgrades as fallback
      const hasPoints = currentState.playerStats.points > 0
      const hasUpgrades = currentState.appliedUpgrades && currentState.appliedUpgrades.length > 0
      const hasProgressedWaves = currentState.wave > 1
      const isLoadedGame = hasPoints || hasUpgrades || hasProgressedWaves

      // Only give starting points if this is a new game (no points yet)
      // If loading a saved game, points are already restored by SaveManager
      if (!isLoadedGame) {
        console.log('New game detected - resetting GameManager and adding 70 starting points')
        // CRITICAL: Reset GameManager state for new game
        // This clears isDead flag, kills, points, etc. from previous sessions
        GameManager.reset()
        GameManager.addPoints(70)
      } else {
        console.log('Loaded game detected (points:', hasPoints, ', upgrades:', hasUpgrades, ', wave:', hasProgressedWaves, ') - keeping existing points:', currentState.playerStats.points)

        // CRITICAL: Restore SaveManager state for loaded games
        // Convert the flat upgrade list to UpgradeEntry format for SaveManager
        const savedUpgrades = currentState.appliedUpgrades || []
        const upgradeHistory = savedUpgrades.map((upgradeId, index) => ({
          upgradeId,
          purchasedAt: Date.now() - (savedUpgrades.length - index) * 1000, // Preserve relative order
          waveNumber: 1 // Unknown, use placeholder
        }))
        SaveManager.restoreFromLoad(upgradeHistory)

        // RE-APPLY SAVED UPGRADES
        // This restores effect system state (like shield charges) from saved game
        console.log('DEBUG: currentState.appliedUpgrades =', currentState.appliedUpgrades)
        console.log('DEBUG: savedUpgrades array:', savedUpgrades, 'length:', savedUpgrades.length)
        if (savedUpgrades.length > 0) {
          console.log(`Re-applying ${savedUpgrades.length} saved upgrades:`, savedUpgrades)
          for (const upgradeId of savedUpgrades) {
            this.applyUpgrade(upgradeId, true, true) // Skip cost, isRestore=true (don't add to array again)
          }
        } else {
          console.warn('WARNING: No saved upgrades to re-apply! This will lose effect state like shield charges.')
        }
      }

      // Pre-load upgrades from backend using saved wave number
      const seed = currentState.seed || Math.floor(Math.random() * 1000000)

      console.log('Starting wave from MainScene:', waveNumber, 'with seed:', seed)
      await waveValidation.startWave(waveNumber, seed)

      // For new games, save the starting points to backend after wave start creates the game save
      if (!isLoadedGame) {
        console.log('Saving starting points to backend...')
        await SaveManager.saveOnWaveComplete()
        console.log('Starting points synced to backend')
      }

      // Play looping background music
      // Start with volume at 75%
      this.time.delayedCall(10, () => {
        // Play the background music with volume and loop
        this.sound.play('background_music', { volume: getDefaultVolume('background_music'), loop: true })
      })

      // Show upgrade modal
      EventBus.emit('show-upgrades')
    })

    // -------- -------- -------- //
  }

  update(_time: number, delta: number): void {

    // DONT UPDATE IF PAUSED
    if (GameManager.getState().isPaused) return

    // UPDATE TOUCH CONTROLS
    if (this.touchControls) {
      this.touchControls.update()
    }

    // INCREMENT FRAME COUNTER FOR WAVE VALIDATION
    waveValidation.incrementFrame()

    // SAMPLE FRAME DATA EVERY 30 FRAMES (about 2x per second at 60fps)
    if (waveValidation.getStats().frameCount % 30 === 0) {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body
      waveValidation.sampleFrame(
        this.player.x,
        this.player.y,
        playerBody.velocity.x,
        playerBody.velocity.y,
        GameManager.getPlayerStats().health
      )
    }

    // Update effect system (for regeneration, etc.)
    UpgradeEffectSystem.onUpdate(delta)

    // Handle movement input (skip if left joystick is active)
    if (!this.touchControls.isLeftJoystickActive()) {
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
    }

    // On mobile, only allow joystick input - disable direct touch control
    if (!this.touchControls.isMobile()) {
      // Update player rotation to face mouse (updates every frame)
      // Manually calculate world position from screen position to handle camera movement
      const pointer = this.input.activePointer
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)

      // Skip rotation if touching joystick
      if (!this.touchControls.isTouchingJoystick(pointer)) {
        this.player.rotateTowards(worldPoint.x, worldPoint.y)
      }

      // Handle shooting (skip if touching joystick)
      if (pointer.isDown && !this.upgradeMenuOpen && !this.touchControls.isTouchingJoystick(pointer)) {
        this.player.shoot(worldPoint.x, worldPoint.y)
      }
    }

    // Update player (for attack animations like spinner/flamer)
    this.player.update()

    // Update active bundles; prune destroyed ones
    for (let i = this.activeBundles.length - 1; i >= 0; i--) {
      const bundle = this.activeBundles[i]
      if (bundle.isDestroyed) {
        this.activeBundles.splice(i, 1)
      } else {
        bundle._update()
      }
    }

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
      this.player.addProjectile(projectile)
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

  // Text shown when the player picks up an upgrade bundle
  private showBundlePickupText(x: number, y: number, upgradeName: string, upgradeValue: number, curse?: boolean, delay: number = 0): void {
    const spawn = () => {
      const colors = ['#aaaaaa', '#44cc66', '#4488ff', '#cc44ff', '#ffaa00']
      let color = colors[Math.max(0, Math.min(4, upgradeValue))]
      if (curse) color = '#ff0000'

      const text = this.add.text(x, y, upgradeName, {
        fontFamily: 'Orbitron',
        fontSize: '17px',
        color,
        stroke: '#ffffff',
        strokeThickness: 1,
      })
      text.setOrigin(0.5, 1)
      text.setDepth(10000)

      this.tweens.add({
        targets: text,
        y: y - 60,
        alpha: 0,
        duration: 1800,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      })
    }

    if (delay > 0) {
      this.time.delayedCall(delay, spawn)
    } else {
      spawn()
    }
  }

  /** Weighted-random rarity roll. Returns upgradeValue 0–4.  FOR BUNDLES*/
  private rollBundleRarity(weights: RarityWeights): number {
    const order: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    const total = order.reduce((sum, r) => sum + weights[r], 0)
    let roll = Math.random() * total
    for (let i = 0; i < order.length; i++) {
      roll -= weights[order[i]]
      if (roll <= 0) return i
    }
    return 0
  }

  /** Picks a random curse at or below maxRarity (0–4). Falls back to lower tiers. Skips IDs in exclude. */
  private pickCurse(maxRarity: number, exclude: string[] = []): string | null {
    const rarityOrder: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    for (let tier = maxRarity; tier >= 0; tier--) {
      const rarity = rarityOrder[tier]
      const candidates = (curses.curses as UpgradeDefinition[]).filter(
        u => u.rarity === rarity && !exclude.includes(u.id) && UpgradeSystem.canApply(u)
      )
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)].id
      }
    }
    return null
  }

  /** Picks a random non-curse upgrade at or below maxRarity (0–4). Falls back to lower tiers. Skips IDs in exclude. */
  private pickRegularUpgrade(maxRarity: number, exclude: string[] = []): string | null {
    const allRegular = [
      ...statUpgrades.upgrades,
      ...effectUpgrades.upgrades,
      ...variantUpgrades.upgrades,
      ...visualUpgrades.upgrades,
      ...abilityUpgrades.upgrades,
    ] as UpgradeDefinition[]

    const rarityOrder: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

    for (let tier = maxRarity; tier >= 0; tier--) {
      const rarity = rarityOrder[tier]
      const candidates = allRegular.filter(u => {
        if (u.rarity !== rarity) return false
        if (exclude.includes(u.id)) return false
        if (!UpgradeSystem.canApply(u)) return false
        // Bundles must not silently replace an already-active variant.
        if (u.type === 'variant' && u.target) {
          const activeVariant = UpgradeSystem.getVariant(u.target)
          if (activeVariant !== null && activeVariant !== u.variantClass) return false
        }
        return true
      })
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)].id
      }
    }
    return null
  }

  private async applyUpgrade(upgradeId: string, skipCost: boolean = false, isRestore: boolean = false): Promise<boolean> {
    // Combine all upgrade sources
    const allUpgrades = [
      ...statUpgrades.upgrades,
      ...effectUpgrades.upgrades,
      ...variantUpgrades.upgrades,
      ...visualUpgrades.upgrades,
      ...abilityUpgrades.upgrades,
      ...curses.curses
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

      // Play selection sound for live picks only — skip on save restore so loading doesn't replay it per upgrade
      if (!isRestore) {
        this.sound.play('select_upgrade', { volume: getDefaultVolume('select_upgrade') })
      }

      // Add to GameManager's appliedUpgrades array for save/load
      // Only skip adding if we're restoring from a saved game (already in array)
      // Always add for new purchases (even duplicates - upgrades can stack!)
      const currentState = GameManager.getState()
      if (!isRestore) {
        currentState.appliedUpgrades.push(upgradeId)
        console.log('Added to GameManager.appliedUpgrades:', upgradeId, '(total:', currentState.appliedUpgrades.length, ')')

        // Record in SaveManager for ordered upgrade history
        // This maintains the order of purchase for correct stat reconstruction on load
        const currentWave = currentState.wave
        SaveManager.recordUpgradePurchase(upgradeId, currentWave)
      }

      // VALIDATE WITH BACKEND and sync points (skip for dev tools and saved upgrades)
      if (!skipCost) {
        const currentWave = GameManager.getState().wave
        const result = await waveValidation.selectUpgrade(upgradeId, currentWave)

        if (!result.success) {
          console.warn('Backend rejected upgrade selection - possible desync')
          return false
        }

        // Sync points from backend (authoritative source)
        if (result.newPoints !== undefined) {
          console.log(`Syncing points from backend: ${stats.points} -> ${result.newPoints}`)
          GameManager.updatePlayerStats({ points: result.newPoints })
        }
      }
      // When skipCost = true (dev tools or re-applying saved upgrades), don't deduct points
      // - Dev tools: free upgrades for testing
      // - Saved upgrades: already paid for, don't charge again

      // Apply player stat changes immediately
      // Skip if restoring from save - saved stats already include these modifications
      if (!isRestore && upgrade.type === 'stat_modifier' && upgrade.target === 'player') {
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
      } else if (isRestore && upgrade.type === 'stat_modifier' && upgrade.target === 'player') {
        // When restoring, if it's a polygon upgrade, update the visual without changing the stat
        if (upgrade.stat === 'polygonSides') {
          this.player.updatePolygon()
        }
      }
      
      // Apply dash charge upgrades
      if (upgrade.type === 'ability') {
        if (upgrade.id === 'double_dash') {
          this.player.setMaxDashCharges(2)
        } else if (upgrade.id === 'triple_dash') {
          this.player.setMaxDashCharges(3)
        }
      }
      
      return true
    } else {
      console.warn(`Could not apply upgrade: ${upgrade.name}`)
      return false
    }
  }
}
