'use strict';
/* ===== Actors: tributes, combat, projectiles, AI ===== */
A.tributes = []; A.player = null; A.projectiles = []; A.fireballs = []; A.regrow = [];
A.ui = { toast() {}, feed() {}, banner() {}, shake() {}, flash() {}, hint() {} };
A.G = { state: 'idle', time: 0, safeR: 110, diff: DIFF.medium, bloodEnd: 70, dayLen: 300, day: 1, dead: [] };

const _skin = new THREE.MeshLambertMaterial({ color: 0xd9c7ac });
const _khaki = new THREE.MeshLambertMaterial({ color: 0xc9bf9b });
const _navy = new THREE.MeshLambertMaterial({ color: 0x1b2036 });
const _boot = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
const _gLeg = new THREE.BoxGeometry(0.24, 0.92, 0.26), _gBoot = new THREE.BoxGeometry(0.26, 0.12, 0.34),
  _gTorso = new THREE.BoxGeometry(0.58, 0.7, 0.34), _gCape = new THREE.BoxGeometry(0.74, 0.95, 0.07),
  _gTrim = new THREE.BoxGeometry(0.76, 0.16, 0.08), _gHead = new THREE.SphereGeometry(0.2, 12, 10),
  _gBand = new THREE.CylinderGeometry(0.208, 0.208, 0.07, 14), _gArm = new THREE.BoxGeometry(0.17, 0.72, 0.17),
  _gHand = new THREE.SphereGeometry(0.085, 8, 6), _gArmband = new THREE.BoxGeometry(0.19, 0.1, 0.19), _gCollar = new THREE.BoxGeometry(0.5, 0.16, 0.4);

const dist2 = (a, bx, bz) => (a.x - bx) * (a.x - bx) + (a.z - bz) * (a.z - bz);
const turnTo = (cur, want, k) => { let d = want - cur; while (d > Math.PI) d -= A.TAU; while (d < -Math.PI) d += A.TAU; return cur + d * Math.min(1, k); };


/* ---------- hair (stylised, matched to each portrait) ---------- */
const _hairMats = {};
A.addHair = (body, name, band) => {
  const h = HAIR[name]; if (!h) return;
  const [style, col] = h, fl = h.slice(2);
  const m = _hairMats[col] || (_hairMats[col] = new THREE.MeshLambertMaterial({ color: col }));
  const put = (geo, x, y, z, rx, rz) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); if (rx) k.rotation.x = rx; if (rz) k.rotation.z = rz; k.castShadow = true; body.add(k); return k; };
  const cap = (r, y, z, th) => put(new THREE.SphereGeometry(r, 14, 10, 0, A.TAU, 0, th || Math.PI * 0.6), 0, y, z);
  const box = (w, hh, d) => new THREE.BoxGeometry(w, hh, d);
  let bandS = 1.12, bandY = 2.0;
  switch (style) {
    case 'afro': put(new THREE.SphereGeometry(0.29, 14, 12), 0, 2.05, -0.1); bandS = 1.45; bandY = 1.93; break;
    case 'curl': put(new THREE.SphereGeometry(0.245, 14, 10), 0, 2.0, -0.05); for (let i = 0; i < 7; i++) { const a = i / 7 * A.TAU; put(new THREE.SphereGeometry(0.07, 6, 5), Math.cos(a) * 0.16, 2.12, Math.sin(a) * 0.16 - 0.05); } bandS = 1.22; bandY = 1.96; break;
    case 'short': cap(0.222, 1.97, -0.04); break;
    case 'quiff': cap(0.222, 1.97, -0.04); put(box(0.2, 0.09, 0.15), 0, 2.16, 0.07, -0.25); break;
    case 'slick': cap(0.214, 1.965, -0.05); put(new THREE.SphereGeometry(0.07, 8, 6), 0, 1.97, -0.25); break;
    case 'wavy': cap(0.225, 1.97, -0.04); put(box(0.46, 0.22, 0.12), 0, 1.9, -0.17); put(box(0.07, 0.24, 0.2), -0.205, 1.9, -0.04); put(box(0.07, 0.24, 0.2), 0.205, 1.9, -0.04); break;
    case 'bob': cap(0.225, 1.97, -0.04); put(box(0.48, 0.34, 0.12), 0, 1.81, -0.17); put(box(0.07, 0.3, 0.26), -0.21, 1.82, -0.05); put(box(0.07, 0.3, 0.26), 0.21, 1.82, -0.05); break;
    case 'long': cap(0.225, 1.97, -0.04); put(box(0.5, 0.95, 0.09), 0, 1.5, -0.29); put(box(0.07, 0.55, 0.1), -0.21, 1.62, 0.12); put(box(0.07, 0.55, 0.1), 0.21, 1.62, 0.12); put(box(0.06, 0.4, 0.22), -0.22, 1.82, -0.02); put(box(0.06, 0.4, 0.22), 0.22, 1.82, -0.02); break;
    case 'braids': cap(0.225, 1.97, -0.04); for (const sx of [-1, 1]) { put(new THREE.CylinderGeometry(0.04, 0.03, 0.62, 6), sx * 0.15, 1.58, -0.28); put(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), sx * 0.18, 1.85, -0.12, 0.2); } break;
    case 'bun': cap(0.218, 1.97, -0.04); put(new THREE.SphereGeometry(0.1, 10, 8), 0, 2.17, -0.1); break;
  }
  if (fl.includes('bangs')) put(box(0.36, 0.08, 0.07), 0, 2.07, 0.14, 0.35);
  if (fl.includes('beard')) { put(box(0.22, 0.12, 0.06), 0, 1.84, 0.17); put(box(0.14, 0.03, 0.05), 0, 1.9, 0.2); }
  if (fl.includes('goatee')) put(box(0.07, 0.1, 0.04), 0, 1.82, 0.19);
  band.scale.set(bandS, 1, bandS); band.position.y = bandY;
};

/* ---------- creation ---------- */
A.makeNameTag = (t) => {
  const d = DISTRICTS[t.d - 1];
  const tex = A.canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(8,6,6,0.72)'; g.beginPath(); g.roundRect ? g.roundRect(2, 6, w - 4, h - 12, 12) : g.rect(2, 6, w - 4, h - 12); g.fill();
    g.fillStyle = d.color; g.fillRect(8, 12, 44, h - 24);
    g.fillStyle = d.ink; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.n, 30, h / 2 + 1);
    g.fillStyle = '#fff'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(t.isPlayer ? t.name + ' ★' : t.name, 62, h / 2 + 1);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(1.7, 0.42, 1); s.renderOrder = 10; return s;
};

