import Phaser from 'phaser'
import { ArrowHeadPart } from './ArrowHeadPart'
import {
  ArrowHeadConfig,
  ARROW_HEAD_IDS,
  chargeDurationFor,
  quantize,
  spacingBetween,
  facingOffset,
  type ArrowHeadRole,
} from './ArrowHeadConfig'
import { EnemyBullet } from '../../projectiles/enemy_projectiles/EnemyBullet'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../../core/GameConfig'
import { SoundID } from '../../../data/ID'
import { getDefaultVolume } from '../../../core/AudioRegistry'
import type { Enemy } from '../Enemy'

/**
 * ============================================================================
 * ARROW HEAD (BOSS) - THE HEAD
 * ============================================================================
 *
 * The only part of the worm that thinks. It:
 *
 *  1. builds its own chain on its first AI frame, spawning each body/tail
 *     segment as a real, separate enemy through EnemyManager
 *  2. owns every statistic — the segments' size, damage, armor, color and
 *     health are all derived from the head's own (already difficulty-scaled)
 *     stats, so the whole worm is retuned by editing the head's entry in
 *     ArrowHeadConfig
 *  3. owns the shared health pool, so damage anywhere on the worm lands here
 *  4. drives every segment's position each frame, front to back
 *
 * Movement is turn-rate limited rather than homing: the head can only rotate
 * so many degrees per second, so it carves wide arcs, overshoots the player
 * and has to come back around — which is what makes it read as a worm rather
 * than a chase. Charging drops the turn rate further, committing it to a line.
 */
export class ArrowHeadHead extends ArrowHeadPart {
  readonly role: ArrowHeadRole = 'head'

  /** Current facing, in radians. Movement direction is decoupled from the player angle by the turn rate. */
  private heading: number = 0
  /** Current speed, eased toward the target speed by `head.accelerationPerSec`. */
  private currentSpeed: number = 0

  private chainSpawned: boolean = false
  private spawnStartTime: number = 0
  private invincible: boolean = false

  private chargeUntil: number = 0
  private nextChargeAt: number = 0
  private nextVolleyAt: number = 0

  /** Whether the head is currently in its aggressive long-range re-approach. */
  private farMode: boolean = false
  /** Which way round the player the re-approach arcs. +1/-1, chosen on entry only. */
  private orbitSide: number = 1

  /** Reused scratch list of the chain's living parts, rebuilt by UpdateChain each frame. */
  private readonly livingParts: ArrowHeadPart[] = []

  SetDefaults(): void {
    const cfg = ArrowHeadConfig.head

    // Shape first: the shared defaults derive `sides` from it.
    this.shape = cfg.shape

    this.health = cfg.health
    this.damage = cfg.damage
    this.defense = cfg.defense
    this.speed = cfg.speed
    this.radius = cfg.radius
    this.hitboxSize = cfg.hitboxSize
    this.color = cfg.color
    this.scoreChance = cfg.scoreChance
    this.bundleDropChance = cfg.bundleDropChance
    this.knockbackResistance = cfg.knockbackResistance
    this.barWidth = cfg.barWidth
    this.barHeight = cfg.barHeight
    this.isBoss = true

    // The head is its own damage owner, so every part - including this one -
    // can route damage the same way with no special case.
    this.owner = this
    this.chainIndex = 0

    this.applySharedDefaults()
  }

  // ========================================================================
  // AI
  // ========================================================================

