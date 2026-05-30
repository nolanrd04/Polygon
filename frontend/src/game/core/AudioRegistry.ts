import Phaser from 'phaser'

export interface AudioDefinition {
  key: string
  path: string
  defaultVolume?: number
  loop?: boolean // If true, the sound will loop automatically
}

export const AUDIO_REGISTRY: AudioDefinition[] = [
  { key: 'bullet_shot', path: 'assets/sounds/bullet_shot.mp3', defaultVolume: 1 },
  { key: 'explosion',   path: 'assets/sounds/explosion.mp3',   defaultVolume: 0.4 },
  { key: 'select_upgrade', path: 'assets/sounds/upgrade_select.mp3', defaultVolume: 1 },
  { key: 'bullet_tileCollide', path: 'assets/sounds/bullet_tileCollide.mp3', defaultVolume: 0.3 },
  { key: 'player_hurt', path: 'assets/sounds/player_hurt.mp3', defaultVolume: 1 },
  { key: 'enemy_hurt', path: 'assets/sounds/enemy_hurt.mp3', defaultVolume: 1 },
  { key: 'enemy_killed', path: 'assets/sounds/enemy_killed.mp3', defaultVolume: 1 },
  { key: 'player_dash', path: 'assets/sounds/player_dash.mp3', defaultVolume: 1 },
  { key: 'upgrade_reroll', path: 'assets/sounds/upgrade_reroll.mp3', defaultVolume: 1 },
  // Soundtrack (add your music file here)
  { key: 'background_music', path: 'assets/sounds/background_music.mp3', defaultVolume: 0.75, loop: true }
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

/**
 * Plays the background music loop
 * @param scene The Phaser scene
 * @param autoplay Whether to start playing immediately
 * @param volume Optional volume override (0-1)
 */
export function playBackgroundMusic(
  scene: Phaser.Scene,
  volume?: number
): void {
  const bgmVolume = volume ?? getDefaultVolume('background_music')
  // Phaser allows overlapping sounds, so we can just play it again if it's already playing
  scene.sound.play('background_music', {
    volume: bgmVolume,
    loop: true
  })
}

/**
 * Pauses the background music by stopping and re-enabling the sound
 * @param scene The Phaser scene
 */
export function pauseBackgroundMusic(scene: Phaser.Scene): void {
  // Get the sound object from the manager
  const bgm = scene.sound.get('background_music')
  if (bgm) {
    bgm.pause()
  }
}

/**
 * Stops the background music
 * @param scene The Phaser scene
 */
export function stopBackgroundMusic(scene: Phaser.Scene): void {
  const bgm = scene.sound.get('background_music')
  if (bgm) {
    bgm.stop()
  }
}

/**
 * Toggles background music playback
 * @param scene The Phaser scene
 */
export function toggleBackgroundMusic(scene: Phaser.Scene): void {
  const bgm = scene.sound.get('background_music')
  if (bgm) {
    if (bgm.isPlaying) {
      // It's playing, stop it
      bgm.stop()
    } else {
      // Not playing, start it
      playBackgroundMusic(scene)
    }
  }
}