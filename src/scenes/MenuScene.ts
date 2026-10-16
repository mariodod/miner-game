import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Sound } from '../core/SoundManager';
import { SettingsModal } from '../ui/SettingsModal';

export class MenuScene extends Phaser.Scene {
  private settingsModal: SettingsModal | null = null;

  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.settingsModal = null;
    GameState.startNewRun();

    // Keep the procedural music loop in sync with the saved preference
    Sound.syncMusic(GameState.musicEnabled);

    // ── Background gradient via graphics ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, width, height);

    // Procedural star field
    this.generateStars(width, height);

    // Underground horizon glow
    const glow = this.add.graphics();
    glow.fillGradientStyle(0x000000, 0x000000, 0x78350f, 0x78350f, 0, 0, 0.4, 0.4);
    glow.fillRect(0, height * 0.55, width, height * 0.45);

    // Pixel ground line
    const ground = this.add.graphics();
    ground.fillStyle(0x8b5a2b, 1);
    ground.fillRect(0, height * 0.62, width, 8);
    ground.fillStyle(0x64748b, 1);
    ground.fillRect(0, height * 0.62 + 8, width, height);

    // Title
    const title = this.add
      .text(width / 2, height * 0.22, '⛏️', { fontSize: '52px' })
      .setOrigin(0.5);
    const titleText = this.add
      .text(width / 2, height * 0.32, 'POCKET MINER', {
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#facc15',
        stroke: '#78350f',
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 3, color: '#000', blur: 6, fill: true },
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [title, titleText],
      y: '-=6',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Subtitle
    this.add
      .text(width / 2, height * 0.4, 'DIG · COLLECT · UPGRADE', {
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // High Score
    if (GameState.highScoreDepth > 0) {
      this.add
        .text(width / 2, height * 0.47, `🏆 Best Depth: ${GameState.highScoreDepth}m`, {
          fontSize: '13px',
          color: '#fcd34d',
        })
        .setOrigin(0.5);
    }

    // ── Play Button ──
    // Drawn centered on the graphics origin so hover scaling grows in place
    // (scaling a graphics whose origin sits at 0,0 shifts it instead).
    const btnY = height * 0.60;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0xf59e0b, 1);
    btnBg.fillRoundedRect(-80, -22, 160, 44, 22);
    btnBg.setPosition(width / 2, btnY);
    btnBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-80, -22, 160, 44),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    const btnText = this.add
      .text(width / 2, btnY, 'PLAY', {
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#1c1917',
      })
      .setOrigin(0.5);

    btnBg.on('pointerover', () => {
      this.tweens.add({ targets: [btnBg, btnText], scale: 1.05, duration: 80 });
    });
    btnBg.on('pointerout', () => {
      this.tweens.add({ targets: [btnBg, btnText], scale: 1.0, duration: 80 });
    });
    btnBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.tweens.add({
        targets: [btnBg, btnText],
        scale: 0.92,
        duration: 60,
        yoyo: true,
        onComplete: () => this.scene.start('GameScene'),
      });
    });

    // ── Shop Button ──
    const shopBtnY = btnY + 58;
    const shopBg = this.add.graphics();
    shopBg.fillStyle(0x1e293b, 1);
    shopBg.lineStyle(2, 0x64748b, 1);
    shopBg.fillRoundedRect(-70, -18, 140, 36, 18);
    shopBg.strokeRoundedRect(-70, -18, 140, 36, 18);
    shopBg.setPosition(width / 2, shopBtnY);
    shopBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-70, -18, 140, 36),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    shopBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.scene.start('ShopScene');
    });

    const shopText = this.add
      .text(width / 2, shopBtnY, '🛒 SHOP', {
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    shopBg.on('pointerover', () => {
      this.tweens.add({ targets: [shopBg, shopText], scale: 1.04, duration: 80 });
    });
    shopBg.on('pointerout', () => {
      this.tweens.add({ targets: [shopBg, shopText], scale: 1.0, duration: 80 });
    });

    // Currency row
    this.add
      .text(width / 2, height * 0.84, `💰 ${GameState.gold}   💎 ${GameState.diamonds}`, {
        fontSize: '15px',
        color: '#e2e8f0',
        backgroundColor: '#0f172a',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);

    // ── Settings Button (top-right) ──
    const gearBg = this.add.circle(width - 28, 28, 18, 0x1e293b, 0.92);
    gearBg.setStrokeStyle(1.5, 0x64748b);
    gearBg.setInteractive({ useHandCursor: true });
    gearBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      if (this.settingsModal) return;
      this.settingsModal = new SettingsModal(this, () => {
        this.settingsModal = null;
      });
    });
    // Padding keeps the emoji glyph inside the text canvas — color emoji
    // paint slightly above the measured ascent and get their top clipped.
    const gearIcon = this.add
      .text(width - 28, 28, '⚙️', {
        fontSize: '18px',
        padding: { top: 6, bottom: 2, left: 2, right: 2 },
      })
      .setOrigin(0.5);
    gearBg.on('pointerover', () => {
      this.tweens.add({ targets: [gearBg, gearIcon], scale: 1.1, duration: 80 });
    });
    gearBg.on('pointerout', () => {
      this.tweens.add({ targets: [gearBg, gearIcon], scale: 1.0, duration: 80 });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsModal?.destroy();
      this.settingsModal = null;
    });

    // Version tag
    this.add
      .text(width - 8, height - 8, 'v0.2', {
        fontSize: '10px',
        color: '#475569',
      })
      .setOrigin(1, 1);
  }

  private generateStars(width: number, height: number): void {
    const g = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height * 0.55);
      const size = Phaser.Math.FloatBetween(0.5, 2.0);
      const alpha = Phaser.Math.FloatBetween(0.3, 1.0);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x, y, size);
    }
  }
}
