import { GameState } from '../core/GameState';
import { Sound } from '../core/SoundManager';

export type SaveTransferMode = 'export' | 'import';

interface SaveTransferOptions {
  /** Validates + applies a pasted code. Return true on success. */
  onImport?: (code: string) => boolean;
  /** Fired shortly after a successful import (scene transition hook). */
  onImported?: () => void;
}

const BTN_NEUTRAL = 'background:#1e293b;border:1.5px solid #475569;color:#e2e8f0;';
const BTN_AMBER = 'background:#78350f;border:1.5px solid #fbbf24;color:#fde68a;';
const BTN_GREEN = 'background:#14532d;border:1.5px solid #4ade80;color:#bbf7d0;';

/**
 * DOM overlay (not a Phaser scene object) for copying / pasting save codes.
 * A real <textarea> is used so mobile players get the native paste menu and
 * a working keyboard; it renders inside #game-container, above the canvas,
 * and blocks the Phaser input beneath it while open.
 */
export class SaveTransferOverlay {
  private root: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private status: HTMLDivElement;
  private options: SaveTransferOptions;
  private destroyed = false;

  constructor(mode: SaveTransferMode, options: SaveTransferOptions = {}) {
    this.options = options;

    const host = document.getElementById('game-container') ?? document.body;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.78);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;';

    const panel = document.createElement('div');
    panel.style.cssText =
      'width:292px;max-width:88%;box-sizing:border-box;background:#0f172a;border:2px solid #475569;' +
      'border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;';

    const title = document.createElement('div');
    title.textContent = mode === 'export' ? '📤 Export Save' : '📥 Import Save';
    title.style.cssText = 'color:#f8fafc;font-weight:700;font-size:17px;text-align:center;';

    const hint = document.createElement('div');
    hint.textContent =
      mode === 'export'
        ? 'Copy this code and keep it somewhere safe — paste it later to restore your progress.'
        : 'Paste a save code below to replace the current progress on this device.';
    hint.style.cssText = 'color:#94a3b8;font-size:12px;line-height:1.35;text-align:center;';

    this.textarea = document.createElement('textarea');
    this.textarea.rows = 5;
    this.textarea.spellcheck = false;
    this.textarea.style.cssText =
      'width:100%;box-sizing:border-box;resize:none;background:#1e293b;border:1px solid #334155;' +
      'border-radius:8px;color:#cbd5e1;font-size:11px;font-family:ui-monospace,Consolas,monospace;' +
      'line-height:1.4;padding:8px;word-break:break-all;outline:none;';
    if (mode === 'export') {
      this.textarea.value = GameState.exportSaveCode();
      this.textarea.readOnly = true;
      // Select-all on focus makes manual copying (Ctrl+C / long-press) one step.
      this.textarea.addEventListener('focus', () => this.textarea.select());
    }

    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#94a3b8;font-size:12px;text-align:center;min-height:14px;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;';

    const primary =
      mode === 'export'
        ? this.makeButton('📋 COPY', BTN_AMBER, () => void this.handleCopy())
        : this.makeButton('IMPORT', BTN_GREEN, () => this.handleImport());
    const secondary = this.makeButton(mode === 'export' ? 'DONE' : 'CANCEL', BTN_NEUTRAL, () =>
      this.destroy()
    );

    buttons.append(primary, secondary);
    panel.append(title, hint, this.textarea, this.status, buttons);
    this.root.append(panel);

    // Tapping the dim backdrop closes (same as the secondary button).
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.destroy();
    });

    host.appendChild(this.root);
  }

  private makeButton(label: string, style: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'flex:1;padding:10px 0;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;' +
      'font-family:inherit;' +
      style;
    btn.addEventListener('click', () => {
      GameState.haptic('tap');
      if (GameState.soundEnabled) Sound.play('ui_click');
      onClick();
    });
    return btn;
  }

  private async handleCopy(): Promise<void> {
    if (this.destroyed) return;
    const value = this.textarea.value;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Legacy fallback: select the text so Ctrl+C / long-press finishes the job.
      try {
        this.textarea.focus();
        this.textarea.select();
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    this.status.textContent = ok
      ? '✅ Copied to clipboard!'
      : 'Selected — copy manually (Ctrl+C or long-press).';
    this.status.style.color = ok ? '#4ade80' : '#fbbf24';
  }

  private handleImport(): void {
    if (this.destroyed) return;
    const code = this.textarea.value.trim();
    if (!code) {
      this.status.textContent = '⚠ Paste a save code first.';
      this.status.style.color = '#fbbf24';
      return;
    }
    const ok = this.options.onImport ? this.options.onImport(code) : false;
    if (!ok) {
      this.status.textContent = '⚠ That does not look like a valid save code.';
      this.status.style.color = '#f87171';
      return;
    }
    this.status.textContent = '✅ Save imported!';
    this.status.style.color = '#4ade80';
    window.setTimeout(() => {
      if (this.destroyed) return;
      this.destroy();
      if (this.options.onImported) this.options.onImported();
    }, 450);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.root.remove();
  }
}
