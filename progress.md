# King of Tokyo Lab: progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md`. Last updated 2026-10-28 (wave 3: Videos tab + Evolutions option).
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
| Screen tests | `tests/ui-play.mjs`: full games at 393 px WebKit (incl. 6 monsters + reload) and 1280 px Chromium, no console errors, no overflow |
| QA pass 1 fixes (2026-10-20) | Done; `tests/ui-fixes.mjs` (14 checks, all seen failing on the old build): double-tap guard, broken-save restore, lobby monsters, 2-player switch off on 2011, Back closes sheet, code with spaces, single toasts, kept dice after reload, Join above the fold at 6, Odds at 0 rerolls |
| Own SVG art (6 monsters, dice faces, card icons, skyline) | Done |
| Sound & effects (2026-10-20) | Done: synthesised sounds for every game event, win/lose confetti, animations; Settings "Sound & effects". Tests `tests/fx.test.js` (node) + `tests/fx-ui.mjs <url>` (Chromium, spies FX) |
| Table look (2026-10-20) | Done: play screen seen from your seat on a dark-wood table: opponents' monster boards across the far side (heart/star dials, green cubes, keep cards: a small fan on phone and mini cards on laptop), the Tokyo board (City/Bay spots with standees), the market (stacked deck, 3 face-up poker-size cards, a loose discard pile), black dice with green symbols, and your board plus keep cards at the bottom edge. Cards are dealt from the deck with a 3-D flip, and bought or swept cards slide off. Log and odds sit in a slim side panel on laptop. Research is in the manager scratchpad `table/king-of-tokyo/real.md` |
| Weird-case pass (2026-10-20) | Done: 44 scenarios, 10 failed on the old build, all fixed (table below). New `tests/edge-ui.mjs` |
| Visibility pass (2026-10-20) | Done: Tokyo board keeps its true 2:1 shape at every size and names who is in City/Bay in full; rival numbers 12 px+, tags 10 px+, phone sale-card names 10 px; all my keep cards + ability buttons on screen (overlapping strips, a thin strip opens the full list); rivals' cards stay on their own board; laptop sale cards show full rules text; landscape sheets scroll. New `tests/layout-ui.mjs` (7 sizes; old build 42 fails, new ALL PASS) |
| Visual design pass (2026-10-20) | Done: phone sale cards get a faint icon watermark, readable "· N left" on Reroll, Sweep tile shows ⚡ 2 / Sweep, laptop Tokyo scene big + centred, dice 66 px, sale-card text no longer clipped, log 13 px, no "Gigazaur / Gigazaur" subtitle, no "You You reaches" in the log |
| Rules sheet + guided first game (2026-10-27) | Done: pilot of the shared `_coach` kit (repo game-coach). Rules sheet in our own words (9 sections) from setup "Rules", the ⋯ game menu and Settings → How to play. First visit offers "New to King of Tokyo?" once; "Teach me" starts you + 2 Easy computers (2016 rules) with stacked dice; resumes after reload; Settings → Replay tutorial. Tests `tests/tutorial.test.js` (10, node) + `tests/coach-ui.mjs <url>` (393/320/659×393 WebKit, 1280/1440 Chromium) |
| Improve pass (2026-10-27, commits f87860f..f420143) | Done, live. Guided game now 27 steps through a whole game: buy Poison Quills, stay, leave on the 2nd hit, heal, win with 20 ★ on your 4th turn (rigged dice hold for 40 computer streams). Hard rebuilt (beats Medium 83%). Medium now buys ~5 cards a game (was 1). `_profile` 1.1.0 (My stats, 10 achievements, Daily game), `_pwa` 1.2.0 (offline, 18/18 pwa-check), Undo vs computer (same dice come back), end-of-game Review (star race + turn stepper), laptop layout with the log under the table (900–1699 px, 700+ tall), bigger laptop portraits, claw-swipe hit animation, rival-buys-a-card toast, rules tabs wrap on phone |
| Wave 3 (2026-10-28, ef279be, a3c0670, 67abf86) | Rules sheet Videos tab (5 checked YouTube links). **Evolutions** (Power Up! idea), Settings switch, off by default: 6 monsters × 8 cards (`js/evolutions.js`, own words), draw on 3 ♥, secret hand, all computer levels play them, online/Undo/save/review work. Screen: hand (dashed) + played cards in your row, glow when playable, card sheet with Play, ability buttons, buttons/sheets for every evolution decision. Base game byte-identical (300 games vs old engine). Tests: `tests/evo.test.js` (54, one per card, all seen failing first), ladder evo test, online test 7, `tests/evo-ui.mjs <url> [--w= --h= --shot=]` (failed on the old screen; passes at 393/320/659×393/1280/1440). Ladder with evolutions (1000 duels): Hard v Medium 82.6%, Hard v Easy 84.9%, Medium v Easy 63.1% |
| Measured ladder (2026-10-27, `node tools/measure-levels.js 1000 4000`, `tools/ladder.js`) | 1v1: Hard vs Medium 83.1%, Hard vs Easy 85.3%, Medium vs Easy 62.3%. vs three Mediums: Easy 2.2%, Medium 23.9%, Hard 37.8%. Profile ratings 1200/1670/1770. `tests/ladder.test.js` guards it |

## Authorized next steps
- (none pending from Tim)

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." (2026-10-20)
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)." (2026-10-20)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)
- "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space, some have severe errors like TTR. Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it." (2026-10-20)
- Global: never ask permission; $0; headless testing only; Tim decides looks, wording and names.

