# King of Tokyo Lab: progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated 2026-10-20.
Live: https://timothyhadfield.github.io/king-of-tokyo/ · Repo: TimothyHadfield/king-of-tokyo (public)

## Goal right now
King of Tokyo to play and study: exact rules (2016 default, 2011 switch), computers of measured strength, odds at every decision, online seats through the shared `_online` module.

## Status
| Part | State |
|---|---|
| Rules engine, both editions, 66 cards each | Done; 38 engine tests |
| Tokyo Bay (5-6), 2-player variant switch | Done |
| Computers Easy / Medium / Hard | Done; measured (see Settings "?" and `js/strength-data.js`) |
| Odds: best keep dots, points lost, KO risk, stay value, card win % | Done |
| Odds tab (real-table dice helper + Tokyo calculator), Cards tab, Settings | Done |
| Online rooms (createOnline, gameId `king-of-tokyo`) | Done; `tests/two-browsers.mjs` (two WebKit browsers: create, join by code, reload mid-game, both end identical) passed |
| Measured strength (400 games each vs three Mediums) | Easy 4.8%, Medium 23.5%, Hard 39%; Hard beats Easy 68% one-on-one |
| Screen tests | `tests/ui-play.mjs`: full games at 393 px WebKit (incl. 6 monsters + reload) and 1280 px Chromium, no console errors, no overflow |
| QA pass 1 fixes (2026-10-20) | Done; `tests/ui-fixes.mjs` (14 checks, all seen failing on the old build): double-tap guard, broken-save restore, lobby monsters, 2-player switch off on 2011, Back closes sheet, code with spaces, single toasts, kept dice after reload, Join above the fold at 6, Odds at 0 rerolls |
| Own SVG art (6 monsters, dice faces, card icons, skyline) | Done |
| Sound & effects (2026-10-20) | Done: synthesised sounds for every game event, win/lose confetti, animations; Settings "Sound & effects". Tests `tests/fx.test.js` (node) + `tests/fx-ui.mjs <url>` (Chromium, spies FX) |
| Table look (2026-10-20) | Done: play screen seen from your seat on a dark-wood table: opponents' monster boards across the far side (heart/star dials, green cubes, keep cards: a small fan on phone and mini cards on laptop), the Tokyo board (City/Bay spots with standees), the market (stacked deck, 3 face-up poker-size cards, a loose discard pile), black dice with green symbols, and your board plus keep cards at the bottom edge. Cards are dealt from the deck with a 3-D flip, and bought or swept cards slide off. Log and odds sit in a slim side panel on laptop. Research is in the manager scratchpad `table/king-of-tokyo/real.md` |
| Weird-case pass (2026-10-20) | Done: 44 scenarios, 10 failed on the old build, all fixed (table below). New `tests/edge-ui.mjs` |
| Visual design pass (2026-10-20) | Done: phone sale cards get a faint icon watermark, readable "· N left" on Reroll, Sweep tile shows ⚡ 2 / Sweep, laptop Tokyo scene big + centred, dice 66 px, sale-card text no longer clipped, log 13 px, no "Gigazaur / Gigazaur" subtitle, no "You You reaches" in the log |

## Authorized next steps
- (none pending from Tim)

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." (2026-10-20)
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)." (2026-10-20)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)
- Global: never ask permission; $0; headless testing only; Tim decides looks, wording and names.

## Traps
- **20 points wins at the END of a turn** (the next `turn` op checks it), not the moment you reach 20. Bots and UI must not assume an instant win.
- `Cards.CARDS` is a live table for ONE edition; the app calls `syncEd()` before rendering. Engine and bots use `Cards.card(s.edition, id)`.
- The keep solver lets you reroll any die every time (KoT rule); a brute force that locks kept dice gives a different (wrong) answer.
- `?botms=40` in the URL speeds the computers up for screen tests.
- Tap guard (app.js, top): drops a 2nd tap at the same spot only if the first tap's element was redrawn (or a sheet opened), and only within 450 ms of the tap OR 300 ms after the new screen was actually shown (`markDrawn()`, called after renderGame/openSheet). So a slow phone can't let a double tap through. A blanket time guard broke fast test clicks on other buttons; don't go back to that.
- **Partial redraw**: renderGame builds the whole html, then replaces only the top-level `#game` sections whose html changed (`ui.secHtml`). The deal/pile animations run only when the market section (index 2) changed. Redrawing the full wood table each move was the 3× slowdown.
- Settings speed change mid-game restarts the local room quietly from its own state (`startLocal(resume, true)`), since `botDelayMs` is fixed when a room is made.
- Only one auto-"done" timer (`ui.autoDone`): several timers sent "done" twice and showed "Bad move".
- `js/online.js` is a copy of the shared `_online` module; when the shared seat fix lands, re-copy it unchanged and rerun `tests/two-browsers.mjs`.
- `js/fx.js` is a copy of `Board and Card Games/_fx/fx.js`: never edit it; game sounds go in `js/fx-events.js` (`defineSounds`). Sounds come from snapshot diffs (`KotFx.events(prev, next, me)`), never from button handlers, so computer and online moves sound the same. The fx "?" is a `.q` without `data-tip`; the app's popover handler only takes `.q[data-tip]`.
- `css/table.css` and `js/table.js` are copies of `Board and Card Games/_table/`: never edit them; re-copy byte for byte. Git on Windows checks them out with CRLF, but the committed blobs match the sources exactly.
- The discard pile's faces come from `publicView().discardTop` (top 4, the pile is face up); `trackDiscards` is only a fallback for old rooms.
- The Tokyo standee stomps only when the occupant changes (`ui.tokyoSeen`). Each die's tilt (`--tilt`) is seeded from turn/roll/index, so redraws don't wobble.
- The local Python `http.server` drops connections under Chromium's burst (`ERR_CONNECTION_REFUSED` → pageerror). Use a node static server for desktop screen tests.
- Worktrees go in `C:/Users/timha/AppData/Local/Temp/claude/wt/`, never under `.claude`.