A.makeTribute = (def, slotIdx, isPlayer) => {
  const perk = PERKS[def.d], d = DISTRICTS[def.d - 1], slot = A.slots[slotIdx];
  const t = {
    id: def.id, def, name: def.name, d: def.d, slot: slotIdx, isPlayer, perk,
    scale: A.clamp(0.9 + (def.hIn - 57) / 18 * 0.2, 0.88, 1.12),
    maxHp: 140 + (perk.hp || 0), hunger: 100, thirst: 100, stam: 100, alive: true,
    x: slot.x, z: slot.z, y: -6.5, yaw: slot.yaw, vx: 0, vz: 0, phase: Math.random() * 6,
    wpn: [null, null, null], ammo: { arrow: 0, knife: 0, stone: 0, dart: 0 }, active: -1, med: 0,
    atkT: 0, swingT: -1, swingDur: 0.3, swingKind: 'swing', hitDone: true, dashT: 0, dashCd: 0, dashVX: 0, dashVZ: 0, inv: 0,
    poison: 0, bleed: 0, kills: 0, lastHit: null, lastHitT: -99, hitFlash: 0, deadT: -1, cause: '', ally: 0, ai: null,
    armRest: -0.2, faceT: 0, bump: 0, moveSp: 0, deathDay: 0
  };
  t.hp = t.maxHp;
  const root = new THREE.Group(), fall = new THREE.Group(), body = new THREE.Group();
  root.add(fall); fall.add(body); body.scale.setScalar(t.scale);
  const mBody = new THREE.MeshLambertMaterial({ color: 0xeceae2 }), mBand = new THREE.MeshLambertMaterial({ color: d.color });
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.16, 0.92, 0); legR.position.set(0.16, 0.92, 0);
  for (const l of [legL, legR]) { add(l, _gLeg, _khaki, 0, -0.46, 0); add(l, _gBoot, _boot, 0, -0.88, 0.04); body.add(l); }
  add(body, _gTorso, mBody, 0, 1.3, 0); add(body, _gCape, mBody, 0, 1.2, -0.22); add(body, _gTrim, _navy, 0, 0.8, -0.22); add(body, _gCollar, _navy, 0, 1.66, -0.02);
  add(body, _gHead, _skin, 0, 1.93, 0); const bandM = add(body, _gBand, mBand, 0, 2.0, 0); A.addHair(body, def.name, bandM);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.4, 1.62, 0); armR.position.set(0.4, 1.62, 0);
  for (const a of [armL, armR]) { add(a, _gArm, mBody, 0, -0.34, 0); add(a, _gHand, _skin, 0, -0.74, 0); add(a, _gArmband, mBand, 0, -0.14, 0); body.add(a); }
  const mount = new THREE.Group(); mount.position.set(0, -0.74, 0); armR.add(mount);
  const tag = A.makeNameTag(t); tag.position.y = 2.55 * t.scale; root.add(tag);
  t.mesh = { root, fall, body, legL, legR, armL, armR, mount, mBody, tag, wmodel: null };
  A.scene.add(root); t.tagMat = tag.material;
  return t;
};

A.curWpn = t => (t.active >= 0 && t.wpn[t.active]) ? WEAPONS[t.wpn[t.active]] : null;
A.FIST = { name: 'Fists', cat: -1, kind: 'melee', dmg: 8, range: 1.6, cd: 0.45, arc: 90, ico: '✊', val: 0 };
A.effWpn = t => A.curWpn(t) || A.FIST;
A.hasWeapon = t => t.wpn.some(w => w);

A.equip = (t, slot) => {
  if (slot !== -1 && !t.wpn[slot]) return false;
  t.active = slot; const m = t.mesh;
  if (m.wmodel) { m.mount.remove(m.wmodel); m.wmodel = null; }
  const w = A.curWpn(t);
  if (w) {
    const key = t.wpn[slot]; m.wmodel = A.makeWeaponModel(key); m.mount.add(m.wmodel);
    if (key === 'bow' || key === 'tknives' || key === 'sling') { t.armRest = -1.4; m.mount.rotation.x = 1.4; }
    else if (key === 'blowgun') { t.armRest = -1.45; m.mount.rotation.x = Math.PI / 2 + 1.45; }
    else if (w.thrust) { t.armRest = -1.2; m.mount.rotation.x = Math.PI / 2 + 1.2; }
    else { t.armRest = -0.35; m.mount.rotation.x = Math.PI / 2; }
    t.swingKind = w.kind === 'ranged' ? (key === 'bow' ? 'shoot' : 'throw') : (w.thrust ? 'thrust' : 'swing');
  } else { t.armRest = -0.2; m.mount.rotation.x = Math.PI / 2; t.swingKind = 'swing'; }
  return true;
};

/* ---------- items ---------- */
A.tryPickup = (t, it) => {
  if (it.taken || !t.alive) return false;
  if (it.kind === 'weapon') {
    const w = WEAPONS[it.type], slot = w.cat;
    if (t.wpn[slot] === it.type) { if (w.ammo) t.ammo[w.ammo] += w.give; else return false; }
    else {
      const old = t.wpn[slot];
      if (old && WEAPONS[old].val >= w.val && !t.isPlayer && t.ai && t.ai.role !== 'x') return false;
      t.wpn[slot] = it.type; if (w.ammo) t.ammo[w.ammo] += w.give;
      if (old) A.spawnItem('weapon', old, t.x + A.rand(-1.5, 1.5), t.z + A.rand(-1.5, 1.5));
    }
    if (t.active < 0 || t.active === slot || (A.curWpn(t) && A.curWpn(t).val < w.val)) A.equip(t, slot);
  } else {
    t.hunger = Math.min(100, t.hunger + it.pack.food); t.thirst = Math.min(100, t.thirst + it.pack.water); t.med += it.pack.med;
    for (let s = 0; s < 3; s++) { const k = t.wpn[s]; if (k && WEAPONS[k].ammo) t.ammo[WEAPONS[k].ammo] += it.pack.ammo; }
  }
  A.removeItem(it);
  if (t.isPlayer) { SFX.play('pickup'); A.ui.toast((it.kind === 'weapon' ? 'Picked up ' + WEAPONS[it.type].name : 'Supplies collected: food, water' + (it.pack.med ? ', medkit' : '')), 'good'); }
  return true;
};
A.useMed = t => {
  if (t.med <= 0 || t.hp >= t.maxHp || !t.alive) return false;
  t.med--; t.hp = Math.min(t.maxHp, t.hp + 45 * (t.perk.med || 1)); t.bleed = 0; t.poison = Math.max(0, t.poison - 4);
  SFX.at('heal', Math.hypot(t.x - A.player.x, t.z - A.player.z), 25);
  for (let i = 0; i < 8; i++) A.fx.add(t.x + A.rand(-0.4, 0.4), t.y + 0.5, t.z + A.rand(-0.4, 0.4), 0, 1.5, 0, [0.4, 1, 0.5], 0.9, 0.35, 0.05, 0, false);
  return true;
};

