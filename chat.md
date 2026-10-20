# King of Tokyo Lab: chat log

## 2026-10-20: first build (builder agent, manager wave "add 12 games")
- **Asked** (Tim): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." The manager briefed a phase 1 + phase 2 build: exact rules plus variants, mixed human/computer/online seats, rules-check, ideas, original art, QA pass.
- **Decided**: 2016 rules by default, 2011 as a switch; Tokyo Bay automatic at 5-6; 2-player variant switch; random first player; reshuffle on an empty deck; no official art (copyright).
- **Built**: engine (step queue, both editions, 66 cards each), exact keep solver, Easy/Medium/Hard computers, odds at each decision (best keep, KO risk, stay value, card win %), Odds/Cards/Settings tabs, online via shared `_online`, own SVG art, icons.
- **Verified**: 37 engine tests + 6 online checks (seen failing on a broken engine); full screen games at 393 px WebKit and 1280 px Chromium; 6-monster game with reload; two-browser online room with reload; measured levels (`tools/measure-levels.js 400 1500`).
- **Open**: see progress.md NOT verified (card wording sources, Psychic Probe timing, real iPhone).
- **QA pass** (fresh agent, live site) found 11 issues; all fixed the same day, with `tests/ui-fixes.mjs` seen failing on the old live build and passing on the fix. The 2-player variant is now disabled on the 2011 deck (rulebook variant is 2016).

## 2026-10-20: visual design pass (builder, manager wave)
- **Asked** (Tim): "once you're finished with all the games, review them again for design improvements especially visually..."
- **Built**: CSS polish + small render tweaks (app.js cardFace watermark, Sweep markup, pboard subtitle, logList); no rules changes. Kept: dice lift on keep (deliberate feedback), phone Odds "Your health" wrap (nowrap clipped it).
- **Verified**: 37 engine + 6 online + ui-fixes ALL PASS + ui-play (393 WebKit 6 monsters with reload, 1280 Chromium). Before/after shots in the manager's scratchpad `design/king-of-tokyo/`.
