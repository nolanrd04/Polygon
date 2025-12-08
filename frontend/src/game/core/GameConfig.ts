import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { MainScene } from '../scenes/MainScene'

export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
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

export const DEV_SETTINGS = {
  showEnemyHealthBar: true,
  showEnemyHealthNumber: true
}

export const RARITY_WEIGHTS: Record<string, number> = {
  common: 0.4,
  uncommon: 0.3,
  rare: 0.15,
  epic: 0.1,
  legendary: 0.05
}
