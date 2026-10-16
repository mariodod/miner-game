import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Ads } from '../core/AdManager';
import { Sound } from '../core/SoundManager';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    const { width, height } = this.scale;
    const depth = GameState.currentDepth;
    const gold = GameState.runGoldCollected;
    const diamonds = GameState.runDiamondsCollected;
    const blocks = GameState.runBlocksBroken;
    const isHighScore = depth > 0 && depth >= GameState.highScoreDepth;

    // Play game over or level up sound
    if (GameState.soundEnabled) {
      if (isHighScore) {
        Sound.play('level_up');
      } else {
        Sound.play('game_over');
      }
    }

    // Dark overlay background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, width, height);
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x1e1b4b, 1);
    bg.fillRect(0, 0, width, height);

    // Card panel
    const cardX = width / 2 - 140;
    const cardY = 70;
    const cardW = 280;
    const cardH = height - 140;
    const card = this.add.graphics();
    card.fillStyle(0x1e293b, 0.95);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 20);
    card.lineStyle(2, 0x334155, 1);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 20);

    // Title
    const titleText = isHighScore ? '🏆 NEW RECORD!' : '💀 RUN OVER';
    const titleColor = isHighScore ? '#fde047' : '#f87171';
    this.add
      .text(width / 2, cardY + 32, titleText, {
        fontSize: '22px',
        fontStyle: 'bold',
        color: titleColor,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    if (isHighScore) {
      const sparkle = this.add
        .text(width / 2, cardY + 32, '✨', { fontSize: '28px' })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({
        targets: sparkle,
        alpha: 1,
        y: cardY + 10,
        duration: 600,
        ease: 'Back.easeOut',
      });
    }

    // Divider
    this.add.graphics().fillStyle(0x334155, 1).fillRect(cardX + 20, cardY + 54, cardW - 40, 1);

    // Stats grid
    const statY = cardY + 72;
    const statSpacing = 52;
    const stats = [
      { icon: '📍', label: 'Depth Reached', value: `${depth}m` },
      { icon: '💰', label: 'Gold Collected', value: `${gold}` },
      { icon: '💎', label: 'Diamonds Found', value: `${diamonds}` },
      { icon: '🪨', label: 'Blocks Broken', value: `${blocks}` },
    ];

    stats.forEach((stat, i) => {
      const y = statY + i * statSpacing;

      // Icon circle bg
      const circle = this.add.graphics();
      circle.fillStyle(0x0f172a, 1);
      circle.fillCircle(cardX + 36, y + 18, 18);

      const icon = this.add.text(cardX + 36, y + 18, stat.icon, { fontSize: '14px' }).setOrigin(0.5);
      const label = this.add
        .text(cardX + 62, y + 10, stat.label, { fontSize: '11px', color: '#94a3b8' });
      const value = this.add
        .text(cardX + 62, y + 24, stat.value, {
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#f1f5f9',
        });

      // Animated reveal
      [circle, icon, label, value].forEach((obj) => {
        this.add.existing(obj as Phaser.GameObjects.GameObject);
        obj.setAlpha(0);
        this.tweens.add({
          targets: obj,
          alpha: 1,
          x: `+=0`,
          delay: 100 + i * 90,
          duration: 280,
          ease: 'Power1',
        });
      });
    });

    // ── Double Gold (Ad) Button ──
    const adBtnY = cardY + cardH - 130;
    if (gold > 0) {
      const adBg = this.add.graphics();
      adBg.fillStyle(0xd97706, 1);
      adBg.fillRoundedRect(cardX + 16, adBtnY, cardW - 32, 44, 12);
      adBg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(cardX + 16, adBtnY, cardW - 32, 44),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });

      const adText = this.add
        .text(width / 2, adBtnY + 22, '📺 Watch Ad → 2× Gold', {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#1c1917',
        })
        .setOrigin(0.5);

      let adUsed = false;
      adBg.on('pointerdown', () => {
        if (adUsed) return;
        if (GameState.soundEnabled) Sound.play('ui_click');
        Ads.showRewardedAd(
          this,
          'double_gold',
          'Watch a short ad to double your run gold!',
          `+${gold} bonus gold`,
          () => {
            adUsed = true;
            GameState.doubleRunGold();
            adText.setText(`✅ +${gold} Gold Added!`);
            adBg.fillStyle(0x16a34a, 1);
            adBg.fillRoundedRect(cardX + 16, adBtnY, cardW - 32, 44, 12);
          }
        );
      });
    }

    // ── Play Again Button ──
    const playBtnY = cardY + cardH - 78;
    const playBg = this.add.graphics();
    playBg.fillStyle(0x2563eb, 1);
    playBg.fillRoundedRect(cardX + 16, playBtnY, cardW - 32, 40, 12);
    playBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(cardX + 16, playBtnY, cardW - 32, 40),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    playBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.scene.start('GameScene');
    });

    this.add
      .text(width / 2, playBtnY + 20, '⛏ PLAY AGAIN', {
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    // ── Menu Button ──
    const menuBtnY = cardY + cardH - 30;
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x334155, 0.8);
    menuBg.fillRoundedRect(cardX + 16, menuBtnY, cardW - 32, 28, 8);
    menuBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(cardX + 16, menuBtnY, cardW - 32, 28),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    menuBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.scene.start('MenuScene');
    });

    this.add
      .text(width / 2, menuBtnY + 14, 'MAIN MENU', {
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
  }
}
