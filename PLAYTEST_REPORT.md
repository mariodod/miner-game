# Pocket Miner — Full Playtest Report

Date: 2026-10-17 · Build: `f0f53f2` (menu update) · Verdict: **No bugs found — every system verified end-to-end. Zero console errors.**

## Run Journey (automated, 2 runs)

| Moment | Result |
| --- | --- |
| Menu → PLAY | GameScene + HUD, run stats reset, `tap` haptic |
| Dig 3 → 102m | 30 blocks broken, milestones, biomes, record — all fired |
| 25m / 50m / 75m / 100m milestones | Chests: +20/+40/+60/+80💰 and +1/+1/+2/+2💎 |
| 57m record crossed | `newRecord {60, previous 57}` + NEW RECORD banner on game over |
| 30m / 70m biomes | "Caverns" → "Deep Rock" banners + washes |
| 100m | `bossSpawn {depth 100, tier 1}` + 100m chest — exactly on schedule |
| Death #1 @ 63m | Collapse overlay → **REVIVE via ad** → 10/10 HP, shield, enemies scattered, `reviveUsed` set |
| Death #2 @ 102m (boss gate) | "Revive already used" → END RUN |
| GameOver #1 | 🏆 NEW RECORD! + 5 stats rows all correct (102m · 334💰 · 6💎 · 30🪨 · 1💀) |
| "Watch Ad → 2× Gold" | Ad modal ran, +334 gold granted, button → "✅ +334 Gold Added!" (698→1032) |
| PLAY AGAIN | Fresh run: 0m/0 blocks/0 kills/10 HP, gold kept |
| Pause | Live line `📍 9m · 💰 3 · 🪨 3 · 💀 0` |
| Pause → Settings | Screen Shake toggled off/on + restored; ✕ closes; RESUME works |
| Give Up | Two-tap confirm ("Tap again", 2.2s window) → GameOver #2 (RUN OVER, 9m stats) |
| MAIN MENU | Menu shows live `💰 1035 💎 10` + `🏆 Best Depth: 102m` |

## System Checks

- **Haptics** — cue histogram reconciles exactly: 33×break = 33 blocks broken (30+3), 53×hit, 8×heavy, 6×success = 4 milestones + revive + new record, 2×tap (menu buttons).
- **Loot safety** — "Your loot is safe" confirmed: run gold/diamonds bank live, survive death and END RUN.
- **Save persistence** — gold/diamonds/best written at every step; verified in localStorage after each run.
- **Errors** — 0 page errors / 0 console errors across ~1,500 stepped frames.

## Observations (not bugs)

1. **Difficulty curve is steep with starter gear** — wood pickaxe, 0 upgrades, 10 HP dies around 60–100m (enemy hits cost 2, hearts heal 1). The gold→upgrade shop loop exists to close that gap; a fresh player is expected to upgrade before the boss gate. Could be tuned later (e.g., power upgrades reduce enemy TTK already).
2. `highScoreChanged` fires per 3m step past the old best (15 events for a 57→102m run) — by design (live best), just chatty.
3. Two-tap Give Up is a deliberate anti-mistap design — verified arming/confirm/2.2s disarm.
4. Audio calls all fired without errors, but sound feel needs a real device/ear check — that's the one untestable-from-here dimension.

## Housekeeping

- No code changes were required → nothing to commit; APK unchanged (`app-debug.apk` from `f0f53f2`, assets byte-match `dist`).
- Dev save restored to pre-test state: **364💰 · 4💎 · 57m · wood · classic** (the playtest's 1035💰/10💎/102m was not kept).
- Game left running at the menu, dev server up, zero errors.

## Suggested Next

- Device playtest of *feel*: haptics patterns, audio levels, frame pacing on real hardware — the APK is ready.
- Optional balance pass if early depth feels punishing: heart drop rate, enemy damage 2→1, or a HP upgrade in the shop.
