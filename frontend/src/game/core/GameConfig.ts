import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { MainScene } from '../scenes/MainScene'
import { SETTINGS } from './SettingsStorage'
import { IS_MOBILE } from './Device'

export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

// World size (larger than screen for camera follow)
export const WORLD_WIDTH = 2560  // 2x wider
export const WORLD_HEIGHT = 1440 // 2x taller

/**
 * How far the camera pulls back on mobile. Desktop always stays at 1.0.
 *
 * WHY MOBILE NEEDS THIS AT ALL
 * `Phaser.Scale.RESIZE` sizes the canvas to the viewport in CSS pixels, so at
 * zoom 1 the visible world is exactly the device viewport: ~1280x720 world units
 * on a laptop but only ~390x844 on a portrait phone. Same world, a third of the
 * horizontal warning distance — enemies enter frame already on top of you. Zoom
 * is what buys that distance back; nothing else about the layout changes.
 *
 * Lower = more world on screen but smaller shapes. 0.6 roughly restores the
 * desktop feel; below ~0.5 the enemy silhouettes stop reading on a phone.
 */
export const MOBILE_CAMERA_ZOOM = 0.6

/**
 * The most of the world the camera is ever allowed to show, per axis.
 *
 * The world is only WORLD_HEIGHT tall, and a portrait phone is tall — at zoom
 * 0.6 an 844px-tall viewport already wants 1407 of the 1440 world units. Past
 * that the camera's bounds clamp hard: it stops following the player entirely on
 * that axis, the player slides off toward the screen edge, and the world's edge
 * sits in frame. Leaving ~8% of headroom keeps the follow smooth.
 *
 * This is the real ceiling on how far mobile can zoom out. To go further, the
 * world itself has to grow (WORLD_WIDTH / WORLD_HEIGHT above), which also moves
 * enemy spawn rings and map generation — a balance change, not a camera change.
 */
export const MAX_WORLD_VIEW_FRACTION = 0.92

/**
 * The camera zoom for a viewport of `viewWidth` x `viewHeight` CSS pixels.
 *
 * Returns MOBILE_CAMERA_ZOOM on mobile, raised only as far as
 * MAX_WORLD_VIEW_FRACTION demands on unusually tall or wide screens, and 1.0
 * everywhere else. Call it again on every resize/orientation change — the
 * clamp depends on the viewport, so a fixed value computed once would be wrong
 * after a rotate.
 */
export function resolveCameraZoom(viewWidth: number, viewHeight: number): number {
  if (!IS_MOBILE) return 1.0

  // A zoom below either of these would show more world than actually exists.
  const minZoomX = viewWidth / (WORLD_WIDTH * MAX_WORLD_VIEW_FRACTION)
  const minZoomY = viewHeight / (WORLD_HEIGHT * MAX_WORLD_VIEW_FRACTION)

  return Math.min(1.0, Math.max(MOBILE_CAMERA_ZOOM, minZoomX, minZoomY))
}

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a0f',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MainScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    // No autoCenter — it adds CSS margins to the canvas which offset
    // pointer coordinates from visual positions, breaking touch detection.
    // No min/max — let the canvas match the device viewport exactly.
  }
}

export const COLORS = {
  player: 0x00ff88,
  playerHead: 0x00ffaa,
  enemy: {
    triangle: 0xff4444,
    square: 0xff8844,
    pentagon: 0xff44ff,
    hexagon: 0x44ffff
  },
  bullet: 0x00ff88,
  laser: 0x00ffff,
  zapper: 0xffff00,
  flamer: 0xff6600
}

export const DEV_SETTINGS = SETTINGS

// Rarity weights for upgrade rolls live on the Difficulty interface.
// See: frontend/src/game/systems/difficulty/Normal.ts (getRarityWeights)
//      backend/app/core/upgrade_data.py (RARITY_WEIGHTS_BY_WAVE)
