import { Enemy } from './Enemy'

/**
 * Pentagon enemy - tougher, can split on death.
 */
export class Pentagon extends Enemy {
  SetDefaults(): void {
    this.health = 400
    this.speed = 63
    this.damage = 80
    this.sides = 5
    this.radius = 20
    this.color = 0xff44ff
    this.scoreChance = 0.5
    this.speedCap = 2.5  // Higher cap (dangerous)
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
