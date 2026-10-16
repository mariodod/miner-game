import Phaser from 'phaser';
import { GameState, PLAYER_MAX_HP } from '../core/GameState';
import { PICKAXES_CONFIG, PickaxeId } from '../config/pickaxes';
import { Sound } from '../core/SoundManager';

/**
 * Screen-space positions of the HUD currency counters.
 * GameScene uses these as homing targets for collectible drops.
 */
export const HUD_GOLD_POS = { x: 125, y: 34 };
export const HUD_DIAMOND_POS = { x: 225, y: 34 };

export class HUD extends Phaser.GameObjects.Container {
  private depthText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private diamondText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;
  private pickaxeBadge: Phaser.GameObjects.Container;
  private pickaxeIcon: Phaser.GameObjects.Sprite;
  private pickaxeLabel: Phaser.GameObjects.Text;

  private unsubs: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    const width = scene.scale.width;

    // Fixed to screen viewport
    this.setScrollFactor(0);
    this.setDepth(1000);

    // Top Header Banner
    const bg = scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.88);
    bg.fillRoundedRect(8, 8, width - 16, 52, 12);
    bg.lineStyle(1, 0x334155, 0.8);
    bg.strokeRoundedRect(8, 8, width - 16, 52, 12);
    this.add(bg);

    // Depth Counter
    const depthIcon = scene.add.text(20, 24, '📍', { fontSize: '16px' });
    this.depthText = scene.add.text(42, 24, '0m', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    this.add(depthIcon);
    this.add(this.depthText);

    // Gold Counter
    const goldIcon = scene.add.sprite(HUD_GOLD_POS.x, HUD_GOLD_POS.y, 'coin_icon');
    goldIcon.setScale(0.8);
    this.goldText = scene.add.text(142, 24, `${GameState.gold}`, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#fbbf24',
    });
    this.add(goldIcon);
    this.add(this.goldText);

    // Diamond Counter
    const gemIcon = scene.add.sprite(HUD_DIAMOND_POS.x, HUD_DIAMOND_POS.y, 'diamond_icon');
    gemIcon.setScale(0.8);
    this.diamondText = scene.add.text(242, 24, `${GameState.diamonds}`, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });
    this.add(gemIcon);
    this.add(this.diamondText);

    // Player HP (transient run health) — hearts under the banner
    this.hpText = scene.add.text(14, 62, `❤️ ${GameState.playerHp}/${PLAYER_MAX_HP}`, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f87171',
      backgroundColor: '#0f172a',
      padding: { x: 6, y: 3 },
    });
    this.add(this.hpText);

    // Equipped Pickaxe Badge (clickable to go to Shop)
    this.pickaxeBadge = scene.add.container(width - 45, 34);
    const badgeBg = scene.add.circle(0, 0, 18, 0x1e293b, 1);
    badgeBg.setStrokeStyle(1.5, 0x64748b);
    this.pickaxeBadge.add(badgeBg);

    const currentPickaxeConfig = PICKAXES_CONFIG[GameState.equippedPickaxe];
    this.pickaxeIcon = scene.add.sprite(0, 0, `pickaxe_${GameState.equippedPickaxe}`);
    this.pickaxeIcon.setScale(0.7);
    this.pickaxeBadge.add(this.pickaxeIcon);

    this.pickaxeLabel = scene.add
      .text(0, 22, `⚡ ${GameState.getEffectiveEfficiency(currentPickaxeConfig.efficiency)}`, {
        fontSize: '9px',
        color: '#94a3b8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pickaxeBadge.add(this.pickaxeLabel);

    // Tap the badge to open the Shop; pause the run so it resumes after.
    badgeBg.setInteractive({ useHandCursor: true });
    badgeBg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.scene.scene.pause('GameScene');
      this.scene.scene.start('ShopScene', { returnTo: 'game' });
    });

    this.add(this.pickaxeBadge);

    scene.add.existing(this);

    // Event Listeners
    this.unsubs.push(
      GameState.on('depthChanged', (depth: number) => {
        this.depthText.setText(`${depth}m`);
      })
    );

    this.unsubs.push(
      GameState.on('goldChanged', (gold: number) => {
        this.goldText.setText(`${gold}`);
        this.pulseText(this.goldText);
      })
    );

    this.unsubs.push(
      GameState.on('diamondsChanged', (diamonds: number) => {
        this.diamondText.setText(`${diamonds}`);
        this.pulseText(this.diamondText);
      })
    );

    this.unsubs.push(
      GameState.on('playerHpChanged', (hp: number) => {
        this.hpText.setText(`❤️ ${hp}/${PLAYER_MAX_HP}`);
        this.pulseText(this.hpText);
      })
    );

    this.unsubs.push(
      GameState.on('pickaxeChanged', (pickaxeId: PickaxeId) => {
        const pConfig = PICKAXES_CONFIG[pickaxeId];
        this.pickaxeIcon.setTexture(`pickaxe_${pickaxeId}`);
        this.pickaxeLabel.setText(`⚡ ${GameState.getEffectiveEfficiency(pConfig.efficiency)}`);
      })
    );

    this.unsubs.push(
      GameState.on('upgradesChanged', () => {
        const pConfig = PICKAXES_CONFIG[GameState.equippedPickaxe];
        this.pickaxeLabel.setText(`⚡ ${GameState.getEffectiveEfficiency(pConfig.efficiency)}`);
      })
    );
  }

  private pulseText(target: Phaser.GameObjects.Text): void {
    this.scene.tweens.killTweensOf(target);
    this.scene.tweens.add({
      targets: target,
      scale: 1.25,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  public destroy(fromScene?: boolean): void {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    super.destroy(fromScene);
  }
}
