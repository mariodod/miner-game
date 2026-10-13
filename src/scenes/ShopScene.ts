import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { PICKAXES_CONFIG, PickaxeId } from '../config/pickaxes';
import { SKINS_CONFIG } from '../config/economy';

type ShopTab = 'pickaxes' | 'skins';

export class ShopScene extends Phaser.Scene {
  private activeTab: ShopTab = 'pickaxes';

  constructor() {
    super('ShopScene');
  }

  create() {
    const { width, height } = this.scale;

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

    // Back Button
    const backBtn = this.add
      .text(16, 28, '← Back', {
        fontSize: '14px',
        color: '#60a5fa',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    // Currency display top-right
    this.add
      .text(width - 12, 28, `💰 ${GameState.gold}  💎 ${GameState.diamonds}`, {
        fontSize: '12px',
        color: '#e2e8f0',
      })
      .setOrigin(1, 0.5);

    // ── Tabs ──
    const tabY = 72;
    this.drawTab('pickaxes', 'Pickaxe Forge', width * 0.25, tabY, width, height);
    this.drawTab('skins', 'Skin Wardrobe', width * 0.75, tabY, width, height);

    // ── Scroll Content ──
    this.renderTab(this.activeTab, width);
  }

  private drawTab(tab: ShopTab, label: string, x: number, y: number, _width: number, _height: number): void {
    const isActive = this.activeTab === tab;
    const bg = this.add.graphics();
    bg.fillStyle(isActive ? 0x1e40af : 0x1e293b, 1);
    bg.fillRoundedRect(x - 72, y - 16, 144, 32, 8);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(x - 72, y - 16, 144, 32),
      Phaser.Geom.Rectangle.Contains
    );

    const text = this.add
      .text(x, y, label, {
        fontSize: '13px',
        fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? '#f0f9ff' : '#94a3b8',
      })
      .setOrigin(0.5);

    if (!isActive) {
      bg.on('pointerdown', () => {
        this.activeTab = tab;
        this.scene.restart();
      });
      text.setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        this.activeTab = tab;
        this.scene.restart();
      });
    }
  }

  private renderTab(tab: ShopTab, width: number): void {
    if (tab === 'pickaxes') {
      this.renderPickaxeTab(width);
    } else {
      this.renderSkinsTab(width);
    }
  }

  // ─── Pickaxe Forge ──────────────────────────────────────────────────────

  private renderPickaxeTab(width: number): void {
    const startY = 110;
    const cardH = 82;
    const gapY = 10;

    Object.entries(PICKAXES_CONFIG).forEach(([id, config], i) => {
      const pickaxeId = id as PickaxeId;
      const y = startY + i * (cardH + gapY);
      const isUnlocked = GameState.unlockedPickaxes.includes(pickaxeId);
      const isEquipped = GameState.equippedPickaxe === pickaxeId;
      const canAfford = GameState.gold >= config.priceGold && GameState.diamonds >= config.priceDiamonds;

      // Card bg
      const cardBg = this.add.graphics();
      const cardColor = isEquipped ? 0x1e3a5f : isUnlocked ? 0x1e293b : 0x0f172a;
      cardBg.fillStyle(cardColor, 1);
      cardBg.fillRoundedRect(12, y, width - 24, cardH, 12);
      cardBg.lineStyle(isEquipped ? 2 : 1, isEquipped ? 0x3b82f6 : 0x334155, 1);
      cardBg.strokeRoundedRect(12, y, width - 24, cardH, 12);

      // Pickaxe Icon
      const icon = this.add.sprite(48, y + cardH / 2, `pickaxe_${pickaxeId}`);
      icon.setTint(config.color);

      // Pickaxe Name
      this.add.text(76, y + 14, config.name, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: isUnlocked ? '#f1f5f9' : '#64748b',
      });

      // Efficiency badge
      this.add.text(76, y + 32, `⚡ Efficiency ${config.efficiency}  |  ${config.description.substring(0, 28)}...`, {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 100 },
      });

      // Price / Status
      if (isEquipped) {
        this.add
          .text(width - 24, y + cardH / 2, '✓ EQUIPPED', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#34d399',
          })
          .setOrigin(1, 0.5);
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
          GameState.equipPickaxe(pickaxeId);
          this.scene.restart();
        });
      } else {
        // Price tag
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
          .setOrigin(1, 0.5);

        if (canAfford) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on('pointerdown', () => {
            const success = GameState.unlockPickaxe(pickaxeId);
            if (success) this.scene.restart();
          });
        }
      }
    });
  }

  // ─── Skin Wardrobe ──────────────────────────────────────────────────────

  private renderSkinsTab(width: number): void {
    const startY = 110;
    const cardH = 82;
    const gapY = 10;

    SKINS_CONFIG.forEach((skin, i) => {
      const y = startY + i * (cardH + gapY);
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

      // Skin color swatch preview (mini miner silhouette tinted)
      const preview = this.add.graphics();
      preview.fillStyle(skin.helmetColor, 1);
      preview.fillRect(28, y + 12, 24, 14);
      preview.fillStyle(skin.suitColor, 1);
      preview.fillRect(28, y + 28, 24, 22);
      preview.fillStyle(skin.glowColor, 0.4);
      preview.fillRect(26, y + 10, 28, 44);

      // Name
      this.add.text(64, y + 14, skin.name, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: isUnlocked ? '#f1f5f9' : '#64748b',
      });
      this.add.text(64, y + 34, skin.description, {
        fontSize: '10px',
        color: '#94a3b8',
        wordWrap: { width: width - 100 },
      });

      // Status / action
      if (isEquipped) {
        this.add
          .text(width - 24, y + cardH / 2, '✓ WEARING', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#4ade80',
          })
          .setOrigin(1, 0.5);
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
          GameState.equipSkin(skin.id);
          this.scene.restart();
        });
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
          .setOrigin(1, 0.5);

        if (canAfford) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on('pointerdown', () => {
            const success = GameState.unlockSkin(skin.id);
            if (success) this.scene.restart();
          });
        }
      }
    });
  }
}
