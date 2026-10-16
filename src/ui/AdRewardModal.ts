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
 * The browser build uses this simulated version; native builds play a real
 * AdMob video via AdManager.
 *
 * Every piece is a top-level, scroll-factor-0 object. Phaser hit-tests
 * children of a Container in registration order instead of visual order and
 * ignores the container's scroll factor, so nesting the dim + buttons would
 * let the full-screen dim swallow button taps (or offset their hit areas).
 */
export class AdRewardModal {
  private scene: Phaser.Scene;
  private options: AdRewardModalOptions;
  private objects: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];
  private timerText: Phaser.GameObjects.Text;
  private countdown: number = 3;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private finished = false;

  constructor(scene: Phaser.Scene, options: AdRewardModalOptions) {
    this.scene = scene;
    this.options = options;

    const { width, height } = scene.scale;

    const add = <T extends Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>(
      obj: T,
      depth: number
    ): T => {
      obj.setScrollFactor(0);
      obj.setAlpha(0);
      obj.setDepth(depth);
      this.objects.push(obj);
      return obj;
    };

    // Full-screen dimming background (blocks input to whatever is behind)
    const background = add(scene.add.graphics(), 2000);
    background.fillStyle(0x000000, 0.85);
    background.fillRect(0, 0, width, height);
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    // Centered panel
    const panelW = Math.min(width - 40, 340);
    const panelH = 220;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = add(scene.add.graphics(), 2000);
    panel.fillStyle(0x1e1b4b, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0x818cf8, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    add(
      scene.add
        .text(width / 2, panelY + 28, '📺 Rewarded Ad', {
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0.5),
      2000
    );

    add(
      scene.add
        .text(width / 2, panelY + 54, this.options.placement.replace('_', ' ').toUpperCase(), {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#a5b4fc',
          backgroundColor: '#312e81',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5),
      2000
    );

    add(
      scene.add
        .text(width / 2, panelY + 86, this.options.title, {
          fontSize: '14px',
          color: '#94a3b8',
          wordWrap: { width: panelW - 40 },
          align: 'center',
        })
        .setOrigin(0.5),
      2000
    );

    add(
      scene.add
        .text(width / 2, panelY + 122, this.options.rewardText, {
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#facc15',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5),
      2000
    );

    this.timerText = add(
      scene.add
        .text(width / 2, panelY + 158, `Simulated ad · ${this.countdown}s`, {
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#38bdf8',
        })
        .setOrigin(0.5),
      2000
    );

    // Cancel button (higher depth than the dim so it always wins the hit test)
    const cancelBtn = add(
      scene.add
        .text(width / 2, panelY + 190, 'Cancel', {
          fontSize: '13px',
          color: '#f87171',
          backgroundColor: '#1c1917',
          padding: { x: 16, y: 4 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true }),
      2001
    );

    cancelBtn.on('pointerover', () => cancelBtn.setStyle({ color: '#fca5a5' }));
    cancelBtn.on('pointerout', () => cancelBtn.setStyle({ color: '#f87171' }));
    cancelBtn.on('pointerdown', () => this.cancel());

    // Fade in, then start the countdown
    scene.tweens.add({
      targets: this.objects,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => this.startCountdown(),
    });
  }

  private startCountdown(): void {
    if (this.finished) return;
    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      repeat: this.countdown,
      callback: () => {
        this.countdown--;
        if (this.countdown > 0) {
          this.timerText.setText(`Simulated ad · ${this.countdown}s`);
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
      this.finish(() => this.options.onSuccess());
    });
  }

  private cancel(): void {
    this.finish(() => {
      if (this.options.onCancel) this.options.onCancel();
    });
  }

  private finish(action: () => void): void {
    if (this.finished) return;
    this.finished = true;

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
    this.objects.forEach((obj) => obj.destroy());
    this.objects = [];

    action();
  }
}