  AI(playerX: number, playerY: number): void {

    // I need to add a new AI phase which runs while not charging/dashing. 
    // the boss should basically speed up if too far from the player, then slow down when it gets close enough.
    // the speed should ease in and ease out, not be instant.
    // For example, if the player is far away, maximizing the charge/dash distance, once the boss starts charging the player can go towards the boss,
    // miss it, and go past it which puts a great distance between the player and the boss.
    // There should be a check here while the charge is on cool down to basically somehow quickly steer the boss towards the player until its close again.
    // It shouldnt move directly towards the player, but rather around it. Like get a point X distance away from the player (radius = X) and move to that point.
    // If at any point the player is within the viable distance again, regular movement resumes. This should not interrupt the charge/dash timer.
    // Utilize this.GetSteerTarget()

    /* -------- SPAWNING -------- */
    const cfg = ArrowHeadConfig
    const now = this.scene.time.now
    // Clamped so a frame hitch can't teleport the worm across the arena.
    const dt = Math.min(this.scene.game.loop.delta, 50) / 1000

    if (this.spawnStartTime === 0) {
      this.spawnStartTime = now
      this.heading = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      this.currentSpeed = this.speed
      this.nextChargeAt = now + cfg.combat.charge.intervalMs
      this.nextVolleyAt = now + cfg.combat.volley.intervalMs
      this.SpawnAnimation()
    }

    this.invincible = now - this.spawnStartTime < cfg.head.spawnImmunityMs

    if (!this.chainSpawned) {
      this.SpawnChain()
    }
    /* -------------------------- */

    /* -------- CHARGING -------- */
    const charge = cfg.combat.charge
    let charging = now < this.chargeUntil
    if (charge.enabled && !charging && now >= this.nextChargeAt) {
      // Range is sampled once, here, rather than tracked per frame: the charge
      // is a committed lunge at where the player was when it launched, so
      // re-deriving its length mid-flight would let a fleeing player stretch it
      // indefinitely and turn the commitment into a homing chase.
      const range = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
      this.chargeUntil = now + chargeDurationFor(range, this.speed)
      // Measured from the end of the charge, so a long one doesn't overlap the next.
      this.nextChargeAt = this.chargeUntil + charge.intervalMs
      charging = true
      // this.PlaySound(SoundID.BossDash)
    }
    /* -------------------------- */

    /* ----------STEERING-------- */
    // One steering path for every mode. Charging and the far re-approach differ
    // only in *where the head aims* and *how hard it pushes*, so those two are
    // resolved up front and the actual turn/accelerate/apply below is shared -
    // duplicating the block per mode is how the easing and the turn rate drift
    // out of sync with each other.
    const far = this.UpdateFarMode(playerX, playerY, charging)
    const farCfg = cfg.head.farMovement

    const aim = far ? this.GetOrbitTarget(playerX, playerY) : { x: playerX, y: playerY }
    const target = this.GetSteerTarget(aim.x, aim.y)
    const desired = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y)

    const turnRate = Phaser.Math.DegToRad(
      cfg.head.turnRateDeg *
        (charging ? charge.turnRateMultiplier : far ? farCfg.turnRateMultiplier : 1)
    )
    this.heading = Phaser.Math.Angle.RotateTo(this.heading, desired, turnRate * dt)

    // Ease toward the target speed in both directions. Note there is no upper
    // clamp: clamping to targetSpeed would make the *end* of a charge snap
    // straight back to cruise speed instead of gliding down over ~0.75s, which
    // is most of what sells the lunge.
    //
    // The multiplier goes on the *target*, never on the final velocity - that's
    // what routes the speed-up through this easing instead of snapping to it
    // and dropping off a cliff the frame the mode ends.
    const targetSpeed =
      this.speed * (charging ? charge.speedMultiplier : far ? farCfg.speedMultiplier : 1)
    // Only the ramp *up* is faster; leaving far mode sets `far` false, so the
    // glide back down to cruise uses the head's normal deceleration.
    const step = (far ? farCfg.accelerationPerSec : cfg.head.accelerationPerSec) * dt
    this.currentSpeed = Math.max(
      0,
      this.currentSpeed + Phaser.Math.Clamp(targetSpeed - this.currentSpeed, -step, step)
    )

    this.velocityX = Math.cos(this.heading) * this.currentSpeed
    this.velocityY = Math.sin(this.heading) * this.currentSpeed
    this.rotation = this.heading + Math.PI / 2
    /* -------------------------- */

    /* ---------ATTACKS---------- */
    const volley = cfg.combat.volley
    if (volley.enabled && now >= this.nextVolleyAt && !(volley.skipWhileCharging && charging)) {
      this.nextVolleyAt = now + volley.intervalMs
      this.FireVolley(playerX, playerY)
    }

