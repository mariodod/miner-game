import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { AdRewardModal } from '../ui/AdRewardModal';

export type AdPlacement = 'double_gold' | 'revive' | 'free_chest';

/**
 * Google-provided rewarded test ad unit. It always fills with a test ad, so
 * the native flow can be exercised safely on any device. Replace with the
 * production ad unit ID before publishing.
 */
const REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

type AdMobModule = typeof import('@capacitor-community/admob');

export class AdManager {
  private static instance: AdManager;

  private readonly native: boolean;
  private admob: AdMobModule | null = null;
  private initPromise: Promise<boolean> | null = null;

  private constructor() {
    this.native = Capacitor.isNativePlatform();
  }

  public static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  /** True when running inside the Capacitor native shell (Android/iOS). */
  public get isNativePlatform(): boolean {
    return this.native;
  }

  /**
   * Prompts the player to watch a voluntary rewarded ad.
   * Native builds play a real AdMob rewarded video; the browser shows a
   * Phaser-native simulated ad so the whole reward flow stays testable.
   */
  public showRewardedAd(
    scene: Phaser.Scene,
    placement: AdPlacement,
    title: string,
    rewardText: string,
    onSuccess: () => void,
    onCancel?: () => void
  ): void {
    if (this.native) {
      void this.showNativeRewardedAd(scene, onSuccess, onCancel);
      return;
    }
    new AdRewardModal(scene, { placement, title, rewardText, onSuccess, onCancel });
  }

  // ─── Native AdMob Flow ──────────────────────────────────────────────────

  private async showNativeRewardedAd(
    scene: Phaser.Scene,
    onSuccess: () => void,
    onCancel?: () => void
  ): Promise<void> {
    const admob = await this.ensureAdMob();
    if (!admob) {
      AdManager.showToast(scene, '😕 Ads unavailable right now');
      onCancel?.();
      return;
    }

    try {
      await admob.AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_UNIT_ID });
    } catch (err) {
      console.warn('Rewarded ad failed to load:', err);
      AdManager.showToast(scene, '😕 Ad not available — try again later');
      onCancel?.();
      return;
    }

    try {
      await admob.AdMob.showRewardVideoAd();
      onSuccess();
    } catch {
      // The player dismissed the ad before earning the reward.
      onCancel?.();
    }
  }

  /** Lazily initializes the AdMob SDK (once per app session). */
  private async ensureAdMob(): Promise<AdMobModule | null> {
    if (this.admob) return this.admob;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const module = await import('@capacitor-community/admob');
          await module.AdMob.initialize({ initializeForTesting: true });
          this.admob = module;
          return true;
        } catch (err) {
          console.warn('AdMob initialization failed:', err);
          this.initPromise = null; // allow a retry on the next request
          return false;
        }
      })();
    }
    const ok = await this.initPromise;
    return ok ? this.admob : null;
  }

  /** Small non-blocking notice used when ads cannot be served. */
  private static showToast(scene: Phaser.Scene, message: string): void {
    const { width, height } = scene.scale;
    const toast = scene.add
      .text(width / 2, height - 90, message, {
        fontSize: '13px',
        color: '#f8fafc',
        backgroundColor: '#1e293b',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
      .setAlpha(0);

    scene.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 150,
      hold: 1400,
      yoyo: true,
      onComplete: () => toast.destroy(),
    });
  }
}

export const Ads = AdManager.getInstance();
