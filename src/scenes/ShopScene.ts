import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { PICKAXES_CONFIG, PickaxeId, PickaxeType } from '../config/pickaxes';
import { SKINS_CONFIG, UPGRADES_CONFIG } from '../config/economy';
import { Sound } from '../core/SoundManager';
import { Ads } from '../core/AdManager';

type ShopTab = 'pickaxes' | 'upgrades' | 'skins';

const PICKAXE_TYPE_LABELS: Record<PickaxeType, string> = {
  standard: 'Standard',
  horizontal_cleaver: 'Cleave L+R',
  vertical_pulverizer: 'Piledriver',
  explosive: 'Explosive',
};

interface ScrollItem {
  centerY: number; // local y inside the content container
  enabled: boolean;
  enable: () => void;
  disable: () => void;
}

interface ShopPill {
  container: Phaser.GameObjects.Container;
  enable: () => void;
  disable: () => void;
  nudge: () => void;
}

interface PillStyle {
  fill: number;
  border: number;
  textColor: string;
}

/** Shared pill palette (matches the HUD/settings pill language). */
const PILL: Record<
  'neutral' | 'blue' | 'green' | 'amber' | 'cyan' | 'dim' | 'badgeBlue' | 'badgeGreen',
  PillStyle
> = {
  neutral: { fill: 0x1e293b, border: 0x64748b, textColor: '#cbd5e1' },
  blue: { fill: 0x1e40af, border: 0x3b82f6, textColor: '#dbeafe' },
  green: { fill: 0x166534, border: 0x4ade80, textColor: '#bbf7d0' },
  amber: { fill: 0x78350f, border: 0xfbbf24, textColor: '#fde68a' },
  cyan: { fill: 0x0c4a6e, border: 0x38bdf8, textColor: '#bae6fd' },
  dim: { fill: 0x0f172a, border: 0x334155, textColor: '#64748b' },
  badgeBlue: { fill: 0x1e3a8a, border: 0x3b82f6, textColor: '#93c5fd' },
  badgeGreen: { fill: 0x14532d, border: 0x4ade80, textColor: '#86efac' },
};

export class ShopScene extends Phaser.Scene {
  private activeTab: ShopTab = 'pickaxes';
  private returnTo: 'menu' | 'game' = 'menu';

  // ── Scroll state ──
  private content!: Phaser.GameObjects.Container;
  private contentViewTop = 96;
  private contentViewBottom = 0;
  private contentHeight = 0;
  private lastContentBottom = 0;
  private scrollMinY = 0;
  private persistedScrollOffset = 0; // ≤ 0 px, survives scene restarts
  private chestReward: number | null = null; // last free-chest reward (shown on the card)
  private scrollItems: ScrollItem[] = [];
  private scrollbarGfx!: Phaser.GameObjects.Graphics;
  private scrollHint!: Phaser.GameObjects.Text;
  private isDragging = false;
  private dragStartY = 0;
  private contentStartY = 0;
  /** Blocks re-entrant buy/back actions while a delayed restart is pending. */
  private actionLock = false;

  constructor() {
    super('ShopScene');
  }

  init(data?: { returnTo?: 'menu' | 'game' }) {
    this.returnTo = data?.returnTo === 'game' ? 'game' : 'menu';
  }

  create() {
    const { width, height } = this.scale;
    this.scrollItems = [];
    this.actionLock = false;

    // Dark background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1a0d2e, 0x1a0d2e, 1);
    bg.fillRect(0, 0, width, height);

    // ── Header ──
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x0f172a, 1);
    headerBg.fillRect(0, 0, width, 56);
    headerBg.lineStyle(1, 0x334155, 1);
    headerBg.lineBetween(0, 56, width, 56);

