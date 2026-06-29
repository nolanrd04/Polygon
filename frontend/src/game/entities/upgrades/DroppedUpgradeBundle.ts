import Phaser from 'phaser'
import { TextureGenerator } from '../../utils/TextureGenerator'
import { BundleRarity } from '../../data/ID'

const RARITY_COLORS: number[] = [
  0xaaaaaa, // 0 common
  0x44cc66, // 1 uncommon
  0x4488ff, // 2 rare
  0xcc44ff, // 3 epic
  0xffaa00, // 4 legendary
]

type Layer = {
  sprite: Phaser.GameObjects.Sprite
  rotation: number
  rotationSpeed: number
}

/**
 * A collectible in-world item dropped by enemies on death.
 * upgradeValue (0–4) controls how many polygon layers are rendered.
 *
 * Layers run from outermost to innermost:
 *   - Outermost: most sides, largest radius, lowest opacity, slowest rotation
 *   - Innermost (triangle): fewest sides, smallest radius, full opacity, fastest rotation
 *
 * Common  (0): triangle only
 * Uncommon(1): square (outer) + triangle (inner)
 * Rare    (2): pentagon + square + triangle
 * Epic    (3): hexagon + pentagon + square + triangle
 * Legendary(4): septagon + hexagon + pentagon + square + triangle
 */
export class DroppedUpgradeBundle {
  readonly upgradeValue: number

  private color: number
  private size: number = 9
  private timeLeft: number = 30000 // frame ticks

  protected scene!: Phaser.Scene
  protected container!: Phaser.GameObjects.Container
  protected body!: Phaser.Physics.Arcade.Body

  private layers: Layer[] = []
  private _isDestroyed: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number, upgradeValue: number) {
    this.scene = scene
    this.upgradeValue = Math.max(BundleRarity.Common, Math.min(BundleRarity.Legendary, upgradeValue))
    this.color = RARITY_COLORS[this.upgradeValue]
    this._spawn(x, y)
  }

  private _spawn(x: number, y: number): void {
    this.container = this.scene.add.container(x, y)
    this.scene.physics.add.existing(this.container)
    this.body = this.container.body as Phaser.Physics.Arcade.Body

    const hitboxRadius = this.size + 4
    this.body.setCircle(hitboxRadius)
    this.body.setOffset(-hitboxRadius, -hitboxRadius)
    this.body.setImmovable(true)


      // special case: the bundle is common, add another triangle in the background.
      if (this.upgradeValue === 0)
      {
        const tempSides = 3
        const tempRadius = this.size * 1.5
        const tempAlpha = 0.5
        const tempRotationSpeed = 0.01
        const tempKey = TextureGenerator.getOrCreatePolygon(this.scene, {
          sides: tempSides,
          radius: tempRadius,
          fillColor: 0xffffff,
          fillAlpha: tempAlpha,
          strokeWidth: 0,
          rotation: 0, // never bake rotation into the key — apply via sprite.setRotation()
        })

        const tempSprite = this.scene.add.sprite(0, 0, tempKey)
        tempSprite.setScale(TextureGenerator.getDisplayScale())
        this.container.add(tempSprite)

        this.layers.push({ sprite: tempSprite, rotation: 0, rotationSpeed: tempRotationSpeed })
      }

    // Build layers outer -> inner so the triangle ends up on top
    for (let i = this.upgradeValue; i >= 0; i--) {
      const sides = i + 3  // septagon(6) -> triangle(3)
      const radius = this.size * (1 + 0.3 * i) // outer is larger
      const fillAlpha = 1.0 - 0.15 * i // outer is more transparent
      const rotationSpeed = 0.008 + 0.006 * (this.upgradeValue - i) // outer is slower

      const key = TextureGenerator.getOrCreatePolygon(this.scene, {
        sides,
        radius,
        fillColor: this.color,
        fillAlpha,
        strokeWidth: 0,
        rotation: 0, // never bake rotation into the key — apply via sprite.setRotation()
      })

      const sprite = this.scene.add.sprite(0, 0, key)
      sprite.setScale(TextureGenerator.getDisplayScale())
      sprite.setBlendMode(Phaser.BlendModes.ADD)
      this.container.add(sprite)

      this.layers.push({ sprite, rotation: 0, rotationSpeed })

      // Special case: if the bundle is legendary, add a white triangle on top because for some reason it isnt visble otherwise.
      if (this.upgradeValue === 4 && i === 0)
      {
        const tempKey = TextureGenerator.getOrCreatePolygon(this.scene, {
          sides,
          radius,
          fillColor: 0xffffff,
          fillAlpha,
          strokeWidth: 0,
          rotation: 0, // never bake rotation into the key — apply via sprite.setRotation()
        })

        const tempSprite = this.scene.add.sprite(0, 0, tempKey)
        tempSprite.setScale(TextureGenerator.getDisplayScale())
        this.container.add(tempSprite)
      }
    }

    this.container.setData('bundleInstance', this)
  }

  _update(): void {
    if (this._isDestroyed) return

    this.timeLeft--
    if (this.timeLeft <= 0) {
      this.destroy()
      return
    }

    // Fade out during the last ~3 seconds (180 ticks at 60 fps)
    if (this.timeLeft < 180) {
      this.container.setAlpha(this.timeLeft / 180)
    }

    for (const layer of this.layers) {
      layer.rotation += layer.rotationSpeed
      layer.sprite.setRotation(layer.rotation)
    }
  }

  destroy(): void {
    if (this._isDestroyed) return
    this._isDestroyed = true
    this.container.destroy()
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  get isDestroyed(): boolean {
    return this._isDestroyed
  }
}