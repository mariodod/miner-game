import Phaser from 'phaser';
import { BLOCKS_CONFIG } from '../config/blocks';
import { PICKAXES_CONFIG } from '../config/pickaxes';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.createProceduralTextures();
    this.scene.start('MenuScene');
  }

  private createProceduralTextures(): void {
    const BLOCK_SIZE = 48;

    // 1. Generate Block Textures
    for (const [key, config] of Object.entries(BLOCKS_CONFIG)) {
      const g = this.make.graphics({ x: 0, y: 0 });

      // Base fill
      g.fillStyle(config.color, 1);
      g.fillRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);

      // Border highlight & shadow
      g.lineStyle(2, config.borderColor, 0.9);
      g.strokeRect(1, 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

      // Inner bevel / 3D rim
      g.lineStyle(1, 0xffffff, 0.25);
      g.beginPath();
      g.moveTo(2, BLOCK_SIZE - 2);
      g.lineTo(2, 2);
      g.lineTo(BLOCK_SIZE - 2, 2);
      g.strokePath();

      g.lineStyle(1, 0x000000, 0.35);
      g.beginPath();
      g.moveTo(BLOCK_SIZE - 2, 2);
      g.lineTo(BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      g.lineTo(2, BLOCK_SIZE - 2);
      g.strokePath();

      // Custom detailing based on block type
      if (key === 'dirt') {
        g.fillStyle(0x5c3818, 0.4);
        g.fillRect(8, 12, 6, 6);
        g.fillRect(28, 22, 8, 5);
        g.fillRect(16, 32, 5, 7);
      } else if (key === 'stone') {
        g.fillStyle(0x334155, 0.4);
        g.fillRect(10, 8, 12, 4);
        g.fillRect(24, 26, 14, 5);
        g.fillRect(6, 30, 8, 6);
      } else if (key === 'granite') {
        g.fillStyle(0x1e293b, 0.6);
        g.fillRect(6, 10, 10, 8);
        g.fillRect(26, 14, 12, 8);
        g.fillRect(14, 30, 14, 10);
      } else if (key === 'gold') {
        // Gold ore specks
        g.fillStyle(0xfde047, 1);
        g.fillCircle(14, 16, 5);
        g.fillCircle(34, 20, 6);
        g.fillCircle(22, 34, 5);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(13, 14, 2);
        g.fillCircle(33, 18, 2);
      } else if (key === 'diamond') {
        // Diamond ore crystals
        g.fillStyle(0x38bdf8, 1);
        // Diamond 1
        g.fillTriangle(14, 10, 8, 20, 20, 20);
        g.fillTriangle(14, 26, 8, 20, 20, 20);
        // Diamond 2
        g.fillTriangle(32, 18, 26, 28, 38, 28);
        g.fillTriangle(32, 36, 26, 28, 38, 28);
        // Specular glint
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(13, 16, 2, 2);
        g.fillRect(31, 24, 2, 2);
      } else if (key === 'tnt') {
        // Fuse band + white "TNT" lettering
        g.fillStyle(0x450a0a, 0.6);
        g.fillRect(4, 16, BLOCK_SIZE - 8, 16);
        g.fillStyle(0xffffff, 1);
        // T
        g.fillRect(11, 20, 7, 2);
        g.fillRect(13.5, 22, 2, 8);
        // N
        g.fillRect(21, 20, 2, 10);
        g.fillRect(27, 20, 2, 10);
        g.lineStyle(2, 0xffffff, 1);
        g.lineBetween(22, 21, 28, 29);
        // T
        g.fillRect(32, 20, 7, 2);
        g.fillRect(34.5, 22, 2, 8);
      } else if (key === 'treasure') {
        // Chest: lighter lid, gold bands and a lock plate
        g.fillStyle(0x92400e, 1);
        g.fillRect(3, 3, BLOCK_SIZE - 6, 16);
        g.fillStyle(0xfbbf24, 1);
        g.fillRect(3, 19, BLOCK_SIZE - 6, 4);
        g.fillRect(10, 3, 3, BLOCK_SIZE - 8);
        g.fillRect(BLOCK_SIZE - 13, 3, 3, BLOCK_SIZE - 8);
        g.fillStyle(0xb45309, 1);
        g.fillRoundedRect(19, 14, 10, 12, 2);
        g.fillStyle(0x451a03, 1);
        g.fillCircle(24, 20, 2);
      } else if (key === 'obsidian') {
        g.fillStyle(0x6366f1, 0.7);
        g.fillRect(12, 8, 4, 16);
        g.fillRect(28, 20, 5, 18);
        g.fillRect(18, 28, 12, 4);
      } else if (key === 'bedrock') {
        g.lineStyle(2, 0x334155, 0.7);
        g.lineBetween(0, 0, BLOCK_SIZE, BLOCK_SIZE);
        g.lineBetween(0, BLOCK_SIZE, BLOCK_SIZE, 0);
      }

      g.generateTexture(`block_${key}`, BLOCK_SIZE, BLOCK_SIZE);
      g.destroy();
    }

    // 2. Generate Crack Textures (stages 1 to 4)
    for (let stage = 1; stage <= 4; stage++) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.lineStyle(stage * 0.8 + 0.8, 0x000000, 0.85);

      if (stage >= 1) {
        g.beginPath();
        g.moveTo(24, 8);
        g.lineTo(20, 22);
        g.lineTo(28, 34);
        g.strokePath();
      }
      if (stage >= 2) {
        g.beginPath();
        g.moveTo(20, 22);
        g.lineTo(8, 26);
        g.lineTo(4, 38);
        g.strokePath();
      }
      if (stage >= 3) {
        g.beginPath();
        g.moveTo(28, 34);
        g.lineTo(42, 38);
        g.moveTo(24, 8);
        g.lineTo(38, 12);
        g.strokePath();
      }
      if (stage >= 4) {
        g.beginPath();
        g.moveTo(12, 6);
        g.lineTo(16, 42);
        g.moveTo(34, 16);
        g.lineTo(24, 44);
        g.strokePath();
      }

      g.generateTexture(`crack_${stage}`, BLOCK_SIZE, BLOCK_SIZE);
      g.destroy();
    }

    // 3. Generate Collectible Drop Textures (Coin, Diamond, Heart)
    // Coin
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf59e0b, 1);
      g.fillCircle(12, 12, 11);
      g.fillStyle(0xfde047, 1);
      g.fillCircle(12, 12, 8);
      g.fillStyle(0xb45309, 1);
      g.fillRect(10, 7, 4, 10);
      g.generateTexture('coin_icon', 24, 24);
      g.destroy();
    }

    // Diamond Gem
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x0284c7, 1);
      g.fillTriangle(12, 2, 3, 12, 21, 12);
      g.fillTriangle(12, 22, 3, 12, 21, 12);
      g.fillStyle(0x38bdf8, 1);
      g.fillTriangle(12, 4, 6, 12, 18, 12);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(10, 8, 3, 3);
      g.generateTexture('diamond_icon', 24, 24);
      g.destroy();
    }

    // Heart Drop (heals the miner when collected)
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xdc2626, 1);
      g.fillCircle(8, 8, 6.5);
      g.fillCircle(16, 8, 6.5);
      g.fillTriangle(2, 10, 22, 10, 12, 22);
      g.fillStyle(0xf87171, 1);
      g.fillCircle(7, 6.5, 2.2);
      g.generateTexture('heart_icon', 24, 24);
      g.destroy();
    }

    // Reward Chest (depth milestones)
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xd97706, 1);
      g.fillRoundedRect(2, 8, 20, 13, 3);
      g.fillStyle(0xfbbf24, 1);
      g.fillRoundedRect(2, 4, 20, 8, 3);
      g.fillStyle(0x7c2d12, 1);
      g.fillRect(10, 4, 4, 17);
      g.fillStyle(0xfef3c7, 1);
      g.fillRect(10, 10, 4, 4);
      g.lineStyle(1.5, 0x451a03, 1);
      g.strokeRoundedRect(2, 4, 20, 17, 3);
      g.generateTexture('reward_chest', 24, 24);
      g.destroy();
    }

    // 4. Generate Particle Texture
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 6, 6);
      g.generateTexture('particle_dust', 6, 6);
      g.destroy();
    }

    // 5. Generate Miner Character Texture
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Head / Face
      g.fillStyle(0xfbcfe8, 1);
      g.fillRect(10, 10, 16, 14);

      // Yellow Hardhat / Helmet
      g.fillStyle(0xfacc15, 1);
      g.fillRect(8, 2, 20, 10);
      g.fillRect(4, 10, 28, 4); // Helmet brim

      // Headlamp light beam
      g.fillStyle(0xffffff, 1);
      g.fillRect(24, 6, 5, 5);
      g.fillStyle(0xfef08a, 0.6);
      g.fillCircle(26, 8, 8);

      // Eyes
      g.fillStyle(0x0f172a, 1);
      g.fillRect(20, 14, 3, 4);

      // Body / Dungarees (Blue denim)
      g.fillStyle(0x2563eb, 1);
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

      g.generateTexture('miner_character', 36, 48);
      g.destroy();
    }

    // 6. Generate Pickaxe Sprites
    for (const [id, config] of Object.entries(PICKAXES_CONFIG)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Handle (Wood stick diagonally)
      g.lineStyle(3, 0x78350f, 1);
      g.lineBetween(5.5, 28, 19.5, 15);

      // Pickaxe Head — arc radius/stroke chosen so the head stays fully
      // inside the 32x32 canvas (it used to poke above the top edge).
      g.lineStyle(5, config.color, 1);
      g.beginPath();
      g.arc(20, 13.5, 10.5, Phaser.Math.DegToRad(170), Phaser.Math.DegToRad(290));
      g.strokePath();

      // Sharp tips
      g.fillStyle(config.color, 1);
      g.fillCircle(9.7, 15.3, 2.5);
      g.fillCircle(23.6, 3.6, 2.5);

      g.generateTexture(`pickaxe_${id}`, 32, 32);
      g.destroy();
    }

    // 7. Generate Highlight Ring / Selection Box
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.lineStyle(3, 0xfacc15, 0.9);
      g.strokeRect(2, 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
      g.generateTexture('block_highlight', BLOCK_SIZE, BLOCK_SIZE);
      g.destroy();
    }
  }
}