    this.add
      .text(width / 2, 28, '🛒 SHOP', {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    // Back Button (resumes the run when the shop was opened mid-game)
    const backLabel = this.returnTo === 'game' ? '← Mine' : '← Menu';
    this.createPillButton({
      x: 16,
      y: 28,
      anchor: 'left',
      label: backLabel,
      ...PILL.neutral,
      onClick: () => {
        if (this.actionLock) return;
        this.actionLock = true;
        if (GameState.soundEnabled) Sound.play('ui_click');
        if (this.returnTo === 'game') {
          this.scene.resume('GameScene');
          this.scene.launch('HUDScene');
          this.scene.stop();
        } else {
          this.scene.start('MenuScene');
        }
      },
    });

    // Currency display top-right (pill)
    const currency = this.add
      .text(width - 24, 28, `💰 ${GameState.gold}  💎 ${GameState.diamonds}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setOrigin(1, 0.5)
      .setDepth(6);
    const currencyBg = this.add.graphics().setDepth(5);
    const cw = currency.width + 24;
    const ch = 24;
    currencyBg.fillStyle(0x1e293b, 1);
    currencyBg.fillRoundedRect(width - 12 - cw, 28 - ch / 2, cw, ch, ch / 2);
    currencyBg.lineStyle(1, 0x334155, 1);
    currencyBg.strokeRoundedRect(width - 12 - cw, 28 - ch / 2, cw, ch, ch / 2);

    // ── Tabs ──
    const tabY = 72;
    const tabCenters: Array<{ tab: ShopTab; label: string }> = [
      { tab: 'pickaxes', label: '⛏ Pickaxes' },
      { tab: 'upgrades', label: '⚡ Upgrades' },
      { tab: 'skins', label: '👷 Skins' },
    ];
    tabCenters.forEach((entry, i) => {
      const isActive = this.activeTab === entry.tab;
      this.createPillButton({
        x: width * ((i + 0.5) / 3),
        y: tabY,
        label: entry.label,
        minWidth: 104,
        interactive: !isActive,
        ...(isActive ? PILL.blue : PILL.neutral),
        onClick: () => {
          if (this.actionLock) return;
          if (GameState.soundEnabled) Sound.play('ui_click');
          this.activeTab = entry.tab;
          this.persistedScrollOffset = 0;
          this.scene.restart({ returnTo: this.returnTo });
        },
      });
    });

    // ── Scrollable content ──
    this.contentViewTop = 94;
    this.contentViewBottom = height - 12;
    this.content = this.add.container(0, this.contentViewTop);

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, this.contentViewTop, width, this.contentViewBottom - this.contentViewTop);
    this.content.setMask(maskShape.createGeometryMask());

    this.renderTab(this.activeTab, width);

    // Scroll hint + scrollbar (fixed overlays)
    this.scrollHint = this.add
      .text(width / 2, height - 4, '↕ Drag to scroll', {
        fontSize: '10px',
        color: '#64748b',
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.scrollbarGfx = this.add.graphics().setDepth(500);

    this.setupScroll();
    this.setupInput();
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────

  private renderTab(tab: ShopTab, width: number): void {
    this.lastContentBottom = 8;

    if (tab === 'pickaxes') {
      this.renderPickaxeTab(width);
    } else if (tab === 'upgrades') {
      this.renderUpgradesTab(width);
    } else {
      this.renderSkinsTab(width);
    }
  }

  // ─── Scrolling ───────────────────────────────────────────────────────────

  private setupScroll(): void {
    const viewH = this.contentViewBottom - this.contentViewTop;
    this.contentHeight = this.lastContentBottom + 8;
    const overflow = Math.max(0, this.contentHeight - viewH);

    this.scrollMinY = this.contentViewTop - overflow;
    this.scrollHint.setVisible(overflow > 0);
    this.setScrollOffset(this.persistedScrollOffset);
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragStartY = pointer.y;
      this.contentStartY = this.content.y;
      this.isDragging = false;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dy = pointer.y - this.dragStartY;
      if (!this.isDragging) {
        if (Math.abs(dy) < 7) return;
        this.isDragging = true;
      }
      this.setScrollY(this.contentStartY + dy);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Mouse wheel support (desktop / emulator)
    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        this.setScrollY(this.content.y - dy * 0.6);
      }
    );
  }

  /** Clamped absolute container y (used while dragging). */
  private setScrollY(y: number): void {
    this.content.y = Phaser.Math.Clamp(y, this.scrollMinY, this.contentViewTop);
    this.persistedScrollOffset = this.content.y - this.contentViewTop;
    this.updateInteractivity();
    this.drawScrollbar();
  }

  /** Applies a relative offset (≤ 0) from the top of the view. */
  private setScrollOffset(offset: number): void {
    const clamped = Phaser.Math.Clamp(offset, this.scrollMinY - this.contentViewTop, 0);
    this.content.y = this.contentViewTop + clamped;
    this.persistedScrollOffset = clamped;
    this.updateInteractivity();
    this.drawScrollbar();
  }

  /** Enables only the buttons currently inside the visible viewport. */
  private updateInteractivity(): void {
    for (const item of this.scrollItems) {
      const worldY = this.content.y + item.centerY;
      const shouldEnable =
        worldY > this.contentViewTop - 40 && worldY < this.contentViewBottom + 40;
      if (shouldEnable && !item.enabled) {
        item.enable();
        item.enabled = true;
      } else if (!shouldEnable && item.enabled) {
        item.disable();
        item.enabled = false;
      }
    }
  }

  private drawScrollbar(): void {
    this.scrollbarGfx.clear();
    const viewH = this.contentViewBottom - this.contentViewTop;
    const overflow = this.contentHeight - viewH;
    if (overflow <= 0) return;

    const trackX = this.scale.width - 5;
    const trackTop = this.contentViewTop + 4;
    const trackH = viewH - 8;
    const thumbH = Math.max(28, trackH * (viewH / this.contentHeight));
    const progress = (this.contentViewTop - this.content.y) / overflow;
    const thumbY = trackTop + Phaser.Math.Clamp(progress, 0, 1) * (trackH - thumbH);

    this.scrollbarGfx.fillStyle(0x475569, 0.35);
    this.scrollbarGfx.fillRoundedRect(trackX, trackTop, 3, trackH, 2);
    this.scrollbarGfx.fillStyle(0x94a3b8, 0.8);
    this.scrollbarGfx.fillRoundedRect(trackX, thumbY, 3, thumbH, 2);
  }

  /** Restarts the scene, keeping the active tab and scroll position. */
  private restartShop(): void {
    if (this.content) {
      this.persistedScrollOffset = this.content.y - this.contentViewTop;
    }
    this.scene.restart({ returnTo: this.returnTo });
  }

  private registerScrollItem(centerY: number, enable: () => void, disable: () => void): void {
    this.scrollItems.push({ centerY, enabled: true, enable, disable });
  }

  // ─── Pill Buttons ────────────────────────────────────────────────────────

  /**
   * Rounded pill button in the HUD/settings visual language. Fires on
   * pointerdown, dips while pressed, and supports a "denied" side-shake.
   */
  private createPillButton(config: {
    x: number;
    y: number;
    anchor?: 'center' | 'left' | 'right';
    label: string;
    fill: number;
    border: number;
    textColor: string;
    minWidth?: number;
    interactive?: boolean;
    onClick?: () => void;
  }): ShopPill {
    const h = 30;
    const padX = 14;

    const text = this.add
      .text(0, 0, config.label, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: config.textColor,
      })
      .setOrigin(0.5);
    const w = Math.max(config.minWidth ?? 0, text.width + padX * 2);

    const gfx = this.add.graphics();
    gfx.fillStyle(config.fill, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    gfx.lineStyle(1.5, config.border, 0.9);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);

    const anchor = config.anchor ?? 'center';
    const cx =
      anchor === 'center' ? config.x : anchor === 'right' ? config.x - w / 2 : config.x + w / 2;

    const container = this.add.container(cx, config.y, [gfx, text]);
    const hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);

    const enable = () => {
      container.setInteractive({
        hitArea,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    };

    if (config.interactive !== false) {
      enable();

      container.on('pointerover', () => text.setAlpha(0.85));
      container.on('pointerout', () => {
        text.setAlpha(1);
        container.setScale(1);
      });
      container.on('pointerdown', () => {
        container.setScale(0.94);
        GameState.haptic('tap');
        config.onClick?.();
      });
      container.on('pointerup', () => container.setScale(1));
    }

    const nudge = () => {
      this.tweens.add({
        targets: container,
        x: { from: cx - 3, to: cx + 3 },
        duration: 40,
        yoyo: true,
        repeat: 1,
        onComplete: () => container.setX(cx),
      });
    };

    return {
      container,
      enable,
      disable: () => container.disableInteractive(),
      nudge,
    };
  }

  /**
   * Purchase celebration: soft screen flash + a floating spend/reward line
   * under the currency pill, then a short delayed restart so the fresh state
   * lands with feedback instead of an instant re-render.
   */
  private celebratePurchase(flashColor: number, floatText: string, floatColor: string): void {
    if (this.actionLock) return;
    this.actionLock = true;

    const { width, height } = this.scale;

    const flash = this.add
      .rectangle(0, 0, width, height, flashColor, 0.18)
      .setOrigin(0, 0)
      .setDepth(700);
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, ease: 'Cubic.easeOut' });

    const floaty = this.add
      .text(width - 60, 48, floatText, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: floatColor,
      })
      .setOrigin(0.5)
      .setDepth(701);
    this.tweens.add({ targets: floaty, y: 30, alpha: 0, duration: 420, ease: 'Cubic.easeOut' });

    this.time.delayedCall(250, () => this.restartShop());
  }

  // ─── Pickaxe Forge ──────────────────────────────────────────────────────

  private renderPickaxeTab(width: number): void {
    let y = 8;
    const cardH = 92;
    const gapY = 10;

    Object.entries(PICKAXES_CONFIG).forEach(([id, config]) => {
      const pickaxeId = id as PickaxeId;
      const isUnlocked = GameState.unlockedPickaxes.includes(pickaxeId);
      const isEquipped = GameState.equippedPickaxe === pickaxeId;
      const canAfford = GameState.gold >= config.priceGold && GameState.diamonds >= config.priceDiamonds;
      const effectivePower = GameState.getEffectiveEfficiency(config.efficiency);

      // Card bg
      const cardBg = this.add.graphics();
      const cardColor = isEquipped ? 0x1e3a5f : isUnlocked ? 0x1e293b : 0x0f172a;
      cardBg.fillStyle(cardColor, 1);
      cardBg.fillRoundedRect(12, y, width - 24, cardH, 12);
      cardBg.lineStyle(isEquipped ? 2 : 1, isEquipped ? 0x3b82f6 : 0x334155, 1);
      cardBg.strokeRoundedRect(12, y, width - 24, cardH, 12);
      this.content.add(cardBg);

      // Pickaxe Icon
      const icon = this.add.sprite(44, y + cardH / 2, `pickaxe_${pickaxeId}`);
      icon.setTint(config.color);
      this.content.add(icon);

      // Pickaxe Name
      const name = this.add.text(72, y + 10, config.name, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: isUnlocked ? '#f1f5f9' : '#64748b',
      });
      this.content.add(name);

      // Effective power + ability type
      const powerText = this.add.text(72, y + 30, `⚡ ${effectivePower} Power`, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: effectivePower > config.efficiency ? '#fbbf24' : '#94a3b8',
      });
      this.content.add(powerText);

      const typeText = this.add.text(72 + powerText.width + 6, y + 30, PICKAXE_TYPE_LABELS[config.type], {
        fontSize: '11px',
        color: '#64748b',
      });
      this.content.add(typeText);

      // Description
      const desc = this.add.text(72, y + 50, config.description, {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 210 },
      });
      this.content.add(desc);

      // Price / Status button
      if (isEquipped) {
        const badge = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: '✓ EQUIPPED',
          interactive: false,
          ...PILL.badgeGreen,
        });
        this.content.add(badge.container);
      } else if (isUnlocked) {
        const equipBtn = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: 'EQUIP',
          ...PILL.blue,
          onClick: () => {
            if (this.actionLock) return;
            if (GameState.soundEnabled) Sound.play('pickaxe_equip');
            GameState.equipPickaxe(pickaxeId);
            this.restartShop();
          },
        });
        this.content.add(equipBtn.container);
        this.registerScrollItem(y + cardH / 2, equipBtn.enable, equipBtn.disable);
      } else {
        const priceStr =
          (config.priceGold > 0 ? `💰${config.priceGold}  ` : '') +
          (config.priceDiamonds > 0 ? `💎${config.priceDiamonds}` : '');
        const buyBtn = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: priceStr || 'FREE',
          ...(canAfford ? PILL.amber : PILL.dim),
          onClick: () => {
            if (this.actionLock) return;
            if (!canAfford) {
              if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
              buyBtn.nudge();
              return;
            }
            if (GameState.soundEnabled) Sound.play('shop_buy');
            if (GameState.unlockPickaxe(pickaxeId)) {
              GameState.haptic('success');
              const spend =
                (config.priceGold > 0 ? `-💰 ${config.priceGold}` : '') +
                (config.priceDiamonds > 0 ? `  -💎 ${config.priceDiamonds}` : '');
              this.celebratePurchase(0xfbbf24, spend.trim(), '#fde68a');
            }
          },
        });
        this.content.add(buyBtn.container);
        this.registerScrollItem(y + cardH / 2, buyBtn.enable, buyBtn.disable);
      }

      y += cardH + gapY;
    });

    this.lastContentBottom = y - gapY + 8;
  }

  // ─── Incremental Upgrades ───────────────────────────────────────────────

  private renderUpgradesTab(width: number): void {
    let y = 8;
    const cardH = 112;
    const gapY = 12;

    // Current bonus summary strip
    const power = GameState.getUpgradeLevel('power');
    const speed = GameState.getUpgradeLevel('speed');
    const fortune = GameState.getUpgradeLevel('fortune');

    const summaryBg = this.add.graphics();
    summaryBg.fillStyle(0x0b1220, 1);
    summaryBg.fillRoundedRect(12, y, width - 24, 28, 8);
    summaryBg.lineStyle(1, 0x1e293b, 1);
    summaryBg.strokeRoundedRect(12, y, width - 24, 28, 8);
    this.content.add(summaryBg);

    const summary = this.add
      .text(
        width / 2,
        y + 14,
        `⚔️ +${power} Power   ⚡ +${speed * 8}% Speed   🍀 +${fortune * 10}% Gold`,
        { fontSize: '10px', fontStyle: 'bold', color: '#cbd5e1' }
      )
      .setOrigin(0.5);
    this.content.add(summary);
    y += 40;

    UPGRADES_CONFIG.forEach((config) => {
      const level = GameState.getUpgradeLevel(config.id);
      const cost = GameState.getUpgradeCost(config.id);
      const isMax = cost === null;
      const canAfford = cost !== null && GameState.gold >= cost;

      // Card bg
      const cardBg = this.add.graphics();
      const cardColor = isMax ? 0x14251a : level > 0 ? 0x1e293b : 0x0f172a;
      cardBg.fillStyle(cardColor, 1);
      cardBg.fillRoundedRect(12, y, width - 24, cardH, 12);
      cardBg.lineStyle(isMax ? 2 : 1, isMax ? 0x4ade80 : 0x334155, 1);
      cardBg.strokeRoundedRect(12, y, width - 24, cardH, 12);
      this.content.add(cardBg);

      // Icon
      const icon = this.add
        .text(38, y + 26, config.icon, { fontSize: '20px' })
        .setOrigin(0.5);
      this.content.add(icon);

      // Name
      const name = this.add.text(58, y + 12, config.name, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f1f5f9',
      });
      this.content.add(name);

      // Effect per level
      const effect = this.add.text(58, y + 32, config.effectLabel, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fbbf24',
      });
      this.content.add(effect);

      // Description
      const desc = this.add.text(58, y + 52, config.description, {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 210 },
      });
      this.content.add(desc);

      // Level pips
      const pips = this.add.text(
        58,
        y + 90,
        '◆'.repeat(level) + '◇'.repeat(config.maxLevel - level),
        {
          fontSize: '10px',
          color: level > 0 ? '#f59e0b' : '#475569',
        }
      );
      this.content.add(pips);

      // Level count + buy button
      const levelText = this.add
        .text(width - 24, y + 40, `Lv ${level}/${config.maxLevel}`, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#94a3b8',
        })
        .setOrigin(1, 0.5);
      this.content.add(levelText);

      if (isMax) {
        const badge = this.createPillButton({
          x: width - 24,
          y: y + 76,
          anchor: 'right',
          label: '✓ MAXED',
          interactive: false,
          ...PILL.badgeGreen,
        });
        this.content.add(badge.container);
      } else {
        const buyBtn = this.createPillButton({
          x: width - 24,
          y: y + 76,
          anchor: 'right',
          label: `💰 ${cost}`,
          ...(canAfford ? PILL.amber : PILL.dim),
          onClick: () => {
            if (this.actionLock) return;
            if (!canAfford) {
              if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
              buyBtn.nudge();
              return;
            }
            if (GameState.purchaseUpgrade(config.id)) {
              if (GameState.soundEnabled) Sound.play('upgrade_buy');
              GameState.haptic('success');
              this.celebratePurchase(0xfbbf24, `-💰 ${cost}`, '#fde68a');
            }
          },
        });
        this.content.add(buyBtn.container);
        this.registerScrollItem(y + 76, buyBtn.enable, buyBtn.disable);
      }

      y += cardH + gapY;
    });

    this.lastContentBottom = y - gapY + 8;
  }

  // ─── Skin Wardrobe ──────────────────────────────────────────────────────

  private renderSkinsTab(width: number): void {
    let y = 8;
    const cardH = 92;
    const gapY = 10;

    // ── Free Diamond Chest (voluntary rewarded ad) ──
    {
      const chestH = 96;
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x2a1c07, 1);
      cardBg.fillRoundedRect(12, y, width - 24, chestH, 12);
      cardBg.lineStyle(1.5, 0xf59e0b, 1);
      cardBg.strokeRoundedRect(12, y, width - 24, chestH, 12);
      this.content.add(cardBg);

      const chestIcon = this.add.text(38, y + 30, '🎁', { fontSize: '26px' }).setOrigin(0.5);
      this.content.add(chestIcon);

      const chestName = this.add.text(64, y + 10, 'Free Diamond Chest', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fde68a',
      });
      this.content.add(chestName);

      const chestDesc = this.add.text(64, y + 30, 'Watch a short ad and crack it open — mystery gems inside!', {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 150 },
      });
      this.content.add(chestDesc);

      const chestBtnLabel =
        this.chestReward !== null
          ? `✅ +${this.chestReward} 💎 · OPEN AGAIN`
          : '📺 WATCH AD · +2-5 💎';
      const chestBtn = this.createPillButton({
        x: width / 2,
        y: y + 74,
        label: chestBtnLabel,
        ...PILL.amber,
        onClick: () => {
          if (this.actionLock) return;
          if (GameState.soundEnabled) Sound.play('ui_click');
          const reward = Phaser.Math.Between(2, 5);
          Ads.showRewardedAd(
            this,
            'free_chest',
            'A mystery diamond chest is waiting!',
            `+${reward} 💎`,
            () => {
              this.chestReward = reward;
              GameState.addDiamonds(reward);
              if (GameState.soundEnabled) Sound.play('diamond_collect');
              GameState.haptic('success');
              this.celebratePurchase(0x38bdf8, `+${reward} 💎`, '#7dd3fc');
            }
          );
        },
      });
      this.content.add(chestBtn.container);
      this.registerScrollItem(y + 74, chestBtn.enable, chestBtn.disable);

      y += chestH + gapY;
    }

    SKINS_CONFIG.forEach((skin) => {
      const isUnlocked = GameState.unlockedSkins.includes(skin.id);
      const isEquipped = GameState.equippedSkin === skin.id;
      const canAfford = GameState.diamonds >= skin.priceDiamonds;

      // Card
      const cardBg = this.add.graphics();
      const cardColor = isEquipped ? 0x1c2c1e : isUnlocked ? 0x1e293b : 0x0f172a;
      cardBg.fillStyle(cardColor, 1);
      cardBg.fillRoundedRect(12, y, width - 24, cardH, 12);
      cardBg.lineStyle(isEquipped ? 2 : 1, isEquipped ? 0x4ade80 : 0x334155, 1);
      cardBg.strokeRoundedRect(12, y, width - 24, cardH, 12);
      this.content.add(cardBg);

      // Skin color swatch preview (mini miner silhouette tinted)
      const preview = this.add.graphics();
      preview.fillStyle(skin.helmetColor, 1);
      preview.fillRect(28, y + 16, 24, 14);
      preview.fillStyle(skin.suitColor, 1);
      preview.fillRect(28, y + 32, 24, 22);
      preview.fillStyle(skin.glowColor, 0.4);
      preview.fillRect(26, y + 14, 28, 44);
      this.content.add(preview);

      // Name
      const name = this.add.text(64, y + 14, skin.name, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: isUnlocked ? '#f1f5f9' : '#64748b',
      });
      this.content.add(name);

      const desc = this.add.text(64, y + 36, skin.description, {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 210 },
      });
      this.content.add(desc);

      // Status / action
      if (isEquipped) {
        const badge = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: '✓ WEARING',
          interactive: false,
          ...PILL.badgeGreen,
        });
        this.content.add(badge.container);
      } else if (isUnlocked) {
        const wearBtn = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: 'WEAR',
          ...PILL.green,
          onClick: () => {
            if (this.actionLock) return;
            if (GameState.soundEnabled) Sound.play('pickaxe_equip');
            GameState.equipSkin(skin.id);
            this.restartShop();
          },
        });
        this.content.add(wearBtn.container);
        this.registerScrollItem(y + cardH / 2, wearBtn.enable, wearBtn.disable);
      } else {
        const priceStr = skin.priceDiamonds > 0 ? `💎 ${skin.priceDiamonds}` : 'FREE';
        const buyBtn = this.createPillButton({
          x: width - 24,
          y: y + cardH / 2,
          anchor: 'right',
          label: priceStr,
          ...(canAfford ? PILL.cyan : PILL.dim),
          onClick: () => {
            if (this.actionLock) return;
            if (!canAfford) {
              if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
              buyBtn.nudge();
              return;
            }
            if (GameState.soundEnabled) Sound.play('shop_buy');
            if (GameState.unlockSkin(skin.id)) {
              GameState.haptic('success');
              this.celebratePurchase(0x38bdf8, `-💎 ${skin.priceDiamonds}`, '#7dd3fc');
            }
          },
        });
        this.content.add(buyBtn.container);
        this.registerScrollItem(y + cardH / 2, buyBtn.enable, buyBtn.disable);
      }

      y += cardH + gapY;
    });

    this.lastContentBottom = y - gapY + 8;
  }
}
