// Define all event types and their payloads
export interface PlayerStatsPayload {
  health: number
  maxHealth: number
  speed: number
  points: number
  polygonSides: number
  unlockedAttacks: string[]
  kills: number
}

export interface GameEvents {
  'wave-complete': { wave: number; score: number; isPrime: boolean }
  'wave-start': number
  'show-upgrades': void
  'player-stats-update': PlayerStatsPayload
  'player-death': void
  'game-pause': void
  'game-resume': void
  'start-next-wave': void
  'upgrade-selected': string
  'upgrade-applied': string
  'enemy-explode': { x: number; y: number; radius: number; damage: number }
  'enemy-split': { x: number; y: number; config: unknown; velocityAngle: number }
  'enemy-shoot': { x: number; y: number; targetX: number; targetY: number; damage: number; speed: number; color: number }
  'thorns-reflect': { damage: number }
  'dev-apply-upgrade': string  // Dev-only: apply upgrade without cost
  'evolution-milestone': number  // Emitted every 6 waves with the current wave number
}

type EventCallback<T = void> = T extends void ? () => void : (data: T) => void

class GameEventBus {
  private events: Map<string, Function[]> = new Map()

  on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
  }

  off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(...args))
    }
  }

  removeAllListeners(): void {
    this.events.clear()
  }
}

export const EventBus = new GameEventBus()