/* ---------- movement ---------- */
A.moveT = (t, mx, mz, speed, dt) => {
  const k = Math.min(1, dt * 9);
  t.vx += (mx * speed - t.vx) * k; t.vz += (mz * speed - t.vz) * k;
  if (t.dashT > 0) { t.vx = t.dashVX; t.vz = t.dashVZ; }
  let nx = t.x + t.vx * dt, nz = t.z + t.vz * dt;
  const cs = A.colliders;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], dx = nx - c.x, dz = nz - c.z, rr = c.r + 0.45;
    if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.001; nx = c.x + dx / d * rr; nz = c.z + dz / d * rr; }
  }
  const r = Math.hypot(nx, nz), lim = A.R_ARENA - 0.7;
  if (r > lim) {
    nx *= lim / r; nz *= lim / r;
    if (t.bump <= 0) { t.bump = 0.6; A.G.ff = 1; A.sparks(nx, t.y + 1.2, nz, 10, [0.6, 0.85, 1], 3, 0.5); if (t.isPlayer) SFX.play('hurt', 0.4); A.hurt(t, 2, null, 'force'); }
  }
  t.x = nx; t.z = nz;
};
A.separate = () => {
  const L = A.tributes;
  for (let i = 0; i < L.length; i++) {
    const a = L[i]; if (!a.alive) continue;
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j]; if (!b.alive) continue;
      const dx = b.x - a.x, dz = b.z - a.z; if (dx > 0.8 || dx < -0.8 || dz > 0.8 || dz < -0.8) continue;
      const d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.0001) { const p = (0.8 - d) * 0.5 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; }
    }
  }
};

/* ---------- combat ---------- */
/* Gamemaker pacing: bloodbath first, then a slower trickle of deaths (fog/hazards finish the Games) */
A.paceBlocked = () => {
  const G = A.G; if (G.state !== 'play') return false;
  let alive = 0; for (const t of A.tributes) if (t.alive) alive++;
  if (alive <= 6) return false;
  return G.dead.length >= 20 + 7 * Math.max(0, (G.time - 80) / G.dayLen);
};
A.hurt = (o, dmg, att, kind, dx = 0, dz = 0) => {
  if (!o.alive || o.inv > 0 || dmg <= 0) return;
  const G = A.G;
  if (o.isPlayer && att && !att.isPlayer) dmg *= G.diff.aiDmg;
  else if (att && !att.isPlayer && !o.isPlayer && (kind === 'melee' || kind === 'ranged')) { dmg *= 0.38; if (A.paceBlocked()) dmg *= 0.1; }
  o.hp -= dmg; o.hitFlash = 0.22;
  if (att) { o.lastHit = att; o.lastHitT = G.time; }
  const pd = Math.hypot(o.x - A.player.x, o.z - A.player.z);
  if (kind !== 'tox' && kind !== 'starve' && kind !== 'force' && kind !== 'poison') {
    A.bloodBurst(o.x, o.y + 1.3 * o.scale, o.z, Math.min(26, 6 + dmg / 3), dx, dz, 1);
    if (Math.random() < 0.7) A.addDecal(o.x + A.rand(-0.7, 0.7), o.z + A.rand(-0.7, 0.7), A.rand(0.2, 0.5));
    SFX.at('hit', pd, 45); SFX.at('blood', pd, 30);
  } else if (kind === 'poison' || kind === 'bleedx') { if (Math.random() < 0.06) A.bloodBurst(o.x, o.y + 1, o.z, 2, 0, 0, 0.3); }
  if (o.isPlayer && dmg > 2) { A.ui.flash(); A.ui.shake(Math.min(0.5, dmg / 80)); SFX.play('hurt', 0.5); }
  if (att && att.isPlayer && dmg > 2) A.ui.hint('hit');
  if (o.hp <= 0) A.killTribute(o, kind, att);
};

A.killTribute = (o, kind, att) => {
  if (!o.alive) return;
  const G = A.G;
  o.alive = false; o.deadT = 0; o.hp = 0; o.deathDay = G.day;
  if (att && att !== o) att.kills++;
  if (!att && o.lastHit && G.time - o.lastHitT < 8 && (kind === 'poison' || kind === 'bleedx')) att = o.lastHit;
  const by = (att && att !== o) ? att : null;
  o.cause = kind; o.killer = by;
  for (let s = 0; s < 3; s++) if (o.wpn[s]) { A.spawnItem('weapon', o.wpn[s], o.x + A.rand(-1.6, 1.6), o.z + A.rand(-1.6, 1.6)); o.wpn[s] = null; }
  if (o.med > 0 || o.hunger > 40) A.spawnItem('pack', null, o.x + A.rand(-1, 1), o.z + A.rand(-1, 1), { food: Math.max(0, Math.round(o.hunger * 0.3)), water: Math.max(0, Math.round(o.thirst * 0.3)), med: o.med > 0 ? 1 : 0, ammo: 3 });
  A.bloodBurst(o.x, o.y + 1, o.z, 34, 0, 0, 1.4);
  A.addDecal(o.x, o.z, A.rand(1.0, 1.5)); A.addDecal(o.x + A.rand(-0.6, 0.6), o.z + A.rand(-0.6, 0.6), A.rand(0.5, 0.9));
  if (o.mesh.wmodel) { o.mesh.mount.remove(o.mesh.wmodel); o.mesh.wmodel = null; }
  o.mesh.tag.visible = false;
  G.dead.push(o); G.cannonQ.push({ t: o, at: G.time + 1.2 + G.cannonQ.length * 1.0 });
  const causes = { melee: 'was slain by', ranged: 'was shot by', fire: 'was caught in the volcanic fire', tox: 'was claimed by the toxic fog', starve: 'did not survive hunger and thirst', poison: 'succumbed to poison', force: 'hit the force field once too often', berry: 'ate the poisonous berries', bleedx: 'bled out' };
  let msg = o.name + ' (D' + o.d + ') ' + (causes[kind] || 'has fallen');
  if (by && (kind === 'melee' || kind === 'ranged')) msg += ' ' + by.name;
  else if (by && (kind === 'poison' || kind === 'bleedx')) msg += ' — by ' + by.name;
  A.ui.feed(msg, by && by.isPlayer ? 'you' : (o.isPlayer ? 'dead' : ''));
  if (o.isPlayer) A.onPlayerDead && A.onPlayerDead(by, kind);
  if (by && by.isPlayer) A.ui.toast('You eliminated ' + o.name + '!', 'good');
};

