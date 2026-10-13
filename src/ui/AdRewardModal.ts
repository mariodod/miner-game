import Phaser from 'phaser';

export interface AdRewardModalOptions {
  placement: 'double_gold' | 'revive' | 'free_chest';
  title: string;
  rewardText: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

/**
 * Rewarded Ad Modal — Phaser-native overlay for voluntary rewarded ads.
 * Replaces the HTML-based simulation in AdManager for a seamless in-game experience.
 */
export class AdRewardModal extends Phaser.GameObjects.Container {
  private options: AdRewardModalOptions;
  private background: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Graphics;
  private timerText: Phaser.GameObjects.Text;
  private countdown: number = 3;
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, options: AdRewardModalOptions) {
    super(scene, 0, 0);
    this.options = options;

    this.setScrollFactor(0);
    this.setDepth(2000);
    this.setAlpha(0);

    const { width, height } = scene.scale;

    // Full-screen dimming background
    this.background = scene.add.graphics();
    this.background.fillStyle(0x000000, 0.85);
    this.background.fillRect(0, 0, width, height);
    this.background.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.add(this.background);

    // Centered panel
    const panelW = Math.min(width - 40, 340);
    const panelH = 220;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    this.panel = scene.add.graphics();
    this.panel.fillStyle(0x1e1b4b, 1);
    this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.panel.lineStyle(2, 0x818cf8, 1);
    this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.add(this.panel);

    // Title
    const titleText = scene.add.text(
      width / 2,
      panelY + 28,
      '📺 Rewarded Ad',
      { fontSize: '20px', fontStyle: 'bold', color: '#f8fafc' }
    ).setOrigin(0.5);
    this.add(titleText);

    // Placement badge
    const badgeText = scene.add.text(
      width / 2,
      panelY + 54,
      this.options.placement.replace('_', ' ').toUpperCase(),
      { fontSize: '12px', fontStyle: 'bold', color: '#a5b4fc', backgroundColor: '#312e81', padding: { x: 8, y: 3 } }
    ).setOrigin(0.5);
    this.add(badgeText);

    // Description
    const descText = scene.add.text(
      width / 2,
      panelY + 86,
      this.options.title,
      { fontSize: '14px', color: '#94a3b8', wordWrap: { width: panelW - 40 }, align: 'center' }
    ).setOrigin(0.5);
    this.add(descText);

    // Reward preview
    const rewardText = scene.add.text(
      width / 2,
      panelY + 122,
      this.options.rewardText,
      { fontSize: '18px', fontStyle: 'bold', color: '#facc15', stroke: '#000000', strokeThickness: 2 }
    ).setOrigin(0.5);
    this.add(rewardText);

    // Timer
    this.timerText = scene.add.text(
      width / 2,
      panelY + 158,
      `Ad playing... (${this.countdown}s)`,
      { fontSize: '16px', fontStyle: 'bold', color: '#38bdf8' }
    ).setOrigin(0.5);
    this.add(this.timerText);

    // Cancel button
    const cancelBtn = scene.add.text(
      width / 2,
      panelY + 190,
      'Cancel',
      { fontSize: '13px', color: '#f87171', backgroundColor: '#1c1917', padding: { x: 16, y: 4 } }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });

    cancelBtn.on('pointerover', () => cancelBtn.setStyle({ color: '#fca5a5' }));
    cancelBtn.on('pointerout', () => cancelBtn.setStyle({ color: '#f87171' }));
    cancelBtn.on('pointerdown', () => this.cancel());

    this.add(cancelBtn);

    scene.add.existing(this);

    // Fade in
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => this.startCountdown(),
    });
  }

  private startCountdown(): void {
    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      repeat: this.countdown,
      callback: () => {
        this.countdown--;
        if (this.countdown > 0) {
          this.timerText.setText(`Ad playing... (${this.countdown}s)`);
        } else {
          this.complete();
        }
      },
    });
  }

  private complete(): void {
    this.timerText.setText('✅ Reward Earned!');
    this.timerText.setColor('#4ade80');

    this.scene.time.delayedCall(600, () => {
      this.destroy(true);
      this.options.onSuccess();
    });
  }

  private cancel(): void {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
    this.destroy(true);
    if (this.options.onCancel) this.options.onCancel();
  }

  public destroy(fromScene?: boolean): void {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
    super.destroy(fromScene);
  }
}