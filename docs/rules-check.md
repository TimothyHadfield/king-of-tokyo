# Rules check: King of Tokyo (2016 and 2011 editions)

Every rule and count the engine uses, with its source and the test that asserts it (`tests/engine.test.js` unless marked).
Researched 2026-10-20. Card texts in the app are our own words; names, costs and counts are game facts.

## Sources
| Key | Source |
|---|---|
| RB16 | IELLO English rulebook, 2023 printing: https://iellogames.com/wp-content/uploads/2021/10/KOT_Rules_EN_11-2023_Light.pdf |
| RB16a | IELLO rulebook, 2016 first printing: https://cdn.1j1ju.com/medias/f9/2f/9b-king-of-tokyo-rulebook.pdf |
| ART | Official 2016 card art with the printed cost in each corner (in the BGA repo, `img/keep-cards.jpg`, `img/discard-cards.jpg`); costs read off by eye. Not used in the app. |
| BGA | Board Game Arena's licensed version: https://github.com/thoun/kingoftokyo (`src/cards.ts`, `PowerCardManager.php`, `NextPlayer.php`) |
| BGAs | BGA card-combination sheet with author/publisher answers: https://docs.google.com/spreadsheets/d/1DbI4EongciNvCcjQBwsMHuXxpzKA1x3ZD_MMdPzBRtM |
| DZ | Dized official rules + FAQ: https://rules.dized.com/game/EfzZnrT4RhCFV67EufxXeg/faq |
| RB11 | 2011 rule text as reproduced at https://www.rulespal.com/king-of-tokyo/rulebook and https://www.64ouncegames.com/pages/king-of-tokyo-rules |
| FAN11 | Three fan 2011 card lists that agree card for card: github.com/maltize/KingOfTokyo-CardList, github.com/daviscodesbugs/gamepiece-json, github.com/alegueri/boardgame.io |

## Counts
| Fact | Value | Source | Test |
|---|---|---|---|
| Power cards per deck | 66 (both editions) | BGA deck list + ART count; FAN11 (`total_count: 66`) | "deck: 66 cards…" |
| Keep / Discard | 48 / 18 physical; 64 different cards | BGA, ART, FAN11 | same |
| Two-copy cards | Extra Head ×2, Evacuation Orders ×2 | BGA, ART (two identical images), FAN11 | same |
| 2016 printed costs | Keep 6,3,5,4,4,5,3,3,3,4,3,4,7,7,4,5,3,5,4,4,5,3,7,5,2,3,8,3,7,4,3,4,3,3,4,3,3,4,3,6,4,2,5,3,4,4,3,6; Discard 5,4,3,5,8,7,7,3,7,6,3,4,5,3,6,6,4,6 | BGA + ART (2 sources) | "2016 printed costs match…" |
| Renamed in 2016 | 8: Alien Origin, Media-Friendly, Death From Above, Flame Thrower, Battery Monster, Detritivore, Energy Drink, Tank | BGA vs FAN11 | "edition differences…" |
| Battery Monster / Monster Batteries | 2016 cost 3 (6 energy from the bank); 2011 cost 2 (your energy, bank matches) | BGA + ART; FAN11 | "edition differences…", "2016 Battery Monster…" |
| Start | 10 hearts, 0 points, 0 energy, 3 cards face up, nobody in Tokyo | RB16, RB11 | "setup…" |
| Dice | 6 dice (faces 1, 2, 3, energy, heart, claw), up to 3 rolls; any die may be rerolled each time | RB16, DZ | "rolls: 6 dice, 2 rerolls" + solver brute-force test |
| Win | 20 points or last monster standing | RB16, RB11 | "20 points wins…", "last monster standing…" |

