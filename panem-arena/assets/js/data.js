'use strict';
/* ===== Static data for the 50th Hunger Games game ===== */

const DISTRICTS = [
  { n: 1,  name: 'Luxury',          color: '#d9d34a', ink: '#2a2600', industry: 'Luxury goods for the Capitol',            career: true },
  { n: 2,  name: 'Masonry & Defense', color: '#9b3fc0', ink: '#ffffff', industry: 'Stone, weapons and Peacekeeper training', career: true },
  { n: 3,  name: 'Technology',      color: '#8fc8f0', ink: '#082033', industry: 'Electronics and machinery' },
  { n: 4,  name: 'Fishing',         color: '#5a85a6', ink: '#ffffff', industry: 'Fishing and seafood',                     career: true },
  { n: 5,  name: 'Power',           color: '#f0852a', ink: '#2a1200', industry: 'Electricity and power plants' },
  { n: 6,  name: 'Transportation',  color: '#a3a3ae', ink: '#14141a', industry: 'Trains and vehicles' },
  { n: 7,  name: 'Lumber',          color: '#b4502a', ink: '#ffffff', industry: 'Lumber and paper' },
  { n: 8,  name: 'Textiles',        color: '#f0916a', ink: '#2a1000', industry: 'Cloth and clothing' },
  { n: 9,  name: 'Grain',           color: '#f4d03a', ink: '#2a2200', industry: 'Grain and cereal crops' },
  { n: 10, name: 'Livestock',       color: '#b5201d', ink: '#ffffff', industry: 'Cattle and livestock' },
  { n: 11, name: 'Agriculture',     color: '#6a7a2d', ink: '#ffffff', industry: 'Farming and orchards' },
  { n: 12, name: 'Coal Mining',     color: '#1b1b1b', ink: '#ffffff', industry: 'Coal mining' }
];

/* District perks (small, so the game stays fair) */
const PERKS = {
  1:  { txt: 'Poise: +4% move speed',                         spd: 1.04 },
  2:  { txt: 'Trained killer: +12% melee damage',             melee: 1.12 },
  3:  { txt: 'Calculated aim: +12% ranged damage, faster dash', ranged: 1.12, dashCd: 0.8 },
  4:  { txt: 'Sea legs: +20% trident damage, thirst drains slower', trident: 1.2, thirst: 0.75 },
  5:  { txt: 'Endurance: +20% stamina regeneration',          stam: 1.2 },
  6:  { txt: 'Sprinter: +8% sprint speed',                    sprint: 1.08 },
  7:  { txt: 'Lumberjack: +25% axe damage',                   axe: 1.25 },
  8:  { txt: 'Nimble hands: medkits heal +20%',               med: 1.2 },
  9:  { txt: 'Well fed: hunger drains 25% slower',            hunger: 0.75 },
  10: { txt: 'Tough hide: +10 max health',                    hp: 10 },
  11: { txt: 'Hardy: hunger and thirst drain 15% slower',     hunger: 0.85, thirst: 0.85 },
  12: { txt: 'Survivor: 30% poison resistance, +5 max health', poison: 0.7, hp: 5 }
};

