import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ShopScene } from './scenes/ShopScene';
import { HUDScene } from './scenes/HUDScene';
import { Sound } from './core/SoundManager';

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
  physics: {
    default: 'arcade', // Enemy entities attach arcade bodies (AI itself is tween-driven)
  },
  input: {
    activePointers: 2, // Multi-touch support
  },
  render: {
    antialias: false,  // Crisp pixel-art style
    pixelArt: false,
    roundPixels: true,
  },
};

const game = new Phaser.Game(config);

// Handy debug/testing handle (kept intentionally: exposes the game instance)
declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}
window.__game = game;

// Initialize sound on first user interaction (required by browser autoplay policy)
let soundInitialized = false;
const initSound = () => {
  if (!soundInitialized) {
    Sound.init();
    soundInitialized = true;
  }
};
['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, initSound, { once: true, passive: true });
});
