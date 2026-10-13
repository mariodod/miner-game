/**
 * SoundManager — Lightweight Web Audio API wrapper for game sound effects.
 * Generates procedural sounds programmatically (no external audio files needed).
 */

export type SoundEffect =
  | 'block_hit'
  | 'block_break'
  | 'gold_collect'
  | 'diamond_collect'
  | 'pickaxe_swing'
  | 'pickaxe_equip'
  | 'shop_buy'
  | 'shop_cannot_afford'
  | 'level_up'
  | 'explosion'
  | 'ui_click'
  | 'game_over';

interface SoundConfig {
  type: OscillatorType;
  frequency: number | number[];
  duration: number;
  volume: number;
  attack: number;
  decay: number;
  pitchSlide?: number; // semitones to slide during decay
}

const SOUND_PRESETS: Record<SoundEffect, SoundConfig> = {
  block_hit: {
    type: 'square',
    frequency: [180, 220],
    duration: 0.08,
    volume: 0.15,
    attack: 0.005,
    decay: 0.07,
  },
  block_break: {
    type: 'sawtooth',
    frequency: [120, 80, 60],
    duration: 0.18,
    volume: 0.2,
    attack: 0.01,
    decay: 0.15,
    pitchSlide: -12,
  },
  gold_collect: {
    type: 'sine',
    frequency: [523, 659, 784, 1047], // C5, E5, G5, C6
    duration: 0.35,
    volume: 0.18,
    attack: 0.01,
    decay: 0.3,
  },
  diamond_collect: {
    type: 'sine',
    frequency: [880, 1108, 1318, 1760], // A5, C#6, E6, A6
    duration: 0.5,
    volume: 0.2,
    attack: 0.01,
    decay: 0.4,
  },
  pickaxe_swing: {
    type: 'triangle',
    frequency: 150,
    duration: 0.12,
    volume: 0.12,
    attack: 0.01,
    decay: 0.1,
    pitchSlide: -8,
  },
  pickaxe_equip: {
    type: 'sine',
    frequency: [330, 440, 554],
    duration: 0.25,
    volume: 0.15,
    attack: 0.01,
    decay: 0.2,
  },
  shop_buy: {
    type: 'sine',
    frequency: [659, 784, 988],
    duration: 0.3,
    volume: 0.18,
    attack: 0.01,
    decay: 0.25,
  },
  shop_cannot_afford: {
    type: 'square',
    frequency: [110, 82],
    duration: 0.25,
    volume: 0.15,
    attack: 0.01,
    decay: 0.2,
    pitchSlide: -5,
  },
  level_up: {
    type: 'sine',
    frequency: [523, 659, 784, 1047, 1318],
    duration: 0.6,
    volume: 0.2,
    attack: 0.01,
    decay: 0.5,
  },
  explosion: {
    type: 'sawtooth',
    frequency: [60, 40, 30, 20],
    duration: 0.5,
    volume: 0.25,
    attack: 0.02,
    decay: 0.45,
    pitchSlide: -24,
  },
  ui_click: {
    type: 'square',
    frequency: 800,
    duration: 0.06,
    volume: 0.1,
    attack: 0.001,
    decay: 0.05,
  },
  game_over: {
    type: 'sawtooth',
    frequency: [220, 165, 110],
    duration: 0.8,
    volume: 0.2,
    attack: 0.05,
    decay: 0.7,
    pitchSlide: -12,
  },
};

export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Initialize AudioContext (must be called after user interaction)
   */
  public init(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.5;
      this.initialized = true;

      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (e) {
      console.warn('Web Audio API not available:', e);
      this.enabled = false;
    }
  }

  /**
   * Play a sound effect by name
   */
  public play(effect: SoundEffect): void {
    if (!this.enabled || !this.initialized || !this.audioContext || !this.masterGain) return;

    const config = SOUND_PRESETS[effect];
    if (!config) return;

    const now = this.audioContext.currentTime;

    // Handle frequency arrays (sequences) vs single frequency
    const frequencies = Array.isArray(config.frequency) ? config.frequency : [config.frequency];
    const noteDuration = config.duration / frequencies.length;

    frequencies.forEach((freq, i) => {
      const startTime = now + i * noteDuration;
      const endTime = startTime + noteDuration;

      // Create oscillator
      const osc = this.audioContext!.createOscillator();
      osc.type = config.type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Pitch slide
      if (config.pitchSlide) {
        const targetFreq = freq * Math.pow(2, config.pitchSlide / 12);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, endTime);
      }

      // Create gain envelope
      const gain = this.audioContext!.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(config.volume, startTime + config.attack);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      // Connect: osc -> gain -> masterGain
      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(endTime);
    });
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Toggle sound on/off
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
      this.initialized = false;
    }
  }
}

export const Sound = SoundManager.getInstance();