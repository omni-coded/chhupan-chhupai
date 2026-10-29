/**
 * Drawn player characters, built from parts. avatarSvg() returns an SVG string so
 * the same character can go in React (Avatar.jsx) and in Leaflet map markers.
 * Shared by the server (to validate) and the app.
 */

export const SKINS = ['#f6d2b0', '#e8b48f', '#d39a6f', '#b47a52', '#8d5a3b', '#6a4029'];
export const HAIR_COLORS = ['#1d1412', '#3b2416', '#6b3f22', '#a8a8a8', '#9b3a1f', '#2f5fd0'];
export const OUTFIT_COLORS = ['#ff7a00', '#e0218a', '#0e8a83', '#ffb300', '#6d4bd8', '#2f9e44', '#d9381e', '#1c7ed6', '#2a1208', '#f4f0e6'];
export const BGS = ['#ffe3c2', '#ffd6e8', '#cfeee9', '#fff0b3', '#e2dbff', '#d7f2d1', '#ffd8cf', '#d3e7ff'];

export const PARTS = {
  hair: ['short', 'sidepart', 'curly', 'spiky', 'long', 'plait', 'bun', 'bald'],
  head: ['none', 'pagdi', 'cap', 'monkeycap', 'headband', 'gajra'],
  face: ['smile', 'grin', 'cool', 'wow'],
  extra: ['none', 'mustache', 'beard', 'bindi', 'specs', 'shades', 'nath'],
  outfit: ['kurta', 'tshirt', 'jersey', 'saree', 'hoodie', 'uniform'],
};

export const PART_LABELS = {
  hair: { short: 'Short', sidepart: 'Side part', curly: 'Curly', spiky: 'Spiky', long: 'Long', plait: 'Choti', bun: 'Bun', bald: 'Takla' },
  head: { none: 'Nothing', pagdi: 'Pagdi', cap: 'Cricket cap', monkeycap: 'Monkey cap', headband: 'Headband', gajra: 'Gajra' },
  face: { smile: 'Smile', grin: 'Big grin', cool: 'Cool', wow: 'Shocked' },
  extra: { none: 'Nothing', mustache: 'Moustache', beard: 'Beard', bindi: 'Bindi', specs: 'Specs', shades: 'Shades', nath: 'Nath' },
  outfit: { kurta: 'Kurta', tshirt: 'T-shirt', jersey: 'Jersey', saree: 'Saree', hoodie: 'Hoodie', uniform: 'School uniform' },
};

/** Ready-made characters for one-tap picking. */
export const PRESETS = [
  { name: 'Captain', av: { skin: 2, hair: 'short', hairColor: 0, head: 'cap', face: 'grin', extra: 'none', outfit: 'jersey', outfitColor: 7, bg: 7 } },
  { name: 'Topper', av: { skin: 1, hair: 'plait', hairColor: 0, head: 'none', face: 'smile', extra: 'specs', outfit: 'uniform', outfitColor: 6, bg: 4 } },
  { name: 'Shaadi Ready', av: { skin: 3, hair: 'bun', hairColor: 1, head: 'gajra', face: 'smile', extra: 'nath', outfit: 'saree', outfitColor: 1, bg: 1 } },
  { name: 'Pagdi Pro', av: { skin: 2, hair: 'short', hairColor: 0, head: 'pagdi', face: 'grin', extra: 'beard', outfit: 'kurta', outfitColor: 3, bg: 3 } },
  { name: 'Winter Warrior', av: { skin: 4, hair: 'short', hairColor: 0, head: 'monkeycap', face: 'wow', extra: 'none', outfit: 'hoodie', outfitColor: 5, bg: 5 } },
  { name: 'Rockstar', av: { skin: 0, hair: 'spiky', hairColor: 5, head: 'none', face: 'cool', extra: 'shades', outfit: 'tshirt', outfitColor: 8, bg: 6 } },
  { name: 'Kurta Uncle', av: { skin: 3, hair: 'bald', hairColor: 3, head: 'none', face: 'smile', extra: 'mustache', outfit: 'kurta', outfitColor: 9, bg: 0 } },
  { name: 'Gym Bhai', av: { skin: 5, hair: 'sidepart', hairColor: 0, head: 'headband', face: 'cool', extra: 'none', outfit: 'tshirt', outfitColor: 6, bg: 2 } },
  { name: 'Dancer', av: { skin: 4, hair: 'long', hairColor: 2, head: 'none', face: 'grin', extra: 'bindi', outfit: 'kurta', outfitColor: 4, bg: 1 } },
  { name: 'Curly Champ', av: { skin: 1, hair: 'curly', hairColor: 4, head: 'none', face: 'grin', extra: 'none', outfit: 'jersey', outfitColor: 2, bg: 2 } },
];

