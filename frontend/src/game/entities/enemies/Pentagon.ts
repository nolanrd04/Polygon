import { Enemy } from './Enemy'

/**
 * Pentagon enemy - tougher, can split on death.
 */
export class Pentagon extends Enemy {
  SetDefaults(): void {
    this.health = 75
    this.speed = 50
    this.damage = 12
    this.sides = 5
    this.radius = 20
    this.color = 0xff44ff
    this.scoreChance = 0.2
  }

  OnDeath(): void {
    // Spawn 2 smaller triangles on death
    this.scene.events.emit('enemy-split', {
      x: this.x,
      y: this.y,
      spawnType: 'triangle',
      count: 2
    })
  }
}
