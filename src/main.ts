import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ShopScene } from './scenes/ShopScene';
import { HUDScene } from './scenes/HUDScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 360,
  height: 640,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#0f172a',
  scene: [BootScene, MenuScene, GameScene, GameOverScene, ShopScene, HUDScene],
  input: {
    activePointers: 2, // Multi-touch support
  },
  render: {
    antialias: false,  // Crisp pixel-art style
    pixelArt: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
