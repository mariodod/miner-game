export interface MinerSkin {
  id: string;
  name: string;
  description: string;
  priceDiamonds: number;
  helmetColor: number;
  suitColor: number;
  glowColor: number;
  unlockedByDefault?: boolean;
}

// ── Incremental Pickaxe Upgrades ────────────────────────────────────────────

export type UpgradeId = 'power' | 'speed' | 'fortune';

export interface UpgradeConfig {
  id: UpgradeId;
  name: string;
  icon: string;
  description: string;
  effectLabel: string;
  maxLevel: number;
  baseCost: number;   // gold cost of level 1
  costGrowth: number; // multiplier applied per level
}

export const UPGRADES_CONFIG: UpgradeConfig[] = [
  {
    id: 'power',
    name: 'Reinforced Edge',
    icon: '⚔️',
    description: 'Hone the pickaxe head so every block cracks in fewer hits.',
    effectLabel: '+1 Mining Power per level',
    maxLevel: 10,
    baseCost: 60,
    costGrowth: 1.5,
  },
  {
    id: 'speed',
    name: 'Swift Strikes',
    icon: '⚡',
    description: 'Lighter swings bring the pickaxe back sooner for the next hit.',
    effectLabel: '+8% Swing Speed per level',
    maxLevel: 10,
    baseCost: 80,
    costGrowth: 1.5,
  },
  {
    id: 'fortune',
    name: "Prospector's Luck",
    icon: '🍀',
    description: 'A lucky charm that multiplies the gold found inside ore blocks.',
    effectLabel: '+10% Ore Gold per level',
    maxLevel: 10,
    baseCost: 100,
    costGrowth: 1.6,
  },
];

/**
 * Gold cost to buy the next level of an upgrade, or null when maxed.
 */
export function getUpgradeCost(config: UpgradeConfig, currentLevel: number): number | null {
  if (currentLevel >= config.maxLevel) return null;
  return Math.round(config.baseCost * Math.pow(config.costGrowth, currentLevel));
}

export const SKINS_CONFIG: MinerSkin[] = [
  {
    id: 'classic',
    name: 'Classic Digger',
    description: 'Standard hardworking underground prospector.',
    priceDiamonds: 0,
    helmetColor: 0xfacc15, // Yellow hardhat
    suitColor: 0x3b82f6,   // Blue denim
    glowColor: 0xfef08a,
    unlockedByDefault: true,
  },
  {
    id: 'cyber',
    name: 'Cyberpunk Mole',
    description: 'Equipped with visor sensors for deep shaft scanning.',
    priceDiamonds: 10,
    helmetColor: 0x06b6d4, // Cyan neon
    suitColor: 0x1e1b4b,   // Dark synth
    glowColor: 0x22d3ee,
  },
  {
    id: 'golden_knight',
    name: 'Golden Vanguard',
    description: 'Shimmering armor radiating ancient luck.',
    priceDiamonds: 25,
    helmetColor: 0xf59e0b, // Amber gold
    suitColor: 0xd97706,
    glowColor: 0xfde047,
  },
  {
    id: 'void_walker',
    name: 'Void Excavator',
    description: 'Infused with dark obsidian crystals.',
    priceDiamonds: 50,
    helmetColor: 0x9333ea, // Purple
    suitColor: 0x18181b,
    glowColor: 0xc084fc,
  },
];
