import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Sound } from '../core/SoundManager';
import { SettingsModal } from '../ui/SettingsModal';
import type { GameScene } from './GameScene';

/**
 * Pause overlay — launched on top of a paused GameScene.
 * Living in its own scene means the frozen run keeps its last rendered frame
 * while this overlay stays fully interactive (GameScene update/tweens/timers
 * are all halted by Scene.pause()).
 */
export class PauseScene extends Phaser.Scene {
  private pieces: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];
  private settingsModal: SettingsModal | null = null;

  constructor() {
    super({ key: 'PauseScene', active: false });
  }

  create() {
    this.pieces = [];
    this.settingsModal = null;

    const { width, height } = this.scale;

    const add = <T extends Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>(
      obj: T,
      depth: number
    ): T => {
      obj.setScrollFactor(0);
      obj.setAlpha(0);
      obj.setDepth(depth);
      this.pieces.push(obj);
      return obj;
    };

    // Full-screen dim (blocks taps to anything behind the overlay)
    const dim = add(this.add.graphics(), 0);
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, width, height);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    // Pause freezes GameScene, but HUDScene keeps running — silence its input
    // so taps can't reach the pickaxe badge behind the dim.
    const hudScene = this.scene.get('HUDScene');
    if (hudScene) hudScene.input.enabled = false;

    // Centered panel
    const panelW = 280;
    const panelH = 276;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = add(this.add.graphics(), 1);
    panel.fillStyle(0x0f172a, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0x475569, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    add(
      this.add
        .text(width / 2, panelY + 34, '⏸ PAUSED', {
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0.5),
      2
    );

    add(
      this.add
        .text(
          width / 2,
          panelY + 62,
          `Depth ${GameState.currentDepth}m · 💰 ${GameState.runGoldCollected} this run`,
          { fontSize: '12px', color: '#94a3b8' }
        )
        .setOrigin(0.5),
      2
    );

    this.addButton(panelX + 20, panelY + 92, panelW - 40, 48, 0x16a34a, 0x22c55e, '▶ RESUME', 16, () =>
      this.resumeRun()
    );

    this.addButton(panelX + 20, panelY + 152, panelW - 40, 44, 0x334155, 0x64748b, '⚙️ SETTINGS', 14, () =>
      this.openSettings()
    );

    this.addButton(panelX + 20, panelY + 208, panelW - 40, 44, 0x7f1d1d, 0xef4444, '🏁 QUIT RUN', 14, () =>
      this.quitRun()
    );

    // Esc resumes (desktop convenience; the game uses tap controls)
    this.input.keyboard?.on('keydown-ESC', () => this.resumeRun());

    // Cleanup: re-enable HUD input and drop the settings modal
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsModal?.destroy();
      this.settingsModal = null;
      const hud = this.scene.get('HUDScene');
      if (hud) hud.input.enabled = true;
    });

    // Fade in
    this.tweens.add({ targets: this.pieces, alpha: 1, duration: 180, ease: 'Power2' });
  }

  private addButton(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    stroke: number,
    label: string,
    fontSize: number,
    onClick: () => void
  ): void {
    const bg = this.add.graphics();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(1.5, stroke, 0.9);
    bg.strokeRoundedRect(x, y, w, h, 10);
    bg.setScrollFactor(0);
    bg.setAlpha(0);
    bg.setDepth(2);
    bg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(x, y, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    bg.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      onClick();
    });
    this.pieces.push(bg);

    const text = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(3);
    this.pieces.push(text);
  }

  private resumeRun(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private openSettings(): void {
    if (this.settingsModal) return;
    this.settingsModal = new SettingsModal(this, () => {
      this.settingsModal = null;
    });
  }

  private quitRun(): void {
    const gameScene = this.scene.get('GameScene') as GameScene;
    this.scene.stop();
    gameScene.quitRun();
  }
}
