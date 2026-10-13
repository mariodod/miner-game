export type PickaxeType = 'standard' | 'horizontal_cleaver' | 'vertical_pulverizer' | 'explosive';

export type PickaxeId =
  | 'wood'
  | 'stone'
  | 'iron'
  | 'gold'
  | 'diamond'
  | 'tunnel_drill'
  | 'piledriver'
  | 'cross_breaker'
  | 'obsidian';

export interface PickaxeConfig {
  id: PickaxeId;
  name: string;
  efficiency: number; // E: Reduces hits needed to break blocks
  type: PickaxeType;
  priceGold: number;
  priceDiamonds: number;
  description: string;
  color: number;
  unlockedByDefault?: boolean;
}

export const PICKAXES_CONFIG: Record<PickaxeId, PickaxeConfig> = {
  wood: {
    id: 'wood',
    name: 'Wooden Pickaxe',
    efficiency: 1,
    type: 'standard',
    priceGold: 0,
    priceDiamonds: 0,
    description: 'Basic handmade tool. Breaks soft dirt with ease.',
    color: 0x8b5a2b,
    unlockedByDefault: true,
  },
  stone: {
    id: 'stone',
    name: 'Stone Pickaxe',
    efficiency: 2,
    type: 'standard',
    priceGold: 75,
    priceDiamonds: 0,
    description: 'Sturdier head. Speeds up mining through stone.',
    color: 0x94a3b8,
  },
  iron: {
    id: 'iron',
    name: 'Iron Pickaxe',
    efficiency: 3,
    type: 'standard',
    priceGold: 250,
    priceDiamonds: 0,
    description: 'Forged iron for faster digging through dense rock.',
    color: 0xe2e8f0,
  },
  tunnel_drill: {
    id: 'tunnel_drill',
    name: 'Tunnel Drill',
    efficiency: 2,
    type: 'horizontal_cleaver',
    priceGold: 500,
    priceDiamonds: 2,
    description: 'Cleaves target block and damages adjacent left & right blocks!',
    color: 0xf59e0b,
  },
  piledriver: {
    id: 'piledriver',
    name: 'Vertical Piledriver',
    efficiency: 3,
    type: 'vertical_pulverizer',
    priceGold: 900,
    priceDiamonds: 5,
    description: 'Punches downward, damaging the block directly underneath!',
    color: 0xec4899,
  },
  gold: {
    id: 'gold',
    name: 'Gilded Pickaxe',
    efficiency: 5,
    type: 'standard',
    priceGold: 1500,
    priceDiamonds: 8,
    description: 'High efficiency pickaxe with boosted ore yields.',
    color: 0xfacc15,
  },
  cross_breaker: {
    id: 'cross_breaker',
    name: 'Cross Breaker',
    efficiency: 4,
    type: 'explosive',
    priceGold: 2500,
    priceDiamonds: 15,
    description: 'Every 5th hit detonates a 3x3 shockwave blast!',
    color: 0xef4444,
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Pickaxe',
    efficiency: 7,
    type: 'standard',
    priceGold: 4500,
    priceDiamonds: 25,
    description: 'Extremely durable. Slices through deep granite.',
    color: 0x38bdf8,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Void Obsidian Pickaxe',
    efficiency: 12,
    type: 'standard',
    priceGold: 10000,
    priceDiamonds: 50,
    description: 'Mythical pickaxe that shatters bedrock-grade strata.',
    color: 0xa855f7,
  },
};
