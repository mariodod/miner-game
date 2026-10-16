export type BlockType =
  | 'dirt'
  | 'stone'
  | 'granite'
  | 'gold'
  | 'diamond'
  | 'obsidian'
  | 'tnt'
  | 'treasure'
  | 'bedrock';

export interface BlockConfig {
  id: BlockType;
  name: string;
  baseHardness: number; // H: base hit points required
  color: number;
  borderColor: number;
  particleColor: number;
  valueGold: number;
  valueDiamonds: number;
  minDepth: number; // in meters/rows
  weight: (depth: number) => number;
}

export const BLOCKS_CONFIG: Record<BlockType, BlockConfig> = {
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    baseHardness: 1,
    color: 0x8b5a2b,
    borderColor: 0x6e431f,
    particleColor: 0xa06b3a,
    valueGold: 1,
    valueDiamonds: 0,
    minDepth: 0,
    weight: (depth) => Math.max(5, 70 - depth * 1.5),
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    baseHardness: 3,
    color: 0x64748b,
    borderColor: 0x475569,
    particleColor: 0x94a3b8,
    valueGold: 3,
    valueDiamonds: 0,
    minDepth: 5,
    weight: (depth) => (depth < 5 ? 0 : Math.min(50, 20 + depth * 0.8)),
  },
  granite: {
    id: 'granite',
    name: 'Hard Granite',
    baseHardness: 6,
    color: 0x475569,
    borderColor: 0x334155,
    particleColor: 0x64748b,
    valueGold: 8,
    valueDiamonds: 0,
    minDepth: 20,
    weight: (depth) => (depth < 20 ? 0 : Math.min(35, 10 + (depth - 20) * 0.5)),
  },
  gold: {
    id: 'gold',
    name: 'Gold Ore',
    baseHardness: 4,
    color: 0xd97706,
    borderColor: 0xb45309,
    particleColor: 0xfacc15,
    valueGold: 25,
    valueDiamonds: 0,
    minDepth: 10,
    weight: (depth) => (depth < 10 ? 0 : Math.min(12, 4 + Math.sin(depth * 0.2) * 2)),
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Ore',
    baseHardness: 8,
    color: 0x0284c7,
    borderColor: 0x0369a1,
    particleColor: 0x38bdf8,
    valueGold: 50,
    valueDiamonds: 1,
    minDepth: 35,
    weight: (depth) => (depth < 35 ? 0 : Math.min(8, 2 + (depth > 60 ? 3 : 0))),
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    baseHardness: 12,
    color: 0x1e1b4b,
    borderColor: 0x312e81,
    particleColor: 0x4338ca,
    valueGold: 100,
    valueDiamonds: 2,
    minDepth: 60,
    weight: (depth) => (depth < 60 ? 0 : Math.min(20, (depth - 60) * 0.4)),
  },
  tnt: {
    id: 'tnt',
    name: 'TNT',
    baseHardness: 1,
    color: 0xb91c1c,
    borderColor: 0x7f1d1d,
    particleColor: 0xf97316,
    valueGold: 0,
    valueDiamonds: 0,
    minDepth: 8,
    weight: (depth) => (depth < 8 ? 0 : 2.2),
  },
  treasure: {
    id: 'treasure',
    name: 'Treasure Chest',
    baseHardness: 4,
    color: 0x78350f,
    borderColor: 0x451a03,
    particleColor: 0xfbbf24,
    valueGold: 60,
    valueDiamonds: 1,
    minDepth: 15,
    weight: (depth) => (depth < 15 ? 0 : 1.4),
  },
  bedrock: {
    id: 'bedrock',
    name: 'Bedrock',
    baseHardness: 999999, // Unbreakable side walls
    color: 0x0f172a,
    borderColor: 0x020617,
    particleColor: 0x1e293b,
    valueGold: 0,
    valueDiamonds: 0,
    minDepth: 0,
    weight: () => 0,
  },
};

/**
 * Procedurally pick a block type for a given depth row
 */
export function getRandomBlockForDepth(depth: number): BlockType {
  const candidatePool: { type: BlockType; weight: number }[] = [];
  let totalWeight = 0;

  for (const key of Object.keys(BLOCKS_CONFIG) as BlockType[]) {
    if (key === 'bedrock') continue;
    const config = BLOCKS_CONFIG[key];
    if (depth >= config.minDepth) {
      const w = config.weight(depth);
      if (w > 0) {
        candidatePool.push({ type: key, weight: w });
        totalWeight += w;
      }
    }
  }

  if (candidatePool.length === 0 || totalWeight <= 0) {
    return 'dirt';
  }

  let roll = Math.random() * totalWeight;
  for (const candidate of candidatePool) {
    if (roll < candidate.weight) {
      return candidate.type;
    }
    roll -= candidate.weight;
  }

  return candidatePool[candidatePool.length - 1].type;
}

/**
 * Calculates hits required to break a block with a given pickaxe efficiency
 * hits = max(1, ceil(baseHardness / efficiency))
 */
export function calculateRequiredHits(baseHardness: number, pickaxeEfficiency: number): number {
  if (baseHardness >= 999999) return Infinity;
  return Math.max(1, Math.ceil(baseHardness / Math.max(1, pickaxeEfficiency)));
}