A.nearestEnemy = (t, maxD, preferPlayer) => {
  let best = null, bd = maxD * maxD;
  for (const o of A.tributes) {
    if (o === t || !o.alive || (t.ally && o.ally === t.ally)) continue;
    let d = dist2(t, o.x, o.z); if (preferPlayer && o.isPlayer) d *= 0.4;
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { t: best, dist: Math.sqrt(dist2(t, best.x, best.z)) } : null;
};

// start an attack. dir = {x,y,z} aim for ranged (player supplies camera aim)
A.attack = (t, dir) => {
  if (!t.alive || t.atkT > 0 || t.dashT > 0 || A.G.state !== 'play') return false;
  const w = A.effWpn(t);
  if (w.kind === 'ranged' && t.ammo[w.ammo] <= 0) { if (t.isPlayer) A.ui.toast('Out of ammo for ' + w.name, 'warn'); t.atkT = 0.3; return false; }
  t.atkT = w.cd * (t.isPlayer ? 1 : 1.7); t.swingT = 0; t.swingDur = Math.min(0.42, w.cd * 0.85); t.hitDone = false; t.pendingDir = dir || null; t.faceT = 0.5;
  SFX.at(w.kind === 'ranged' ? (w.ammo === 'arrow' ? 'arrow' : w.ammo === 'dart' ? 'dart' : w.ammo === 'stone' ? 'sling' : 'swing') : 'swing', Math.hypot(t.x - A.player.x, t.z - A.player.z), 40);
  return true;
};
A.applyAttack = t => {
  const w = A.effWpn(t), G = A.G;
  if (w.kind === 'melee') {
    let dmg = w.dmg * (t.perk.melee || 1) * (w.axe ? (t.perk.axe || 1) : 1) * (w.trident ? (t.perk.trident || 1) : 1);
    let hits = 0;
    const cands = [];
    for (const o of A.tributes) {
      if (o === t || !o.alive || (t.ally && o.ally === t.ally)) continue;
      const dx = o.x - t.x, dz = o.z - t.z, d = Math.hypot(dx, dz);
      if (d > w.range + 0.55 * o.scale) continue;
      let da = Math.atan2(dx, dz) - t.yaw; while (da > Math.PI) da -= A.TAU; while (da < -Math.PI) da += A.TAU;
      if (Math.abs(da) > (w.arc / 2) * Math.PI / 180) continue;
      cands.push({ o, d, dx: dx / (d || 1), dz: dz / (d || 1) });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands.slice(0, 2)) {
      if (!t.isPlayer && Math.random() < G.diff.aiMiss) continue;
      const crit = Math.random() < 0.08;
      A.hurt(c.o, dmg * A.rand(0.9, 1.1) * (crit ? 1.5 : 1), t, 'melee', c.dx, c.dz);
      if (w.knock) { c.o.x += c.dx * w.knock * 0.3; c.o.z += c.dz * w.knock * 0.3; }
      if (w.bleed && c.o.alive) c.o.bleed = Math.max(c.o.bleed, 5);
      if (c.o.alive || true) hits++;
    }
    if (!hits) A.sparks(t.x + Math.sin(t.yaw) * w.range * 0.8, t.y + 1, t.z + Math.cos(t.yaw) * w.range * 0.8, 2, [0.9, 0.9, 0.9], 1.5, 0.2);
  } else {
    let dir = t.pendingDir;
    if (!dir) dir = { x: Math.sin(t.yaw), y: 0.05, z: Math.cos(t.yaw) };
    A.shoot(t, w, dir);
  }
};
A.shoot = (t, w, dir) => {
  t.ammo[w.ammo]--;
  const sy = t.y + 1.45 * t.scale, sx = t.x + Math.sin(t.yaw) * 0.55, sz = t.z + Math.cos(t.yaw) * 0.55;
  const L = Math.hypot(dir.x, dir.y, dir.z) || 1, dx = dir.x / L, dy = dir.y / L, dz = dir.z / L;
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: w.ammo === 'arrow' ? 0xe9d9b0 : w.ammo === 'dart' ? 0xff5a5a : 0xdfe3ea });
  if (w.ammo === 'arrow') { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 5).rotateX(Math.PI / 2), mat); g.add(s); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x999999 })); tip.position.z = 0.5; g.add(tip); }
  else if (w.ammo === 'knife') g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.32), mat));
  else if (w.ammo === 'dart') g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4).rotateX(Math.PI / 2), mat));
  else g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat));
  g.position.set(sx, sy, sz); A.scene.add(g);
  let dmg = w.dmg * (t.perk.ranged || 1);
  A.projectiles.push({ mesh: g, x: sx, y: sy, z: sz, vx: dx * w.spd, vy: dy * w.spd, vz: dz * w.spd, w, dmg, owner: t, life: 4, bounced: false, spin: w.ammo === 'knife' });
};
A.updateProjectiles = dt => {
  const P = A.projectiles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; let dead = false;
    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps && !dead; s++) {
      p.vy -= p.w.grav * h; p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
      const r = Math.hypot(p.x, p.z);
      if (r > A.R_ARENA - 0.3) { // force field: shots bounce back
        const nx = -p.x / r, nz = -p.z / r, dot = p.vx * nx + p.vz * nz;
        p.vx -= 2 * dot * nx; p.vz -= 2 * dot * nz; p.x = p.x / r * (A.R_ARENA - 0.6); p.z = p.z / r * (A.R_ARENA - 0.6); p.bounced = true; A.G.ff = 1;
        A.sparks(p.x, p.y, p.z, 10, [0.6, 0.85, 1], 3, 0.5);
      }
      if (p.y <= A.groundH(p.x, p.z) + 0.05) { dead = true; SFX.at('thud', Math.hypot(p.x - A.player.x, p.z - A.player.z), 30); break; }
      for (const c of A.colliders) { if (c.r < 5) { const dx = p.x - c.x, dz = p.z - c.z; if (dx * dx + dz * dz < c.r * c.r && p.y < 7) { dead = true; break; } } }
      if (dead) break;
      for (const o of A.tributes) {
        if (!o.alive || o.inv > 0 || (o === p.owner && !p.bounced)) continue;
        const dx = o.x - p.x, dz = o.z - p.z; if (dx > 0.7 || dx < -0.7 || dz > 0.7 || dz < -0.7) continue;
        if (dx * dx + dz * dz > 0.36) continue;
        if (p.y < o.y - 0.1 || p.y > o.y + 1.98 * o.scale) continue;
        const head = p.y > o.y + 1.72 * o.scale, mult = head ? 1.5 : 1;
        const L = Math.hypot(p.vx, p.vz) || 1;
        if (p.owner !== o && (!p.owner.ally || p.owner.ally !== o.ally)) {
          A.hurt(o, p.dmg * mult * A.rand(0.92, 1.08), p.owner, 'ranged', p.vx / L, p.vz / L);
          if (p.w.poison && o.alive) o.poison = Math.max(o.poison, 6);
          if (head && p.owner.isPlayer) A.ui.toast('Headshot!', 'good');
        } else if (p.bounced) A.hurt(o, p.dmg * mult, o, 'ranged', 0, 0);
        dead = true; break;
      }
    }
    p.life -= dt; if (p.life <= 0) dead = true;
    p.mesh.position.set(p.x, p.y, p.z);
    if (p.spin) p.mesh.rotation.y += dt * 25; else p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
    if (dead) { A.scene.remove(p.mesh); P.splice(i, 1); }
  }
};