/* name, gender, feet, inches  (heights as shown on the tribute board) */
const RAW = {
  1:  [['Silka','F',5,7],['Panache','M',6,0],['Carat','F',5,7],['Loupe','M',5,11]],
  2:  [['Camilla','F',5,8],['Alpheus','M',6,2],['Nona','F',5,3],['Janus','M',6,1]],
  3:  [['Coil','F',5,1],['Ampert','M',5,1],['Dio','F',5,10],['Lect','M',5,9]],
  4:  [['Maritte','F',5,6],['Angler','M',6,0],['Barba','F',5,4],['Urchin','M',5,4]],
  5:  [['Potena','F',5,5],['Fisser','M',5,7],['Anion','F',5,9],['Hychel','M',5,10]],
  6:  [['Wellie','F',5,2],['Atread','M',5,7],['Velo','F',5,6],['Miles','M',6,0]],
  7:  [['Ringina','F',5,4],['Heartwood','M',5,8],['Autumn','F',4,11],['Bircher','M',6,0]],
  8:  [['Notion','F',5,8],['Ripman','M',5,9],['Alawna','F',5,6],['Wefton','M',5,11]],
  9:  [['Kerna','F',4,9],['Clayton','M',5,11],['Midge','F',5,5],['Ryan','M',5,9]],
  10: [['Peeler','F',5,1],['Buck','M',5,9],['Lannie','F',5,3],['Stamp','M',6,0]],
  11: [['Blossom','F',4,11],['Hull','M',6,0],['Chicory','F',5,7],['Tile','M',6,2]],
  12: [['Louella','F',4,11],['Haymitch','M',6,2],['Maysilee','F',5,3],['Wyatt','M',5,8]]
};

const TRIBUTES = [];
Object.keys(RAW).forEach(d => RAW[d].forEach(r => {
  TRIBUTES.push({
    id: TRIBUTES.length, name: r[0], d: +d, g: r[1],
    ft: r[2], inch: r[3], hIn: r[2] * 12 + r[3],
    img: 'assets/img/tributes/' + r[0].toLowerCase() + '.jpg'
  });
}));

/* Weapons: cat = slot (0 melee, 1 ranged, 2 survival) ; kind = how it is used */
const WEAPONS = {
  knife:   { name: 'Knife',          cat: 0, kind: 'melee',  dmg: 26, range: 2.1, cd: 0.34, arc: 80, ico: '🔪', val: 2 },
  spear:   { name: 'Spear',          cat: 0, kind: 'melee',  dmg: 33, range: 3.5, cd: 0.75, arc: 40, ico: '🔱', val: 4, thrust: true },
  mace:    { name: 'Mace',           cat: 0, kind: 'melee',  dmg: 45, range: 2.5, cd: 1.0,  arc: 90, ico: '🔨', val: 4, knock: 4 },
  bow:     { name: 'Bow & Arrows',   cat: 1, kind: 'ranged', dmg: 42, spd: 62, cd: 0.95, grav: 9,  ammo: 'arrow', give: 9, ico: '🏹', val: 6 },
  tknives: { name: 'Throwing Knives',cat: 1, kind: 'ranged', dmg: 27, spd: 44, cd: 0.45, grav: 7,  ammo: 'knife', give: 8, ico: '🗡️', val: 3 },
  sling:   { name: 'Slingshot',      cat: 1, kind: 'ranged', dmg: 16, spd: 50, cd: 0.55, grav: 6,  ammo: 'stone', give: 14, ico: '🪨', val: 2 },
  axe:     { name: 'Axe',            cat: 2, kind: 'melee',  dmg: 48, range: 2.4, cd: 1.0,  arc: 80, ico: '🪓', val: 5, axe: true },
  sword:   { name: 'Sword',          cat: 2, kind: 'melee',  dmg: 39, range: 2.9, cd: 0.55, arc: 90, ico: '⚔️', val: 5 },
  trident: { name: 'Trident',        cat: 2, kind: 'melee',  dmg: 36, range: 3.6, cd: 0.8,  arc: 45, ico: '🔱', val: 4, thrust: true, trident: true },
  blowgun: { name: 'Blowgun & Darts',cat: 2, kind: 'ranged', dmg: 7,  spd: 75, cd: 0.7, grav: 3, ammo: 'dart', give: 10, ico: '💨', val: 3, poison: true },
  sickle:  { name: 'Sickle',         cat: 2, kind: 'melee',  dmg: 30, range: 2.3, cd: 0.5,  arc: 100, ico: '🌙', val: 3, bleed: true }
};
const SLOT_NAMES = ['Melee', 'Ranged', 'Survival'];

