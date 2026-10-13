import Phaser from 'phaser';
import { AdRewardModal } from '../ui/AdRewardModal';

export type AdPlacement = 'double_gold' | 'revive' | 'free_chest';

export class AdManager {
  private static instance: AdManager;

  private constructor() {
    // In capacitor mobile, capacitor-community/admob would initialize here
  }

  public static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  /**
   * Prompts the player to watch a voluntary rewarded ad.
   * Uses a Phaser-native modal overlay for a seamless in-game experience.
   */
  public showRewardedAd(
    scene: Phaser.Scene,
    placement: AdPlacement,
    title: string,
    rewardText: string,
    onSuccess: () => void,
    onCancel?: () => void
  ): void {
    new AdRewardModal(scene, {
      placement,
      title,
      rewardText,
      onSuccess,
      onCancel,
    });
  }
}

export const Ads = AdManager.getInstance();