const rnd = (n) => Math.floor(Math.random() * n);
const pickOf = (arr) => arr[rnd(arr.length)];

export function randomAvatar() {
  return {
    skin: rnd(SKINS.length),
    hair: pickOf(PARTS.hair),
    hairColor: rnd(HAIR_COLORS.length),
    head: Math.random() < 0.5 ? 'none' : pickOf(PARTS.head),
    face: pickOf(PARTS.face),
    extra: Math.random() < 0.4 ? 'none' : pickOf(PARTS.extra),
    outfit: pickOf(PARTS.outfit),
    outfitColor: rnd(OUTFIT_COLORS.length),
    bg: rnd(BGS.length),
  };
}

/** Accepts anything and returns a valid avatar (random parts fill in the gaps). */
export function cleanAvatar(input) {
  const a = input && typeof input === 'object' ? input : {};
  const r = randomAvatar();
  const idx = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
  const part = (k) => (PARTS[k].includes(a[k]) ? a[k] : r[k]);
  return {
    skin: idx(a.skin, SKINS.length, r.skin),
    hair: part('hair'),
    hairColor: idx(a.hairColor, HAIR_COLORS.length, r.hairColor),
    head: part('head'),
    face: part('face'),
    extra: part('extra'),
    outfit: part('outfit'),
    outfitColor: idx(a.outfitColor, OUTFIT_COLORS.length, r.outfitColor),
    bg: idx(a.bg, BGS.length, r.bg),
  };
}

const INK = '#2a1208';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

function hairBack(style, hc) {
  if (style === 'long') return `<path d="M29 46 Q26 19 50 21 Q74 19 71 46 L74 78 Q63 71 60 62 L40 62 Q37 71 26 78 Z" fill="${hc}"/>`;
  if (style === 'plait')
    return `<path d="M30 46 Q30 30 38 26 L33 62 Z" fill="${hc}"/><g fill="${hc}" stroke="${shade(hc, 0.7)}" stroke-width="1">${[62, 69, 76, 83].map((y) => `<ellipse cx="31" cy="${y}" rx="4.5" ry="4.2"/>`).join('')}</g>`;
  return '';
}

