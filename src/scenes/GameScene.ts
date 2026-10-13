import Phaser from 'phaser';
import { Block } from '../entities/Block';
import { Player } from '../entities/Player';
import { GameState } from '../core/GameState';
import { PICKAXES_CONFIG, PickaxeType } from '../config/pickaxes';
import { getRandomBlockForDepth } from '../config/blocks';
import { Sound } from '../core/SoundManager';

// ── Grid Constants ──────────────────────────────────────────────────────────
const COLS = 7;
const BLOCK_SIZE = 48;
const VISIBLE_ROWS = 12; // rows rendered above/below camera
const CHUNK_SIZE = 10; // generate N rows at a time

export class GameScene extends Phaser.Scene {
  // Grid
  private blocks: Map<string, Block> = new Map();
  private generatedRows: number = 0;

  // Entities
  private player!: Player;

  // State
  private isMining: boolean = false;
  private explosiveHitCount: number = 0;
  private EXPLOSIVE_CHARGE_MAX = 5;

  // Particle emitter
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('GameScene');
  }

  create() {
    const { width } = this.scale;

    GameState.startNewRun();

    // Background — deep earth gradient
    const bgHeight = 9999;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x111827, 0x111827, 0x1c1009, 0x1c1009, 1);
    bg.fillRect(0, 0, width, bgHeight);
    bg.setDepth(-10);

    // Bedrock side walls
    this.drawSideWalls(width, bgHeight);

    // Setup particles
    this.particles = this.add.particles(0, 0, 'particle_dust', {
      speed: { min: 40, max: 100 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 200, max: 450 },
      quantity: 0,
      emitting: false,
      gravityY: 200,
    });
    this.particles.setDepth(50);

    // Generate initial chunks
    this.generateChunk(0, CHUNK_SIZE + VISIBLE_ROWS);

    // Spawn player above first block row
    const playerX = Math.floor(COLS / 2) * BLOCK_SIZE + BLOCK_SIZE / 2;
    const playerY = BLOCK_SIZE / 2 - 6;
    this.player = new Player(this, playerX, playerY, Math.floor(COLS / 2), 0);
    this.player.setDepth(100);

    // HUD runs as a parallel overlay scene so it isn't affected by camera scroll
    this.scene.launch('HUDScene');

    // Camera setup
    this.cameras.main.setBounds(0, -BLOCK_SIZE * 2, width, 999999);
    this.cameras.main.setDeadzone(0, 100);
    this.cameras.main.startFollow(this.player, false, 0.1, 0.08);

    // Touch / pointer input
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);

    // Keyboard shortcut (desktop fallback)
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.code === 'Escape') this.endRun();
    });

    // "Give Up" button — fixed to viewport
    this.add
      .text(width - 8, 8, '🏳 Give Up', {
        fontSize: '12px',
        color: '#f87171',
        backgroundColor: '#0f172a',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.endRun());
  }

  private endRun(): void {
    this.scene.stop('HUDScene');
    this.scene.start('GameOverScene');
  }

  // ─── Grid Generation ────────────────────────────────────────────────────

  private gridKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  private generateChunk(startRow: number, endRow: number): void {
    const efficiency = PICKAXES_CONFIG[GameState.equippedPickaxe].efficiency;

    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < COLS; col++) {
        const key = this.gridKey(col, row);
        if (this.blocks.has(key)) continue;

        const x = col * BLOCK_SIZE + BLOCK_SIZE / 2;
        const y = row * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockType = getRandomBlockForDepth(row);

        const block = new Block(this, x, y, col, row, blockType, efficiency);
        block.setDepth(10);
        this.blocks.set(key, block);
      }
    }

    this.generatedRows = Math.max(this.generatedRows, endRow);
  }

  // ─── Side Walls ─────────────────────────────────────────────────────────

  private drawSideWalls(_width: number, height: number): void {
    const wallThickness = 6;
    const g = this.add.graphics();
    g.fillStyle(0x0f172a, 1);
    g.fillRect(-wallThickness, 0, wallThickness, height);
    g.fillRect(COLS * BLOCK_SIZE, 0, wallThickness, height);
    g.lineStyle(2, 0x1e293b, 1);
    g.lineBetween(0, 0, 0, height);
    g.lineBetween(COLS * BLOCK_SIZE, 0, COLS * BLOCK_SIZE, height);
    g.setDepth(200);
  }

  // ─── Input Handling ──────────────────────────────────────────────────────

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    this.tryMineAt(worldX, worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    // Allow dragging to mine adjacent blocks
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    this.tryMineAt(worldX, worldY);
  }

  private tryMineAt(worldX: number, worldY: number): void {
    if (this.isMining) return;

    const col = Math.floor(worldX / BLOCK_SIZE);
    const row = Math.floor(worldY / BLOCK_SIZE);

    if (col < 0 || col >= COLS) return;

    // Only allow mining blocks adjacent to player
    const dx = Math.abs(col - this.player.gridX);
    const dy = row - this.player.gridY;

    const isAdjacent =
      (dx === 0 && (dy === 0 || dy === 1)) ||        // same col, same or below
      (dy === 0 && dx === 1) ||                       // same row, left/right
      (dx === 1 && dy === 1);                         // diagonal below

    if (!isAdjacent) return;

    const key = this.gridKey(col, row);
    const block = this.blocks.get(key);
    if (!block || block.isBroken) return;

    this.isMining = true;

    // Move player to the block's row if mining below
    if (dy === 1) {
      const newX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
      const newY = this.player.gridY * BLOCK_SIZE + BLOCK_SIZE / 2;
      this.player.moveToGrid(newX, newY, col, this.player.gridY, () => {
        this.doMineHit(block, col, row);
      });
    } else {
      this.doMineHit(block, col, row);
    }
  }

  private doMineHit(block: Block, col: number, row: number): void {
    const blockWorldX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
    const pickaxeConfig = PICKAXES_CONFIG[GameState.equippedPickaxe];

    // Play swing sound
    if (GameState.soundEnabled) {
      Sound.play('pickaxe_swing');
    }

    this.player.playSwingAnimation(blockWorldX, () => {
      this.applyHit(block, col, row, pickaxeConfig.type);
      GameState.triggerHaptic(20);
      this.isMining = false;
    });
  }

  // ─── Hit Logic & AOE ─────────────────────────────────────────────────────

  private applyHit(block: Block, col: number, row: number, pickaxeType: PickaxeType): void {
    const result = block.hit(1);

    // Spawn particles
    this.particles.setPosition(col * BLOCK_SIZE + BLOCK_SIZE / 2, row * BLOCK_SIZE + BLOCK_SIZE / 2);
    this.particles.setParticleTint(result.particleColor);
    this.particles.explode(6);

    if (result.broken) {
      this.onBlockBroken(block, col, row, result.gold, result.diamonds);

      // AOE effects based on pickaxe type
      if (pickaxeType === 'horizontal_cleaver') {
        this.aoeSideBlocks(col, row);
      } else if (pickaxeType === 'vertical_pulverizer') {
        this.aoeVerticalBlocks(col, row);
      } else if (pickaxeType === 'explosive') {
        this.explosiveHitCount++;
        if (this.explosiveHitCount >= this.EXPLOSIVE_CHARGE_MAX) {
          this.explosiveHitCount = 0;
          GameState.explosiveCharge = 0;
          this.time.delayedCall(150, () => this.aoeExplosiveBlast(col, row));
        }
      }
    }

    if (pickaxeType === 'explosive') {
      GameState.explosiveCharge = this.explosiveHitCount;
    }
  }

  private aoeSideBlocks(col: number, row: number): void {
    const targets = [
      { col: col - 1, row },
      { col: col + 1, row },
    ];
    this.time.delayedCall(80, () => {
      for (const t of targets) {
        const b = this.blocks.get(this.gridKey(t.col, t.row));
        if (b && !b.isBroken) {
          const res = b.hit(1);
          this.particles.setPosition(t.col * BLOCK_SIZE + BLOCK_SIZE / 2, t.row * BLOCK_SIZE + BLOCK_SIZE / 2);
          this.particles.explode(3);
          if (res.broken) this.onBlockBroken(b, t.col, t.row, res.gold, res.diamonds);
        }
      }
    });
  }

  private aoeVerticalBlocks(col: number, row: number): void {
    const targets = [
      { col, row: row + 1 },
      { col, row: row + 2 },
    ];
    this.time.delayedCall(80, () => {
      for (const t of targets) {
        const b = this.blocks.get(this.gridKey(t.col, t.row));
        if (b && !b.isBroken) {
          const res = b.hit(1);
          this.particles.setPosition(t.col * BLOCK_SIZE + BLOCK_SIZE / 2, t.row * BLOCK_SIZE + BLOCK_SIZE / 2);
          this.particles.explode(3);
          if (res.broken) this.onBlockBroken(b, t.col, t.row, res.gold, res.diamonds);
        }
      }
    });
  }

  private aoeExplosiveBlast(col: number, row: number): void {
    // Play explosion sound
    if (GameState.soundEnabled) {
      Sound.play('explosion');
    }

    // 3x3 blast
    const flashOverlay = this.add.graphics();
    flashOverlay.fillStyle(0xfef08a, 0.55);
    flashOverlay.fillRect(
      (col - 1) * BLOCK_SIZE,
      (row - 1) * BLOCK_SIZE,
      BLOCK_SIZE * 3,
      BLOCK_SIZE * 3
    );
    flashOverlay.setDepth(500);
    this.tweens.add({
      targets: flashOverlay,
      alpha: 0,
      duration: 350,
      onComplete: () => flashOverlay.destroy(),
    });

    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        const b = this.blocks.get(this.gridKey(c, r));
        if (b && !b.isBroken) {
          const res = b.hit(99); // destroys block
          this.particles.setPosition(c * BLOCK_SIZE + BLOCK_SIZE / 2, r * BLOCK_SIZE + BLOCK_SIZE / 2);
          this.particles.explode(8);
          if (res.broken) this.onBlockBroken(b, c, r, res.gold, res.diamonds);
        }
      }
    }
    this.cameras.main.shake(200, 0.006);
  }

  // ─── Block Broken Handler ────────────────────────────────────────────────

  private onBlockBroken(block: Block, col: number, row: number, gold: number, diamonds: number): void {
    GameState.recordBlockBroken();

    const worldX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
    const worldY = row * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Fade out and destroy block visuals
    this.tweens.add({
      targets: block,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 180,
      ease: 'Back.easeIn',
      onComplete: () => block.destroy(),
    });
    this.blocks.delete(this.gridKey(col, row));

    // Collect rewards
    if (gold > 0) {
      GameState.addGold(gold);
      this.spawnFloatingText(worldX, worldY, `+${gold}💰`, '#facc15');
      if (GameState.soundEnabled) Sound.play('gold_collect');
    }
    if (diamonds > 0) {
      GameState.addDiamonds(diamonds);
      this.spawnFloatingText(worldX, worldY - 20, `+${diamonds}💎`, '#38bdf8');
      if (GameState.soundEnabled) Sound.play('diamond_collect');
    }

    // Check if player can fall into broken space below
    this.checkPlayerDrop(col, row);

    // Update depth
    const newDepth = Math.max(this.player.gridY * 3, row * 3);
    GameState.updateDepth(newDepth);

    // Generate more chunks as the player goes deeper
    if (row + VISIBLE_ROWS > this.generatedRows) {
      this.generateChunk(this.generatedRows, this.generatedRows + CHUNK_SIZE);
    }
  }

  private checkPlayerDrop(col: number, row: number): void {
    // If player is at this column and directly above, let them step down
    if (col === this.player.gridX && row === this.player.gridY + 1) {
      this.time.delayedCall(220, () => {
        const newX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
        const newY = row * BLOCK_SIZE + BLOCK_SIZE / 2 - 6;
        this.player.moveToGrid(newX, newY, col, row);
        GameState.updateDepth(row * 3);
      });
    }
  }

  // ─── Floating Text ───────────────────────────────────────────────────────

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontSize: '14px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(300);

    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 900,
      ease: 'Power1',
      onComplete: () => t.destroy(),
    });
  }

  // ─── Update Loop ─────────────────────────────────────────────────────────

  update(): void {
    // Cull blocks far above the camera to keep draw calls low
    const camTop = this.cameras.main.worldView.top;
    const cullRow = Math.floor(camTop / BLOCK_SIZE) - 2;

    for (const [_key, block] of this.blocks) {
      if (block.gridY < cullRow - 2) {
        block.setVisible(false);
      } else if (!block.isBroken) {
        block.setVisible(true);
      }
    }
  }
}
