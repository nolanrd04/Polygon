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
    this.scoreChance = .4
    this.speedCap = 4.5
    this.knockbackResistance = 0.8
    this.bundleDropChance = 0.12
  }

  OnDeath(): void {
    const scene = this.scene as any
    scene.enemyManager.spawnEnemy('square', this.x, this.y)
    scene.enemyManager.spawnEnemy('square', this.x, this.y)
  }

    
  
}