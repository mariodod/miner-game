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

  constructor() {
    super('ShopScene');
  }

  init(data?: { returnTo?: 'menu' | 'game' }) {
    this.returnTo = data?.returnTo === 'game' ? 'game' : 'menu';
  }

  create() {
    const { width, height } = this.scale;
    this.scrollItems = [];
    this.chestReward = null;

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
    const backBtn = this.add
      .text(16, 28, backLabel, {
        fontSize: '14px',
        color: '#60a5fa',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      if (GameState.soundEnabled) Sound.play('ui_click');
      if (this.returnTo === 'game') {
        this.scene.resume('GameScene');
        this.scene.launch('HUDScene');
        this.scene.stop();
      } else {
        this.scene.start('MenuScene');
      }
    });

    // Currency display top-right
    this.add
      .text(width - 12, 28, `💰 ${GameState.gold}  💎 ${GameState.diamonds}`, {
        fontSize: '12px',
        color: '#e2e8f0',
      })
      .setOrigin(1, 0.5);

    // ── Tabs ──
    const tabY = 72;
    const tabCenters: Array<{ tab: ShopTab; label: string }> = [
      { tab: 'pickaxes', label: '⛏ Pickaxes' },
      { tab: 'upgrades', label: '⚡ Upgrades' },
      { tab: 'skins', label: '👷 Skins' },
    ];
    tabCenters.forEach((entry, i) => {
      this.drawTab(entry.tab, entry.label, width * ((i + 0.5) / 3), tabY);
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

  private drawTab(tab: ShopTab, label: string, x: number, y: number): void {
    const isActive = this.activeTab === tab;
    const w = 104;
    const h = 30;

    const bg = this.add.graphics();
    bg.fillStyle(isActive ? 0x1e40af : 0x1e293b, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);

    const text = this.add
      .text(x, y, label, {
        fontSize: '11px',
        fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? '#f0f9ff' : '#94a3b8',
      })
      .setOrigin(0.5);

    if (!isActive) {
      const switchTab = () => {
        if (GameState.soundEnabled) Sound.play('ui_click');
        this.activeTab = tab;
        this.persistedScrollOffset = 0;
        this.scene.restart({ returnTo: this.returnTo });
      };
      bg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      bg.on('pointerdown', switchTab);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerdown', switchTab);
    }
  }

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

  private registerScrollItem(centerY: number, button: Phaser.GameObjects.Text): void {
    this.scrollItems.push({
      centerY,
      enabled: true,
      enable: () => button.setInteractive({ useHandCursor: true }),
      disable: () => button.disableInteractive(),
    });
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
        wordWrap: { width: width - 190 },
      });
      this.content.add(desc);

      // Price / Status button
      if (isEquipped) {
        const equipped = this.add
          .text(width - 24, y + cardH / 2, '✓ EQUIPPED', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#34d399',
          })
          .setOrigin(1, 0.5);
        this.content.add(equipped);
      } else if (isUnlocked) {
        const equipBtn = this.add
          .text(width - 24, y + cardH / 2, 'EQUIP', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#60a5fa',
            backgroundColor: '#1e40af',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        equipBtn.on('pointerdown', () => {
          if (GameState.soundEnabled) Sound.play('pickaxe_equip');
          GameState.equipPickaxe(pickaxeId);
          this.restartShop();
        });
        this.content.add(equipBtn);
        this.registerScrollItem(y + cardH / 2, equipBtn);
      } else {
        const priceStr =
          (config.priceGold > 0 ? `💰${config.priceGold}  ` : '') +
          (config.priceDiamonds > 0 ? `💎${config.priceDiamonds}` : '');
        const buyBtn = this.add
          .text(width - 24, y + cardH / 2, priceStr || 'FREE', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: canAfford ? '#fbbf24' : '#6b7280',
            backgroundColor: canAfford ? '#292524' : '#1c1917',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => {
          if (!canAfford) {
            if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
            return;
          }
          if (GameState.soundEnabled) Sound.play('shop_buy');
          if (GameState.unlockPickaxe(pickaxeId)) this.restartShop();
        });
        this.content.add(buyBtn);
        this.registerScrollItem(y + cardH / 2, buyBtn);
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
        wordWrap: { width: width - 170 },
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
        const max = this.add
          .text(width - 24, y + 76, '✓ MAXED', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#4ade80',
          })
          .setOrigin(1, 0.5);
        this.content.add(max);
      } else {
        const buyBtn = this.add
          .text(width - 24, y + 76, `💰 ${cost}`, {
            fontSize: '12px',
            fontStyle: 'bold',
            color: canAfford ? '#fbbf24' : '#6b7280',
            backgroundColor: canAfford ? '#292524' : '#1c1917',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => {
          if (!canAfford) {
            if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
            return;
          }
          if (GameState.purchaseUpgrade(config.id)) {
            if (GameState.soundEnabled) Sound.play('upgrade_buy');
            this.restartShop();
          }
        });
        this.content.add(buyBtn);
        this.registerScrollItem(y + 76, buyBtn);
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
      const chestBtn = this.add
        .text(width / 2, y + 74, chestBtnLabel, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#1c1917',
          backgroundColor: '#f59e0b',
          padding: { x: 14, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      chestBtn.on('pointerdown', () => {
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
            this.restartShop();
          }
        );
      });
      this.content.add(chestBtn);
      this.registerScrollItem(y + 74, chestBtn);

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
        wordWrap: { width: width - 190 },
      });
      this.content.add(desc);

      // Status / action
      if (isEquipped) {
        const wearing = this.add
          .text(width - 24, y + cardH / 2, '✓ WEARING', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#4ade80',
          })
          .setOrigin(1, 0.5);
        this.content.add(wearing);
      } else if (isUnlocked) {
        const wearBtn = this.add
          .text(width - 24, y + cardH / 2, 'WEAR', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#4ade80',
            backgroundColor: '#14532d',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        wearBtn.on('pointerdown', () => {
          if (GameState.soundEnabled) Sound.play('pickaxe_equip');
          GameState.equipSkin(skin.id);
          this.restartShop();
        });
        this.content.add(wearBtn);
        this.registerScrollItem(y + cardH / 2, wearBtn);
      } else {
        const priceStr = skin.priceDiamonds > 0 ? `💎 ${skin.priceDiamonds}` : 'FREE';
        const buyBtn = this.add
          .text(width - 24, y + cardH / 2, priceStr, {
            fontSize: '13px',
            fontStyle: 'bold',
            color: canAfford ? '#38bdf8' : '#6b7280',
            backgroundColor: canAfford ? '#0c1428' : '#1c1917',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => {
          if (!canAfford) {
            if (GameState.soundEnabled) Sound.play('shop_cannot_afford');
            return;
          }
          if (GameState.soundEnabled) Sound.play('shop_buy');
          if (GameState.unlockSkin(skin.id)) this.restartShop();
        });
        this.content.add(buyBtn);
        this.registerScrollItem(y + cardH / 2, buyBtn);
      }

      y += cardH + gapY;
    });

    this.lastContentBottom = y - gapY + 8;
  }
}
