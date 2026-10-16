import Phaser from 'phaser';
import { PickaxeId } from '../config/pickaxes';
import { GameState } from '../core/GameState';
import { SKINS_CONFIG, MinerSkin } from '../config/economy';

export class Player extends Phaser.GameObjects.Container {
  public gridX: number = 3;
  public gridY: number = 0;
  public isSwinging: boolean = false;

  private minerSprite: Phaser.GameObjects.Sprite;
  private pickaxeSprite: Phaser.GameObjects.Sprite;
  private lampGlow: Phaser.GameObjects.Arc;
  private pickaxeUnsub: (() => void) | null = null;
  private skinUnsub: (() => void) | null = null;
  private currentSkinId: string = 'classic';

  constructor(scene: Phaser.Scene, x: number, y: number, gridX: number = 3, gridY: number = 0) {
    super(scene, x, y);

    this.gridX = gridX;
    this.gridY = gridY;

    // Get initial skin
    const initialSkin = SKINS_CONFIG.find(s => s.id === GameState.equippedSkin) || SKINS_CONFIG[0];
    this.currentSkinId = initialSkin.id;

    // Ambient glow (updated by skin)
    this.lampGlow = scene.add.circle(0, 0, 48, initialSkin.glowColor, 0.12);
    this.add(this.lampGlow);

    // Generate initial miner texture with skin colors
    this.generateMinerTexture(initialSkin);

    // Miner Body Sprite
    this.minerSprite = scene.add.sprite(0, 0, `miner_character_${this.currentSkinId}`);
    this.minerSprite.setOrigin(0.5, 0.5);
    this.add(this.minerSprite);

    // Pickaxe Sprite
    const equippedPickaxe = GameState.equippedPickaxe;
    this.pickaxeSprite = scene.add.sprite(12, -4, `pickaxe_${equippedPickaxe}`);
    this.pickaxeSprite.setOrigin(0.2, 0.8);
    this.add(this.pickaxeSprite);

    this.setSize(36, 48);
    scene.add.existing(this);

    // Listen for pickaxe change
    this.pickaxeUnsub = GameState.on('pickaxeChanged', (newPickaxe: PickaxeId) => {
      this.updatePickaxeTexture(newPickaxe);
    });

    // Listen for skin change
    this.skinUnsub = GameState.on('skinChanged', (skinId: string) => {
      const skin = SKINS_CONFIG.find(s => s.id === skinId);
      if (skin) this.applySkin(skin);
    });
  }

  /**
   * Generates a miner character texture with the given skin colors
   */
  private generateMinerTexture(skin: MinerSkin): void {
    const scene = this.scene;
    const key = `miner_character_${skin.id}`;

    // Destroy existing texture if it exists
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }

    const g = scene.make.graphics({ x: 0, y: 0 });

    // Head / Face (skin tone)
    g.fillStyle(0xfbcfe8, 1);
    g.fillRect(10, 10, 16, 14);

    // Helmet / Hardhat
    g.fillStyle(skin.helmetColor, 1);
    g.fillRect(8, 2, 20, 10);
    g.fillRect(4, 10, 28, 4); // Helmet brim

    // Headlamp light beam
    g.fillStyle(0xffffff, 1);
    g.fillRect(24, 6, 5, 5);
    g.fillStyle(skin.glowColor, 0.6);
    g.fillCircle(26, 8, 8);

    // Eyes
    g.fillStyle(0x0f172a, 1);
    g.fillRect(20, 14, 3, 4);

    // Body / Suit
    g.fillStyle(skin.suitColor, 1);
    g.fillRect(8, 24, 20, 14);

    // Belt
    g.fillStyle(0x78350f, 1);
    g.fillRect(8, 36, 20, 3);
    g.fillStyle(0xfacc15, 1);
    g.fillRect(16, 36, 4, 3);