/* ---------- AI ---------- */
A.aiInit = t => {
  const d = DISTRICTS[t.d - 1], diff = A.G.diff;
  const ai = { mode: 'wait', thinkT: Math.random() * 0.4, dest: null, target: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, item: null, role: 'scav', fleeFrom: null, fleeT: 0, drinkT: 0, huntT: 0 };
  if (d.career && (t.d !== 4 || Math.random() < 0.6)) { ai.role = 'rush'; t.ally = 1; }
  else { const r = Math.random(); ai.role = r < diff.rush * 0.55 ? 'rush' : r < 0.82 ? 'scav' : 'hide'; }
  t.ai = ai;
};
A.itemScore = (t, it, from) => {
  if (it.taken) return -1;
  const d = Math.hypot(it.x - from.x, it.z - from.z);
  let gain;
  if (it.kind === 'weapon') { const w = WEAPONS[it.type], cur = t.wpn[w.cat]; gain = w.val - (cur ? WEAPONS[cur].val : -3) + (!A.hasWeapon(t) ? 3 : 0); if (cur === it.type && w.ammo) gain = 1; }
  else gain = (t.hunger < 75 || t.thirst < 75 || t.med < 1) ? 2.5 : 1;
  if (gain <= 0) return -1;
  return gain * 10 / (6 + d);
};
A.bestItem = (t, maxD, kindFilter, minR) => {
  let best = null, bs = 0;
  for (const it of A.items) {
    if (it.taken || (kindFilter && it.kind !== kindFilter)) continue;
    const d = Math.hypot(it.x - t.x, it.z - t.z); if (d > maxD) continue;
    const ir = Math.hypot(it.x, it.z); if (minR && ir < minR) continue;
    if (t.ai && t.ai.role !== 'rush' && A.G.time > A.G.bloodEnd && ir < 26) continue;
    const s = A.itemScore(t, it, t) * (0.8 + Math.random() * 0.4); if (s > bs) { bs = s; best = it; }
  }
  return best;
};
A.startBloodbath = t => {
  const ai = t.ai;
  if (ai.role === 'rush') { ai.item = A.bestItem(t, 70, 'weapon'); ai.mode = 'loot'; }
  else if (ai.role === 'scav') { ai.item = A.bestItem(t, 70, 'pack', 17) || A.bestItem(t, 70, null, 17); ai.mode = ai.item ? 'loot' : 'idle'; }
  else { const a = Math.atan2(t.x, t.z) + A.rand(-0.6, 0.6), r = A.rand(62, 98); ai.dest = { x: Math.sin(a) * r, z: Math.cos(a) * r }; ai.mode = 'go'; }
};
A.nearestPond = t => {
  let best = null, bd = 1e9;
  for (const p of A.PONDS) { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = p; } }
  return { p: best, d: bd };
};
A.nearestFruit = t => {
  let best = null, bd = 1e9;
  for (const tr of A.trees) { if (tr.fruit <= 0) continue; const d = Math.hypot(t.x - tr.x, t.z - tr.z); if (d < bd) { bd = d; best = tr; } }
  return best;
};
A.eatFruit = (t, tr) => {
  if (tr.fruit <= 0) return false;
  tr.fruit--; t.hunger = Math.min(100, t.hunger + 30);
  const idx = tr.fidx[tr.fruit]; const m = new THREE.Matrix4().makeScale(0, 0, 0); A.fruitMesh.setMatrixAt(idx, m); A.fruitMesh.instanceMatrix.needsUpdate = true;
  A.regrow.push({ tr, at: A.G.time + 90 });
  SFX.at('eat', Math.hypot(t.x - A.player.x, t.z - A.player.z), 20); return true;
};
A.chooseWeapon = (t, dist) => {
  let bestSlot = -1, bs = -1;
  for (let s = 0; s < 3; s++) {
    const k = t.wpn[s]; if (!k) continue; const w = WEAPONS[k];
    if (w.kind === 'ranged' && t.ammo[w.ammo] <= 0) continue;
    let sc = w.dmg * (w.kind === 'melee' ? 1 : 0.9) / (w.cd + 0.3);
    if (w.kind === 'ranged') sc *= dist > 11 ? 1.8 : 0.6; else sc *= dist > 14 ? 0.3 : 1.2;
    if (sc > bs) { bs = sc; bestSlot = s; }
  }
  return bestSlot;
};

