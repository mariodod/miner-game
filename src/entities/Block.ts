import Phaser from 'phaser';
import { BlockType, BLOCKS_CONFIG, calculateRequiredHits } from '../config/blocks';
import { Sound } from '../core/SoundManager';
import { GameState } from '../core/GameState';

export class Block extends Phaser.GameObjects.Container {
  public gridX: number;
  public gridY: number;
  public blockType: BlockType;
  public maxHp: number;
  public currentHp: number;
  public isBroken: boolean = false;

  private baseSprite: Phaser.GameObjects.Sprite;
  private crackSprite: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    gridX: number,
    gridY: number,
    blockType: BlockType,
    pickaxeEfficiency: number = 1
  ) {
    super(scene, x, y);

    this.gridX = gridX;
    this.gridY = gridY;
    this.blockType = blockType;

    const config = BLOCKS_CONFIG[blockType];
    this.maxHp = calculateRequiredHits(config.baseHardness, pickaxeEfficiency);
    this.currentHp = this.maxHp;

    // Base block graphic
    this.baseSprite = scene.add.sprite(0, 0, `block_${blockType}`);
    this.baseSprite.setOrigin(0.5);
    this.add(this.baseSprite);

    // Crack overlay (hidden initially)
    this.crackSprite = scene.add.sprite(0, 0, 'crack_1');
    this.crackSprite.setOrigin(0.5);
    this.crackSprite.setVisible(false);
    this.add(this.crackSprite);

    this.setSize(48, 48);
    scene.add.existing(this);
  }

  /**
   * Recalculates HP if player swaps pickaxe mid-shaft
   */
  public updatePickaxeEfficiency(efficiency: number): void {
    if (this.isBroken || this.blockType === 'bedrock') return;
    const config = BLOCKS_CONFIG[this.blockType];
    const newMax = calculateRequiredHits(config.baseHardness, efficiency);
    const progress = (this.maxHp - this.currentHp) / this.maxHp;
    this.maxHp = newMax;
    this.currentHp = Math.max(1, Math.ceil(this.maxHp * (1 - progress)));
    this.updateCrackOverlay();
  }

  /**
   * Hits the block, decrements HP and updates crack overlay
   */
  public hit(damage: number = 1): {
    broken: boolean;
    gold: number;
    diamonds: number;
    particleColor: number;
    remainingHits: number;
  } {
    if (this.isBroken) {
      return { broken: true, gold: 0, diamonds: 0, particleColor: 0xffffff, remainingHits: 0 };
    }

    const config = BLOCKS_CONFIG[this.blockType];

    if (this.blockType === 'bedrock') {
      // Bedrock is unbreakable
      this.playHitWobble(2);
      return { broken: false, gold: 0, diamonds: 0, particleColor: config.particleColor, remainingHits: Infinity };
    }

    this.currentHp -= damage;
    this.playHitWobble(4);

    // Play hit sound
    if (GameState.soundEnabled) {
      Sound.play('block_hit');
    }

    if (this.currentHp <= 0) {
      this.isBroken = true;

      // Play break sound
      if (GameState.soundEnabled) {
        Sound.play('block_break');
      }

      return {
        broken: true,
        gold: config.valueGold,
        diamonds: config.valueDiamonds,
        particleColor: config.particleColor,
        remainingHits: 0,
      };
    } else {
      this.updateCrackOverlay();
      return {
        broken: false,
        gold: 0,
        diamonds: 0,
        particleColor: config.particleColor,
        remainingHits: this.currentHp,
      };
    }
  }

  private updateCrackOverlay(): void {
    const damageRatio = (this.maxHp - this.currentHp) / this.maxHp;
    if (damageRatio <= 0) {
      this.crackSprite.setVisible(false);
      return;
    }

    this.crackSprite.setVisible(true);
    if (damageRatio > 0.75) {
      this.crackSprite.setTexture('crack_4');
    } else if (damageRatio > 0.5) {
      this.crackSprite.setTexture('crack_3');
    } else if (damageRatio > 0.25) {
      this.crackSprite.setTexture('crack_2');
    } else {
      this.crackSprite.setTexture('crack_1');
    }
  }

  private playHitWobble(intensity: number = 4): void {
    this.scene.tweens.killTweensOf(this);
    this.y = this.gridY * 48 + 24; // reset anchor
    this.scene.tweens.add({
      targets: this,
      y: this.y + intensity,
      duration: 45,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }
}