function hairFront(style, hc) {
  switch (style) {
    case 'short':
      return `<path d="M31 45 Q29 23 50 22 Q71 23 69 45 Q67 33 50 32 Q35 33 31 45 Z" fill="${hc}"/>`;
    case 'sidepart':
      return `<path d="M31 47 Q28 21 53 22 Q72 24 69 46 Q67 34 59 31 Q49 37 37 35 Q33 39 31 47 Z" fill="${hc}"/>`;
    case 'curly':
      return `<g fill="${hc}">${[
        [33, 38], [36, 30], [42, 25], [50, 23], [58, 25], [64, 30], [67, 38], [46, 30], [54, 30],
      ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5"/>`).join('')}</g>`;
    case 'spiky':
      return `<path d="M31 45 L30 30 L36 33 L37 20 L44 29 L50 17 L56 29 L63 20 L64 33 L70 30 L69 45 Q66 34 50 33 Q34 34 31 45 Z" fill="${hc}"/>`;
    case 'long':
    case 'plait':
      return `<path d="M31 47 Q29 22 50 22 Q71 22 69 47 Q66 33 56 30 Q50 36 44 30 Q34 33 31 47 Z" fill="${hc}"/>`;
    case 'bun':
      return `<circle cx="50" cy="20" r="8" fill="${hc}"/><path d="M31 45 Q29 24 50 23 Q71 24 69 45 Q66 32 50 31 Q34 32 31 45 Z" fill="${hc}"/>`;
    case 'bald':
      return `<ellipse cx="44" cy="31" rx="5" ry="2.5" fill="#fff" opacity="0.35"/>`;
    default:
      return '';
  }
}

function headwear(kind, oc) {
  switch (kind) {
    case 'pagdi': {
      const c = oc === '#f4f0e6' ? '#ff7a00' : oc;
      return `<path d="M27 43 Q26 16 50 15 Q74 16 73 43 Q63 34 50 35 Q37 34 27 43 Z" fill="${c}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M31 36 Q46 22 69 30 M30 29 Q50 18 66 24" fill="none" stroke="${shade(c, 0.7)}" stroke-width="2"/>
        <circle cx="50" cy="28" r="3" fill="#ffd43b" stroke="${INK}" stroke-width="1"/>`;
    }
    case 'cap':
      return `<path d="M30 39 Q30 19 50 19 Q70 19 70 39 Z" fill="#1c7ed6" stroke="${INK}" stroke-width="1.5"/>
        <path d="M29 38 Q52 30 79 41 Q62 45 30 41 Z" fill="#155fa8" stroke="${INK}" stroke-width="1.5"/>
        <circle cx="50" cy="19.5" r="2" fill="${INK}"/>`;
    case 'headband':
      return `<path d="M30 37 Q50 29 70 37 L70 42 Q50 34 30 42 Z" fill="#e0218a" stroke="${INK}" stroke-width="1.2"/>`;
    case 'gajra':
      return `<g fill="#fff" stroke="#c9b98f" stroke-width="0.8">${[
        [40, 15], [45, 13], [55, 13], [60, 15], [63, 19],
      ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g><circle cx="37" cy="18" r="2.6" fill="#ff7a00"/>`;
    default:
      return '';
  }
}

function mouth(face) {
  switch (face) {
    case 'grin':
      return `<path d="M42 55 Q50 66 58 55 Z" fill="${INK}"/><path d="M44 55.5 L56 55.5 L55 58 L45 58 Z" fill="#fff"/>`;
    case 'cool':
      return `<path d="M44 58 Q51 60 57 55" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'wow':
      return `<ellipse cx="50" cy="58" rx="3" ry="3.8" fill="${INK}"/>`;
    default:
      return `<path d="M43 56 Q50 62 57 56" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

function eyes(face, extra) {
  if (extra === 'shades') return '';
  if (face === 'wow') return `<circle cx="43" cy="46" r="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="57" cy="46" r="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="43" cy="46" r="1.4" fill="${INK}"/><circle cx="57" cy="46" r="1.4" fill="${INK}"/>`;
  if (face === 'grin') return `<path d="M40 47 Q43 44 46 47 M54 47 Q57 44 60 47" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  return `<circle cx="43" cy="47" r="2.3" fill="${INK}"/><circle cx="57" cy="47" r="2.3" fill="${INK}"/>`;
}

function extras(kind, hc) {
  switch (kind) {
    case 'mustache':
      return `<path d="M41 54 Q45 50 50 52.5 Q55 50 59 54 Q55 56.5 50 55 Q45 56.5 41 54 Z" fill="${hc}"/>`;
    case 'beard':
      return `<path d="M31 48 Q31 71 50 72 Q69 71 69 48 Q66 63 58 62 Q50 66 42 62 Q34 63 31 48 Z" fill="${hc}"/><path d="M41 54 Q45 50 50 52.5 Q55 50 59 54 Q55 56.5 50 55 Q45 56.5 41 54 Z" fill="${hc}"/>`;
    case 'bindi':
      return `<circle cx="50" cy="39" r="1.8" fill="#d9381e"/>`;
    case 'specs':
      return `<g fill="none" stroke="${INK}" stroke-width="1.8"><circle cx="43" cy="47" r="5"/><circle cx="57" cy="47" r="5"/><path d="M48 47 L52 47"/></g>`;
    case 'shades':
      return `<path d="M36 43 L48 43 Q48 51 42 51 Q36 51 36 43 Z M52 43 L64 43 Q64 51 58 51 Q52 51 52 43 Z" fill="${INK}"/><path d="M48 44 L52 44" stroke="${INK}" stroke-width="2"/><path d="M38 45 L42 45" stroke="#fff" stroke-width="1" opacity="0.6"/>`;
    case 'nath':
      return `<circle cx="54" cy="53" r="2.6" fill="none" stroke="#e8b923" stroke-width="1.4"/>`;
    default:
      return '';
  }
}

function outfit(kind, oc, skin) {
  const body = `<path d="M13 101 Q15 75 50 73 Q85 75 87 101 Z" fill="${oc}" stroke="${INK}" stroke-width="1.5"/>`;
  const dark = shade(oc, 0.75);
  switch (kind) {
    case 'kurta':
      return `${body}<path d="M44 74 L50 80 L56 74" fill="none" stroke="${dark}" stroke-width="2.5"/><path d="M50 80 L50 100" stroke="${dark}" stroke-width="2"/>${[85, 91, 97].map((y) => `<circle cx="50" cy="${y}" r="1.4" fill="#ffd43b"/>`).join('')}`;
    case 'tshirt':
      return `${body}<path d="M42 74 Q50 82 58 74" fill="${skin}" stroke="${dark}" stroke-width="2"/>`;
    case 'jersey':
      return `${body}<path d="M43 74 L50 84 L57 74" fill="${skin}" stroke="#fff" stroke-width="2"/><path d="M18 88 Q22 80 30 77 M82 88 Q78 80 70 77" fill="none" stroke="#fff" stroke-width="3"/><text x="50" y="98" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="12" text-anchor="middle" fill="#fff">7</text>`;
    case 'saree':
      return `<path d="M13 101 Q15 75 50 73 Q85 75 87 101 Z" fill="#ffb300" stroke="${INK}" stroke-width="1.5"/><path d="M42 74 Q50 80 58 74" fill="${skin}"/><path d="M26 77 Q40 73 46 76 L78 101 L58 101 Z" fill="${oc}" stroke="${INK}" stroke-width="1.2"/><path d="M27 79 Q41 75 46 78 L75 101" fill="none" stroke="#ffd43b" stroke-width="2"/>`;
    case 'hoodie':
      return `<path d="M30 80 Q28 66 38 64 L62 64 Q72 66 70 80 Z" fill="${dark}" stroke="${INK}" stroke-width="1.5"/>${body}<path d="M46 76 L45 88 M54 76 L55 88" stroke="#fff" stroke-width="1.6"/><path d="M38 92 L62 92 L60 101 L40 101 Z" fill="${dark}"/>`;
    case 'uniform':
      return `<path d="M13 101 Q15 75 50 73 Q85 75 87 101 Z" fill="#fdfdfd" stroke="${INK}" stroke-width="1.5"/><path d="M41 73 L50 79 L59 73 L57 80 L50 82 L43 80 Z" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M48 80 L52 80 L54 99 L50 102 L46 99 Z" fill="${oc}" stroke="${INK}" stroke-width="1"/>`;
    default:
      return body;
  }
}

/** The character as an SVG string. `bg: false` leaves out the background circle. */
export function avatarSvg(input, { bg = true } = {}) {
  const a = cleanAvatar(input);
  const skin = SKINS[a.skin];
  const hc = HAIR_COLORS[a.hairColor];
  const oc = OUTFIT_COLORS[a.outfitColor];
  const monkey = a.head === 'monkeycap';
  const capColor = oc === '#f4f0e6' ? '#d9381e' : oc;
  const parts = [
    bg ? `<circle cx="50" cy="50" r="50" fill="${BGS[a.bg]}"/>` : '',
    monkey ? '' : hairBack(a.hair, hc),
    outfit(a.outfit, oc, skin),
    `<rect x="43" y="60" width="14" height="15" rx="4" fill="${shade(skin, 0.9)}"/>`,
    monkey
      ? `<path d="M26 52 Q25 16 50 15 Q75 16 74 52 L74 66 Q50 80 26 66 Z" fill="${capColor}" stroke="${INK}" stroke-width="1.5"/>
         <path d="M28 60 Q50 72 72 60" fill="none" stroke="${shade(capColor, 0.7)}" stroke-width="2"/>
         <circle cx="50" cy="13" r="5" fill="${shade(capColor, 0.75)}" stroke="${INK}" stroke-width="1.2"/>
         <ellipse cx="50" cy="50" rx="15" ry="15.5" fill="${skin}" stroke="${INK}" stroke-width="1.2"/>`
      : `<circle cx="31" cy="49" r="4.2" fill="${skin}" stroke="${INK}" stroke-width="1.2"/><circle cx="69" cy="49" r="4.2" fill="${skin}" stroke="${INK}" stroke-width="1.2"/>
         <ellipse cx="50" cy="46" rx="19" ry="21" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>`,
    `<circle cx="38" cy="54" r="3" fill="#ff8a8a" opacity="0.35"/><circle cx="62" cy="54" r="3" fill="#ff8a8a" opacity="0.35"/>`,
    eyes(a.face, a.extra),
    mouth(a.face),
    monkey ? '' : hairFront(a.hair, hc),
    monkey ? '' : headwear(a.head, oc),
    extras(monkey && a.extra === 'beard' ? 'mustache' : a.extra, hc),
  ];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block"><defs><clipPath id="cc-clip"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#cc-clip)">${parts.join('')}</g></svg>`;
}
