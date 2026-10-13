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
