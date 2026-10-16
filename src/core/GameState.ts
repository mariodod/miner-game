import { Capacitor } from '@capacitor/core';
import { PickaxeId, PICKAXES_CONFIG } from '../config/pickaxes';
import { SKINS_CONFIG, UPGRADES_CONFIG, UpgradeId, getUpgradeCost } from '../config/economy';
import { BiomeDef, getBiomeForDepth } from '../config/biomes';

export interface GameSaveData {
  gold: number;
  diamonds: number;
  highScoreDepth: number;
  equippedPickaxe: PickaxeId;
  unlockedPickaxes: PickaxeId[];
  equippedSkin: string;
  unlockedSkins: string[];
  upgrades: Record<UpgradeId, number>;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  tutorialDone: boolean;
}

const STORAGE_KEY = 'pocket_miner_save_v1';

/** Player health for a single run (death opens the revive ad offer). */
export const PLAYER_MAX_HP = 10;

/** Depth reward cadence: a chest is earned every 25 m of a run. */
export const MILESTONE_STEP_M = 25;
/** Mini-boss cadence: an elite guard blocks the way every 100 m. */
export const BOSS_STEP_M = 100;
/** A "new record" needs at least this much prior history to be worth cheering. */
const RECORD_MIN_PRIOR_DEPTH = 10;

/** Payload emitted for every milestone chest crossing. */
export interface DepthMilestoneInfo {
  /** Milestone depth in meters (25, 50, 75, ...). */
  depth: number;
  /** How many milestones were crossed at once (usually 1). */
  count: number;
  gold: number;
  diamonds: number;
}

/** Payload emitted the first time a run beats the previous best depth. */
export interface NewRecordInfo {
  depth: number;
  previous: number;
}

/** Payload emitted when a run crosses a 100 m threshold (elite guard). */
export interface BossSpawnInfo {
  depth: number;
  tier: number;
}

export class GameStateManager {
  private static instance: GameStateManager;

  private data: GameSaveData;
  private hapticsModule: typeof import('@capacitor/haptics') | null = null;

  // Run-specific transient stats
  public currentDepth: number = 0;
  public runGoldCollected: number = 0;
  public runDiamondsCollected: number = 0;
  public runBlocksBroken: number = 0;
  public explosiveCharge: number = 0; // For explosive pickaxe counter
  public playerHp: number = PLAYER_MAX_HP; // Transient run health

  // Milestone / record / biome tracking (reset by startNewRun)
  private lastMilestone: number = 0;
  private recordCelebratedThisRun: boolean = false;
  private lastBiomeId: string = 'topsoil';
  private lastBossMilestone: number = 0;

  private listeners: Map<string, Set<(val: any) => void>> = new Map();

