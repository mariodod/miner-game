import Phaser from 'phaser';

export type CollectibleKind = 'gold' | 'diamond';

export interface CollectibleTarget {
  x: number;
  y: number;
}

/**
 * A physical drop item (coin or gem) that bursts out of a broken block /
 * defeated enemy and then magnet-flies to the HUD counter in screen space.
 * Currency is only credited once the drop reaches the counter.
 */
export class Collectible extends Phaser.GameObjects.Sprite {
  public readonly kind: CollectibleKind;
  public readonly value: number;
  /** Only the first drop of a burst plays the collection jingle. */
  public readonly withSound: boolean;

  private vx: number;
  private vy: number;
  private burstTimeLeft: number = 360;
  private phase: 'burst' | 'homing' = 'burst';
  private homingScale: number = 1;

  private readonly getTarget: () => CollectibleTarget;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: CollectibleKind,
    value: number,
    getTarget: () => CollectibleTarget,
    withSound: boolean = true
  ) {
    super(scene, x, y, kind === 'gold' ? 'coin_icon' : 'diamond_icon');

    this.kind = kind;
    this.value = value;
    this.withSound = withSound;
    this.getTarget = getTarget;

    this.setOrigin(0.5);
    this.setDepth(250);
    this.setScale(0.9 + Math.random() * 0.25);

    // Burst outward and upward, then fall for a short moment
    this.vx = Phaser.Math.Between(-150, 150);
    this.vy = Phaser.Math.Between(-330, -170);

    scene.add.existing(this);

    // Pop-in spin
    scene.tweens.add({
      targets: this,
      scale: { from: 0.3, to: this.scaleX },
      duration: 140,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Advances the drop animation. Returns true when the item has reached the
   * HUD counter and should be collected (caller credits the value + destroys).
   */
  public updateCollectible(dt: number): boolean {
    if (this.phase === 'burst') {
      this.burstTimeLeft -= dt * 1000;
      this.vy += 980 * dt; // gravity
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.burstTimeLeft <= 0) {
        this.phase = 'homing';
        this.homingScale = this.scaleX;
      }
      return false;
    }

    const target = this.getTarget();
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Accelerating magnet pull: constant base speed + distance-proportional
    const step = (620 + dist * 6) * dt;

    if (dist <= Math.max(18, step)) {
      return true;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;

    // Shrink as it approaches the counter
    const shrink = Phaser.Math.Clamp(dist / 340, 0.45, 1);
    this.setScale(this.homingScale * shrink);
    return false;
  }
}
