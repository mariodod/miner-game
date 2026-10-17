import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Sound } from '../core/SoundManager';
import type { SaveTransferMode } from './SaveTransferOverlay';

/**
 * Settings modal — sound / music / vibration / screen-shake toggles, a
 * tutorial replay button, and (menu-only) a guarded Reset Progress row.
 * Used from the main menu and the pause overlay.
 *
 * Every piece is a top-level, scroll-factor-0 object. Phaser hit-tests
 * children of a Container in registration order instead of visual order and
 * ignores the container's scroll factor, so nesting the dim + buttons would
 * let the full-screen dim swallow button taps (see AdRewardModal.ts).
 */
export class SettingsModal {
  private scene: Phaser.Scene;
  private onClose?: () => void;
  private onReset?: () => void;
  private onSaveTransfer?: (mode: SaveTransferMode) => void;
  private objects: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    onClose?: () => void,
    options?: {
      showReset?: boolean;
      onReset?: () => void;
      onSaveTransfer?: (mode: SaveTransferMode) => void;
    }
  ) {
    this.scene = scene;
    this.onClose = onClose;
    this.onReset = options?.onReset;
    this.onSaveTransfer = options?.onSaveTransfer;

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
    const dim = add(scene.add.graphics(), 2000);
    dim.fillStyle(0x000000, 0.82);
    dim.fillRect(0, 0, width, height);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    // Centered panel — taller when the menu-only reset row is included.
    const panelW = Math.min(width - 40, 320);
    const panelX = (width - panelW) / 2;
    const rowHeight = 52;
    const rowCount = options?.showReset ? 7 : 6;
    const panelH = 66 + rowCount * rowHeight + 42;
    const panelY = (height - panelH) / 2;

    const panel = add(scene.add.graphics(), 2000);
    panel.fillStyle(0x0f172a, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0x475569, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    add(
      scene.add
        .text(width / 2, panelY + 30, '⚙️ SETTINGS', {
          fontSize: '19px',
          fontStyle: 'bold',
          color: '#f8fafc',
          // Emoji headroom — color glyphs paint above the measured ascent
          padding: { top: 5, bottom: 1, left: 2, right: 2 },
        })
        .setOrigin(0.5),
      2000
    );

    // Close (X) button — above the dim so it always wins the hit test
    const closeBtn = add(
      scene.add
        .text(panelX + panelW - 22, panelY + 30, '✕', {
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#f87171',
          backgroundColor: '#1e293b',
          padding: { x: 7, y: 2 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true }),
      2001
    );
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#fca5a5' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#f87171' }));
    closeBtn.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      this.destroy();
      if (this.onClose) this.onClose();
    });

    // ── Toggle rows ──
    const rowsTop = panelY + 66;
    const rowY = (index: number) => rowsTop + rowHeight * index + rowHeight / 2;

    this.addToggleRow(
      panelX,
      panelW,
      rowY(0),
      '🔊 Sound Effects',
      () => GameState.soundEnabled,
      () => GameState.toggleSound()
    );

    this.addToggleRow(
      panelX,
      panelW,
      rowY(1),
      '🎵 Music',
      () => GameState.musicEnabled,
      () => {
        const on = GameState.toggleMusic();
        Sound.syncMusic(on);
        return on;
      }
    );

    this.addToggleRow(
      panelX,
      panelW,
      rowY(2),
      '📳 Vibration',
      () => GameState.hapticsEnabled,
      () => {
        const on = GameState.toggleHaptics();
        if (on) GameState.haptic('tap'); // feel the switch flip back on
        return on;
      }
    );

    this.addToggleRow(
      panelX,
      panelW,
      rowY(3),
      '🎬 Screen Shake',
      () => GameState.screenShakeEnabled,
      () => GameState.toggleScreenShake()
    );

    this.addTutorialRow(panelX, panelW, rowY(4));

    this.addSaveTransferRow(panelX, panelW, rowY(5));

    if (options?.showReset) {
      this.addResetRow(panelX, panelW, rowY(6));
    }

    // Fade in
    scene.tweens.add({ targets: this.objects, alpha: 1, duration: 180, ease: 'Power2' });
  }

  // ── Rows ──────────────────────────────────────────────────────────────────

  private addToggleRow(
    panelX: number,
    panelW: number,
    y: number,
    label: string,
    isOn: () => boolean,
    toggle: () => boolean
  ): void {
    const scene = this.scene;

    this.objects.push(
      scene.add
        .text(panelX + 22, y, label, { fontSize: '14px', color: '#e2e8f0' })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setAlpha(0)
        .setDepth(2000)
    );

    // Pill toggle on the right
    const pillW = 72;
    const pillH = 32;
    const pillX = panelX + panelW - 22 - pillW;
    const pillY = y - pillH / 2;

    const pill = scene.add.graphics();
    pill.setScrollFactor(0);
    pill.setAlpha(0);
    pill.setDepth(2001);
    pill.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(pillX, pillY, pillW, pillH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.drawPill(pill, pillX, pillY, pillW, pillH, isOn());
    this.objects.push(pill);

    const stateText = scene.add
      .text(pillX + pillW / 2, y, isOn() ? 'ON' : 'OFF', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(2001);
    this.objects.push(stateText);

    pill.on('pointerdown', () => {
      if (this.destroyed) return;
      const on = toggle();
      this.drawPill(pill, pillX, pillY, pillW, pillH, on);
      stateText.setText(on ? 'ON' : 'OFF');

      // Click feedback: audible only when sound ends up enabled (so turning
      // sound OFF is silent, and turning it ON confirms with a click).
      if (GameState.soundEnabled) Sound.play('ui_click');
    });
  }

  private addTutorialRow(panelX: number, panelW: number, y: number): void {
    const scene = this.scene;

    this.objects.push(
      scene.add
        .text(panelX + 22, y, '👆 Tutorial', { fontSize: '14px', color: '#e2e8f0' })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setAlpha(0)
        .setDepth(2000)
    );

    const btnW = 88;
    const btnH = 32;
    const btnX = panelX + panelW - 22 - btnW;
    const btnY = y - btnH / 2;

    const btn = scene.add.graphics();
    btn.setScrollFactor(0);
    btn.setAlpha(0);
    btn.setDepth(2001);
    btn.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.drawReplayButton(btn, btnX, btnY, btnW, btnH);
    this.objects.push(btn);

    const btnText = scene.add
      .text(btnX + btnW / 2, y, 'REPLAY', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(2001);
    this.objects.push(btnText);

    let resetTimer: Phaser.Time.TimerEvent | null = null;
    btn.on('pointerdown', () => {
      if (this.destroyed) return;
      GameState.resetTutorial();
      if (GameState.soundEnabled) Sound.play('ui_click');
      btnText.setText('✓ NEXT RUN').setColor('#4ade80');
      if (resetTimer) resetTimer.remove();
      resetTimer = scene.time.delayedCall(1400, () => {
        if (btnText.active) btnText.setText('REPLAY').setColor('#fbbf24');
      });
    });
  }

  /**
   * Destructive row — the first tap only arms the button ("SURE?"), a second
   * deliberate tap within the window wipes the save. A stray tap can never
   * erase progress.
   */
  private addResetRow(panelX: number, panelW: number, y: number): void {
    const scene = this.scene;

    this.objects.push(
      scene.add
        .text(panelX + 22, y, '🗑 Reset Progress', { fontSize: '14px', color: '#e2e8f0' })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setAlpha(0)
        .setDepth(2000)
    );

    const btnW = 88;
    const btnH = 32;
    const btnX = panelX + panelW - 22 - btnW;
    const btnY = y - btnH / 2;

    const btn = scene.add.graphics();
    btn.setScrollFactor(0);
    btn.setAlpha(0);
    btn.setDepth(2001);
    btn.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.drawResetButton(btn, btnX, btnY, btnW, btnH, false);
    this.objects.push(btn);

    const btnText = scene.add
      .text(btnX + btnW / 2, y, 'RESET', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fecaca',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(2001);
    this.objects.push(btnText);

    let armed = false;
    let armTimer: Phaser.Time.TimerEvent | null = null;

    btn.on('pointerdown', () => {
      if (this.destroyed) return;
      if (GameState.soundEnabled) Sound.play('ui_click');

      if (!armed) {
        armed = true;
        btnText.setText('SURE?').setColor('#ffffff');
        this.drawResetButton(btn, btnX, btnY, btnW, btnH, true);
        if (armTimer) armTimer.remove();
        armTimer = scene.time.delayedCall(2200, () => {
          armed = false;
          if (btnText.active) btnText.setText('RESET').setColor('#fecaca');
          if (btn.active) this.drawResetButton(btn, btnX, btnY, btnW, btnH, false);
        });
        return;
      }

      if (armTimer) armTimer.remove();
      GameState.resetProgress();
      this.destroy();
      if (this.onClose) this.onClose();
      if (this.onReset) this.onReset();
    });
  }

  /** Export/import save codes — backups and moving progress between devices. */
  private addSaveTransferRow(panelX: number, panelW: number, y: number): void {
    const scene = this.scene;

    this.objects.push(
      scene.add
        .text(panelX + 22, y, '💾 Save Data', { fontSize: '14px', color: '#e2e8f0' })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setAlpha(0)
        .setDepth(2000)
    );

    const btnW = 74;
    const btnH = 32;
    const importX = panelX + panelW - 22 - btnW;
    const exportX = importX - btnW - 8;

    this.addTransferButton(
      exportX,
      y - btnH / 2,
      btnW,
      btnH,
      'EXPORT',
      '#fde68a',
      0x78350f,
      0xfbbf24,
      () => this.onSaveTransfer?.('export')
    );
    this.addTransferButton(
      importX,
      y - btnH / 2,
      btnW,
      btnH,
      'IMPORT',
      '#bbf7d0',
      0x14532d,
      0x4ade80,
      () => this.onSaveTransfer?.('import')
    );
  }

  private addTransferButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    textColor: string,
    fill: number,
    border: number,
    onClick: () => void
  ): void {
    const scene = this.scene;

    const btn = scene.add.graphics();
    btn.setScrollFactor(0);
    btn.setAlpha(0);
    btn.setDepth(2001);
    btn.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(x, y, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    btn.fillStyle(fill, 1);
    btn.fillRoundedRect(x, y, w, h, 10);
    btn.lineStyle(1.5, border, 0.8);
    btn.strokeRoundedRect(x, y, w, h, 10);
    this.objects.push(btn);

    const btnText = scene.add
      .text(x + w / 2, y + h / 2, label, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: textColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(2001);
    this.objects.push(btnText);

    btn.on('pointerdown', () => {
      if (this.destroyed) return;
      GameState.haptic('tap');
      if (GameState.soundEnabled) Sound.play('ui_click');
      onClick();
    });
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────

  private drawPill(
    pill: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    on: boolean
  ): void {
    pill.clear();
    pill.fillStyle(on ? 0x16a34a : 0x334155, 1);
    pill.fillRoundedRect(x, y, w, h, h / 2);
    pill.lineStyle(1.5, on ? 0x4ade80 : 0x64748b, 0.9);
    pill.strokeRoundedRect(x, y, w, h, h / 2);
  }

  private drawReplayButton(
    btn: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    btn.clear();
    btn.fillStyle(0x78350f, 1);
    btn.fillRoundedRect(x, y, w, h, 10);
    btn.lineStyle(1.5, 0xfbbf24, 0.8);
    btn.strokeRoundedRect(x, y, w, h, 10);
  }

  private drawResetButton(
    btn: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    armed: boolean
  ): void {
    btn.clear();
    btn.fillStyle(armed ? 0xb91c1c : 0x7f1d1d, 1);
    btn.fillRoundedRect(x, y, w, h, 10);
    btn.lineStyle(1.5, armed ? 0xfca5a5 : 0xef4444, 0.8);
    btn.strokeRoundedRect(x, y, w, h, 10);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.objects.forEach((obj) => {
      if (obj.active) obj.destroy();
    });
    this.objects = [];
  }
}
