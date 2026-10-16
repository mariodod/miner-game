import Phaser from 'phaser';
import { EnemyType, ENEMIES_CONFIG, calculateEnemyHp } from '../config/enemies';
import { GameState } from '../core/GameState';
import { Sound } from '../core/SoundManager';

export class Enemy extends Phaser.GameObjects.Container {
  public gridX: number;
  public gridY: number;
  public enemyType: EnemyType;
  public maxHp: number;
  public currentHp: number;
  public isDead: boolean = false;
  public isStunned: boolean = false;

  private bodySprite!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  public config: typeof ENEMIES_CONFIG[EnemyType];
  private moveTimer: Phaser.Time.TimerEvent | null = null;
  private attackCooldown: boolean = false;
  private targetPlayer: Phaser.GameObjects.Container | null = null;
  private isAiPaused: boolean = false;

  /** GameScene hook — may this enemy step onto (col, row)? */
  public canStepTo: ((col: number, row: number) => boolean) | null = null;
  /** GameScene hook — re-key the enemy map after a completed grid step. */
  public onGridMove: ((enemy: Enemy, oldCol: number, oldRow: number) => void) | null = null;

  /** True while a grid-step tween is in flight. */
  public isMoving: boolean = false;

  /** Called when this enemy lands a hit on the player (GameScene applies it). */
  public onPlayerHit: ((damage: number) => void) | null = null;
  private damageFlashTimer: Phaser.Time.TimerEvent | null = null;
  private damageFlashGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    gridX: number,
    gridY: number,
    enemyType: EnemyType,
    pickaxeEfficiency: number = 1
  ) {
    super(scene, x, y);

    this.gridX = gridX;
    this.gridY = gridY;
    this.enemyType = enemyType;
    this.config = ENEMIES_CONFIG[enemyType];

    // Calculate HP based on current depth
    const depth = gridY * 3; // Same depth calculation as blocks
    this.maxHp = calculateEnemyHp(this.config, depth, pickaxeEfficiency);
    this.currentHp = this.maxHp;

    this.createVisuals();
    this.setupPhysics();

    scene.add.existing(this);
    this.setDepth(50);

    // Start AI behavior
    this.startAI();
  }

  private createVisuals(): void {
    const BLOCK_SIZE = 48;

    // Body sprite (procedural graphics)
    this.bodySprite = this.scene.add.graphics();
    this.drawBody();
    this.add(this.bodySprite);

    // HP bar background
    this.hpBarBg = this.scene.add.graphics();
    this.hpBarBg.fillStyle(0x000000, 0.7);
    this.hpBarBg.fillRoundedRect(-20, -BLOCK_SIZE / 2 - 10, 40, 5, 2);
    this.hpBarBg.setVisible(false);
    this.add(this.hpBarBg);

    // HP bar fill
    this.hpBarFill = this.scene.add.graphics();
    this.updateHpBar();
    this.hpBarFill.setVisible(false);
    this.add(this.hpBarFill);

    // Name text
    this.nameText = this.scene.add.text(0, -BLOCK_SIZE / 2 - 20, this.config.name, {
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#f1f5f9',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setVisible(false);
    this.add(this.nameText);
  }

  private drawBody(): void {
    const g = this.bodySprite;
    g.clear();
    const BLOCK_SIZE = 48;
    const size = BLOCK_SIZE * 0.7;
    const half = size / 2;

    // Body shape varies by enemy type
    if (this.enemyType === 'bat') {
      // Bat - wings spread
      g.fillStyle(this.config.color, 1);
      // Body
      g.fillEllipse(0, 0, half, half * 0.7);
      // Wings
      g.fillEllipse(-half, 0, half * 0.8, half * 0.5);
      g.fillEllipse(half, 0, half * 0.8, half * 0.5);
      // Eyes
      g.fillStyle(this.config.accentColor, 1);
      g.fillCircle(-4, -3, 3);
      g.fillCircle(4, -3, 3);
    } else if (this.enemyType === 'goblin') {
      // Goblin - humanoid
      g.fillStyle(this.config.color, 1);
      // Head
      g.fillCircle(0, -half * 0.4, half * 0.5);
      // Body
      g.fillRect(-half * 0.5, -half * 0.1, half, half);
      // Arms
      g.fillRect(-half * 0.9, 0, half * 0.4, half * 0.8);
      g.fillRect(half * 0.5, 0, half * 0.4, half * 0.8);
      // Eyes
      g.fillStyle(this.config.accentColor, 1);
      g.fillCircle(-4, -half * 0.4 - 2, 2);
      g.fillCircle(4, -half * 0.4 - 2, 2);
    } else if (this.enemyType === 'slime') {
      // Slime - blob with wobble
      g.fillStyle(this.config.color, 0.8);
      g.fillEllipse(0, half * 0.2, half * 1.2, half * 1.2);
      g.fillStyle(this.config.accentColor, 0.5);
      g.fillEllipse(0, 0, half * 0.8, half * 0.8);
      // Eyes
      g.fillStyle(0x000000, 1);
      g.fillCircle(-6, -4, 3);
      g.fillCircle(6, -4, 3);
    } else if (this.enemyType === 'rock_golem') {
      // Rock Golem - bulky rocky
      g.fillStyle(this.config.color, 1);
      // Main body
      g.fillRect(-half * 0.7, -half * 0.3, half * 1.4, half * 1.3);
      // Head area
      g.fillRect(-half * 0.5, -half * 0.8, half, half * 0.5);
      // Arms
      g.fillRect(-half * 1.1, -half * 0.2, half * 0.5, half * 1.0);
      g.fillRect(half * 0.6, -half * 0.2, half * 0.5, half * 1.0);
      // Glowing cracks
      g.fillStyle(this.config.accentColor, 1);
      g.fillRect(-2, -half * 0.3, 1, 4);
      g.fillRect(-1, half * 0.2, 2, 3);
    } else if (this.enemyType === 'crystal_lurker') {
      // Crystal Lurker - geometric crystals
      g.fillStyle(this.config.color, 1);
      // Main crystal body
      g.beginPath();
      g.moveTo(0, -half);
      g.lineTo(half * 0.7, 0);
      g.lineTo(0, half);
      g.lineTo(-half * 0.7, 0);
      g.closePath();
      g.fillPath();
      // Inner glow
      g.fillStyle(this.config.accentColor, 0.6);
      g.beginPath();
      g.moveTo(0, -half * 0.5);
      g.lineTo(half * 0.35, 0);
      g.lineTo(0, half * 0.5);
      g.lineTo(-half * 0.35, 0);
      g.closePath();
      g.fillPath();
      // Crystal facets
      g.lineStyle(2, this.config.accentColor, 0.8);
      g.lineBetween(0, -half, 0, half);
      g.lineBetween(-half * 0.7, 0, half * 0.7, 0);
    } else if (this.enemyType === 'void_wraith') {
      // Void Wraith - dark shadowy figure
      g.fillStyle(this.config.color, 0.9);
      // Main body
      g.fillEllipse(0, 0, half, half * 1.3);
      // Tendrils
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const len = half * 0.8;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        g.strokePath();
      }
      // Core glow
      g.fillStyle(this.config.accentColor, 1);
      g.fillCircle(0, 0, half * 0.25);
      // Eyes
      g.fillStyle(this.config.accentColor, 1);
      g.fillCircle(-5, -3, 4);
      g.fillCircle(5, -3, 4);
    }
  }

  private updateHpBar(): void {
    const ratio = this.currentHp / this.maxHp;
    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444,
      1
    );
    this.hpBarFill.fillRoundedRect(-18, -48 / 2 - 9, 36 * ratio, 3, 1);
  }

  private setupPhysics(): void {
    // Guard: arcade physics may be unavailable if the game config changes.
    if (!this.scene.physics) return;
    this.scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const BLOCK_SIZE = 48;
      const size = BLOCK_SIZE * 0.6;
      body.setSize(size, size);
      body.setOffset(-size / 2, -size / 2);
      body.setCollideWorldBounds(false);
      body.setImmovable(false);
      body.mass = 2;
      body.setDrag(200);
    }
  }

  private startAI(): void {
    // One decision every ~0.5-1s: hop toward the miner or wander the shaft.
    this.moveTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(550, 1000),
      loop: true,
      callback: this.decideAction,
      callbackScope: this,
    });

    // Initial decision
    this.decideAction();
  }

  private decideAction(): void {
    if (this.isDead || this.isStunned || this.isAiPaused || this.isMoving) return;

    const BLOCK_SIZE = 48;
    const toGrid = (v: number) => Math.round((v - BLOCK_SIZE / 2) / BLOCK_SIZE);

    if (this.targetPlayer) {
      const playerCol = toGrid(this.targetPlayer.x);
      const playerRow = toGrid(this.targetPlayer.y);
      const dCol = playerCol - this.gridX;
      const dRow = playerRow - this.gridY;
      const range = Math.max(Math.abs(dCol), Math.abs(dRow));

      // In reach — attack instead of stepping
      if (range <= 1) {
        this.attackPlayer();
        return;
      }

      // Scent the miner and take a greedy step toward them
      if (range <= 5 && this.tryStep(dCol, dRow)) return;
    }

    // Otherwise wander to a random passable neighbour
    const dirs = Phaser.Utils.Array.Shuffle([
      { dCol: -1, dRow: 0 },
      { dCol: 1, dRow: 0 },
      { dCol: 0, dRow: -1 },
      { dCol: 0, dRow: 1 },
    ]);
    for (const dir of dirs) {
      if (this.tryStep(dir.dCol, dir.dRow)) return;
    }
  }

  /**
   * Attempts a single grid step, trying the dominant axis first. Every
   * candidate cell must pass the GameScene passability check, so enemies
   * never burrow through solid rock or drift outside the shaft.
   */
  private tryStep(dCol: number, dRow: number): boolean {
    const steps: Array<{ dc: number; dr: number }> = [];
    if (Math.abs(dCol) >= Math.abs(dRow)) {
      if (dCol !== 0) steps.push({ dc: Math.sign(dCol), dr: 0 });
      if (dRow !== 0) steps.push({ dc: 0, dr: Math.sign(dRow) });
    } else {
      if (dRow !== 0) steps.push({ dc: 0, dr: Math.sign(dRow) });
      if (dCol !== 0) steps.push({ dc: Math.sign(dCol), dr: 0 });
    }

    for (const step of steps) {
      const col = this.gridX + step.dc;
      const row = this.gridY + step.dr;
      if (!this.canStepTo || !this.canStepTo(col, row)) continue;
      this.stepTo(col, row);
      return true;
    }
    return false;
  }

  /** Animates a single-cell hop and re-keys the enemy map on arrival. */
  private stepTo(col: number, row: number): void {
    const BLOCK_SIZE = 48;
    const oldCol = this.gridX;
    const oldRow = this.gridY;
    // Faster enemies hop quicker; clamped so nothing teleports or crawls.
    const duration = Phaser.Math.Clamp(Math.round(18000 / this.config.speed), 280, 900);

    this.isMoving = true;

    if (col < oldCol) this.setScale(-1, 1);
    else if (col > oldCol) this.setScale(1, 1);

    this.scene.tweens.add({
      targets: this,
      x: col * BLOCK_SIZE + BLOCK_SIZE / 2,
      y: row * BLOCK_SIZE + BLOCK_SIZE / 2,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.gridX = col;
        this.gridY = row;
        this.isMoving = false;
        if (this.active && this.onGridMove) this.onGridMove(this, oldCol, oldRow);
      },
    });
  }

  private attackPlayer(): void {
    if (this.attackCooldown || !this.targetPlayer || this.isAiPaused || this.isDead) return;
    this.attackCooldown = true;

    // Visual attack indicator (relative so a mirrored enemy stays mirrored)
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.2,
      scaleY: 0.9,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Land the hit on the player (GameScene applies the HP loss).
        if (this.active && !this.isDead && this.onPlayerHit) {
          this.onPlayerHit(this.config.damage);
        }
        if (GameState.soundEnabled) Sound.play('block_hit');
        this.attackCooldown = false;
      },
    });

    this.scene.time.delayedCall(1000, () => {
      this.attackCooldown = false;
    });
  }

  public setTargetPlayer(player: Phaser.GameObjects.Container): void {
    this.targetPlayer = player;
  }

  /** Freezes AI decisions (used while the collapse/revive prompt is open). */
  public pauseAI(): void {
    this.isAiPaused = true;
    if (this.moveTimer) this.moveTimer.paused = true;
  }

  public resumeAI(): void {
    this.isAiPaused = false;
    if (this.moveTimer) this.moveTimer.paused = false;
  }

  public takeDamage(damage: number, fromX: number, fromY: number): { dead: boolean; exp: number; gold?: number; diamonds?: number } {
    if (this.isDead) return { dead: false, exp: 0 };

    this.currentHp -= damage;
    this.updateHpBar();

    // Show HP bar
    this.hpBarBg.setVisible(true);
    this.hpBarFill.setVisible(true);
    this.nameText.setVisible(true);

    // Damage flash - create red overlay
    if (!this.damageFlashGraphics) {
      this.damageFlashGraphics = this.scene.add.graphics();
      this.addAt(this.damageFlashGraphics, 0); // Add at bottom
    }
    this.damageFlashGraphics.clear();
    this.damageFlashGraphics.fillStyle(0xff0000, 0.5);
    this.damageFlashGraphics.fillCircle(0, 0, 24);
    this.damageFlashGraphics.setVisible(true);

    if (this.damageFlashTimer) this.damageFlashTimer.remove();
    this.damageFlashTimer = this.scene.time.delayedCall(100, () => {
      if (this.damageFlashGraphics) this.damageFlashGraphics.setVisible(false);
    });

    // Knockback
    const knockbackX = (this.x - fromX) * 0.5;
    const knockbackY = (this.y - fromY) * 0.5;
    this.scene.tweens.add({
      targets: this,
      x: this.x + knockbackX,
      y: this.y + knockbackY,
      duration: 100,
      ease: 'Power2',
    });

    // Stun briefly
    this.isStunned = true;
    this.scene.time.delayedCall(200, () => {
      this.isStunned = false;
    });

    // Play hit sound
    if (GameState.soundEnabled) Sound.play('block_hit');

    if (this.currentHp <= 0) {
      return this.die();
    }

    return { dead: false, exp: 0 };
  }

  private die(): { dead: boolean; exp: number; gold?: number; diamonds?: number } {
    this.isDead = true;
    if (this.moveTimer) {
      this.moveTimer.remove();
      this.moveTimer = null;
    }

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy(true);
      },
    });

    // Drop rewards
    const depth = this.gridY * 3;
    const gold = this.config.dropGold(depth);
    const diamonds = this.config.dropDiamonds(depth);

    if (GameState.soundEnabled) Sound.play('block_break');

    return { dead: true, exp: this.maxHp, gold, diamonds };
  }

  public destroy(fromScene?: boolean): void {
    if (this.moveTimer) this.moveTimer.remove();
    if (this.damageFlashTimer) this.damageFlashTimer.remove();
    if (this.damageFlashGraphics) this.damageFlashGraphics.destroy();
    super.destroy(fromScene);
  }
}