## Rules
| Rule | Engine | Source | Test |
|---|---|---|---|
| Three of a number = that many points, +1 per extra die | `resolve` | RB16 (worked example: four 1s = 2) | "number sets…" |
| Hearts heal outside Tokyo only; max 10 (12 with Even Bigger in 2016) | `resolve`, `maxHp` | RB16, BGA | "hearts…", "Even Bigger…" |
| Hearts in Tokyo also can't remove poison/shrink tokens | `resolve` | RB16, DZ | — (reasoned from same rule) |
| In Tokyo you hit everyone outside; outside you hit Tokyo (City and Bay); same place never hits each other | `attack` | RB16 p.4 + 5-player example | "claws from Tokyo…", "City and Bay never hit each other…" |
| You may yield only after actually losing hearts to claws | `attack` st 2 | RB16, BGAs (Armor/Camouflage/Wings) | "you may not yield when Armor Plating…" |
| Attacker takes the spot that was yielded, +1 point | `attack` st 3 | RB16, DZ | "claws from outside hit Tokyo…" |
| 2016: an empty City must be entered (no claw needed), so the first player always enters | `enter` | RB16 | "2016: the first monster enters…" |
| 2011: only a monster that rolled a claw takes empty Tokyo | `enter` | RB11 | "2011: you need to roll a claw…" |
| +2 points for starting a turn in Tokyo | `turn` | RB16, RB11 | "starting a turn in Tokyo…" |
| Tokyo Bay only with 5-6 players; City first, then Bay | `enter`, `bayOpen` | RB16, BGA | "Tokyo Bay is used only with 5-6…" |
| Both yield: attacker takes City, Bay stays empty | `attack` st 3 | RB16 example, BGAs | "City and Bay never hit each other…" |
| Bay closes at 4 or fewer monsters: Bay monster moves to an empty City, else leaves | `knockouts` | RB16, DZ | "Bay closes at 4 monsters…" |
| Knocked-out monster discards its keep cards and energy | `knockouts` | RB16 p.4 | 100-game test (card total stays 66) |
| 20 points wins at the end of a turn; you must survive your turn | `checkEnd(s, true)` at the start of the next turn op | RB16 (2023: "end of a turn"), DZ, BGA code | "20 points wins at the END…", "you must survive…" |
| Several at 20 share the win; all knocked out at once = nobody wins | `checkEnd` | BGAs, RB16 | "two monsters at 20…", "everyone knocked out…" |
| Buy any face-up cards; replaced at once; sweep for 2 energy, repeatable | `buy` action | RB16 | UI game test |
| Optional 2-player variant: Tokyo gives 1 energy (enter, start) instead of points | `enter`, `turn` (`s.duel`) | RB16, BGA wiki | "2-player variant…" |

