# King of Tokyo Lab: progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated 2026-10-20.
Live: https://timothyhadfield.github.io/king-of-tokyo/ · Repo: TimothyHadfield/king-of-tokyo (public)

## Goal right now
King of Tokyo to play and study: exact rules (2016 default, 2011 switch), computers of measured strength, odds at every decision, online seats through the shared `_online` module.

## Status
| Part | State |
|---|---|
| Rules engine, both editions, 66 cards each | Done; 37 engine tests |
| Tokyo Bay (5-6), 2-player variant switch | Done |
| Computers Easy / Medium / Hard | Done; measured (see Settings "?" and `js/strength-data.js`) |
| Odds: best keep dots, points lost, KO risk, stay value, card win % | Done |
| Odds tab (real-table dice helper + Tokyo calculator), Cards tab, Settings | Done |
| Online rooms (createOnline, gameId `king-of-tokyo`) | Done; `tests/two-browsers.mjs` (two WebKit browsers: create, join by code, reload mid-game, both end identical) passed |
| Measured strength (400 games each vs three Mediums) | Easy 4.8%, Medium 23.5%, Hard 39%; Hard beats Easy 68% one-on-one |
| Screen tests | `tests/ui-play.mjs`: full games at 393 px WebKit (incl. 6 monsters + reload) and 1280 px Chromium, no console errors, no overflow |
| Own SVG art (6 monsters, dice faces, card icons, skyline) | Done |

## Authorized next steps
- (none pending from Tim)

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." (2026-10-20)
- Global: never ask permission; $0; headless testing only; Tim decides looks, wording and names.

## Traps
- **20 points wins at the END of a turn** (the next `turn` op checks it), not the moment you reach 20. Bots and UI must not assume an instant win.
- `Cards.CARDS` is a live table for ONE edition; the app calls `syncEd()` before rendering. Engine and bots use `Cards.card(s.edition, id)`.
- The keep solver lets you reroll any die every time (KoT rule); a brute force that locks kept dice gives a different (wrong) answer.
- `?botms=40` in the URL speeds the computers up for screen tests.
- Worktrees go in `C:/Users/timha/AppData/Local/Temp/claude/wt/`, never under `.claude`.

## Decisions
- 2016 rules by default; 2011 as a Settings switch (names, costs, texts, entry rule, damage-style cards).
- First player random (rules: claw roll-off). Empty deck: reshuffle discards.
- Metamorph gives no Friend of Children bonus (Dized FAQ over the BGA sheet).
- Card win % leaves out buys in the game's last round (those are bought to finish).
- Knock-out odds use the measured claw share of computer attackers' final dice (measured 13.6%, `Bots.CFG.claw` = 0.13), not 1/6.

## NOT verified
- Card effect wording for ~40 cards comes from one source (BGA's licensed text); the 2011 texts from fan lists.
- Psychic Probe: the active monster can't use Herd Culler / Stretchy / Plot Twist after a probe (the BGA sheet says it may).
- Real iPhone (only WebKit at 393 px).
- One desktop run logged a single `ERR_CONNECTION_REFUSED` from the local Python server; three reruns were clean. Assumed local-server noise.

## Rejected / parked
- ~~Official card or monster art from BGA's repo~~ copyright; Tim's call if he ever wants it.