    // Legs / Boots
    g.fillStyle(0x1e293b, 1);
    g.fillRect(9, 39, 8, 9);
    g.fillRect(19, 39, 8, 9);

    g.generateTexture(key, 36, 48);
    g.destroy();
  }

  /**
   * Applies a new skin by regenerating the miner texture
   */
  private applySkin(skin: MinerSkin): void {
    if (skin.id === this.currentSkinId) return;

    // Update glow color immediately
    this.lampGlow.setFillStyle(skin.glowColor, 0.12);

    // Generate new texture
    this.generateMinerTexture(skin);
    this.currentSkinId = skin.id;

    // Swap texture on sprite
    if (this.minerSprite) {
      this.minerSprite.setTexture(`miner_character_${this.currentSkinId}`);
    }
  }

  public updatePickaxeTexture(pickaxeId: PickaxeId): void {
    if (this.pickaxeSprite) {
      this.pickaxeSprite.setTexture(`pickaxe_${pickaxeId}`);
    }
  }

  public setFacingDirection(direction: 'left' | 'right'): void {
    if (direction === 'left') {
      this.minerSprite.setFlipX(true);
      this.pickaxeSprite.setX(-12);
      this.pickaxeSprite.setFlipX(true);
    } else {
      this.minerSprite.setFlipX(false);
      this.pickaxeSprite.setX(12);
      this.pickaxeSprite.setFlipX(false);
    }
  }

  /**
   * Snappy mining swing animation.
   * @param speedMultiplier Scales animation durations (higher = faster swings).
   * @returns false when a swing is already in progress (caller should abort).
   */
  public playSwingAnimation(
    targetX: number,
    onImpact: () => void,
    speedMultiplier: number = 1
  ): boolean {
    if (this.isSwinging) return false;
    this.isSwinging = true;

    const mult = Math.max(0.1, speedMultiplier);
    const windupMs = Math.round(50 / mult);
    const strikeMs = Math.round(65 / mult);
    const recoverMs = Math.round(80 / mult);
    const hopMs = Math.round(60 / mult);

    if (targetX < this.x) {
      this.setFacingDirection('left');
    } else if (targetX > this.x) {
      this.setFacingDirection('right');
    }

    const isLeft = this.minerSprite.flipX;
    const windupAngle = isLeft ? 35 : -35;
    const strikeAngle = isLeft ? -50 : 50;

    // Windup -> Strike -> Recover
    this.scene.tweens.add({
      targets: this.pickaxeSprite,
      angle: windupAngle,
      duration: windupMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.pickaxeSprite,
          angle: strikeAngle,
          duration: strikeMs,
          ease: 'Back.easeIn',
          onComplete: () => {
            if (onImpact) onImpact();
            // Recover to rest
            this.scene.tweens.add({
              targets: this.pickaxeSprite,
              angle: 0,
              duration: recoverMs,
              ease: 'Quad.easeOut',
              onComplete: () => {
                this.isSwinging = false;
              },
            });
          },
        });
      },
    });

    // Slight miner hop
    this.scene.tweens.add({
      targets: this.minerSprite,
      y: -4,
      duration: hopMs,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });

    return true;
  }

  /**
   * Smoothly moves the player to a target grid coordinate
   */
  public moveToGrid(targetX: number, targetY: number, gridX: number, gridY: number, callback?: () => void): void {
    this.gridX = gridX;
    this.gridY = gridY;

    if (targetX < this.x) {
      this.setFacingDirection('left');
    } else if (targetX > this.x) {
      this.setFacingDirection('right');
    }

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 120,
      ease: 'Power1',
      onComplete: () => {
        if (callback) callback();
      },
    });
  }

  public destroy(fromScene?: boolean): void {
    if (this.pickaxeUnsub) {
      this.pickaxeUnsub();
      this.pickaxeUnsub = null;
    }
    if (this.skinUnsub) {
      this.skinUnsub();
      this.skinUnsub = null;
    }
    super.destroy(fromScene);
  }
}