## Card rulings implemented (2016 unless marked)
| Ruling | Source | Test |
|---|---|---|
| Acid Attack, Burrowing (in Tokyo), Poison Quills (2-2-2) ADD claws; Spiked Tail and Urbavore add 1 if you rolled at least 1 claw (added claws count) | BGA text, BGAs | "Spiked Tail…" |
| Alpha Monster: +1 point when you roll at least 1 claw (2011: when you attack) | BGA, FAN11 | "Alpha Monster…" |
| Fire Breathing: neighbours lose 1 extra whenever you roll a claw, wherever they are; no token from it (2011: neighbours you damage) | RB16, BGAs | "Fire Breathing…" |
| Poison Spit / Shrink Ray tokens only for monsters that lost hearts to claws (2011: any damage you deal) | RB16, BGAs | "Poison Spit…" |
| Armor Plating ignores exactly-1 losses, per source | DZ, BGAs | "Armor Plating" yield test |
| Battery Monster: 6 bank energy, 2 per turn, discard when empty | BGA, DZ | "Battery Monster" |
| Death From Above: +2, take City, every other Tokyo monster leaves (2011 Drop from High Altitude: only if you're not in Tokyo) | RB16 card image, BGAs, RB11 | "Death From Above" |
| Frenzy: your turn ends at once (no end-of-turn effects) and a new one starts; via Opportunist on someone else's turn, you play right after them | DZ, BGAs | "Frenzy" |
| Even Bigger: max 12; losing it only caps you at 10 (2011: max +2, losing it takes 2 hearts) | BGA, BGAs, RB11 | "Even Bigger" |
| Regeneration only adds to heart-dice healing (2011: any healing) | DZ | "…Regeneration only on heart dice" |
| It Has a Child: keep energy and tokens, leave Tokyo, back at 10 hearts and 0 points | DZ, BGAs, BGA | — |
| Healing Ray: 2 energy per heart, or what they have left | BGA | — |
| Rooting for the Underdog: end of your own turn (2011: end of any turn) | BGA, FAN11 | — |
| Mimic copies get their own fresh tokens; Parasitic Tentacles resets Smoke Cloud / Battery Monster (2011: tokens move with the card) | RB16, DZ, BGAs, RB11 | — |
| Metamorph refunds the full printed cost | RB16, DZ | — |
| Opportunist: first chance goes clockwise from the active player | RB16, DZ | — |

## Choices where the sources are silent or disagree (flagged)
- **First player**: the rules say most claws on a roll-off goes first; we pick at random (same odds for everyone).
- **Empty deck**: not covered anywhere; we reshuffle the discard pile.
- **2011 entry by Acid Attack**: 2011 needs a rolled claw to take Tokyo; added damage doesn't count.
- **2011 win timing**: RB11 gives none; we use the same end-of-turn check as 2016.
- **Metamorph + Friend of Children**: DZ says no bonus, BGAs says yes; we give no bonus (Metamorph refunds, it doesn't "gain").
- **Vast Storm rounding**: rounded down.
- **2011 Even Bigger loss**: takes 2 hearts but never below 1.
- **Psychic Probe timing**: offered after the active monster's last roll; the active monster can't use Herd Culler/Stretchy/Plot Twist after a probe (BGAs says it may). NOT implemented.

## Odds maths
| Check | Test |
|---|---|
| P(3+ ones in one roll of 6) = 0.0623 by enumerating all 6^6 rolls | "odds: one roll of 6 dice…" |
| Chasing three 1s with 3 dice, 3 rolls = (91/216)^3 | "odds: chasing three 1s…" |
| Keep solver = brute force over real dice tuples (3 dice, 3 rolls, mixed values) | "odds: the keep solver matches…" |

## Tests seen failing on a broken engine (2026-10-20)
Deliberately broke: Extra Head ×1, mid-turn 20-point wins, hearts healing in Tokyo, Made in a Lab top card shown to everyone.
Result: 9 engine tests failed (deck ×3, setup, Tokyo healing, win timing ×3, 100-game test) and the online secrecy test failed. Restored: all pass (now 37 engine tests + 6 online checks).

## Evolutions (option, off by default; added 2026-10-28)
The Power Up! expansion idea, called "Evolutions" on the site. Card texts are in our own words (`js/evolutions.js`); art is the site's own monster portraits.
- **Sources, cross-checked:** Board Game Arena's open-source King of Tokyo (github thoun/kingoftokyo: `src/evolution-cards.ts`, `material.inc.php`), and BGA news on Power Up! (id 621).
- **Monster mapping:** site monster 0 The King, 1 Gigazaur, 2 Cyber Kitty, 3 Alienoid, 4 Meka Dragon, 5 Space Penguin, each with that monster's official 8 cards.
- **Rules kept:** each monster has its own shuffled 8; resolving 3+ ♥ draws one (also in Tokyo); the hand is secret (only `privateView` shows it); Permanent cards stay in play, Temporary ones are used once. A base game uses the random numbers exactly as before (300 computer games byte-identical to the old engine).
- **Simplifications (flagged):** Mega Purr: each monster gives ⚡ if it has any, else ★ (no choice). Superior Alien Technology's half price is applied automatically. Target Acquired moves automatically. Nine Lives plays itself. Lightning Armor, Breath of Doom and Exotic Arms damage lands at once. Reactive cards (Detachable Tail, Simian Scamper, Giant Banana, Radioactive Waste) are offered when you are about to lose hearts. Anger Batteries is offered at the end of any turn you lost hearts in, and can also be played in your own buy step. Computers never load Exotic Arms and never use Encased in Ice.
- **Tests:** `tests/evo.test.js` has one test per card (54, all seen failing before the engine code); the ladder test with evolutions on holds Hard ≥ Medium ≥ Easy; `tests/evo-ui.mjs` (WebKit, 393 px) failed on the old screen (no switch) and passes now.
