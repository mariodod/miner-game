# Mobile Miner Game — Architecture & Implementation Plan

## 1. Project Overview & Vision
A fast-paced 2D mobile mining game where players dig deep underground, gather valuable ores, combat depth-scaling cave monsters, unlock specialized pickaxes with area-of-effect abilities, customize miner skins, and boost rewards with voluntary rewarded ads.

---

## 2. Recommended Tech Stack
For an AI-assisted development workflow targeting mobile devices, the optimal technology stack is:

| Layer | Technology | Rationale |
|---|---|---|
| **Core Game Engine** | **Phaser 3 + TypeScript** | High performance 2D WebGL/Canvas engine; fully code-driven (no binary assets/opaque scene files), allowing rapid AI iteration, precise game math, and clean component structure. |
| **Bundler & Tooling** | **Vite** | Ultra-fast HMR (Hot Module Replacement) and immediate browser testing in mobile responsive mode. |
| **Mobile Runtime** | **Capacitor** | Modern standard for wrapping web apps into native Android (APK/AAB) and iOS apps with direct access to hardware APIs. |
| **Monetization (Ads)** | **@capacitor-community/admob** (with Web Fallback Simulator) | Rewarded video ad SDK integration for voluntary ads (e.g., revive, double gold, free diamond chest). Includes a mock/simulator for local web testing. |
| **Persistence** | **LocalStorage / Capacitor Preferences** | Automatic saving of gold, diamonds, owned pickaxes, equipped skins, and high scores. |
| **Sound & Haptics** | **Web Audio API + @capacitor/haptics** | Tactile feedback on block hits/breaking and dynamic sound effects. |

---

## 3. Core Mechanics & Game Design

### 3.1. Mining Grid & Hit System
- **Grid Generation**: Procedural vertical shaft generated in chunks/levels as the miner digs deeper.
- **Block Types**:
  - `Dirt` (Soft)
  - `Stone` (Medium)
  - `Hard Rock / Granite` (Hard)
  - `Obsidian / Bedrock` (Ultra Hard)
  - `Gold Ore` & `Diamond Ore` (Valuable deposits)
- **Hit Calculation Matrix**:
  - Each block has a base hardness rating \(H\).
  - Each pickaxe has an efficiency tier \(E\).
  - Hits to break = \(\max(1, \lceil H / E \rceil)\).
  - When hitting a block, hit points decrement with cracking visual stages (cracks 1 to 4) and particle dust.

### 3.2. Specialized Pickaxes
Players can craft and equip different pickaxe classes:
1. **Standard Pickaxes** (Wood, Stone, Iron, Gold, Diamond, Obsidian):
   - Progressive hit efficiency (reduces hits required per block tier).
2. **Horizontal Cleaver ("Tunnel Drill")**:
   - Breaks the target block and immediately damages adjacent left & right blocks.
3. **Vertical Pulverizer ("Piledriver")**:
   - Breaks the target block and penetrates 1–2 blocks directly beneath.
4. **Explosive / Cross Breaker**:
   - Charges on consecutive hits, detonating a 3x3 blast when fully charged.

### 3.3. Enemies & Depth Scaling
- Enemies spawn in underground caverns or dormant inside specific blocks.
- **Health Formula**: Enemy HP directly mirrors the block hit points of the current depth level (e.g., Level 3 blocks take 4 hits \(\rightarrow\) Level 3 Bats/Goblins take 4 pickaxe hits).
- **Combat**: Tapping or swinging the pickaxe at an enemy deals 1 hit of damage. Defeating enemies drops bonus gold/diamonds.

### 3.4. Economy & Shop
- **Currencies**:
  - **Gold (Coins)**: Common currency mined abundantly; used for incremental pickaxe upgrades (speed, durability, damage).
  - **Diamonds (Gems)**: Rare underground gems; used to unlock unique pickaxes and cosmetic miner skins.
