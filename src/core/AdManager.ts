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
   * In web/development mode, shows an interactive overlay modal simulating the rewarded ad experience.
   */
  public showRewardedAd(
    placement: AdPlacement,
    title: string,
    rewardText: string,
    onSuccess: () => void,
    onCancel?: () => void
  ): void {
    // Show simulated modal in browser
    const overlay = document.createElement('div');
    overlay.id = 'ad-simulation-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.textAlign = 'center';

    let countdown = 3;

    overlay.innerHTML = `
      <div style="background: #1e1b4b; border: 2px solid #818cf8; border-radius: 16px; padding: 24px; max-width: 320px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="font-size: 24px; margin-bottom: 8px;">📺 Rewarded Ad (${placement.replace('_', ' ').toUpperCase()})</div>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 16px;">${title}</p>
        <div style="font-size: 16px; font-weight: bold; color: #facc15; margin-bottom: 20px;">${rewardText}</div>
        <div id="ad-timer" style="font-size: 20px; font-weight: bold; color: #38bdf8; margin-bottom: 20px;">
          Ad playing... (${countdown}s)
        </div>
        <button id="ad-skip-btn" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px; opacity: 0.7;">
          Cancel / Skip
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const timerEl = overlay.querySelector('#ad-timer') as HTMLDivElement;
    const skipBtn = overlay.querySelector('#ad-skip-btn') as HTMLButtonElement;

    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        if (timerEl) timerEl.innerText = `Ad playing... (${countdown}s)`;
      } else {
        clearInterval(interval);
        if (timerEl) {
          timerEl.innerText = '✅ Reward Earned!';
          timerEl.style.color = '#4ade80';
        }
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          onSuccess();
        }, 600);
      }
    }, 1000);

    skipBtn.addEventListener('click', () => {
      clearInterval(interval);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (onCancel) onCancel();
    });
  }
}

export const Ads = AdManager.getInstance();
