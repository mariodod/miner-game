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
    // Wander behavior with occasional player targeting
    this.moveTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(1500, 3000),
      loop: true,
      callback: this.decideAction,
      callbackScope: this,
    });

    // Initial decision
    this.decideAction();
  }

  private decideAction(): void {
    if (this.isDead || this.isStunned) return;

    // Find player if nearby
    if (this.targetPlayer && !this.attackCooldown) {
      const dist = Phaser.Math.Distance.Between(
        this.x, this.y,
        this.targetPlayer.x, this.targetPlayer.y
      );
      if (dist < 120) {
        this.moveTowardsPlayer();
        return;
      }
    }

    // Random wander
    this.wander();
  }

  private wander(): void {
    const directions = [
      { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }
    ];
    const dir = Phaser.Utils.Array.GetRandom(directions);
    const BLOCK_SIZE = 48;
    const targetX = this.x + dir.x * BLOCK_SIZE;
    const targetY = this.y + dir.y * BLOCK_SIZE;

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 800,
      ease: 'Power1',
      onComplete: () => {
        this.gridX = Math.round(this.x / BLOCK_SIZE);
        this.gridY = Math.round(this.y / BLOCK_SIZE);
      },
    });

    // Face direction
    if (dir.x < 0) this.setScale(-1, 1);
    else if (dir.x > 0) this.setScale(1, 1);
  }

  private moveTowardsPlayer(): void {
    if (!this.targetPlayer) return;

    const dx = this.targetPlayer.x - this.x;
    const dy = this.targetPlayer.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 40) {
      // Attack range
      this.attackPlayer();
      return;
    }

    const speed = this.config.speed;
    const moveX = (dx / dist) * speed * 0.1;
    const moveY = (dy / dist) * speed * 0.1;

    this.scene.tweens.add({
      targets: this,
      x: this.x + moveX,
      y: this.y + moveY,
      duration: 100,
      ease: 'Linear',
    });

    // Face player
    if (dx < 0) this.setScale(-1, 1);
    else this.setScale(1, 1);
  }

  private attackPlayer(): void {
    if (this.attackCooldown || !this.targetPlayer) return;
    this.attackCooldown = true;

    // Visual attack indicator
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 0.9,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Deal damage to player (placeholder - would need player ref)
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