A.aiThink = t => {
  const G = A.G, ai = t.ai, diff = G.diff;
  if (G.state !== 'play') return;
  const rr = Math.hypot(t.x, t.z);
  // 1. incoming fireballs
  for (const f of A.fireballs) if (dist2(t, f.tx, f.tz) < 100) { ai.mode = 'flee'; ai.fleeFrom = { x: f.tx, z: f.tz }; ai.fleeT = 1.5; return; }
  // 2. toxic fog
  if (G.safeR < A.R_ARENA - 1 && rr > G.safeR - 4) { const k = Math.max(0.2, (G.safeR * 0.6) / (rr || 1)); ai.mode = 'go'; ai.dest = { x: t.x * k, z: t.z * k }; ai.urgent = true; return; }
  ai.urgent = false;
  // 3. heal
  if (t.hp < t.maxHp * 0.45 && t.med > 0) A.useMed(t);
  // 4. grab anything underfoot
  for (const it of A.items) {
    if (it.taken) continue; const dx = it.x - t.x, dz = it.z - t.z; if (dx * dx + dz * dz > 5.5) continue;
    if (A.itemScore(t, it, t) > 0.35) { A.tryPickup(t, it); if (ai.item === it) ai.item = null; break; }
  }
  // 5. enemies
  const sense = (G.time < G.bloodEnd ? 11 : G.night ? 13 : 26) * (diff === DIFF.easy ? 0.8 : 1);
  let e = A.nearestEnemy(t, sense, diff.hunt > 0.3 && Math.random() < diff.hunt);
  if (!e && t.lastHit && G.time - t.lastHitT < 4 && t.lastHit.alive) e = { t: t.lastHit, dist: Math.hypot(t.x - t.lastHit.x, t.z - t.lastHit.z) };
  const armed = A.hasWeapon(t);
  if (ai.mode === 'fight' && ai.target && ai.target.alive && Math.hypot(t.x - ai.target.x, t.z - ai.target.z) < 45 && G.time < (ai.fightUntil || 1e9)) {
    if (t.hp < t.maxHp * 0.4 && Math.random() < (ai.role === 'rush' ? 0.4 : 0.8)) { ai.mode = 'flee'; ai.fleeFrom = { x: ai.target.x, z: ai.target.z }; ai.fleeT = 3; }
    return;
  }
  if (e && !(G.time < G.bloodEnd && !armed && e.dist > 4 && G.time - t.lastHitT > 3) && G.time > (ai.noFight || 0)) {
    const early = G.time < G.bloodEnd;
    let p = ai.role === 'rush' ? 0.85 : ai.role === 'scav' ? 0.12 + 0.3 * diff.aggr : 0.04 + 0.12 * diff.aggr;
    if (!armed) p *= early ? 0.5 : 0.35; if (t.hp < t.maxHp * 0.35) p *= 0.3;
    if (e.t.isPlayer && diff.hunt > 0) p = Math.min(1, p + diff.hunt * 0.4);
    if (Math.random() < p) { ai.mode = 'fight'; ai.target = e.t; ai.fightUntil = G.time + A.rand(14, 26); return; }
    ai.noFight = G.time + A.rand(5, 10);
    if (e.dist < 15 && (!armed || t.hp < 40)) { ai.mode = 'flee'; ai.fleeFrom = { x: e.t.x, z: e.t.z }; ai.fleeT = 2.5; return; }
  }
  if (ai.mode === 'fight') ai.mode = 'idle';
  // 6. needs
  if (t.thirst < 40 || (ai.need === 'drink' && t.thirst < 85 && A.nearestPond(t).d < 12)) { const n = A.nearestPond(t); const a = Math.atan2(t.x - n.p.x, t.z - n.p.z); ai.mode = 'go'; ai.dest = { x: n.p.x + Math.sin(a) * n.p.r * 1.0, z: n.p.z + Math.cos(a) * n.p.r * 1.0 }; ai.need = 'drink'; return; }
  if (t.hunger < 40) { const tr = A.nearestFruit(t); if (tr) { ai.mode = 'go'; ai.dest = { x: tr.x, z: tr.z }; ai.need = 'eat'; ai.tree = tr; return; } }
  // 7. loot
  if (ai.item && ai.item.taken) ai.item = null;
  const early = G.time < G.bloodEnd + 40;
  if (!armed || (ai.role !== 'hide' && early) || t.med < 1 && Math.random() < 0.3) {
    const it = ai.item || A.bestItem(t, early ? 60 : 90); if (it) { ai.item = it; ai.mode = 'loot'; return; }
  }
  // 8. idle: hunt or wander
  if (ai.mode === 'go' && ai.dest && Math.hypot(t.x - ai.dest.x, t.z - ai.dest.z) > 3 && !ai.need) return;
  if (ai.mode === 'hunt' && ai.target && ai.target.alive) return;
  ai.need = null;
  const canHunt = armed && G.time > G.bloodEnd + 40 && G.time > (ai.huntCd || 0) && !G.night;
  const hunter = canHunt && ((ai.role === 'rush' && Math.random() < 0.12) || Math.random() < 0.02 * diff.aggr + diff.hunt * 0.03);
  if (hunter) {
    let pick = null; const L = A.tributes.filter(o => o.alive && o !== t && !(t.ally && o.ally === t.ally));
    if (L.length) { pick = (diff.hunt > 0 && A.player.alive && Math.random() < diff.hunt * 0.5) ? A.player : A.pick(L); }
    if (pick) { ai.mode = 'hunt'; ai.target = pick; ai.huntUntil = G.time + A.rand(25, 45); ai.huntCd = G.time + A.rand(110, 220); return; }
  }
  if (G.night && G.time > G.bloodEnd && (ai.role !== 'rush' || Math.random() < 0.7)) { ai.mode = 'idle'; return; } // rest at night
  if (G.time < (ai.restUntil || 0)) { ai.mode = 'idle'; return; }
  ai.restUntil = G.time + A.rand(8, 35);
  const base = (ai.role === 'rush' && G.time > G.bloodEnd) ? { x: 0, z: 0, R: 32 } : { x: t.x, z: t.z, R: 26 };
  const a2 = Math.random() * A.TAU, r2 = A.rand(6, base.R);
  let wx = base.x + Math.sin(a2) * r2, wz = base.z + Math.cos(a2) * r2; const wr = Math.hypot(wx, wz), lim = Math.min(G.safeR * 0.85, 98);
  if (wr > lim) { wx *= lim / wr; wz *= lim / wr; }
  if (ai.role !== 'rush' && G.time > G.bloodEnd && wr < 28) { const k = 30 / (wr || 1); wx = (wx || 1) * k; wz = (wz || 1) * k; if (Math.hypot(wx, wz) > lim) { wx *= lim / Math.hypot(wx, wz); wz *= lim / Math.hypot(wx, wz); } }
  ai.mode = 'go'; ai.dest = { x: wx, z: wz };
};