- **Shop Modules**:
  - **Pickaxe Forge**: Unlock new pickaxes and upgrade efficiency.
  - **Skin Wardrobe**: Character customization (e.g., Classic Miner, Cyberpunk Miner, Mole Suit, Golden Knight).

### 3.5. Voluntary Rewarded Ads
- **Non-intrusive design**: No forced pop-up banners or interrupted gameplay.
- **Reward Opportunities**:
  - *Post-Run Multiplier*: "Watch an ad to double collected run gold (2x)".
  - *Second Chance*: "Watch an ad to revive once per run".
  - *Free Diamond Chest*: "Watch an ad to open a mystery gem chest in the shop".

---

## 4. Architecture & Directory Structure

```
miner-game/
├── android/                   # Generated Capacitor Android native project
├── public/
│   └── assets/                # Audio, spritesheets, icons
├── src/
│   ├── config/                # Game constants, block tables, balance numbers
│   │   ├── blocks.ts          # Block hardness, drop rates, colors
│   │   ├── pickaxes.ts        # Pickaxe stats, special abilities
│   │   └── economy.ts         # Shop prices, upgrades
│   ├── core/
│   │   ├── GameState.ts       # Central state (gold, diamonds, inventory, save/load)
│   │   ├── SoundManager.ts    # Procedural SFX + chiptune music (Web Audio)
│   │   └── AdManager.ts       # Rewarded ad interface (mock + Capacitor AdMob)
│   ├── entities/
│   │   ├── Player.ts          # Miner sprite, animations, movement
│   │   ├── Block.ts           # Block logic, health states, crack animations
│   │   └── Enemy.ts           # Enemy AI, patrol, health synced to level
│   ├── scenes/
│   │   ├── BootScene.ts       # Asset loading & splash
│   │   ├── MenuScene.ts       # Title screen, play button
│   │   ├── GameScene.ts       # Primary mining loop, camera, touch controls
│   │   ├── ShopScene.ts       # Pickaxe & skin store
│   │   ├── PauseScene.ts      # Pause overlay (resume / settings / quit run)
│   │   └── GameOverScene.ts   # Run summary, voluntary ad double reward
│   ├── ui/
│   │   ├── HUD.ts             # Depth counter, gold/diamond counter
│   │   ├── SettingsModal.ts   # Sound / music / vibration settings
│   │   └── AdRewardModal.ts   # Rewarded ad prompt UI
│   ├── index.html
│   └── main.ts                # Phaser game initialization
├── capacitor.config.ts        # Mobile deployment configuration
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Development Roadmap & Milestones

- **Milestone 1 — Project Initialization & Core Framework**:
  - Initialize Vite + TypeScript + Phaser 3.
  - Implement mobile responsive viewport and touch input (virtual touch/tap-to-mine).
  - Setup modular state store with persistence.
- **Milestone 2 — Mining Grid & Pickaxe System**:
  - Implement procedural block grid with crack overlays.
  - Implement pickaxe damage matrix (hits-per-block-type).
  - Implement special pickaxes (horizontal/vertical AOE cleaving).
- **Milestone 3 — Enemies & Depth Progression**:
  - Implement enemy spawning with health tied to level block HP.
  - Implement pickaxe attack hitboxes and combat feedback.
- **Milestone 4 — Economy, Shop & Skins**:
  - Collectible drop items (gold coins & diamonds) floating to HUD.
  - Interactive Shop UI for pickaxe upgrades and miner skins.
- **Milestone 5 — Voluntary Rewarded Ads & Native Packaging**:
  - Integrate AdManager (simulated in browser, native AdMob in mobile).
  - Capacitor setup for Android APK build test.
- **Milestone 6 — Settings, Music, Pause & Tutorial (polish)**:
  - Settings modal (sound / music / vibration toggles + tutorial replay) reachable from the main menu and the pause overlay.
  - Procedural chiptune background music via Web Audio (no audio assets), with a persisted on/off flag.
  - Pause overlay that freezes the run (resume / settings / quit run).
  - First-run tutorial hints (mine → dig deeper → combat) shown only once.
