import { Enemy } from './Enemy'

export class Dodecahedron extends Enemy {
  private invincible: boolean = false
  // spawn variables
  private spawnImmunityFrames: number = 60
  private spawnScale = 1.3

  // onHit() variables
  private hitColor = 0xb067f5
  private hitColorTimer: Phaser.Time.TimerEvent | null = null
  private readonly defaultColor = 0x8a2be2


  SetDefaults(): void {
    this.health = 30000
    this.speed = 60
    this.damage = 150
    this.sides = 12
    this.radius = 80
    this.color = this.defaultColor
    this.scoreChance = 1
    this.speedCap = 1
    this.isBoss = true
    this.knockbackResistance = 1
    this.barWidth = 60
    this.barHeight = 8
  }

  AI(_playerX: number, _playerY: number): void {

    if (this.spawnImmunityFrames === 60) {
      // Start animation on first frame
      this.spawnAnimation()
    }
    if (this.spawnImmunityFrames > 0) {
      this.invincible = true
      this.spawnImmunityFrames--
      if (this.spawnImmunityFrames === 0) {
        this.invincible = false
      }
    }


    this.moveTowards(_playerX, _playerY)
  }

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
      duration: this.spawnImmunityFrames * 16.67, // Convert frames to ms (60fps)
      ease: 'Quad.easeOut',
    })

    // Animate color from white to default using a helper object
    const colorTween = { progress: 0 }
    this.scene.tweens.add({
      targets: colorTween,
      progress: 1,
      duration: this.spawnImmunityFrames * 16.67,
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

  private GetDefaults() {
    return { color: 0x8a2be2 }
  }
}