A.aiAct = (t, dt) => {
  const G = A.G, ai = t.ai, diff = G.diff;
  let mx = 0, mz = 0, run = false;
  const goTo = (x, z, stop) => { const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz); if (d > stop) { mx = dx / d; mz = dz / d; return false; } return true; };
  if (ai.mode === 'wait' || t.dashT > 0 && false) { A.moveT(t, 0, 0, 0, dt); return; }
  switch (ai.mode) {
    case 'loot': {
      if (!ai.item || ai.item.taken) { ai.mode = 'idle'; ai.thinkT = 0; break; }
      run = true; if (goTo(ai.item.x, ai.item.z, 1.1)) { A.tryPickup(t, ai.item); ai.item = null; ai.mode = 'idle'; ai.thinkT = 0; }
      break;
    }
    case 'go': {
      run = !!ai.urgent || G.time < G.bloodEnd;
      if (!ai.dest) { ai.mode = 'idle'; break; }
      const reach = ai.need ? 2.2 : 2.5;
      if (goTo(ai.dest.x, ai.dest.z, reach)) {
        if (ai.need === 'drink') { const n = A.nearestPond(t); if (n.d < n.p.r * 1.5 && t.thirst < 90) { t.thirst = Math.min(100, t.thirst + 32 * dt); ai.drinkT += dt; if (ai.drinkT > 0.7) { SFX.at('drink', Math.hypot(t.x - A.player.x, t.z - A.player.z), 20); ai.drinkT = 0; } break; } }
        else if (ai.need === 'eat' && ai.tree) { A.eatFruit(t, ai.tree); }
        ai.mode = 'idle'; ai.need = null; ai.thinkT = 0;
      }
      break;
    }
    case 'hunt': {
      if (!ai.target || !ai.target.alive || G.time > (ai.huntUntil || 0)) { ai.mode = 'idle'; break; }
      run = false; goTo(ai.target.x, ai.target.z, 3);
      break;
    }
    case 'flee': {
      ai.fleeT -= dt; run = true;
      if (!ai.fleeFrom || ai.fleeT <= 0) { ai.mode = 'idle'; ai.thinkT = 0; break; }
      const dx = t.x - ai.fleeFrom.x, dz = t.z - ai.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
      mx = dx / d; mz = dz / d;
      if (Math.hypot(t.x, t.z) > G.safeR - 8) { mx -= t.x / 100; mz -= t.z / 100; }
      break;
    }
    case 'fight': {
      const e = ai.target; if (!e || !e.alive) { ai.mode = 'idle'; ai.thinkT = 0; break; }
      const dx = e.x - t.x, dz = e.z - t.z, d = Math.hypot(dx, dz) || 1;
      if (t.atkT <= 0.05 || (t.active < 0)) { const best = A.chooseWeapon(t, d); if (best !== t.active && best !== -1) A.equip(t, best); else if (best === -1 && t.active !== -1) A.equip(t, -1); }
      const w = A.effWpn(t); run = true;
      t.yaw = turnTo(t.yaw, Math.atan2(dx, dz), dt * (6 + 8 * diff.aggr));
      ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = A.rand(0.8, 2.2); ai.strafe = Math.random() < 0.5 ? 1 : -1; }
      let al = Math.atan2(dx, dz) - t.yaw; while (al > Math.PI) al -= A.TAU; while (al < -Math.PI) al += A.TAU;
      if (w.kind === 'ranged') {
        if (d > 17) { mx = dx / d; mz = dz / d; } else if (d < 7) { mx = -dx / d; mz = -dz / d; } else { mx = -dz / d * ai.strafe * 0.7; mz = dx / d * ai.strafe * 0.7; run = false; }
        if (Math.abs(al) < 0.2 && d < 50 && t.atkT <= 0) {
          const tt = d / w.spd, lead = 0.55;
          const ax = e.x + (e.vx || 0) * tt * lead - t.x, az = e.z + (e.vz || 0) * tt * lead - t.z;
          const drop = 0.5 * w.grav * tt * tt;
          const ay = (e.y + 1.2 * e.scale + drop) - (t.y + 1.45 * t.scale);
          const sp = diff.aiAcc * Math.PI / 180 * (d / 25 + 0.4);
          const yaw = Math.atan2(ax, az) + A.rand(-sp, sp), hl = Math.hypot(ax, az);
          A.attack(t, { x: Math.sin(yaw) * hl, y: ay + A.rand(-sp, sp) * hl, z: Math.cos(yaw) * hl });
        }
      } else {
        if (d > w.range * 0.75) { mx = dx / d; mz = dz / d; } else { mx = -dz / d * ai.strafe * 0.5; mz = dx / d * ai.strafe * 0.5; run = d < w.range + 1.5; }
        if (d < w.range + 0.4 && Math.abs(al) < 0.5 && t.atkT <= 0 && Math.random() < 0.3 + 0.7 * diff.aggr) A.attack(t, null);
      }
      if (t.hp < t.maxHp * 0.3 && d < 4 && t.dashCd <= 0 && Math.random() < 0.02) { A.dash(t, -mx || -dx / d, -mz || -dz / d); }
      if (d > 14 && w.kind === 'melee') { ai.chaseT = (ai.chaseT || 0) + dt; if (ai.chaseT > 4) { ai.mode = 'idle'; ai.chaseT = 0; ai.noFight = G.time + 8; ai.thinkT = 0; } } else ai.chaseT = 0;
      if (d > 56) ai.mode = 'idle';
      break;
    }
    default: break;
  }
  // locomotion
  const sp = (run ? 6.3 : 3.6) * diff.aiSpeed * (t.perk.spd || 1) * (run ? (t.perk.sprint || 1) : 1) * (1.02 - (t.scale - 1) * 0.3);
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  if (ai.mode !== 'fight' && len > 0.05) t.yaw = turnTo(t.yaw, Math.atan2(mx, mz), dt * 9);
  A.moveT(t, mx, mz, sp * (t.atkT > 0.15 && A.effWpn(t).kind === 'melee' ? 0.6 : 1), dt);
};