## Traps
- **Kits re-copied 2026-10-28 (sweep, ea945c9):** game-coach 1.2.0 (offer `place:'auto'`, `avoid` Start + Rules/My stats/Daily; at 320×568 it can only sit over Rules, so `tests/coach-ui.mjs` clicks Rules through it) and game-pwa 1.4.0 (fixes the flaky "access control checks" console error), build 16. Earlier: **2026-10-27 (kitfix):** game-coach 1.1.0 wraps the rules tabs itself (the style.css `.coach-rules .coach-rules-nav` override is now redundant but harmless) and keeps a note beside a tall target readable; game-pwa 1.3.0 (`data-extra`). `js/app.js` now imports `./online.js?v=a3d0418b` (the `_online` content stamp; `node ../_online/tools/stamp.mjs --check .` says OK); after a re-copy of online.js put the new stamp there and bump app.js's `?v=`. `tests/coach-ui.mjs` "the coach runs to the end" fails at random sizes with both the old and new kit (same 24 steps shown): a flaky check, every note stays on screen and off its target.
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
- **Seeded dice (local games)**: app.js `seeded()` (mulberry32) is the room rng; its position `rs` is saved in `store.saved` with `meta` (Undo snapshot, helped/recorded/moved flags, review timeline `tl`). Undo restarts the room from the snapshot state + `rs`, so the same dice come back. The tutorial keeps `COACH.rng` and has no Undo; the Daily seeds from `Profile.daily.seed(day,'king-of-tokyo')` and has no Undo.
- **Bots `'advice'` level**: the best-keep dots and Study numbers use Hard's OLD values (`turnValues(..., 'advice')`), so retuning Hard doesn't move the advice. Retune Hard via `CLAW_BASE`/`MOVE_IN`/`KILL_WIN`/`WIN_BONUS` and rerun `node --test tests/ladder.test.js`.
- **Card win %** now comes from all-Easy 4-player games (Easy buys at random, so all 64 cards get 30+ buys); Hard/Medium games bought too few cards.
- **My stats**: recorded once per game (`meta.recorded`); quit after a move = loss; Undo = mode "help" (unrated); `meta.tut` games never count; online recorded once per `code:turnNo` (`store.recOnline`). `PWA.safeToReload` is false on Play while a saved game exists (the kit's check requires it).
- Kit copies added: `js/profile.js`, `css/profile.css`, `js/pwa.js`, `sw.js`, `tools/pwa-check.mjs`, `tools/make-icons.mjs` (never edit; re-copy). Bump `data-version` on the pwa.js tag with each deploy. Rules-tab wrap is a game-side override in style.css (`.coach-rules .coach-rules-nav`) until the `_coach` kit fixes it.
- `tests/ui-fixes.mjs` "no console errors" is flaky (1 in 3): WebKit logs "…due to access control checks" when a test navigates while pwa.js's page check (a HEAD fetch of the page) is in flight. Not a player-visible error; `tests/evo-ui.mjs` ignores exactly that message. Kit fix idea filed in wave3-cross-game.md.
- **Evolutions**: state fields only exist when `o.evo` (`s.evo`, `s.ling`, per player `ed/eh/ex/evo`); dealt AFTER everything else so base games use the rng exactly as before (keep it that way). The hand is in `privateView(seat).hand` only. The UI never decides legality: `evoCan()` in app.js is a hint for the glow, the engine has the last word. `layout-ui.mjs` "Metamorph End turn button (659×393)" failed 2 of 6 runs on 2026-10-28 (not on my debug copy); not explained.
- **Tutorial**: `js/coach.js` + `css/coach.css` are copies of `Board and Card Games/_coach` (repo game-coach): never edit them here; fix the kit and re-copy. The tutorial lives in `js/tutorial.js`: `SEED = 11` (you go first, a 3-cost card on sale) and `SCRIPT` stacks your first rolls and one computer's claws through `rigGame` (engine untouched). Changing the engine's rng order or card deck can break the stacked deal: `tests/tutorial.test.js` catches it. The save carries `tut:true` so a reload re-rigs it. Offer key `coach-offer:kot-first-game`, tour key `coach:kot-first-game` in localStorage.
- **Layout (visibility pass)**: the board sits in `.bwrap` (a size container); `.board` is `min(100cqw, 200cqh)` at 2:1 and is itself a container, so tag/standee/plate sizes use `cqh` and a `@container (max-height: 100px)` rule (small board: names on the bottom edge, 22 px standee). `.market` is `display: contents`: deck, 3 cards and pile are placed straight on the `#game` grid (areas deck/c1/c2/c3/pile). Card rows overlap to fit using `--n` (card count, set inline by app.js). The log side panel (with odds) appears at ≥1700 px (`SIDE` matchMedia in app.js redraws on change); at 900–1699 px and 700+ px tall the same `#g-side` log runs under the table (CSS only); shorter laptops keep the log behind its button. Run `tests/layout-ui.mjs <url>` after any layout change.

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
- Tutorial: not tried on a real iPhone. Knock-outs are only in the Rules sheet.
- Evolutions: which decisions come up in `evo-ui.mjs` is random (the live run at 8407680 met and tapped all 8 kinds); `tests/two-browsers.mjs` with evolutions not run (the test's 2nd browser is blocked by the "New to King of Tokyo?" offer over Join, pre-existing); simplifications listed in docs/rules-check.md. My stats / Daily on the setup screen are 45 px below the fold at 393×659 with 4 seats: moving them up pushes Join below the fold at 6 seats (a layout call for Tim).
- Improve pass: offline install not tried on a real iPhone home screen; claw swipe seen only in a still shot; the Daily's "same dice for everyone" holds only if players make the same moves (bots share the stream); Hard still buys only ~0.7 cards a game.

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