## Decisions
- 2016 rules by default; 2011 as a Settings switch (names, costs, texts, entry rule, damage-style cards).
- First player random (rules: claw roll-off). Empty deck: reshuffle discards.
- Metamorph gives no Friend of Children bonus (Dized FAQ over the BGA sheet).
- Card win % leaves out buys in the game's last round (those are bought to finish).
- Knock-out odds use the measured claw share of computer attackers' final dice (measured 13.6%, `Bots.CFG.claw` = 0.13), not 1/6.

## Sound map (event → sound, `js/fx-events.js` plan)
| Event | Sound | Animation |
|---|---|---|
| Dice thrown (roll/reroll) | `diceRoll` per die (40 ms apart, like the tumble), `diceLand` per die as it lands (~300 ms) | CSS tumble (speed-scaled) |
| Keep / unkeep a die | `place` high / lower | die lifts (existing) |
| Die changed by a card | `place` | – |
| Damage (claws, poison) | `smash` (louder for bigger hits) | red flash on the monster, CSS shake; 4+ shakes the Tokyo board |
| Hearts heal | `heal` | +♥ float |
| Energy gained / spent | `zap` / `coins` | count-up on the chip, +⚡ float |
| Points gained / lost | `star` / `miss` | count-up, +★ float |
| Enter Tokyo | `roar` (custom synth growl) | stomp + board shake |
| Leave Tokyo | `whoosh` | – |
| Buy a card | `coins` + `cardDeal`, new card `cardFlip` | buyer pops, new card in your row pops |
| Sweep | `shuffle` | cards deal in |
| Knocked out / It Has a Child | `explosion` / `heal`+`ding` | flash + shake |
| Your turn | `turn` | Roll button pulses |
| Decision mine off-turn (stay? Wings?) | `turn` lower, quieter | main button pulses |
| Illegal tap | `error` | toast |
| Game over | celebrate `win` (winner's colour confetti) / `lose`; local: win if a person won | – |
| Big moment | celebrate `big`: you gain 3+ ★ in one step, or knock a monster out on your turn | – |
Others' sounds play at 0.85 volume. Button taps: fx.js default, skipping dice.

## NOT verified
- Sound by ear: no one has listened (headless). Real iPhone audio unlock and silent switch not tried.
- Card effect wording for ~40 cards comes from one source (BGA's licensed text); the 2011 texts from fan lists.
- Psychic Probe: the active monster can't use Herd Culler / Stretchy / Plot Twist after a probe (the BGA sheet says it may).
- Real iPhone (only WebKit at 393 px).
- One desktop run logged a single `ERR_CONNECTION_REFUSED` from the local Python server; three reruns were clean. Assumed local-server noise.
- Redraw speed: script + layout measured ~3× faster after the partial redraw (65→19 ms, 171→57 ms); paint time not measurable in headless WebKit on this laptop, and not tried on a real phone.
- Weird-case pass not tried: two tabs on one save, online opponent going offline/AFK.
- Table look: the card animations (deal/flip/slide) were seen only in headless shots, not watched in motion on a phone.

## Weird-case scenarios (2026-10-20)
44 tested (full list in the manager scratchpad `edge/king-of-tokyo/scenarios.md`). Failed on the old build, now fixed:
| Scenario | Fix |
|---|---|
| Double-tap Roll on a slow phone rolled twice | guard counts from when the new screen is shown |
| Every move redrew the whole table (3× slower) | redraw only the changed sections |
| Discard pile blank after reload | engine shares its top 4 cards |
| Tapping dice after the last reroll: "Bad move" | one auto-done timer |
| Knocked out: button said "Waiting" | "You're knocked out · watching" |
| Speed → Fast mid-game did nothing until next game | applies at once |
| 5 rivals: card fans covered names | fan of 2 plus a count |
| Dealt card flew with a red back | uses the purple deck back |
| `_table` kit copies stale | re-copied 1.0.1, `.gitattributes` `-text` |
Passed: endings (points/last/nobody), empty deck, 6 long/emoji names with 35 cards at 320/393/landscape/1920, 200% zoom, storage blocked, Back through tabs, 400 computer games, refused bad moves.

## Rejected / parked
- ~~Official card or monster art from BGA's repo~~ copyright; Tim's call if he ever wants it.
