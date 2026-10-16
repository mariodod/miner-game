import { BlockType } from './blocks';

export type EnemyType = 'bat' | 'goblin' | 'slime' | 'rock_golem' | 'crystal_lurker' | 'void_wraith';

// ── Elite (mini-boss) scaling — applied on top of a base enemy type ─────────
export const ELITE_HP_MULTIPLIER = 8;
export const ELITE_DAMAGE_BONUS = 2;
export const ELITE_SPEED_MULTIPLIER = 0.85;
export const ELITE_GOLD_MULTIPLIER = 3;
export const ELITE_DIAMOND_BONUS = 2;

export interface EnemyConfig {
  id: EnemyType;
  name: string;
  baseHp: number; // Base HP at depth 0 (will scale with depth)
  damage: number; // Damage to player (for future use)
  speed: number; // Movement speed (pixels per second)
  color: number;
  accentColor: number;
  minDepth: number; // Minimum depth (meters) to spawn
  maxDepth?: number; // Optional max depth
  weight: (depth: number) => number; // Spawn weight at depth
  dropGold: (depth: number) => number;
  dropDiamonds: (depth: number) => number;
  description: string;
}

export const ENEMIES_CONFIG: Record<EnemyType, EnemyConfig> = {
  bat: {
    id: 'bat',
    name: 'Cave Bat',
    baseHp: 2,
    damage: 1,
    speed: 60,
    color: 0x475569,
    accentColor: 0x64748b,
    minDepth: 5,
    maxDepth: 40,
    weight: (depth) => (depth < 5 || depth > 40) ? 0 : Math.min(30, 10 + depth * 0.5),
    dropGold: (depth) => Math.floor(3 + depth * 0.3),
    dropDiamonds: () => 0,
    description: 'Fast flying pest. Weak but annoying.',
  },
  goblin: {
    id: 'goblin',
    name: 'Tunnel Goblin',
    baseHp: 4,
    damage: 2,
    speed: 35,
    color: 0x166534,
    accentColor: 0x22c55e,
    minDepth: 15,
    maxDepth: 60,
    weight: (depth) => (depth < 15 || depth > 60) ? 0 : Math.min(25, 5 + (depth - 15) * 0.4),
    dropGold: (depth) => Math.floor(8 + depth * 0.5),
    dropDiamonds: (depth) => depth > 30 ? 1 : 0,
    description: 'Territorial miner. Guards its loot.',
  },
  slime: {
    id: 'slime',
    name: 'Acid Slime',
    baseHp: 6,
    damage: 2,
    speed: 20,
    color: 0x0d9488,
    accentColor: 0x2dd4bf,
    minDepth: 25,
    maxDepth: 80,
    weight: (depth) => (depth < 25 || depth > 80) ? 0 : Math.min(20, 3 + (depth - 25) * 0.3),
    dropGold: (depth) => Math.floor(12 + depth * 0.6),
    dropDiamonds: (depth) => depth > 40 ? 1 : 0,
    description: 'Corrosive blob. Splits when hit... (not yet implemented)',
  },
  rock_golem: {
    id: 'rock_golem',
    name: 'Rock Golem',
    baseHp: 10,
    damage: 3,
    speed: 15,
    color: 0x57534e,
    accentColor: 0x78716c,
    minDepth: 45,
    weight: (depth) => (depth < 45) ? 0 : Math.min(15, 2 + (depth - 45) * 0.25),
    dropGold: (depth) => Math.floor(25 + depth * 0.8),
    dropDiamonds: (depth) => depth > 55 ? 2 : 1,
    description: 'Living stone. Extremely durable.',
  },
  crystal_lurker: {
    id: 'crystal_lurker',
    name: 'Crystal Lurker',
    baseHp: 14,
    damage: 4,
    speed: 25,
    color: 0x7e22ce,
    accentColor: 0xa855f7,
    minDepth: 70,
    weight: (depth) => (depth < 70) ? 0 : Math.min(12, 1 + (depth - 70) * 0.2),
    dropGold: (depth) => Math.floor(50 + depth * 1.0),
    dropDiamonds: (depth) => depth > 80 ? 3 : 2,
    description: 'Gem-infused predator. Rich rewards.',
  },
  void_wraith: {
    id: 'void_wraith',
    name: 'Void Wraith',
    baseHp: 20,
    damage: 5,
    speed: 40,
    color: 0x18181b,
    accentColor: 0x6366f1,
    minDepth: 100,
    weight: (depth) => (depth < 100) ? 0 : Math.min(10, 0.5 + (depth - 100) * 0.15),
    dropGold: (depth) => Math.floor(100 + depth * 1.5),
    dropDiamonds: (_depth) => 5,
    description: 'Entity from the deep void. Deadly.',
  },
};

/**
 * Calculate enemy HP based on depth and pickaxe efficiency (mirroring block HP logic)
 * Enemy HP = max(1, ceil(baseHp * depthMultiplier / pickaxeEfficiency))
 */
export function calculateEnemyHp(enemy: EnemyConfig, depth: number, pickaxeEfficiency: number = 1): number {
  // Depth multiplier: every 10 meters increases HP by ~20%
  const depthMultiplier = 1 + Math.floor(depth / 10) * 0.2;
  const rawHp = enemy.baseHp * depthMultiplier;
  return Math.max(1, Math.ceil(rawHp / Math.max(1, pickaxeEfficiency)));
}

/**
 * Pick a random enemy type for a given depth
 */
export function getRandomEnemyForDepth(depth: number, _pickaxeEfficiency: number = 1): EnemyType | null {
  const candidatePool: { type: EnemyType; weight: number }[] = [];
  let totalWeight = 0;

  for (const key of Object.keys(ENEMIES_CONFIG) as EnemyType[]) {
    const config = ENEMIES_CONFIG[key];
    if (depth >= config.minDepth && (!config.maxDepth || depth <= config.maxDepth)) {
      const w = config.weight(depth);
      if (w > 0) {
        candidatePool.push({ type: key, weight: w });
        totalWeight += w;
      }
    }
  }

  if (candidatePool.length === 0 || totalWeight <= 0) {
    return null;
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
 * Check if an enemy should spawn at a given block position
 * Enemies can spawn when breaking certain blocks or in empty spaces
 */
export function shouldEnemySpawn(blockType: BlockType, depth: number): boolean {
  // Higher chance for valuable blocks
  const baseChance: Record<BlockType, number> = {
    dirt: 0.02,
    stone: 0.03,
    granite: 0.05,
    gold: 0.08,
    diamond: 0.15,
    obsidian: 0.2,
    tnt: 0.1,
    treasure: 0.25,
    bedrock: 0,
  };

  const chance = baseChance[blockType] || 0;
  // Increase chance slightly with depth
  const depthBonus = Math.min(0.1, depth * 0.001);
  return Math.random() < (chance + depthBonus);
}