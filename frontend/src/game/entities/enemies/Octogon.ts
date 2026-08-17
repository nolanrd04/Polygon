import { Enemy } from './Enemy'

/**
 * Octogon enemy - tanky enemy that splits on death.
 */
export class Octogon extends Enemy {

SetDefaults(): void {
    this.health = 1500
    this.speed = 58
    this.damage = 100
    this.sides = 8
    this.radius = 35
    this.color = 0x4287f5
    this.scoreChance = .1
    this.speedCap = 6.5
    this.knockbackResistance = 0.8
    this.bundleDropChance = 0.0 // use difficulty drop chance
  }

  OnDeath(): void {
    const scene = this.scene as any
    scene.enemyManager.spawnEnemy('square', this.x, this.y, false, false)
    scene.enemyManager.spawnEnemy('square', this.x, this.y, false, false)
  }

    
  
}