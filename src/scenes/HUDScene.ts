import Phaser from 'phaser';
import { HUD } from '../ui/HUD';

/**
 * HUDScene is launched as a parallel overlay on top of GameScene.
 * It renders the depth counter, gold/diamond display, and pickaxe badge.
 * Running it as a separate scene ensures it is never scrolled by the camera.
 */
export class HUDScene extends Phaser.Scene {
  private hud!: HUD;

  constructor() {
    super({ key: 'HUDScene', active: false });
  }

  create() {
    this.hud = new HUD(this);
  }

  shutdown() {
    this.hud?.destroy();
  }
}