A.dash = (t, dx, dz) => {
  if (t.dashCd > 0 || t.dashT > 0) return false;
  const l = Math.hypot(dx, dz) || 1; t.dashVX = dx / l * 13; t.dashVZ = dz / l * 13; t.dashT = 0.2; t.inv = 0.2; t.dashCd = 1.1 * (t.perk.dashCd || 1);
  SFX.at('dash', Math.hypot(t.x - A.player.x, t.z - A.player.z), 25);
  for (let i = 0; i < 6; i++) A.blood.add(t.x, t.y + 0.1, t.z, A.rand(-1, 1), 0.6, A.rand(-1, 1), [0.7, 0.65, 0.5], 0.5, 0.35, 0.05, 0, false);
  return true;
};

/* ---------- per-frame tribute update ---------- */
A.updateTribute = (t, dt, input) => {
  const G = A.G, m = t.mesh;
  if (!t.alive) {
    if (t.deadT >= 0) { t.deadT = Math.min(1, t.deadT + dt * 2.2); const e = t.deadT * t.deadT * (3 - 2 * t.deadT); m.fall.rotation.x = -1.5 * e * (t.id % 2 ? 1 : -1); m.fall.position.y = 0.12 * e; m.legL.rotation.x = m.legR.rotation.x = 0; }
    m.root.position.set(t.x, A.groundH(t.x, t.z), t.z); return;
  }
  // cooldowns
  t.atkT = Math.max(0, t.atkT - dt); t.dashCd = Math.max(0, t.dashCd - dt); t.dashT = Math.max(0, t.dashT - dt); t.inv = Math.max(0, t.inv - dt);
  t.hitFlash = Math.max(0, t.hitFlash - dt); t.bump = Math.max(0, t.bump - dt); t.faceT = Math.max(0, t.faceT - dt);
  if (G.state === 'play') {
    const dr = G.diff.drain * (t.isPlayer ? 1 : 0.8);
    t.hunger = Math.max(0, t.hunger - 0.085 * dr * (t.perk.hunger || 1) * dt); t.thirst = Math.max(0, t.thirst - 0.13 * dr * (t.perk.thirst || 1) * dt);
    if (t.hunger <= 0 || t.thirst <= 0) A.hurt(t, 1.1 * dt, null, 'starve');
    else if (t.hp < t.maxHp && t.hunger > 40 && t.thirst > 40 && G.time - t.lastHitT > 7 && !t.poison && !t.bleed) t.hp = Math.min(t.maxHp, t.hp + 0.55 * G.diff.regen * dt);
    if (t.poison > 0) { t.poison -= dt; A.hurt(t, 4.5 * (t.perk.poison || 1) * dt, t.lastHit, 'poison'); }
    if (t.bleed > 0) { t.bleed -= dt; A.hurt(t, 3 * dt, t.lastHit, 'bleedx'); }
    // toxic fog
    if (t.alive && G.safeR < A.R_ARENA - 1 && Math.hypot(t.x, t.z) > G.safeR) A.hurt(t, (3.2 + G.fogStage * 1.1) * dt, null, 'tox');
    if (!t.alive) return;
    if (t.swingT >= 0) {
      t.swingT += dt;
      const hitAt = t.swingDur * (t.swingKind === 'swing' ? 0.5 : t.swingKind === 'thrust' ? 0.4 : 0.35);
      if (!t.hitDone && t.swingT >= hitAt) { t.hitDone = true; A.applyAttack(t); }
      if (t.swingT >= t.swingDur) t.swingT = -1;
    }
    if (t.isPlayer) A.playerControl(t, dt, input); else if (t.ai) { t.ai.thinkT -= dt; if (t.ai.thinkT <= 0) { t.ai.thinkT = G.diff.think * A.rand(0.8, 1.3); A.aiThink(t); } A.aiAct(t, dt); }
    if (t.dashT > 0 || t.inv > 0) { /* dash trail */ }
  } else if (G.state === 'intro' || G.state === 'countdown') {
    t.y = A.slots[t.slot].platY; t.x = A.slots[t.slot].x; t.z = A.slots[t.slot].z; t.vx = t.vz = 0;
  }
  if (G.state === 'play') {
    t.moveSp = Math.hypot(t.vx, t.vz);
    t.y = A.groundH(t.x, t.z);
  }
  // pose
  const walk = Math.min(1.3, t.moveSp / 5);
  t.phase += dt * (t.moveSp * 1.7 + 1);
  m.legL.rotation.x = Math.sin(t.phase) * 0.9 * walk; m.legR.rotation.x = -Math.sin(t.phase) * 0.9 * walk;
  m.armL.rotation.x = -Math.sin(t.phase) * 0.7 * walk;
  m.body.position.y = Math.abs(Math.sin(t.phase)) * 0.05 * walk + (G.state !== 'play' ? Math.sin(t.phase * 0.4) * 0.01 : 0);
  let ang = t.armRest + (walk > 0.1 && t.swingT < 0 && t.armRest > -0.5 ? Math.sin(t.phase) * 0.7 * walk : 0), lunge = 0;
  if (t.swingT >= 0) {
    const p = t.swingT / t.swingDur;
    if (t.swingKind === 'swing') ang = p < 0.3 ? A.lerp(t.armRest, -2.4, p / 0.3) : A.lerp(-2.4, -0.2, (p - 0.3) / 0.7);
    else if (t.swingKind === 'thrust') { ang = t.armRest - Math.sin(p * Math.PI) * 0.3; lunge = Math.sin(p * Math.PI) * 0.4; }
    else if (t.swingKind === 'shoot') ang = t.armRest + Math.sin(p * Math.PI) * 0.25;
    else ang = p < 0.5 ? A.lerp(t.armRest, -2.2, p / 0.5) : A.lerp(-2.2, t.armRest, (p - 0.5) / 0.5);
  }
  m.armR.rotation.x = ang; m.body.position.z = lunge;
  m.root.position.set(t.x, t.y, t.z); m.root.rotation.y = t.yaw;
  m.mBody.emissive.setRGB(t.hitFlash * 3, 0, 0);
};
