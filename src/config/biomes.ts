/**
 * Depth biomes — visual bands the mine passes through as the player digs
 * deeper. Purely cosmetic: background wash + HUD label + arrival banner.
 */
export interface BiomeDef {
  id: string;
  name: string;
  minDepth: number;
  /** Full-screen tint colour applied as a translucent wash. */
  wash: number;
  /** 0 = no wash (surface look). */
  washAlpha: number;
  /** Accent colour (CSS) for labels and banners. */
  accent: string;
}

export const BIOMES: BiomeDef[] = [
  { id: 'topsoil', name: 'Topsoil', minDepth: 0, wash: 0x000000, washAlpha: 0, accent: '#fb923c' },
  { id: 'cavern', name: 'Caverns', minDepth: 30, wash: 0x1d4ed8, washAlpha: 0.12, accent: '#7dd3fc' },
  { id: 'deep_rock', name: 'Deep Rock', minDepth: 70, wash: 0x4338ca, washAlpha: 0.12, accent: '#a5b4fc' },
  { id: 'crystal', name: 'Crystal Hollows', minDepth: 120, wash: 0x0891b2, washAlpha: 0.12, accent: '#67e8f9' },
  { id: 'core', name: 'The Core', minDepth: 180, wash: 0x991b1b, washAlpha: 0.14, accent: '#fca5a5' },
];

/** Returns the biome band that contains the given depth (in meters). */
export function getBiomeForDepth(depth: number): BiomeDef {
  let biome = BIOMES[0];
  for (const candidate of BIOMES) {
    if (depth >= candidate.minDepth) {
      biome = candidate;
    } else {
      break;
    }
  }
  return biome;
}
