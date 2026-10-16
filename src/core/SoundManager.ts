/**
 * SoundManager — Lightweight Web Audio API wrapper for game sound effects.
 * Generates procedural sounds programmatically (no external audio files needed).
 */

export type SoundEffect =
  | 'block_hit'
  | 'block_break'
  | 'gold_collect'
  | 'diamond_collect'
  | 'heart_collect'
  | 'pickaxe_swing'
  | 'pickaxe_equip'
  | 'shop_buy'
  | 'upgrade_buy'
  | 'shop_cannot_afford'
  | 'level_up'
  | 'explosion'
  | 'record'
  | 'treasure'
  | 'boss'
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
  heart_collect: {
    type: 'triangle',
    frequency: [392, 587, 784], // G4, D5, G5 — warm heal chime
    duration: 0.4,
    volume: 0.18,
    attack: 0.01,
    decay: 0.32,
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
  upgrade_buy: {
    type: 'triangle',
    frequency: [392, 523, 659, 880],
    duration: 0.4,
    volume: 0.2,
    attack: 0.01,
    decay: 0.32,
    pitchSlide: 2,
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
  record: {
    type: 'triangle',
    frequency: [523, 659, 784, 1047, 1397], // C5 E5 G5 C6 F6 — victory fanfare
    duration: 0.7,
    volume: 0.22,
    attack: 0.01,
    decay: 0.55,
    pitchSlide: 2,
  },
  treasure: {
    type: 'triangle',
    frequency: [784, 988, 1175, 1568], // G5 B5 D6 G6 — sparkling jackpot
    duration: 0.5,
    volume: 0.2,
    attack: 0.01,
    decay: 0.4,
  },
  boss: {
    type: 'sawtooth',
    frequency: [98, 87, 73], // low descending growl
    duration: 0.6,
    volume: 0.18,
    attack: 0.02,
    decay: 0.5,
    pitchSlide: -6,
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

// ── Procedural background music ─────────────────────────────────────────────
// A gentle 4-chord chiptune loop (Am → F → C → G). A lookahead scheduler
// queues notes slightly in the future so timing stays steady even when the
// main thread is busy; everything is oscillator-generated (no audio assets).

interface MusicChord {
  bass: number; // Root note for the bassline
  arp: [number, number, number, number]; // Chord tones for the arpeggio
}

const MUSIC_STEP_DURATION = 0.3125; // 8th note at 96 BPM
const MUSIC_STEPS_PER_CHORD = 8;
const MUSIC_LOOP_STEPS = MUSIC_STEPS_PER_CHORD * 4;

const MUSIC_CHORDS: MusicChord[] = [
  { bass: 110.0, arp: [220.0, 261.63, 329.63, 261.63] }, // A minor
  { bass: 87.31, arp: [174.61, 220.0, 261.63, 220.0] }, // F major
  { bass: 130.81, arp: [261.63, 329.63, 392.0, 329.63] }, // C major
  { bass: 98.0, arp: [196.0, 246.94, 293.66, 246.94] }, // G major
];

export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private initialized: boolean = false;

  // Music loop state
  private musicGain: GainNode | null = null;
  private musicPlaying: boolean = false;
  private musicRequested: boolean = false; // set before the context exists
  private musicScheduler: number | null = null;
  private musicStep: number = 0;
  private nextNoteTime: number = 0;

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

      // Music may have been requested before the first user gesture unlocked audio.
      if (this.musicRequested) {
        this.startMusic();
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
    this.ensureRunning();

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

  // ── Background music API ──────────────────────────────────────────────────

  /**
   * Starts the background music loop. Safe to call before the first user
   * gesture — the loop begins as soon as audio gets initialized/unlocked.
   */
  public startMusic(): void {
    this.musicRequested = true;
    if (!this.initialized || !this.audioContext || !this.masterGain) return;
    if (this.musicPlaying) return;

    this.musicPlaying = true;

    if (!this.musicGain) {
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.masterGain);
    }

    this.musicStep = 0;
    this.nextNoteTime = this.audioContext.currentTime + 0.1;
    this.musicScheduler = window.setInterval(() => this.scheduleMusic(), 40);
    this.scheduleMusic();
  }

  public stopMusic(): void {
    this.musicRequested = false;
    if (!this.musicPlaying) return;
    this.musicPlaying = false;

    if (this.musicScheduler !== null) {
      window.clearInterval(this.musicScheduler);
      this.musicScheduler = null;
    }
  }

  /** Keeps the music loop in sync with the persisted settings flag. */
  public syncMusic(enabled: boolean): void {
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  public isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  private ensureRunning(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  /** Lookahead scheduler: queues every note due within the next 150 ms. */
  private scheduleMusic(): void {
    const ctx = this.audioContext;
    if (!ctx || !this.musicGain) return;

    this.ensureRunning();
    if (ctx.state !== 'running') {
      // Keep the playhead near "now" so no burst of stale notes fires once
      // the context resumes (autoplay unlock, tab regains focus, ...).
      this.nextNoteTime = ctx.currentTime + 0.1;
      return;
    }

    if (this.nextNoteTime < ctx.currentTime) {
      this.nextNoteTime = ctx.currentTime + 0.05;
    }

    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      this.scheduleMusicStep(this.musicStep, this.nextNoteTime);
      this.musicStep = (this.musicStep + 1) % MUSIC_LOOP_STEPS;
      this.nextNoteTime += MUSIC_STEP_DURATION;
    }
  }

  private scheduleMusicStep(step: number, time: number): void {
    const chord = MUSIC_CHORDS[Math.floor(step / MUSIC_STEPS_PER_CHORD)];
    const inChord = step % MUSIC_STEPS_PER_CHORD;

    // Bassline on the quarter notes
    if (inChord % 4 === 0) {
      this.scheduleMusicNote(chord.bass, time, MUSIC_STEP_DURATION * 1.8, 0.1, 'square');
    }

    // Arpeggio on every 8th note; second half of each chord jumps an octave
    const handle = inChord % 4;
    const octave = inChord < 4 ? 1 : 2;
    this.scheduleMusicNote(
      chord.arp[handle] * octave,
      time,
      MUSIC_STEP_DURATION * 0.85,
      0.045,
      'triangle'
    );
  }

  private scheduleMusicNote(
    frequency: number,
    time: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    const ctx = this.audioContext;
    if (!ctx || !this.musicGain) return;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
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
    this.stopMusic();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
      this.musicGain = null;
      this.initialized = false;
    }
  }
}

export const Sound = SoundManager.getInstance();