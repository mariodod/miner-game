import Phaser from 'phaser';

/**
 * Tiny game-feel (juice) helpers: hit-stop freezes and camera shakes.
 * Kept scene-agnostic so any scene can borrow them.
 */

let freezeMsLeft = 0;

/** Briefly slows the scene's clock + tweens for a punchy hit-stop moment. */
export function freeze(scene: Phaser.Scene, ms: number): void {
  freezeMsLeft = Math.max(freezeMsLeft, ms);
  scene.time.timeScale = 0.08;
  scene.tweens.timeScale = 0.08;
}

/**
 * Drains the active hit-stop using the raw frame delta (never the slowed
 * clock), so the freeze always lasts `ms` of real play time. Call once per
 * frame from the scene that triggered the freeze.
 */
export function tickFreeze(scene: Phaser.Scene, deltaMs: number): void {
  if (freezeMsLeft <= 0) return;
  freezeMsLeft -= deltaMs;
  if (freezeMsLeft <= 0) {
    freezeMsLeft = 0;
    scene.time.timeScale = 1;
    scene.tweens.timeScale = 1;
  }
}

/** Camera shake shorthand. */
export function shake(scene: Phaser.Scene, durationMs: number, intensity: number): void {
  scene.cameras.main.shake(durationMs, intensity);
}
