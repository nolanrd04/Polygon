import Phaser from 'phaser'

export interface AudioDefinition {
  key: string
  path: string
  defaultVolume?: number
}

export const AUDIO_REGISTRY: AudioDefinition[] = [
  { key: 'bullet_shot', path: 'assets/sounds/bullet_shot.mp3', defaultVolume: 1 },
  { key: 'explosion',   path: 'assets/sounds/explosion.mp3',   defaultVolume: 0.4 },
  { key: 'select_upgrade', path: 'assets/sounds/select_upgrade.mp3', defaultVolume: 1 },
  { key: 'bullet_tileCollide', path: 'assets/sounds/bullet_tileCollide.mp3', defaultVolume: 0.3 },
  { key: 'player_hurt', path: 'assets/sounds/player_hurt.mp3', defaultVolume: 1 },
  { key: 'enemy_hurt', path: 'assets/sounds/enemy_hurt.mp3', defaultVolume: 1 },
  { key: 'enemy_killed', path: 'assets/sounds/enemy_killed.mp3', defaultVolume: 1 },
  { key: 'player_dash', path: 'assets/sounds/player_dash.mp3', defaultVolume: 1 }
]

const defaultVolumeByKey: Map<string, number> = new Map(
  AUDIO_REGISTRY.filter(a => a.defaultVolume !== undefined).map(a => [a.key, a.defaultVolume!])
)

export function preloadAllAudio(scene: Phaser.Scene): void {
  for (const audio of AUDIO_REGISTRY) {
    scene.load.audio(audio.key, audio.path)
  }
}

export function getDefaultVolume(key: string): number {
  return defaultVolumeByKey.get(key) ?? 1
}