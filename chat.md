# King of Tokyo Lab: chat log

## 2026-10-20: first build (builder agent, manager wave "add 12 games")
- **Asked** (Tim): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." The manager briefed a phase 1 + phase 2 build: exact rules plus variants, mixed human/computer/online seats, rules-check, ideas, original art, QA pass.
- **Decided**: 2016 rules by default, 2011 as a switch; Tokyo Bay automatic at 5-6; 2-player variant switch; random first player; reshuffle on an empty deck; no official art (copyright).
- **Built**: engine (step queue, both editions, 66 cards each), exact keep solver, Easy/Medium/Hard computers, odds at each decision (best keep, KO risk, stay value, card win %), Odds/Cards/Settings tabs, online via shared `_online`, own SVG art, icons.
- **Verified**: 37 engine tests + 6 online checks (seen failing on a broken engine); full screen games at 393 px WebKit and 1280 px Chromium; 6-monster game with reload; two-browser online room with reload; measured levels (`tools/measure-levels.js 400 1500`).
- **Open**: see progress.md NOT verified (card wording sources, Psychic Probe timing, real iPhone).
- **QA pass** (fresh agent, live site) found 11 issues; all fixed the same day, with `tests/ui-fixes.mjs` seen failing on the old live build and passing on the fix. The 2-player variant is now disabled on the 2011 deck (rulebook variant is 2016).

## 2026-10-20: visibility pass (builder, manager wave)
- **Asked** (Tim): cards/board "too small to easily see what's going on"; fill the screen with the board, fit the rest in the empty space, make dense parts readable (full quote in progress.md).
- **Built** (css/style.css, js/app.js, index.html): true 2:1 board that fills its area; deck + pile beside the board on phone; landscape board across the left; laptop Reroll/Done under the dice, my area under the board; larger rival dials, tags and card names; overlap-to-fit card rows (thin strip opens the full list); ability buttons beside my cards; scrolling sheets; log panel only at ≥1700 px.
- **Verified**: new `tests/layout-ui.mjs` (old build 42 fails, new ALL PASS at 393/320/659 WebKit, 1280/1440/1536/1920 Chromium); engine+fx 41, online 6, ui-fixes, edge-ui, ui-play (393 + desktop), fx-ui, two-browsers. Before/after shots + one read-only review in the manager scratchpad `vis/king-of-tokyo/`.
- **Open**: real iPhone; laptop still has empty wood beside my cards.

## 2026-10-20: weird-case pass (builder, manager wave)
- **Asked** (Tim): "making each game perfect especially in scenarios that the game doesn't expect or are a little weird" (full quote in progress.md). Plus leftovers: flaky double-tap test, 3× slower redraw, blank discard after reload.
- **Built**: solid tap guard (`markDrawn`), partial redraw, `discardTop` in the public view, single auto-done timer, knocked-out button, smaller fan with 5 rivals, purple deal ghost, mid-game speed change, `_table` 1.0.1 re-copy + `.gitattributes`.
- **Verified**: 44 scenarios; 10 failed on the old build, all pass now. New `tests/edge-ui.mjs` (old build 4 fails, new ALL PASS), ui-fixes 1b (old 3/3 fail, new 3 runs pass), engine 38, fx 3, online 6, ui-play 393 WebKit + 1280 Chromium, fx-ui, two-browsers.
- **Open**: paint time and real iPhone; two tabs; online AFK.

## 2026-10-20: visual design pass (builder, manager wave)
- **Asked** (Tim): "once you're finished with all the games, review them again for design improvements especially visually..."
- **Built**: CSS polish + small render tweaks (app.js cardFace watermark, Sweep markup, pboard subtitle, logList); no rules changes. Kept: dice lift on keep (deliberate feedback), phone Odds "Your health" wrap (nowrap clipped it).
- **Verified**: 37 engine + 6 online + ui-fixes ALL PASS + ui-play (393 WebKit 6 monsters with reload, 1280 Chromium). Before/after shots in the manager's scratchpad `design/king-of-tokyo/`.

## 2026-10-20: table look (builder, manager wave)
- **Asked** (Tim): make each game look like the real board or cards on a real table, "like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md).
- **Built**:
  - Play screen rebuilt as a table from your seat: wood surface, opponents' boards, Tokyo board with standees, deck, 3 cards and discard, black and green dice, your board and cards at the bottom.
  - Shared `_table` kit copied in; `_fx/fx.js` 1.0.3 re-copied.
  - Two read-only reviews against `real.md`, with their fixes applied: standee only stomps on entry, opponents' card fan, 40 px buttons, long names, tilted dice, landscape market placement.
- **Verified** (2026-10-20):
  - engine 37 + fx 3 + online 6 pass.
  - ui-play: 393 WebKit and 1280 Chromium.
  - fx-ui and two-browsers pass.
  - Shots at 320, 393, 659 landscape and 1280: no scroll, no overflow, no console errors.
  - Effects speed and game Speed change independently.
  - The ui-fixes double-tap check is flaky under load, on the old build too (see NOT verified).

## 2026-10-20: sound & effects (builder, manager wave)
- **Asked** (Tim): "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- **Built**: `js/fx.js` (shared library, copied unchanged), `js/fx-events.js` (snapshot diff → events → sounds, plus our own roar/smash/heal/zap/star recipes), app.js hooks (onSnap → fxReact, keep knock, error sound, countUp/flash/shake/pop/pulse, celebrate), Settings "Sound & effects" panel, CSS gating the game's own animations (`fx-noanim`, `fx-fast`).
- **Verified**: tests/fx.test.js (3 tests) + tests/fx-ui.mjs, both seen failing on the old build; 37 engine, ui-fixes, ui-play 393 WebKit + 1280 Chromium all pass. Shots in the manager scratchpad `design/king-of-tokyo-fx/`.

## 2026-10-27: rules sheet + guided first game (builder, manager wave "improve", resumed after a laptop crash)
- **Asked** (manager, plan item 2): shared kit `_coach` (guided first game + rules sheet), piloted here; the site had no rules page.
- **Built**: kit repo TimothyHadfield/game-coach (coach.js/coach.css, demo, tests); here `js/tutorial.js` (rules in our own words, seed 11, scripted rolls, 17 steps), app.js wiring (offer once, Rules from setup/⋯ menu/Settings, Replay tutorial, resume after reload, Back closes rules).
- **Verified**: tutorial.test.js 8/8 (seen failing with the rig off / seed changed); coach-ui.mjs ALL PASS at 393, 320, 659×393 (WebKit), 1280, 1440 (Chromium); engine/fx/online, ui-fixes, ui-play (393 + desktop reload), layout-ui, edge-ui, fx-ui all pass. One reviewer pass: fixed the step-7 wording vs the green dots, "you still lose the ♥" when leaving, Bay hits, ⋯ menu pointer.
- **Open**: see NOT verified (tutorial stops after turn 2; chips scroll on phone).
