# Data and theory ideas (2026-10-20)

Build = in the app now. Skip = not built, with the reason.

| # | Idea | Verdict | Why / where |
|---|---|---|---|
| 1 | Exact best keep for every reroll (dynamic programming over dice counts, all rerolls ahead) | **Build** | Green dots on the dice + "Best / Yours" bar during the roll. `js/dice.js` solver, checked against brute force. |
| 2 | Points lost per decision (study mode) | **Build** | End screen "Your dice choices": total points given up and the 3 worst keeps. |
| 3 | Knock-out risk if you stay in Tokyo | **Build** | Shown on the Stay button and the odds bar when you're asked to yield. |
| 4 | Stay-in-Tokyo value: start-of-turn points times survival chance | **Build** | "Stay ≈ +x ★" next to the risk. |
| 5 | Real claw rate measured from games (not 1/6, not a guess) | **Build** | About 13.6% of an attacker's final dice are claws (computer games); the risk numbers use 13%. Using it lifted Hard from 37% to 39-43% against three Mediums. |
| 6 | Card win % (how often a monster that bought it won) | **Build** | Cards tab column + card sheet. Measured over 1,500 all-Hard games. |
| 7 | Measured computer strength | **Build** | Settings "?" next to Computer level. `tools/measure-levels.js`. |
| 8 | Dice helper for a real table (tap in your dice, get the best keep) | **Build** | Odds tab. |
| 9 | Tokyo knock-out calculator for a real table (your hearts vs monsters outside) | **Build** | Odds tab, red bars = knocked out. |
| 10 | Set chances: odds of three of a number by the last roll | **Build** | Tap the odds bar during a roll. |
| 11 | Whole-game win chance for each monster, live | Skip | Needs thousands of simulated games per move; too slow on a phone. |
| 12 | Energy-to-points exchange rate | Skip | Depends on the cards for sale; a single number would mislead. Card win % covers buying. |
| 13 | First-player advantage | Skip | Interesting but nothing to decide: the first player is random. |
| 14 | "Should I sweep the cards?" value | Skip | Unknown next three cards; little to gain over the card win % column. |
| 15 | Edition comparison (game length, claws) under 2016 vs 2011 rules | Skip | Only trivia for players; recorded in `docs/rules-check.md` tests instead. |
| 16 | Learning opponents' habits from your own games | Skip | Needs a history of games per person; would need storage Tim hasn't asked for. |
