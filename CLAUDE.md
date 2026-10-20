# King of Tokyo Lab

Play King of Tokyo against computers or friends online, with the odds shown at every decision. Static site on GitHub Pages ($0): https://timothyhadfield.github.io/king-of-tokyo/

Read `progress.md` first. Tim's global rules (`~/.claude/CLAUDE.md`) and the Code Projects rules apply.

## Layout
- `js/cards.js` 66-card deck for both editions (names, costs, counts are facts; texts are our own words)
- `js/engine.js` rules engine (pure, JSON state, step queue). `js/game.js` wraps it for `js/online.js`.
- `js/online.js` shared online module, copied unchanged from `Board and Card Games/_online` (gameId `king-of-tokyo`)
- `js/dice.js` exact keep solver; `js/bots.js` Easy/Medium/Hard + advice; `js/art.js` original SVG art
- `js/strength-data.js` written by `tools/measure-levels.js` only
- `docs/rules-check.md` source for every rule/count; `docs/ideas.md` data ideas, Build/Skip

## Commands
- Tests: `node --test tests/engine.test.js` and `node tests/online.test.mjs`; screens: `node tests/ui-fixes.mjs <url> [--online]` (QA regressions)
- Screens: serve the folder (`python -m http.server 8614 --bind 127.0.0.1`), then `node tests/ui-play.mjs http://127.0.0.1:8614/ --botms 40 [--desktop] [--reload] [--shots dir]`
- Measure: `node tools/measure-levels.js 400 1500` (about 5 minutes)

## Rules for this project
- Rules accuracy first: change a rule only with a source in `docs/rules-check.md` and a test.
- No official card art or rulebook text (copyright). Our own drawings and wording only.
- Bump `?v=` on script/style tags when changing them (iPhone caching).