  private constructor() {
    this.data = this.load();
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  // --- Persistence ---
  private getDefaultData(): GameSaveData {
    return {
      gold: 0,
      diamonds: 0,
      highScoreDepth: 0,
      equippedPickaxe: 'wood',
      unlockedPickaxes: ['wood'],
      equippedSkin: 'classic',
      unlockedSkins: ['classic'],
      upgrades: { power: 0, speed: 0, fortune: 0 },
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      tutorialDone: false,
    };
  }

  public load(): GameSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const defaults = this.getDefaultData();
        return {
          ...defaults,
          ...parsed,
          upgrades: { ...defaults.upgrades, ...(parsed.upgrades ?? {}) },
        };
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }
    return this.getDefaultData();
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // --- Event Handling ---
  public on(event: string, callback: (val: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: (val: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, value: any): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(value);
      } catch (err) {
        console.error(`Error in GameState listener for ${event}:`, err);
      }
    });
  }

  // --- Getters ---
  public get gold(): number {
    return this.data.gold;
  }

  public get diamonds(): number {
    return this.data.diamonds;
  }

  public get highScoreDepth(): number {
    return this.data.highScoreDepth;
  }

  public get equippedPickaxe(): PickaxeId {
    return this.data.equippedPickaxe;
  }

  public get unlockedPickaxes(): PickaxeId[] {
    return [...this.data.unlockedPickaxes];
  }

  public get equippedSkin(): string {
    return this.data.equippedSkin;
  }

  public get unlockedSkins(): string[] {
    return [...this.data.unlockedSkins];
  }

  public get upgradeLevels(): Record<UpgradeId, number> {
    return { ...this.data.upgrades };
  }

  public getUpgradeLevel(id: UpgradeId): number {
    return this.data.upgrades[id] ?? 0;
  }

  /** Gold cost of the next upgrade level, or null when the track is maxed. */
  public getUpgradeCost(id: UpgradeId): number | null {
    const config = UPGRADES_CONFIG.find((u) => u.id === id);
    if (!config) return null;
    return getUpgradeCost(config, this.getUpgradeLevel(id));
  }

  /** Pickaxe efficiency including the Power upgrade bonus. */
  public getEffectiveEfficiency(baseEfficiency: number): number {
    return baseEfficiency + this.getUpgradeLevel('power');
  }

  /** Swing animation speed multiplier from the Speed upgrade. */
  public get swingSpeedMultiplier(): number {
    return 1 + this.getUpgradeLevel('speed') * 0.08;
  }

  /** Gold multiplier from the Fortune upgrade. */
  public get goldMultiplier(): number {
    return 1 + this.getUpgradeLevel('fortune') * 0.1;
  }

  public get soundEnabled(): boolean {
    return this.data.soundEnabled;
  }

  public get musicEnabled(): boolean {
    return this.data.musicEnabled;
  }

  public get hapticsEnabled(): boolean {
    return this.data.hapticsEnabled;
  }

  public get tutorialDone(): boolean {
    return this.data.tutorialDone;
  }

  // --- Actions ---
  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.data.gold += amount;
    this.runGoldCollected += amount;
    this.save();
    this.emit('goldChanged', this.data.gold);
  }

  public spendGold(amount: number): boolean {
    if (this.data.gold >= amount) {
      this.data.gold -= amount;
      this.save();
      this.emit('goldChanged', this.data.gold);
      return true;
    }
    return false;
  }

  public addDiamonds(amount: number): void {
    if (amount <= 0) return;
    this.data.diamonds += amount;
    this.runDiamondsCollected += amount;
    this.save();
    this.emit('diamondsChanged', this.data.diamonds);
  }

  public spendDiamonds(amount: number): boolean {
    if (this.data.diamonds >= amount) {
      this.data.diamonds -= amount;
      this.save();
      this.emit('diamondsChanged', this.data.diamonds);
      return true;
    }
    return false;
  }

  public updateDepth(depth: number): void {
    if (depth > this.currentDepth) {
      const previousHigh = this.data.highScoreDepth;
      this.currentDepth = depth;
      if (this.currentDepth > this.data.highScoreDepth) {
        this.data.highScoreDepth = this.currentDepth;
        this.save();
        this.emit('highScoreChanged', this.data.highScoreDepth);
      }
      this.emit('depthChanged', this.currentDepth);
      this.checkMilestones();
      this.checkRecord(previousHigh);
      this.checkBiome();
      this.checkBossMilestone();
    }
  }

  /** Emits a reward event for every 25 m boundary crossed. */
  private checkMilestones(): void {
    let count = 0;
    let gold = 0;
    let diamonds = 0;

    while (this.currentDepth >= (this.lastMilestone + 1) * MILESTONE_STEP_M) {
      this.lastMilestone += 1;
      count += 1;
      gold += 20 * this.lastMilestone;
      diamonds += Math.ceil(this.lastMilestone / 2);
    }

    if (count === 0) return;
    this.emit('depthMilestone', {
      depth: this.lastMilestone * MILESTONE_STEP_M,
      count,
      gold,
      diamonds,
    } satisfies DepthMilestoneInfo);
  }

  /** Fires once per run when the player passes their previous best depth. */
  private checkRecord(previousHigh: number): void {
    if (this.recordCelebratedThisRun) return;
    if (previousHigh < RECORD_MIN_PRIOR_DEPTH) return;
    if (this.currentDepth <= previousHigh) return;

    this.recordCelebratedThisRun = true;
    this.emit('newRecord', { depth: this.currentDepth, previous: previousHigh } satisfies NewRecordInfo);
  }

  /** Emits when the depth enters a new visual biome band. */
  private checkBiome(): void {
    const biome: BiomeDef = getBiomeForDepth(this.currentDepth);
    if (biome.id === this.lastBiomeId) return;
    this.lastBiomeId = biome.id;
    this.emit('biomeChanged', biome);
  }

  /** Emits once per 100 m threshold crossed (an elite guard is dispatched). */
  private checkBossMilestone(): void {
    const tier = Math.floor(this.currentDepth / BOSS_STEP_M);
    if (tier <= this.lastBossMilestone) return;
    this.lastBossMilestone = tier;
    this.emit('bossSpawn', { depth: tier * BOSS_STEP_M, tier } satisfies BossSpawnInfo);
  }

  public recordBlockBroken(): void {
    this.runBlocksBroken++;
  }

  /** Updates the transient run HP and notifies the HUD. */
  public setPlayerHp(value: number): void {
    this.playerHp = Math.max(0, Math.min(PLAYER_MAX_HP, Math.round(value)));
    this.emit('playerHpChanged', this.playerHp);
  }

  public equipPickaxe(id: PickaxeId): boolean {
    if (this.data.unlockedPickaxes.includes(id)) {
      this.data.equippedPickaxe = id;
      this.save();
      this.emit('pickaxeChanged', id);
      return true;
    }
    return false;
  }

  public unlockPickaxe(id: PickaxeId): boolean {
    const config = PICKAXES_CONFIG[id];
    if (!config) return false;
    if (this.data.unlockedPickaxes.includes(id)) return true;

    // Check afford
    if (this.data.gold >= config.priceGold && this.data.diamonds >= config.priceDiamonds) {
      this.data.gold -= config.priceGold;
      this.data.diamonds -= config.priceDiamonds;
      this.data.unlockedPickaxes.push(id);
      this.data.equippedPickaxe = id;
      this.save();
      this.emit('goldChanged', this.data.gold);
      this.emit('diamondsChanged', this.data.diamonds);
      this.emit('pickaxeChanged', id);
      return true;
    }
    return false;
  }

  public equipSkin(id: string): boolean {
    if (this.data.unlockedSkins.includes(id)) {
      this.data.equippedSkin = id;
      this.save();
      this.emit('skinChanged', id);
      return true;
    }
    return false;
  }

  public unlockSkin(id: string): boolean {
    const skin = SKINS_CONFIG.find((s) => s.id === id);
    if (!skin) return false;
    if (this.data.unlockedSkins.includes(id)) return true;

    if (this.data.diamonds >= skin.priceDiamonds) {
      this.data.diamonds -= skin.priceDiamonds;
      this.data.unlockedSkins.push(id);
      this.data.equippedSkin = id;
      this.save();
      this.emit('diamondsChanged', this.data.diamonds);
      this.emit('skinChanged', id);
      return true;
    }
    return false;
  }

  /** Buys the next level of an incremental pickaxe upgrade with gold. */
  public purchaseUpgrade(id: UpgradeId): boolean {
    const config = UPGRADES_CONFIG.find((u) => u.id === id);
    if (!config) return false;

    const level = this.getUpgradeLevel(id);
    const cost = getUpgradeCost(config, level);
    if (cost === null || this.data.gold < cost) return false;

    this.data.gold -= cost;
    this.data.upgrades[id] = level + 1;
    this.save();
    this.emit('goldChanged', this.data.gold);
    this.emit('upgradesChanged', this.upgradeLevels);
    return true;
  }

  public toggleSound(): boolean {
    this.data.soundEnabled = !this.data.soundEnabled;
    this.save();
    this.emit('soundToggled', this.data.soundEnabled);
    return this.data.soundEnabled;
  }

  public toggleMusic(): boolean {
    this.data.musicEnabled = !this.data.musicEnabled;
    this.save();
    this.emit('musicToggled', this.data.musicEnabled);
    return this.data.musicEnabled;
  }

  public toggleHaptics(): boolean {
    this.data.hapticsEnabled = !this.data.hapticsEnabled;
    this.save();
    this.emit('hapticsToggled', this.data.hapticsEnabled);
    return this.data.hapticsEnabled;
  }

  /** First-run tutorial is considered complete once every hint was shown. */
  public markTutorialDone(): void {
    if (this.data.tutorialDone) return;
    this.data.tutorialDone = true;
    this.save();
    this.emit('tutorialDoneChanged', true);
  }

  /** Queues the tutorial to replay on the next run (settings > Replay). */
  public resetTutorial(): void {
    this.data.tutorialDone = false;
    this.save();
    this.emit('tutorialDoneChanged', false);
  }

  public triggerHaptic(durationMs: number = 25): void {
    if (!this.data.hapticsEnabled) return;

    // Native app: use the Capacitor haptics engine (the vibrate API is
    // unreliable inside the Android WebView).
    if (Capacitor.isNativePlatform()) {
      void this.vibrateNative(durationMs);
      return;
    }

    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore fallback
      }
    }
  }

  private async vibrateNative(durationMs: number): Promise<void> {
    try {
      if (!this.hapticsModule) {
        this.hapticsModule = await import('@capacitor/haptics');
      }
      const { Haptics, ImpactStyle } = this.hapticsModule;
      await Haptics.impact({
        style: durationMs >= 30 ? ImpactStyle.Medium : ImpactStyle.Light,
      });
    } catch {
      // Haptics are best-effort only.
    }
  }

  public startNewRun(): void {
    this.currentDepth = 0;
    this.runGoldCollected = 0;
    this.runDiamondsCollected = 0;
    this.runBlocksBroken = 0;
    this.explosiveCharge = 0;
    this.playerHp = PLAYER_MAX_HP;
    this.lastMilestone = 0;
    this.recordCelebratedThisRun = false;
    this.lastBiomeId = 'topsoil';
    this.lastBossMilestone = 0;
    this.emit('depthChanged', 0);
    this.emit('playerHpChanged', this.playerHp);
  }

  public doubleRunGold(): void {
    const bonus = this.runGoldCollected;
    this.addGold(bonus);
  }
}

export const GameState = GameStateManager.getInstance();
