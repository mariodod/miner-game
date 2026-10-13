import Phaser from 'phaser';
import { PickaxeId } from '../config/pickaxes';
import { GameState } from '../core/GameState';

export class Player extends Phaser.GameObjects.Container {
  public gridX: number = 3;
  public gridY: number = 0;
  public isSwinging: boolean = false;

  private minerSprite: Phaser.GameObjects.Sprite;
  private pickaxeSprite: Phaser.GameObjects.Sprite;
  private lampGlow: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, gridX: number = 3, gridY: number = 0) {
    super(scene, x, y);

    this.gridX = gridX;
    this.gridY = gridY;

    // Ambient glow
    this.lampGlow = scene.add.circle(0, 0, 48, 0xfef08a, 0.12);
    this.add(this.lampGlow);

    // Miner Body Sprite
    this.minerSprite = scene.add.sprite(0, 0, 'miner_character');
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
    GameState.on('pickaxeChanged', (newPickaxe: PickaxeId) => {
      this.updatePickaxeTexture(newPickaxe);
    });
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
   * Snappy mining swing animation
   */
  public playSwingAnimation(targetX: number, onImpact?: () => void): void {
    if (this.isSwinging) return;
    this.isSwinging = true;

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
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.pickaxeSprite,
          angle: strikeAngle,
          duration: 65,
          ease: 'Back.easeIn',
          onComplete: () => {
            if (onImpact) onImpact();
            // Recover to rest
            this.scene.tweens.add({
              targets: this.pickaxeSprite,
              angle: 0,
              duration: 80,
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
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
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
}
