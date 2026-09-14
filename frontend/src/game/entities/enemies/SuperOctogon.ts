import { Enemy } from './Enemy'
import { SeekingSquare } from './SeekingSquare'
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'
import { TextureGenerator } from '../../../game/utils/TextureGenerator'


// Smaller square spawned by the super octogon that chases the player like a projectile. An enemy was used over a projectile so it can be killed.
export class SuperOctogon extends Enemy {
    private hasOutline: boolean = false
    private projCooldown: number = 4000
    private lastProjTime: number = 0
    private maxMinions: number = 5
    /**
     * Lifetime budget of squares, on top of the maxMinions cap on how many are
     * alive at once. Without it an octagon left alive is an infinite enemy
     * fountain - every square killed frees a slot and is replaced 4s later -
     * so a wave has no bounded amount of health in it, and the backend's kill
     * ceiling has nothing to price (see backend enemy_data.get_family_members).
     */
    private maxTotalMinions: number = 15
    private totalMinionsSpawned: number = 0
    /** Live squares this octagon has spawned. Pruned each frame in AI(). */
    private minions: SeekingSquare[] = []
    private canSpawnMinions: boolean = true

    SetDefaults(): void 
    {
        this.health = 1000
        this.speed = 35
        this.damage = 30
        this.sides = 8
        this.radius = 35
        this.color = 0x4287f5
        this.scoreChance = .4
        this.speedCap = 2.5
        this.knockbackResistance = 0.99
        this.bundleDropChance = 0.0 // use difficulty drop chance
    }

    AI(_playerX: number, _playerY: number): void 
    {
        this.moveTowards(_playerX, _playerY)

        // Budget spent: this octagon is done spawning for good, however long
        // it survives. Checked before the prune so a spent octagon costs
        // nothing per frame.
        if (this.totalMinionsSpawned >= this.maxTotalMinions) return

        // Drop dead squares before the cap check so kills free up slots. Done
        // every frame rather than only when about to fire: a square can die on
        // any frame, and holding the reference keeps the dead object alive.
        this.minions = this.minions.filter(m => !m.isDestroyed)
        if (this.minions.length >= this.maxMinions) return

        if (this.scene.time.now - this.lastProjTime >= this.projCooldown)
        {
            const scene = this.scene as any
            // Fire off-axis so the square has to curve back in, instead of just
            // being a straight line at the player. FloatBetween, not Between:
            // Between returns an integer, so it would only ever give -1/0/1.
            const spread = Phaser.Math.FloatBetween(-Math.PI / 4, Math.PI / 4)
            const direction = Phaser.Math.Angle.Between(this.x, this.y, _playerX, _playerY) + spread

            // 6th arg is a configure callback that runs before _spawn, not a
            // number. Seeding heading here beats the null default in the
            // square's first moveTowards, so it launches along this angle.
            const square = scene.enemyManager.spawnEnemy('seeking_square', this.x, this.y, false, false, (enemy: Enemy) => {
                (enemy as SeekingSquare).heading = direction
            }) as SeekingSquare | null
            if (square)
            {
                square.damage = this.damage
            }

            // Counted against the lifetime budget only when one actually
            // spawned - a failed spawn (pool exhausted, wave ending) shouldn't
            // silently eat part of the budget.
            if (square) {
                this.minions.push(square)
                this.totalMinionsSpawned++
            }
            this.lastProjTime = this.scene.time.now
        }
    }
    
    OnDeath(): void {

        if (this.canSpawnMinions)
        {
            const scene = this.scene as any
            scene.enemyManager.spawnEnemy('suspicious_square', this.x, this.y, false, false)
            scene.enemyManager.spawnEnemy('suspicious_square', this.x, this.y, false, false)
        }
    }
    
    Draw(): void {
        super.Draw()

    // Create outer outline sprite if it doesn't exist
    if (!this.hasOutline) 
    {
        // Generate outline texture on-demand with larger radius and no fill
        const outlineKey = TextureGenerator.getOrCreatePolygon(this.scene, {
            sides: this.sides,
            radius: this.radius + 6,  // Larger radius for outline effect
            fillColor: 0x000000,
            fillAlpha: 0,  // Transparent fill
            strokeWidth: 2,
            strokeColor: 0xffffff,
            strokeAlpha: 0.8
          
        })
    
        const outlineSprite = this.scene.add.sprite(0, 0, outlineKey)
        outlineSprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture
        this.container.add(outlineSprite)
        this.hasOutline = true
    }
}
  

  /**
   * Emissive glow, sized to the enemy so bigger shapes light more of the room.
   *
   * Uses this.color, not a stored default: the damage flash tints the SPRITE and
   * leaves this.color alone (Enemy.takeDamage), so the light will not strobe white
   * on every hit.
   */
  PostDraw(): void {
    LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity * this.radius / 35)
  }
}