const DIFF = {
  easy:   { label: 'EASY',   desc: 'Slow, inaccurate rivals. Gentler fog and fewer eruptions. Resources last longer.',
            aiMiss: 0.35, aiDmg: 0.7, aiAcc: 9,  think: 0.55, aggr: 0.45, rush: 0.30, aiSpeed: 0.88, drain: 0.7, hazard: 1.5, fog: 1.3, regen: 1.0, hunt: 0.0 },
  medium: { label: 'MEDIUM', desc: 'Balanced rivals. Careers hunt in packs. Hazards strike on a steady schedule.',
            aiMiss: 0.2, aiDmg: 1.0, aiAcc: 5,  think: 0.35, aggr: 0.7,  rush: 0.45, aiSpeed: 0.96, drain: 1.0, hazard: 1.0, fog: 1.0, regen: 0.7, hunt: 0.25 },
  hard:   { label: 'HARD',   desc: 'Fast, sharp-aimed rivals who hunt you down. Frequent eruptions and a fast-closing fog.',
            aiMiss: 0.08, aiDmg: 1.3, aiAcc: 2.2, think: 0.22, aggr: 0.95, rush: 0.6, aiSpeed: 1.03, drain: 1.3, hazard: 0.6, fog: 0.75, regen: 0.4, hunt: 0.6 }
};

const KNOWN_BIOS = {
  Haymitch: 'District 12 tribute. In the story he wins this Games, using the arena itself against the Capitol.',
  Maysilee: 'District 12 tribute and Haymitch\'s ally in the arena.',
  Louella: 'District 12 tribute reaped alongside Haymitch and Maysilee.',
  Wyatt: 'District 12 tribute reaped alongside Haymitch and Maysilee.'
};

/* Hair per tribute: style, colour (hex), optional flags (bangs, beard, goatee) — matched to the portraits */
const HAIR = {
  Silka: ['long', 0xb8895a], Panache: ['curl', 0x15110e, 'goatee'], Carat: ['long', 0x1a1414], Loupe: ['afro', 0x120e0c],
  Camilla: ['long', 0x2a1c16], Alpheus: ['curl', 0x2a1c14], Nona: ['bob', 0x1b1512, 'bangs'], Janus: ['wavy', 0x4a3322],
  Coil: ['bob', 0x7a5a3a, 'bangs'], Ampert: ['curl', 0x0f0d0c], Dio: ['long', 0x9a6b35], Lect: ['quiff', 0x17120f],
  Maritte: ['long', 0x3a2a22], Angler: ['long', 0x16100e, 'beard'], Barba: ['long', 0x6b5440], Urchin: ['curl', 0xb89a4a],
  Potena: ['bob', 0x6a4326], Fisser: ['short', 0x2a1c1c], Anion: ['curl', 0x15110f], Hychel: ['short', 0x100e0d],
  Wellie: ['long', 0x120e0e], Atread: ['short', 0x141010], Velo: ['long', 0x7a5b3d], Miles: ['short', 0x1b1512],
  Ringina: ['bun', 0x1a1210], Heartwood: ['quiff', 0x0f0d0d], Autumn: ['long', 0x9a7a52], Bircher: ['quiff', 0x9a5a30],
  Notion: ['long', 0xa04a22], Ripman: ['short', 0x1a1410], Alawna: ['afro', 0x120d0b], Wefton: ['wavy', 0x5a4330],
  Kerna: ['long', 0x4a3426], Clayton: ['curl', 0x15100e], Midge: ['long', 0x6a4a35], Ryan: ['quiff', 0x8a5a30],
  Peeler: ['long', 0x1a1311], Buck: ['quiff', 0x120e0d], Lannie: ['long', 0x120d0d], Stamp: ['slick', 0x8a6a45],
  Blossom: ['bun', 0x14100f], Hull: ['short', 0x4a3322], Chicory: ['short', 0x0d0b0b], Tile: ['afro', 0x120d0b],
  Louella: ['braids', 0x1d1412], Haymitch: ['wavy', 0xc8a05a], Maysilee: ['long', 0xe0c27a, 'bangs'], Wyatt: ['short', 0x15110f]
};
