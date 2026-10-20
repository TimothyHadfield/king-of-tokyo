/* Original SVG art for King of Tokyo Lab: dice faces, six monsters, the Tokyo board, card icons.
   All drawn here; nothing copied from the published game. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KotArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------ symbols (24x24 boxes)
  const SYM = {
    E: '<path d="M13.5 2 5 13.2h5.6L9.4 22 19 9.8h-5.8L13.5 2z" fill="#f4c542" stroke="#8a6512" stroke-width="1" stroke-linejoin="round"/>',
    H: '<path d="M12 21s-8-4.9-8-11a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 6.1-8 11-8 11z" fill="#ef5468" stroke="#7a1d2a" stroke-width="1"/>',
    C: '<g fill="#f2ede1" stroke="#5a5040" stroke-width=".9"><path d="M5 20C6 13 9 7 14 3c-2.6 5-3.6 10-3.8 16z"/><path d="M10.5 21c1-6 3.4-11 7.8-15-2 4.7-2.8 9.4-3 14.6z"/><path d="M16 21.5c.9-4.2 2.6-7.8 5.2-10.5-1 3.3-1.4 6.6-1.4 10.2z"/></g>',
    VP: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#f0b354" stroke="#7a5512" stroke-width="1" stroke-linejoin="round"/>',
  };
  const NUMCOL = '#e9edf5';
  function face(f, size) {
    size = size || 24;
    let inner;
    if (f === '1' || f === '2' || f === '3') inner = `<text x="12" y="17.6" text-anchor="middle" font-size="17" font-weight="800" font-family="system-ui,-apple-system,Segoe UI,sans-serif" fill="${NUMCOL}">${f}</text>`;
    else inner = SYM[f];
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
  }
  function icon(k, size) { return `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" aria-hidden="true">${SYM[k]}</svg>`; }

  // ------------------------------------------------------------ monsters (100x100)
  const MON = [
    // The King: a big ape with a crown
    `<circle cx="50" cy="56" r="34" fill="#7a5131"/><ellipse cx="50" cy="66" rx="22" ry="17" fill="#c89a6c"/>
     <circle cx="25" cy="48" r="9" fill="#7a5131"/><circle cx="75" cy="48" r="9" fill="#7a5131"/>
     <ellipse cx="39" cy="52" rx="6" ry="6.5" fill="#fff"/><ellipse cx="61" cy="52" rx="6" ry="6.5" fill="#fff"/>
     <circle cx="40" cy="53" r="3.2" fill="#1b1410"/><circle cx="60" cy="53" r="3.2" fill="#1b1410"/>
     <path d="M31 43l14 4M69 43l-14 4" stroke="#3b2414" stroke-width="4" stroke-linecap="round"/>
     <ellipse cx="44" cy="64" rx="2.6" ry="2" fill="#5a3a22"/><ellipse cx="56" cy="64" rx="2.6" ry="2" fill="#5a3a22"/>
     <path d="M38 74q12 8 24 0" stroke="#3b2414" stroke-width="3" fill="none" stroke-linecap="round"/>
     <path d="M30 26l7 9 7-12 6 12 6-12 7 12 7-9-3 15H33z" fill="#f2c443" stroke="#9a7514" stroke-width="1.5" stroke-linejoin="round"/>
     <circle cx="50" cy="33" r="2.6" fill="#e2584f"/>`,
    // Gigazaur: green dinosaur with back spikes
    `<path d="M22 30l8 10M34 20l5 12M50 15l1 13M66 19l-4 13" stroke="#3d8f3f" stroke-width="7" stroke-linecap="round"/>
     <path d="M18 62c0-22 14-34 34-34s32 12 32 30c0 10-6 14-14 14H40c-14 0-22 2-22-10z" fill="#5cb85c"/>
     <path d="M30 70c10 10 34 12 50 2l-2 10c-14 8-36 8-48-2z" fill="#4a9e4a"/>
     <path d="M36 72l3 6 3-6 3 6 3-6 3 6 3-6 3 6 3-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
     <circle cx="58" cy="46" r="8" fill="#fff"/><circle cx="60" cy="47" r="4" fill="#1d2a12"/>
     <path d="M49 37l15 4" stroke="#2d6b2d" stroke-width="4" stroke-linecap="round"/>
     <circle cx="78" cy="58" r="2" fill="#2d6b2d"/><circle cx="72" cy="59" r="2" fill="#2d6b2d"/>`,
    // Cyber Kitty: pink robot cat
    `<path d="M22 40L26 12l20 18zM78 40L74 12 54 30z" fill="#d86aa6" stroke="#8c2f63" stroke-width="2" stroke-linejoin="round"/>
     <path d="M28 33l1-12 9 9M72 33l-1-12-9 9" fill="#f6b8d8"/>
     <rect x="18" y="28" width="64" height="56" rx="24" fill="#e783ba" stroke="#8c2f63" stroke-width="2"/>
     <rect x="27" y="44" width="46" height="17" rx="8.5" fill="#24203a"/>
     <circle cx="39" cy="52.5" r="5" fill="#7ef0ff"/><circle cx="61" cy="52.5" r="5" fill="#7ef0ff"/>
     <path d="M47 67l3 3 3-3z" fill="#8c2f63"/><path d="M42 73q4 4 8 0q4 4 8 0" stroke="#8c2f63" stroke-width="2.4" fill="none" stroke-linecap="round"/>
     <path d="M20 66h-12M20 72h-11M80 66h12M80 72h11" stroke="#f6b8d8" stroke-width="2" stroke-linecap="round"/>
     <circle cx="50" cy="18" r="4" fill="#7ef0ff"/><path d="M50 22v8" stroke="#8c2f63" stroke-width="2.5"/>`,
    // Alienoid: yellow, three eyes, antennae
    `<path d="M36 26L28 8M64 26l8-18" stroke="#b58714" stroke-width="3.5" stroke-linecap="round"/>
     <circle cx="28" cy="8" r="5" fill="#9be15d"/><circle cx="72" cy="8" r="5" fill="#9be15d"/>
     <path d="M50 20c22 0 32 16 32 34 0 18-14 32-32 32S18 72 18 54c0-18 10-34 32-34z" fill="#e8b93a" stroke="#9a7514" stroke-width="2"/>
     <circle cx="36" cy="48" r="8" fill="#fff"/><circle cx="64" cy="48" r="8" fill="#fff"/><circle cx="50" cy="36" r="7" fill="#fff"/>
     <circle cx="37" cy="49" r="4" fill="#1d1a2e"/><circle cx="63" cy="49" r="4" fill="#1d1a2e"/><circle cx="50" cy="37" r="3.6" fill="#1d1a2e"/>
     <path d="M34 66q16 14 32 0z" fill="#5a2a1a"/><path d="M40 66l3 5 3-5M54 66l3 5 3-5" fill="#fff"/>`,
    // Meka Dragon: red robot dragon
    `<path d="M26 34L14 14l22 12M74 34l12-20-22 12" fill="#9aa3b5" stroke="#4d5568" stroke-width="2" stroke-linejoin="round"/>
     <path d="M16 50c0-18 16-28 34-28s34 10 34 28v12c0 14-14 24-34 24S16 76 16 62z" fill="#d9493f" stroke="#7a1f1a" stroke-width="2"/>
     <rect x="24" y="40" width="52" height="14" rx="4" fill="#2b2f3c"/>
     <path d="M30 47h14M56 47h14" stroke="#ffd25a" stroke-width="5" stroke-linecap="round"/>
     <rect x="30" y="62" width="40" height="14" rx="5" fill="#9aa3b5" stroke="#4d5568" stroke-width="2"/>
     <path d="M38 62v14M46 62v14M54 62v14M62 62v14" stroke="#4d5568" stroke-width="2"/>
     <circle cx="22" cy="58" r="3" fill="#ffd25a"/><circle cx="78" cy="58" r="3" fill="#ffd25a"/>`,
    // Space Penguin: blue penguin in a helmet
    `<circle cx="50" cy="52" r="38" fill="#bfe3ff" fill-opacity=".25" stroke="#cfeaff" stroke-width="3"/>
     <path d="M50 22c18 0 28 14 28 32s-10 30-28 30-28-12-28-30 10-32 28-32z" fill="#2f4f7a"/>
     <path d="M50 38c11 0 17 9 17 20s-7 22-17 22-17-11-17-22 6-20 17-20z" fill="#f4f6fb"/>
     <circle cx="43" cy="50" r="4.6" fill="#fff" stroke="#2f4f7a" stroke-width="1.5"/><circle cx="57" cy="50" r="4.6" fill="#fff" stroke="#2f4f7a" stroke-width="1.5"/>
     <circle cx="44" cy="51" r="2.3" fill="#111"/><circle cx="56" cy="51" r="2.3" fill="#111"/>
     <path d="M44 58l6 7 6-7z" fill="#f2a33a" stroke="#a5611a" stroke-width="1.2" stroke-linejoin="round"/>
     <path d="M28 26q8-8 16-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
  ];
  function monster(i, size, extra) {
    return `<svg viewBox="0 0 100 100" width="${size || 40}" height="${size || 40}" aria-hidden="true" ${extra || ''}>${MON[i] || MON[0]}</svg>`;
  }

  // ------------------------------------------------------------ Tokyo skyline (wide strip)
  function skyline(w, h, color) {
    const c = color || '#232a3d';
    let x = 0, d = '';
    const blocks = [[14, .55], [10, .7], [18, .45], [8, .85], [16, .6], [12, .4], [20, .75], [9, .5], [15, .66], [11, .38], [17, .58], [10, .8], [14, .48]];
    let k = 0;
    while (x < w) {
      const [bw, bh] = blocks[k++ % blocks.length];
      const top = h - bh * h;
      d += `<rect x="${x}" y="${top.toFixed(1)}" width="${bw - 1}" height="${(h - top).toFixed(1)}"/>`;
      x += bw;
    }
    return `<svg class="sky" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><g fill="${c}">${d}</g>
      <path d="M${w * 0.62} ${h} V${h * 0.18} M${w * 0.62 - 6} ${h} L${w * 0.62} ${h * 0.18} L${w * 0.62 + 6} ${h}" stroke="${c}" stroke-width="2.4" fill="none"/></svg>`;
  }

  // ------------------------------------------------------------ card icons by what the card does
  const CARD_ICON = {
    VP: ['apartment-building', 'commuter-train', 'corner-store', 'skyscraper', 'dedicated-news-team', 'alpha-monster', 'herbivore', 'gourmet', 'omnivore', 'complete-destruction', 'eater-of-the-dead', 'energy-hoarder', 'rooting-for-the-underdog', 'evacuation-orders', 'urbavore', 'amusement-park', 'nuclear-power-plant', 'tanks', 'jet-fighters', 'national-guard', 'death-from-above', 'drop-from-high-altitude', 'army'],
    E: ['energize', 'friend-of-children', 'solar-powered', 'monster-batteries', 'battery-monster', 'alien-metabolism', 'metamorph', 'were-only-making-it-stronger', 'vast-storm', 'opportunist', 'parasitic-tentacles', 'made-in-a-lab'],
    H: ['heal', 'rapid-healing', 'regeneration', 'even-bigger', 'healing-ray', 'it-has-a-child', 'armor-plating', 'camouflage', 'wings', 'jets'],
    C: ['acid-attack', 'spiked-tail', 'fire-breathing', 'nova-breath', 'poison-spit', 'poison-quills', 'shrink-ray', 'fire-blast', 'gas-refinery', 'high-altitude-bombing', 'burrowing'],
  };
  const ICON_OF = {};
  for (const k of Object.keys(CARD_ICON)) for (const id of CARD_ICON[k]) ICON_OF[id] = k;
  function cardIcon(id, size) {
    const k = ICON_OF[id];
    if (k) return icon(k, size);
    // dice-related cards: a small die
    return `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#232838" stroke="#8fa0c8" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.8" fill="#cfd8ee"/><circle cx="15.5" cy="15.5" r="1.8" fill="#cfd8ee"/><circle cx="12" cy="12" r="1.8" fill="#cfd8ee"/></svg>`;
  }
  // a colour band per icon kind for card tops
  const KIND_COL = { VP: '#f0b354', E: '#f4c542', H: '#ef5468', C: '#c9c1ad' };
  const cardKind = id => ICON_OF[id] || 'D';

  return { face, icon, monster, skyline, cardIcon, cardKind, KIND_COL, SYM };
});