    this.EmitAmbientParticles()
    this.UpdateChain(playerX, playerY)
  }
    

  /**
   * Advance the far-movement state machine and report whether it is active.
   *
   * Entry and exit use different distances (`minDistanceFromPlayer` /
   * `resumeDistanceFromPlayer`) so the head can't oscillate between modes while
   * sitting on the boundary — with a single threshold it would re-roll
   * `orbitSide` every few frames and twitch in place instead of committing to
   * an arc.
   *
   * Charging suppresses it outright: a charge is already a committed long-range
   * movement that scales its own length with distance, and letting both drive
   * the heading at once means two different aim points fighting each other. It
   * does not touch the charge timers, so the re-approach never delays a charge.
   */
  private UpdateFarMode(playerX: number, playerY: number, charging: boolean): boolean {
    const cfg = ArrowHeadConfig.head.farMovement

    if (!cfg.enabled || charging) {
      this.farMode = false
      return false
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)

    if (!this.farMode && distance >= cfg.minDistanceFromPlayer) {
      this.farMode = true

      // Commit to whichever side needs the smaller turn from the current
      // heading, so the head flows into the arc instead of first reversing its
      // rotation. `delta` is how far the heading already sits off "straight at
      // the player"; a negative delta means it is already swinging the way the
      // +1 side arcs.
      const toPlayer = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      const delta = Phaser.Math.Angle.Wrap(this.heading - toPlayer)
      this.orbitSide = delta < 0 ? 1 : -1
    } else if (this.farMode && distance <= cfg.resumeDistanceFromPlayer) {
      this.farMode = false
    }

    return this.farMode
  }

  /**
   * A point on a ring of `targetDistanceFromPlayer` around the player, rotated
   * `orbitOffsetDeg` to one side of the player-to-head bearing.
   *
   * The offset has to be *angular*. Pushing the aim point further out along the
   * head-to-player line leaves it collinear with both, which is the identical
   * bearing to aiming at the player — so a radial offset produces a beeline no
   * matter how large it is. Rotating it around the player is what puts a lateral
   * component in the heading and turns the approach into an arc.
   *
   * Note the offset is rotated *first* and the player's position added after:
   * `Vector2.rotate()` pivots about the world origin, so adding first would spin
   * the player's absolute map coordinate around the corner of the world and
   * scatter the aim point hundreds of pixels off, drifting as the player moves.
   */
  private GetOrbitTarget(playerX: number, playerY: number): { x: number; y: number } {
    const cfg = ArrowHeadConfig.head.farMovement

    const toHead = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
    const aim = toHead + Phaser.Math.DegToRad(cfg.orbitOffsetDeg) * this.orbitSide

    return {
      x: playerX + Math.cos(aim) * cfg.targetDistanceFromPlayer,
      y: playerY + Math.sin(aim) * cfg.targetDistanceFromPlayer,
    }
  }

  /**
   * Where the head wants to go. Normally the player — but a turn-rate limited
   * worm that overshoots badly could otherwise wander off the map, so once it
   * is far enough outside the world it steers for the center until it is back.
   */
  private GetSteerTarget(playerX: number, playerY: number): { x: number; y: number } {
    const margin = ArrowHeadConfig.head.worldMargin
    const outside =
      this.x < -margin ||
      this.y < -margin ||
      this.x > WORLD_WIDTH + margin ||
      this.y > WORLD_HEIGHT + margin

    return outside ? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 } : { x: playerX, y: playerY }
  }

  // ========================================================================
  // CHAIN CONSTRUCTION
  // ========================================================================

  /**
   * Spawn the body/tail chain, tModLoader's `HeadAI_SpawnSegments`.
   *
   * Each segment is spawned through EnemyManager like any other enemy (so it
   * lands in the update loop, the collision group and the physics world), then
   * configured from this head via the spawn hook before it is built. Segments
   * never drop score or bundles of their own — the worm's rewards belong to
   * the head.
   */
  private SpawnChain(): void {
    this.chainSpawned = true

    const cfg = ArrowHeadConfig
    const manager = (this.scene as any).enemyManager
    if (!manager) {
      console.warn('[ArrowHead] No enemyManager on scene - spawning headless.')
      return
    }

    const bodyCount = Phaser.Math.Between(cfg.chain.bodySegments.min, cfg.chain.bodySegments.max)
    const totalSegments = bodyCount + (cfg.chain.includeTail ? 1 : 0)
    const chainLength = totalSegments + 1 // + the head itself

    let leader: ArrowHeadPart = this
    let previousShape = this.shape
    let previousRadius = this.radius * this.scale
    let previousRole: ArrowHeadRole = this.role
    let distanceBehind = 0

    for (let i = 1; i <= totalSegments; i++) {
      const isTail = cfg.chain.includeTail && i === totalSegments
      const role: ArrowHeadRole = isTail ? 'tail' : 'body'
      const typeId = ARROW_HEAD_IDS[role]

      // Pre-compute where this part will sit, using the same spacing rule the
      // chain itself uses, so a long worm doesn't spawn stacked in one point
      // and snap outward on its first frame.
      const t = totalSegments > 1 ? (i - 1) / (totalSegments - 1) : 1
      const tShape = quantize(t, cfg.segment.textureSteps)
      const shape = cfg.segment.shapeFor(role, tShape)
      const radius = this.radius * cfg.segment.radiusRatio(tShape) * this.scale

      distanceBehind += spacingBetween(
        { shape: previousShape, radius: previousRadius, role: previousRole },
        { shape, radius, role, t }
      )
      previousShape = shape
      previousRadius = radius
      previousRole = role

      const spawnX = this.x - Math.cos(this.heading) * distanceBehind
      const spawnY = this.y - Math.sin(this.heading) * distanceBehind

      const segment = manager.spawnEnemy(
        typeId,
        spawnX,
        spawnY,
        false, // no score drop - the head carries the worm's rewards
        false, // no bundle drop, same reason
        (enemy: Enemy) => (enemy as ArrowHeadPart).ConfigureAsSegment(this, i, chainLength)
      ) as ArrowHeadPart | null

      if (!segment) {
        console.warn(`[ArrowHead] Failed to spawn segment ${i} ('${typeId}') - chain truncated.`)
        break
      }

      segment.rotation = this.heading + Math.PI / 2 + facingOffset(role)
      leader.LinkFollower(segment)
      leader = segment
    }

    // Snap the freshly spawned chain into exact formation immediately, so it
    // is never rendered in its estimated spawn positions.
    this.UpdateChain()
  }

  /**
   * Walk the chain front-to-back, placing each part behind the one ahead and
   * then running its `AI()`.
   *
   * Done from the head rather than from each segment's own update so the
   * ordering is guaranteed: `EnemyManager.update()` iterates backwards, so a
   * segment updating itself would always be reading its leader's
   * previous-frame position, and the lag would compound down a long worm.
   *
   * **This is what calls `AI()` on body and tail segments.** Their `PreAI()`
   * returns false, so the base class skips its own `moveTowards()` + `AI()`
   * pair — those two are bundled behind one `if` in `Enemy._update()`, and a
   * segment that let the base call `AI()` would also get default
   * move-toward-player steering fighting the chain every frame. Calling `AI()`
   * here instead gives a segment normal AI with two guarantees the base class
   * can't offer it: its position is already current for this frame, and
   * segments run in head-to-tail order.
   *
   * Player coords are optional purely so the snap-into-formation call at the
   * end of `SpawnChain()` can place the chain without firing any AI.
   */
  UpdateChain(playerX?: number, playerY?: number): void {
    this.livingParts.length = 0

    let leader: ArrowHeadPart = this
    let part = this.follower
    let guard = 0

    while (part && guard++ < 256) {
      if (part.isDestroyed) {
        // Dead part: skip it and keep the rest of the chain attached.
        leader.follower = part.follower
        if (part.follower) part.follower.leader = leader
        part = part.follower
        continue
      }

      part.FollowLeader(leader)

      // Position is current as of this line, so anything AI() spawns (muzzle
      // flashes, projectiles) lines up with where the segment is actually
      // drawn this frame rather than trailing it by a frame.
      if (playerX !== undefined && playerY !== undefined) {
        part.AI(playerX, playerY)
      }

      this.livingParts.push(part)
      leader = part
      part = part.follower
    }

    if (ArrowHeadConfig.chain.sharedContactCooldown) {
      this.ShareContactCooldown()
    }
  }

  /**
   * Give the whole worm one contact-damage cooldown.
   *
   * CollisionManager gates contact damage on each enemy's own
   * `lastHitPlayerTime`, and every part here is its own enemy — so a worm
   * dragged across the player would otherwise bill them once per part. Taking
   * the newest hit time across the chain and writing it back to every part
   * means any one part connecting puts the entire worm on cooldown.
   */
  private ShareContactCooldown(): void {
    let latest = this.lastHitPlayerTime
    for (const part of this.livingParts) {
      if (part.lastHitPlayerTime > latest) latest = part.lastHitPlayerTime
    }

    this.lastHitPlayerTime = latest
    for (const part of this.livingParts) {
      part.lastHitPlayerTime = latest
    }
  }

  // ========================================================================
  // ATTACKS
  // ========================================================================

  /** Fan of bullets out of the arrow's tip, centered on the player. */
  private FireVolley(playerX: number, playerY: number): void {
    const volley = ArrowHeadConfig.combat.volley
    const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }
    if (typeof scene.spawnProjectile !== 'function') return

    // The chevron's tip sits `tipRadius` out along the heading.
    const tipDistance = this.radius * this.scale * this.shape.tipRadius
    const originX = this.x + Math.cos(this.heading) * tipDistance
    const originY = this.y + Math.sin(this.heading) * tipDistance

    const toPlayer = Phaser.Math.Angle.Between(originX, originY, playerX, playerY)
    const spread = Phaser.Math.DegToRad(volley.spreadDeg)
    const count = Math.max(1, volley.count)
    const step = count > 1 ? spread / (count - 1) : 0
    const start = toPlayer - spread / 2

    for (let i = 0; i < count; i++) {
      const angle = count > 1 ? start + step * i : toPlayer

      const bullet = new EnemyBullet()
      bullet.SetDefaults()
      bullet.damage = this.damage * volley.damageRatio
      bullet.color = this.color

      scene.spawnProjectile(
        bullet,
        originX,
        originY,
        originX + Math.cos(angle) * 500,
        originY + Math.sin(angle) * 500,
        'enemy',
        this.id
      )
    }

    this.PlaySound(SoundID.BossShoot1)
  }

  // ========================================================================
  // OVERRIDES
  // ========================================================================

  OnHit(damage: number, source: any): boolean {
    if (this.invincible) return false
    return super.OnHit(damage, source)
  }

  /** The worm dies as one enemy: the head reports the kill, the chain dissolves behind it. */
  OnDeath(): void {
    super.OnDeath()

    const stagger = ArrowHeadConfig.fx.deathStaggerMs
    let part = this.follower
    let index = 0
    let guard = 0

    while (part && guard++ < 256) {
      part.Dissolve(stagger * index++)
      part = part.follower
    }
  }

  /** Scattered bundle drop, driven by the config's drop table. */
  DropBundles(): void {
    for (const row of ArrowHeadConfig.drops) {
      const count = Phaser.Math.Between(row.count.min, row.count.max)
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Phaser.Math.Between(row.minRadius, row.maxRadius)
        this.dropBundle(row.rarity, Math.cos(angle) * distance, Math.sin(angle) * distance)
      }
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private PlaySound(sound: SoundID): void {
    // all sound calls should have this check to prevent "sound stacking"
    if (this.scene.sound.isPlaying(sound)) {
      this.scene.sound.stopByKey(sound)
    }
    this.scene.sound.play(sound, { volume: getDefaultVolume(sound) })
  }

  /** Grow-in on spawn, covering the spawn immunity window. */
  private SpawnAnimation(): void {
    const cfg = ArrowHeadConfig.head

    this.scene.tweens.add({
      targets: this.container,
      scale: { from: this.scale * cfg.spawnScale, to: this.scale },
      duration: cfg.spawnImmunityMs,
      ease: 'Quad.easeOut',
    })
  }
}
