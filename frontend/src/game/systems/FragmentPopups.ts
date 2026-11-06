import Phaser from 'phaser'
import { EventBus } from '../core/EventBus'
import { FRAGMENT_COLORS, FRAGMENT_TIERS, fragmentPolygon, type FragmentCounts } from './FragmentBudget'

const POOL_SIZE = 24
const ICON_RADIUS = 8
const ICON_GAP = 3
const ENTRY_GAP = 8
const FLOAT_DISTANCE = 50
const FLOAT_MS = 900
// Above the light overlay, same as the bundle pickup text.
const POPUP_DEPTH = 10000

interface PopupEntry {
  icon: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
}

interface Popup {
  container: Phaser.GameObjects.Container
  entries: PopupEntry[]
  tween: Phaser.Tweens.Tween | null
}

/**
 * Floating "+37" per tier on each paying kill. A fixed pool: during a chain of
 * kills the oldest popup is reused, so explosive runs can't pile up text objects.
 * Each popup holds one icon/label pair per tier, hidden when that tier is zero.
 */
export class FragmentPopups {
  private scene: Phaser.Scene
  private pool: Popup[] = []
  private next: number = 0

  private onAwarded = (data: { x: number; y: number; counts: FragmentCounts }) => {
    this.show(data.x, data.y, data.counts)
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    for (let i = 0; i < POOL_SIZE; i++) {
      const entries = FRAGMENT_TIERS.map(tier => {
        const icon = scene.add.graphics()
        const points = fragmentPolygon(tier, ICON_RADIUS)
        // Hollow: a dark halo under the coloured outline keeps it readable over the arena.
        icon.lineStyle(4, 0x000000, 0.8)
        icon.strokePoints(points, true)
        icon.lineStyle(2, Phaser.Display.Color.HexStringToColor(FRAGMENT_COLORS[tier]).color, 1)
        icon.strokePoints(points, true)
        const label = scene.add.text(0, 0, '', {
          fontFamily: 'Orbitron',
          fontSize: '15px',
          color: FRAGMENT_COLORS[tier],
          stroke: '#000000',
          strokeThickness: 3,
        }).setOrigin(0, 0.5)
        return { icon, label }
      })
      const children = entries.flatMap(e => [e.icon, e.label])
      const container = scene.add.container(0, 0, children).setDepth(POPUP_DEPTH).setVisible(false)
      this.pool.push({ container, entries, tween: null })
    }
    EventBus.on('fragments-awarded', this.onAwarded)
  }

  private show(x: number, y: number, counts: FragmentCounts): void {
    if (FRAGMENT_TIERS.every(tier => counts[tier] <= 0)) return

    const popup = this.pool[this.next]
    this.next = (this.next + 1) % POOL_SIZE
    popup.tween?.stop()

    // Lay out the non-zero tiers left to right, then centre the row on the kill.
    let cursor = 0
    const shown: PopupEntry[] = []
    FRAGMENT_TIERS.forEach((tier, i) => {
      const entry = popup.entries[i]
      const visible = counts[tier] > 0
      entry.icon.setVisible(visible)
      entry.label.setVisible(visible)
      if (!visible) return
      if (shown.length > 0) cursor += ENTRY_GAP
      entry.label.setText(`+${counts[tier].toLocaleString()}`)
      entry.icon.setPosition(cursor + ICON_RADIUS, 0)
      entry.label.setPosition(cursor + ICON_RADIUS * 2 + ICON_GAP, 0)
      cursor = entry.label.x + entry.label.width
      shown.push(entry)
    })
    const offset = -cursor / 2
    for (const entry of shown) {
      entry.icon.x += offset
      entry.label.x += offset
    }

    popup.container.setPosition(x, y).setAlpha(1).setVisible(true)
    popup.tween = this.scene.tweens.add({
      targets: popup.container,
      y: y - FLOAT_DISTANCE,
      alpha: 0,
      duration: FLOAT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.container.setVisible(false),
    })
  }

  destroy(): void {
    EventBus.off('fragments-awarded', this.onAwarded)
    for (const popup of this.pool) {
      popup.tween?.stop()
      popup.container.destroy()
    }
    this.pool = []
  }
}