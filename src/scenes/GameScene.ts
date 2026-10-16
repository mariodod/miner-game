import Phaser from 'phaser';
import { Block } from '../entities/Block';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Collectible, CollectibleKind } from '../entities/Collectible';
import { GameState, PLAYER_MAX_HP } from '../core/GameState';
import { Ads } from '../core/AdManager';
import { PICKAXES_CONFIG, PickaxeType } from '../config/pickaxes';
import { getRandomBlockForDepth } from '../config/blocks';
import { shouldEnemySpawn, getRandomEnemyForDepth, ENEMIES_CONFIG } from '../config/enemies';
import { Sound } from '../core/SoundManager';
import { HUD_GOLD_POS, HUD_DIAMOND_POS } from '../ui/HUD';

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
  private enemies: Map<string, Enemy> = new Map();
  private collectibles: Collectible[] = [];

  // State
  private isMining: boolean = false;
  private explosiveHitCount: number = 0;
  private EXPLOSIVE_CHARGE_MAX = 5;

  // Combat
  private isAttacking: boolean = false;

  // Pause overlay (PauseScene handles resume / settings / quit)
  private isPauseOpen: boolean = false;

  // First-run tutorial hints (only while !GameState.tutorialDone)
  private tutorialStep: number = 0; // 1 = awaiting first mine, 2 = awaiting first enemy
  private tutorialHint: Phaser.GameObjects.Text | null = null;

  // Player survival & revive (second-chance ad) flow.
  // Overlay pieces are top-level objects: Phaser hit-tests Container children
  // in registration order and ignores the container's scroll factor, which
  // would let the full-screen dim swallow taps aimed at the buttons.
  private isCollapsed: boolean = false;
  private reviveUsedThisRun: boolean = false;
  private invulnUntil: number = 0;
  private collapseObjects: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];

  // Particle emitter
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('GameScene');
  }

  create() {
    const { width } = this.scale;

    // Reset all run-scoped state (scene instances persist across restarts,
    // and shut-down scenes destroy their game objects).
    this.blocks.clear();
    this.enemies.clear();
    this.collectibles = [];
    this.generatedRows = 0;
    this.isMining = false;
    this.isAttacking = false;
    this.explosiveHitCount = 0;
    this.isCollapsed = false;
    this.reviveUsedThisRun = false;
    this.invulnUntil = 0;
    this.collapseObjects = [];
    this.isPauseOpen = false;
    this.tutorialStep = 0;
    this.tutorialHint = null;

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
      if (event.code === 'Escape') this.openPauseMenu();
    });

    // "Pause" & "Give Up" buttons — fixed to viewport, below the HUD banner
    this.add
      .text(width - 8, 64, '⏸ Pause', {
        fontSize: '12px',
        color: '#cbd5e1',
        backgroundColor: '#0f172a',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (GameState.soundEnabled) Sound.play('ui_click');
        this.openPauseMenu();
      });

    this.add
      .text(width - 8, 92, '🏳 Give Up', {
        fontSize: '12px',
        color: '#f87171',
        backgroundColor: '#0f172a',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (GameState.soundEnabled) Sound.play('ui_click');
        this.endRun();
      });

    // When returning from the shop mid-run, refresh block HP for the
    // (possibly upgraded) pickaxe efficiency.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.isPauseOpen = false;
      const efficiency = this.currentEfficiency();
      for (const block of this.blocks.values()) {
        block.updatePickaxeEfficiency(efficiency);
      }
    });

    // Never lose un-collected drops, no matter how the scene exits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.flushCollectibles();
    });

    // First-run tutorial hints (skipped once completed on a previous run)
    this.initTutorial();
  }

  /** Pickaxe efficiency including incremental Power upgrades. */
  private currentEfficiency(): number {
    const base = PICKAXES_CONFIG[GameState.equippedPickaxe].efficiency;
    return GameState.getEffectiveEfficiency(base);
  }

  private endRun(): void {
    this.flushCollectibles();
    this.scene.stop('HUDScene');
    this.scene.start('GameOverScene');
  }

  /** Ends the run from outside the scene (e.g. the pause menu quit button). */
  public quitRun(): void {
    this.endRun();
  }

  /** Opens the pause overlay (no-op while a death/revive overlay is up). */
  private openPauseMenu(): void {
    if (this.isCollapsed || this.isPauseOpen) return;
    this.isPauseOpen = true;
    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  // ─── First-Run Tutorial Hints ────────────────────────────────────────────

  private initTutorial(): void {
    if (GameState.tutorialDone) return;
    this.tutorialStep = 1;
    this.time.delayedCall(600, () => {
      if (this.tutorialStep === 1) {
        this.showTutorialHint('👆 Tap a block next to your miner to mine it!');
      }
    });
  }

  /** Bottom-screen hint bubble; auto-hides after a few seconds. */
  private showTutorialHint(text: string): void {
    this.tutorialHint?.destroy();

    const hint = this.add
      .text(this.scale.width / 2, this.scale.height - 84, text, {
        fontSize: '13px',
        color: '#f8fafc',
        backgroundColor: '#0f172ae6',
        padding: { x: 14, y: 8 },
        wordWrap: { width: 300 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1200)
      .setAlpha(0);
    this.tutorialHint = hint;

    this.tweens.add({ targets: hint, alpha: 1, duration: 250, ease: 'Power2' });
    this.time.delayedCall(6000, () => {
      if (this.tutorialHint !== hint) return;
      this.tweens.add({
        targets: hint,
        alpha: 0,
        duration: 300,
        onComplete: () => hint.destroy(),
      });
      this.tutorialHint = null;
    });
  }

  // ─── Player Survival & Second Chance ─────────────────────────────────────

  /** Applies enemy damage to the transient run HP. */
  private damagePlayer(damage: number): void {
    if (this.isCollapsed) return;
    if (this.time.now < this.invulnUntil) return;

    GameState.setPlayerHp(GameState.playerHp - damage);
    GameState.triggerHaptic(40);
    this.cameras.main.shake(120, 0.004);
    this.cameras.main.flash(160, 190, 30, 30);

    if (GameState.playerHp <= 0) {
      this.collapse();
    }
  }

  /** Opens the "second chance" prompt when the player runs out of HP. */
  private collapse(): void {
    if (this.isCollapsed) return;
    this.isCollapsed = true;

    // Freeze enemies so the prompt has a calm backdrop
    for (const enemy of this.enemies.values()) enemy.pauseAI();

    const { width, height } = this.scale;

    // Overlay pieces are top-level objects so input priority follows depth.
    const pieces: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];
    const add = <T extends Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>(
      obj: T,
      depth: number
    ): T => {
      obj.setScrollFactor(0);
      obj.setAlpha(0);
      obj.setDepth(depth);
      pieces.push(obj);
      return obj;
    };

    // Full-screen dim — blocks taps to whatever is behind (e.g. Give Up)
    const dim = add(this.add.graphics(), 1500);
    dim.fillStyle(0x000000, 0.74);
    dim.fillRect(0, 0, width, height);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    const canRevive = !this.reviveUsedThisRun;
    const panelW = 300;
    const panelH = canRevive ? 240 : 196;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = add(this.add.graphics(), 1501);
    panel.fillStyle(0x1e1b4b, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0xef4444, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    add(
      this.add
        .text(width / 2, panelY + 32, '💀 YOU COLLAPSED!', {
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#f87171',
        })
        .setOrigin(0.5),
      1501
    );

    add(
      this.add
        .text(width / 2, panelY + 62, `Depth ${GameState.currentDepth}m · Your loot is safe`, {
          fontSize: '12px',
          color: '#94a3b8',
        })
        .setOrigin(0.5),
      1501
    );

    let buttonY = panelY + 92;

    if (canRevive) {
      const reviveBg = add(this.add.graphics(), 1502);
      reviveBg.fillStyle(0x16a34a, 1);
      reviveBg.fillRoundedRect(panelX + 20, buttonY, panelW - 40, 46, 12);
      reviveBg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(panelX + 20, buttonY, panelW - 40, 46),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      reviveBg.on('pointerdown', () => {
        if (GameState.soundEnabled) Sound.play('ui_click');
        Ads.showRewardedAd(
          this,
          'revive',
          'Watch a short ad to get back on your feet!',
          'Full HP + 3s Shield',
          () => this.revivePlayer()
        );
      });

      add(
        this.add
          .text(width / 2, buttonY + 16, '📺 REVIVE · WATCH AD', {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#f0fdf4',
          })
          .setOrigin(0.5),
        1502
      );
      add(
        this.add
          .text(width / 2, buttonY + 34, 'Full HP + 3s shield', {
            fontSize: '10px',
            color: '#bbf7d0',
          })
          .setOrigin(0.5),
        1502
      );

      buttonY += 58;
    } else {
      add(
        this.add
          .text(width / 2, buttonY, 'Revive already used this run', {
            fontSize: '11px',
            color: '#64748b',
          })
          .setOrigin(0.5),
        1501
      );
      buttonY += 26;
    }

    const endBg = add(this.add.graphics(), 1502);
    endBg.fillStyle(0x334155, 1);
    endBg.fillRoundedRect(panelX + 20, buttonY, panelW - 40, 38, 10);
    endBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(panelX + 20, buttonY, panelW - 40, 38),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    endBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.endRun();
    });

    add(
      this.add
        .text(width / 2, buttonY + 19, '🏁 END RUN', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#e2e8f0',
        })
        .setOrigin(0.5),
      1502
    );

    this.collapseObjects = pieces;
    this.tweens.add({ targets: pieces, alpha: 1, duration: 220, ease: 'Power2' });
  }

  /** Grants the revive ad reward: full HP, a brief shield and breathing room. */
  private revivePlayer(): void {
    if (!this.isCollapsed) return;

    this.reviveUsedThisRun = true;
    this.isCollapsed = false;

    GameState.setPlayerHp(PLAYER_MAX_HP);
    this.invulnUntil = this.time.now + 3000;
    GameState.triggerHaptic(30);
    if (GameState.soundEnabled) Sound.play('level_up');

    if (this.collapseObjects.length > 0) {
      this.collapseObjects.forEach((obj) => obj.destroy());
      this.collapseObjects = [];
    }

    // Scatter enemies near the player so the revive isn't instant death.
    for (const [key, enemy] of [...this.enemies]) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < 140) {
        this.particles.setPosition(enemy.x, enemy.y);
        this.particles.setParticleTint(0xef4444);
        this.particles.explode(10);
        enemy.destroy();
        this.enemies.delete(key);
      }
    }

    for (const enemy of this.enemies.values()) enemy.resumeAI();
  }

  // ─── Grid Generation ────────────────────────────────────────────────────

  private gridKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  private enemyKey(col: number, row: number): string {
    return `enemy_${col},${row}`;
  }

  private generateChunk(startRow: number, endRow: number): void {
    const efficiency = this.currentEfficiency();

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
    if (this.isMining || this.isAttacking || this.isCollapsed) return;

    // First, try to attack an enemy at this position
    if (this.tryAttackEnemy(worldX, worldY)) {
      return;
    }

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

    const started = this.player.playSwingAnimation(
      blockWorldX,
      () => {
        this.applyHit(block, col, row, pickaxeConfig.type);
        GameState.triggerHaptic(20);
        this.isMining = false;
      },
      GameState.swingSpeedMultiplier
    );

    if (!started) {
      // A previous swing is still recovering — abort cleanly.
      this.isMining = false;
      return;
    }

    // Play swing sound
    if (GameState.soundEnabled) {
      Sound.play('pickaxe_swing');
    }
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

    // Chance to spawn enemy when breaking block
    this.trySpawnEnemy(col, row, block.blockType);

    // Tutorial: first broken block → nudge the player deeper
    // (checked after trySpawnEnemy so the enemy hint fires on the next spawn)
    if (this.tutorialStep === 1) {
      this.tutorialStep = 2;
      this.showTutorialHint('💰 Blocks can drop gold and gems — dig deeper for rarer ores!');
    }

    // Fortune upgrade multiplies ore gold
    const boostedGold = gold > 0 ? Math.round(gold * GameState.goldMultiplier) : 0;

    // Spawn physical drops that fly to the HUD counter. Currency is only
    // credited once each drop arrives (see update()).
    if (boostedGold > 0) {
      this.spawnGoldDrops(worldX, worldY, boostedGold);
      this.spawnFloatingText(worldX, worldY, `+${boostedGold}💰`, '#facc15');
    }
    if (diamonds > 0) {
      this.spawnDiamondDrops(worldX, worldY, diamonds);
      this.spawnFloatingText(worldX, worldY - 20, `+${diamonds}💎`, '#38bdf8');
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

  // ─── Enemy System ────────────────────────────────────────────────────────────

  private trySpawnEnemy(col: number, row: number, blockType: string): void {
    const depth = row * 3;
    if (!shouldEnemySpawn(blockType as any, depth)) return;

    const efficiency = this.currentEfficiency();
    const enemyType = getRandomEnemyForDepth(depth, efficiency);
    if (!enemyType) return;

    const key = this.enemyKey(col, row);
    if (this.enemies.has(key)) return;

    const x = col * BLOCK_SIZE + BLOCK_SIZE / 2;
    const y = row * BLOCK_SIZE + BLOCK_SIZE / 2;

    const enemy = new Enemy(this, x, y, col, row, enemyType, efficiency);
    enemy.setTargetPlayer(this.player);
    enemy.onPlayerHit = (damage) => this.damagePlayer(damage);
    this.enemies.set(key, enemy);

    // Spawn effect
    this.particles.setPosition(x, y);
    this.particles.setParticleTint(ENEMIES_CONFIG[enemyType].accentColor);
    this.particles.explode(12);

    // Tutorial: first enemy spawn → combat hint, and mark the tutorial done.
    if (this.tutorialStep === 2) {
      this.tutorialStep = 3;
      this.showTutorialHint('⚠️ A cave monster appeared — tap it to attack!');
      GameState.markTutorialDone();
    }
  }

  private tryAttackEnemy(worldX: number, worldY: number): boolean {
    if (this.isAttacking) return false;

    const col = Math.floor(worldX / BLOCK_SIZE);
    const row = Math.floor(worldY / BLOCK_SIZE);

    if (col < 0 || col >= COLS) return false;

    // Check if there's an enemy at or adjacent to this position
    const key = this.enemyKey(col, row);
    let enemy = this.enemies.get(key);

    // Also check adjacent positions (enemy might be slightly off-grid)
    if (!enemy) {
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const adjKey = this.enemyKey(col + dc, row + dr);
          const e = this.enemies.get(adjKey);
          if (e && !e.isDead) {
            const dist = Phaser.Math.Distance.Between(worldX, worldY, e.x, e.y);
            if (dist < BLOCK_SIZE * 0.8) {
              enemy = e;
              break;
            }
          }
        }
        if (enemy) break;
      }
    }

    if (!enemy || enemy.isDead) return false;

    // Check if player is adjacent to enemy
    const dx = Math.abs(col - this.player.gridX);
    const dy = Math.abs(row - this.player.gridY);
    const isAdjacent = (dx <= 1 && dy <= 1);

    if (!isAdjacent) return false;

    this.isAttacking = true;

    const damage = this.currentEfficiency(); // Base damage = effective efficiency

    const started = this.player.playSwingAnimation(
      enemy.x,
      () => {
        const result = enemy.takeDamage(damage, this.player.x, this.player.y);

        // Hit particles
        this.particles.setPosition(enemy.x, enemy.y);
        this.particles.setParticleTint(enemy.config.accentColor);
        this.particles.explode(8);

        if (result.dead) {
          this.onEnemyKilled(enemy, col, row, result.gold || 0, result.diamonds || 0);
        } else {
          GameState.triggerHaptic(15);
        }

        this.isAttacking = false;
      },
      GameState.swingSpeedMultiplier
    );

    if (!started) {
      // A previous swing is still recovering — abort cleanly.
      this.isAttacking = false;
      return false;
    }

    // Play swing sound
    if (GameState.soundEnabled) {
      Sound.play('pickaxe_swing');
    }

    return true;
  }

  private onEnemyKilled(enemy: Enemy, col: number, row: number, gold: number, diamonds: number): void {
    const worldX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
    const worldY = row * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Remove from map
    this.enemies.delete(this.enemyKey(col, row));

    // Rewards — physical drops fly to the HUD counters
    if (gold > 0) {
      this.spawnGoldDrops(worldX, worldY, gold);
      this.spawnFloatingText(worldX, worldY - 10, `+${gold}💰`, '#facc15');
    }
    if (diamonds > 0) {
      this.spawnDiamondDrops(worldX, worldY, diamonds);
      this.spawnFloatingText(worldX, worldY - 30, `+${diamonds}💎`, '#38bdf8');
    }

    // Defeat notification
    this.spawnFloatingText(worldX, worldY - 50, `💀 ${enemy.config.name} Defeated!`, '#ef4444');
  }

  // ─── Collectible Drops ───────────────────────────────────────────────────

  /** World-space position of a HUD counter, tracked as the camera moves. */
  private hudTarget(kind: CollectibleKind): { x: number; y: number } {
    const cam = this.cameras.main;
    const pos = kind === 'gold' ? HUD_GOLD_POS : HUD_DIAMOND_POS;
    return { x: cam.worldView.x + pos.x, y: cam.worldView.y + pos.y };
  }

  private spawnCollectible(
    x: number,
    y: number,
    kind: CollectibleKind,
    value: number,
    withSound: boolean
  ): void {
    const drop = new Collectible(
      this,
      x + Phaser.Math.Between(-8, 8),
      y - 6,
      kind,
      value,
      () => this.hudTarget(kind),
      withSound
    );
    this.collectibles.push(drop);
  }

  /** Splits gold into 1-5 visual coins, each carrying a share of the value. */
  private spawnGoldDrops(x: number, y: number, totalGold: number): void {
    if (totalGold <= 0) return;
    const count =
      totalGold >= 50 ? 5 : totalGold >= 25 ? 4 : totalGold >= 8 ? 3 : totalGold >= 3 ? 2 : 1;

    const base = Math.floor(totalGold / count);
    let remainder = totalGold - base * count;

    for (let i = 0; i < count; i++) {
      const value = base + (remainder-- > 0 ? 1 : 0);
      this.spawnCollectible(x, y, 'gold', value, i === 0);
    }
  }

  private spawnDiamondDrops(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnCollectible(x, y, 'diamond', 1, i === 0);
    }
  }

  private onCollectibleArrived(drop: Collectible): void {
    if (drop.kind === 'gold') {
      GameState.addGold(drop.value);
    } else {
      GameState.addDiamonds(drop.value);
    }

    if (drop.withSound && GameState.soundEnabled) {
      Sound.play(drop.kind === 'gold' ? 'gold_collect' : 'diamond_collect');
    }
  }

  /** Instantly banks all in-flight drops (e.g. when the run ends). */
  private flushCollectibles(): void {
    if (this.collectibles.length === 0) return;
    for (const drop of this.collectibles) {
      if (drop.kind === 'gold') {
        GameState.addGold(drop.value);
      } else {
        GameState.addDiamonds(drop.value);
      }
      drop.destroy();
    }
    this.collectibles = [];
  }

  private updateEnemies(): void {
    const camTop = this.cameras.main.worldView.top;
    const camBottom = this.cameras.main.worldView.bottom;
    const cullRowTop = Math.floor(camTop / BLOCK_SIZE) - 3;
    const cullRowBottom = Math.floor(camBottom / BLOCK_SIZE) + 3;

    for (const [key, enemy] of this.enemies) {
      if (enemy.isDead) {
        this.enemies.delete(key);
        continue;
      }

      // Cull off-screen enemies
      if (enemy.gridY < cullRowTop || enemy.gridY > cullRowBottom) {
        enemy.setVisible(false);
      } else {
        enemy.setVisible(true);
      }
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

  update(_time: number, delta: number): void {
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

    // Update enemies
    this.updateEnemies();

    // Advance collectible drops (burst -> magnet to HUD -> banked)
    const dt = delta / 1000;
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const drop = this.collectibles[i];
      if (drop.updateCollectible(dt)) {
        this.collectibles.splice(i, 1);
        this.onCollectibleArrived(drop);
        drop.destroy();
      }
    }
  }
}
