# ⛏️ Pocket Miner

A mobile-first pixel mining game — dig deep, crack TNT, loot treasure chests, dodge cave critters, and upgrade your pickaxe.

Built with **Phaser 3** + **TypeScript** + **Vite**. All art and audio are generated procedurally (no binary assets).

## ▶️ Play now

**https://mariodod.github.io/miner-game/**

Best in portrait on a phone — works on desktop too. Every push to `main` deploys automatically via GitHub Pages.

## 🎮 How to play

- Tap a block **next to or directly below** the miner to swing — no diagonal mining.
- Tap empty (or freshly broken) cells to walk.
- Mine **25m chest milestones** for gold and diamonds; a boss guards every **100m**.
- Keep an eye on your **HP** — cave critters bite. Hearts drop from broken blocks.
- Spend gold in the **Shop**: pickaxes and skins. Diamonds come from milestones and chests.
- **Give Up** is a two-tap confirm — a stray tap never ends a run.

## 🛠 Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## 📱 Android

A Capacitor project lives in `android/` (with AdMob rewarded-ad test units):

```bash
npm run cap:sync      # build web + copy into the native project
npm run android:apk   # build a debug APK
```

## ☁️ Deployment

`.github/workflows/deploy.yml` builds the game and publishes `dist/` to GitHub Pages on every push to `main` (Pages source: **GitHub Actions**).
