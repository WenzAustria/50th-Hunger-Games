'use strict';
/* ===== Main: game loop, input, camera, day/night, hazards, HUD ===== */
const Main = (() => {
  const $ = id => document.getElementById(id);
  const G = A.G, IN = { x: 0, y: 0, sprint: false, attack: false, use: false, usePressed: false, dashPressed: false, medPressed: false, slot: -1, keys: {}, jx: 0, jy: 0 };
  let camYaw = 0, camPitch = 0.28, camDist = 6.2, started = false, paused = false, last = 0, shake = 0, lockedMouse = false;
  let hudT = 0, mapT = 0, sprintLock = false, memories = null;
  const SKY = [
    [0.00, '#f2b985', 0.7, 0.55, '#ffd9b0'], [0.08, '#9cc8ea', 1.0, 0.75, '#ffffff'], [0.50, '#8ec3e8', 1.05, 0.75, '#ffffff'],
    [0.60, '#e6955a', 0.7, 0.55, '#ffbf90'], [0.68, '#3a2a52', 0.15, 0.3, '#5a4a78'], [0.76, '#070b1c', 0.0, 0.17, '#1a2142'],
    [0.90, '#070b1c', 0.0, 0.17, '#1a2142'], [0.96, '#5a4a70', 0.15, 0.3, '#8a6a80'], [1.0, '#f2b985', 0.7, 0.55, '#ffd9b0']
  ].map(k => [k[0], new THREE.Color(k[1]), k[2], k[3], new THREE.Color(k[4])]);

  /* ---------- HUD helpers ---------- */
  const el = { toastT: 0, bannerT: 0 };
  A.ui = {
    toast(msg, kind) { const e = $('hud-toast'); e.textContent = msg; e.className = 'show ' + (kind || ''); clearTimeout(el.toastT); el.toastT = setTimeout(() => e.className = '', 2200); },
    banner(big, small, kind) { const e = $('hud-banner'); e.innerHTML = '<b>' + big + '</b>' + (small ? '<span>' + small + '</span>' : ''); e.className = 'show ' + (kind || ''); clearTimeout(el.bannerT); el.bannerT = setTimeout(() => e.className = '', 3600); },
    feed(msg, kind) { const f = $('hud-feed'); const d = document.createElement('div'); d.textContent = msg; if (kind) d.className = kind; f.prepend(d); while (f.children.length > 6) f.lastChild.remove(); setTimeout(() => d.remove(), 14000); },
    shake(v) { shake = Math.max(shake, v); },
    flash() { const e = $('hit-flash'); e.style.opacity = 0.7; setTimeout(() => e.style.opacity = 0, 120); },
    hint() { const c = $('crosshair'); c.classList.add('hit'); setTimeout(() => c.classList.remove('hit'), 120); }
  };

  /* ---------- sky / day-night ---------- */
  const _c = new THREE.Color(), _t = new THREE.Color();
  function keyAt(tf) {
    let a = SKY[0], b = SKY[1];
    for (let i = 0; i < SKY.length - 1; i++) if (tf >= SKY[i][0] && tf <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
    const k = (tf - a[0]) / ((b[0] - a[0]) || 1);
    return { sky: _c.copy(a[1]).lerp(b[1], k), sun: A.lerp(a[2], b[2], k), hemi: A.lerp(a[3], b[3], k), tint: _t.copy(a[4]).lerp(b[4], k) };
  }
  function lighting(tf, focus) {
    const k = keyAt(tf), toxic = G.inToxic ? 1 : 0;
    const night = A.smooth(0.62, 0.74, tf) * (1 - A.smooth(0.92, 0.99, tf)); G.night = night > 0.6; G.nightF = night;
    A.scene.background.copy(k.sky); A.scene.fog.color.copy(k.sky);
    if (toxic) { A.scene.fog.color.lerp(new THREE.Color(0x5f8a2a), 0.65); A.scene.fog.near = 4; A.scene.fog.far = 70; } else { A.scene.fog.near = 70; A.scene.fog.far = 420; }
    A.hemi.color.copy(k.sky).lerp(new THREE.Color(0xffffff), 0.5); A.hemi.intensity = k.hemi;
    A.sun.intensity = k.sun; A.moon.intensity = night * 0.45;
    A.backdropMat.color.copy(k.tint);
    const ang = Math.PI * (tf / 0.66), sd = new THREE.Vector3(Math.cos(ang) * 0.9, Math.sin(ang) * 0.9 + 0.1, 0.35).normalize();
    A.sun.position.set(focus.x + sd.x * 140, focus.y + sd.y * 140, focus.z + sd.z * 140); A.sun.target.position.set(focus.x, focus.y, focus.z); A.sun.target.updateMatrixWorld();
    A.moon.position.set(focus.x - sd.x * 140, focus.y + Math.abs(sd.y) * 140 + 20, focus.z - sd.z * 140);
    A.sunMesh.position.set(focus.x + sd.x * 520, sd.y * 520, focus.z + sd.z * 520); A.sunMesh.visible = sd.y > -0.05 && tf < 0.7;
    A.moonMesh.position.set(focus.x - sd.x * 520, Math.abs(sd.y) * 400 + 60, focus.z - sd.z * 520); A.moonMesh.visible = night > 0.05;
    A.starMat.opacity = night; A.stars.position.set(focus.x, 0, focus.z);
    A.lava.material.color.setHex(night > 0.3 ? 0xff7a28 : 0xff5a14); A.craterLight.intensity = 1.4 + Math.sin(performance.now() * 0.004) * 0.3 + night * 1.2;
  }

  /* ---------- player control ---------- */
  A.findInteract = t => {
    let best = null, bd = 99;
    for (const it of A.items) { if (it.taken) continue; const d = Math.hypot(it.x - t.x, it.z - t.z); if (d < 2.7 && d < bd) { bd = d; best = { type: 'item', obj: it, label: 'Pick up ' + it.name, d }; } }
    if (best) return best;
    const n = A.nearestPond(t); if (n.d < n.p.r * 1.3 + 1.3 && t.thirst < 99) return { type: 'drink', obj: n.p, label: 'Hold to drink water' };
    for (const tr of A.trees) { if (tr.fruit > 0 && Math.hypot(tr.x - t.x, tr.z - t.z) < 3.2) return { type: 'fruit', obj: tr, label: 'Eat fruit (' + tr.fruit + ' left)' }; }
    for (const b of A.bushes) { if (Math.hypot(b.x - t.x, b.z - t.z) < 2.6) return { type: 'bush', obj: b, label: 'Eat berries (they look poisonous!)' }; }
    return null;
  };
  A.interact = (t, hold, pressed) => {
    const f = A.findInteract(t); if (!f) return;
    if (f.type === 'item' && pressed) A.tryPickup(t, f.obj);
    else if (f.type === 'drink' && hold) { t.thirst = Math.min(100, t.thirst + 30 * (1 / 60)); t.drinkTick = (t.drinkTick || 0) + 1; if (t.drinkTick % 14 === 0) SFX.play('drink', 0.5); }
    else if (f.type === 'fruit' && pressed) A.eatFruit(t, f.obj);
    else if (f.type === 'bush' && pressed) {
      t.hunger = Math.min(100, t.hunger + 8); t.poison = 9; t.lastHit = null; A.hurt(t, 14, null, 'berry'); SFX.play('eat', 0.5); A.ui.toast('Poisonous berries! You feel sick…', 'warn');
    }
  };
  function aimDir(t, assist) {
    const cam = A.camera, w = A.effWpn(t);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const head = { x: t.x, y: t.y + 1.55 * t.scale, z: t.z };
    const tx = head.x + fx * 4 + rx * 0.75, ty = head.y - 0.1 - Math.sin(camPitch) * 0.2, tz = head.z + fz * 4 + rz * 0.75;
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    let dx = tx - cx, dy = ty - cy, dz = tz - cz; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const my = t.y + 1.45 * t.scale, mx = t.x + Math.sin(t.yaw) * 0.55, mz = t.z + Math.cos(t.yaw) * 0.55;
    let ax = cx + dx * 40, ay = cy + dy * 40, az = cz + dz * 40;
    // aim assist (stronger on touch)
    let bestA = assist, bt = null;
    for (const o of A.tributes) {
      if (!o.alive || o === t) continue; const ex = o.x - cx, ey = o.y + 1.2 - cy, ez = o.z - cz, el = Math.hypot(ex, ey, ez); if (el > 65 || el < 3) continue;
      const dot = (ex * dx + ey * dy + ez * dz) / el, ang = Math.acos(A.clamp(dot, -1, 1)); if (ang < bestA) { bestA = ang; bt = o; }
    }
    if (bt) { ax = bt.x; ay = bt.y + 1.2 * bt.scale; az = bt.z; }
    const hd = Math.hypot(ax - mx, az - mz), tt = hd / (w.spd || 50);
    ay += 0.5 * (w.grav || 0) * tt * tt;
    return { x: ax - mx, y: ay - my, z: az - mz };
  }
  A.playerControl = (t, dt) => {
    if (G.auto) {
      if (!t.ai) { A.aiInit(t); t.ai.role = 'scav'; t.ai.mode = 'idle'; t.ai.thinkT = 0; }
      t.ai.thinkT -= dt; if (t.ai.thinkT <= 0) { t.ai.thinkT = G.diff.think; A.aiThink(t); } A.aiAct(t, dt); return;
    }
    let ix = IN.x + IN.jx, iy = IN.y + IN.jy; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    let mx = fx * iy + rx * ix, mz = fz * iy + rz * ix; const moving = il > 0.08;
    const w = A.effWpn(t);
    if (sprintLock && t.stam > 20) sprintLock = false;
    const sprint = (IN.sprint || il > 0.92 && IN.jx !== 0 && IN.jmax) && moving && t.stam > 1 && !sprintLock;
    if (sprint) { t.stam -= 20 * dt; if (t.stam <= 1) sprintLock = true; } else t.stam = Math.min(100, t.stam + 14 * (t.perk.stam || 1) * dt);
    const sp = 4.5 * (t.perk.spd || 1) * (sprint ? 1.6 * (t.perk.sprint || 1) : 1) * (t.atkT > 0.15 && w.kind === 'melee' ? 0.65 : 1);
    if (IN.dashPressed) { IN.dashPressed = false; if (t.stam >= 20 && A.dash(t, moving ? mx : fx, moving ? mz : fz)) t.stam -= 20; }
    if (IN.medPressed) { IN.medPressed = false; if (!A.useMed(t)) A.ui.toast(t.med ? 'Health is full' : 'No medkits', 'warn'); }
    if (IN.slot >= 0) { if (t.wpn[IN.slot]) A.equip(t, IN.slot); else if (IN.slot === t.active || true) { A.ui.toast('Nothing in the ' + SLOT_NAMES[IN.slot] + ' slot', 'warn'); } IN.slot = -1; }
    if (IN.usePressed) { A.interact(t, false, true); IN.usePressed = false; }
    if (IN.use) A.interact(t, true, false);
    if (IN.attack && t.atkT <= 0) {
      const ranged = w.kind === 'ranged';
      if (ranged) { t.yaw = camYaw; A.attack(t, aimDir(t, A.mobile ? 0.2 : 0.05)); }
      else {
        // auto-face nearest enemy in front
        let bt = null, bd = w.range + 1.4;
        for (const o of A.tributes) { if (!o.alive || o === t) continue; const d = Math.hypot(o.x - t.x, o.z - t.z); if (d < bd) { let da = Math.atan2(o.x - t.x, o.z - t.z) - camYaw; while (da > Math.PI) da -= A.TAU; while (da < -Math.PI) da += A.TAU; if (Math.abs(da) < 1.1) { bd = d; bt = o; } } }
        t.yaw = bt ? Math.atan2(bt.x - t.x, bt.z - t.z) : camYaw; A.attack(t, null);
      }
    }
    if (t.faceT > 0 || w.kind === 'ranged' && t.active >= 0) t.yaw = turnTo(t.yaw, camYaw, dt * 14);
    else if (moving) t.yaw = turnTo(t.yaw, Math.atan2(mx, mz), dt * 12);
    A.moveT(t, mx * Math.min(1, il), mz * Math.min(1, il), sp, dt);
  };
  const turnTo = (cur, want, k) => { let d = want - cur; while (d > Math.PI) d -= A.TAU; while (d < -Math.PI) d += A.TAU; return cur + d * Math.min(1, k); };
  A.onPlayerDead = (by, kind) => {
    G.playerDead = true; G.spec = by && by.alive ? by : null;
    setTimeout(() => { if (G.state === 'play') { $('death-text').textContent = by ? 'You were eliminated by ' + by.name + ' (District ' + by.d + ').' : 'The arena claimed you.'; $('screen-death').classList.add('show'); if (document.exitPointerLock) document.exitPointerLock(); } }, 1600);
  };

  /* ---------- camera ---------- */
  function updateCamera(dt) {
    const cam = A.camera, p = A.player;
    if (G.state === 'intro') {
      const s = A.slots[p.slot], y = s.platY, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      cam.position.set(s.x - fx * 1.9, y + 2.7, s.z - fz * 1.9); cam.lookAt(s.x + fx * 3, y + 1.6 + A.smooth(0, 6.5, G.introT) * 2.2, s.z + fz * 3);
      A.shaftLight.position.set(s.x, y + 1.6, s.z); A.shaftLight.intensity = 1.6; camYaw = s.yaw; return;
    }
    A.shaftLight.intensity = 0;
    let tgt = p;
    if (G.playerDead) { if (!G.spec || !G.spec.alive) G.spec = A.tributes.find(o => o.alive) || p; tgt = G.spec; }
    const head = { x: tgt.x, y: tgt.y + 1.55 * tgt.scale, z: tgt.z };
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw), cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    let px = head.x - fx * camDist * cp + rx * 0.75, py = head.y + sp * camDist + 0.3, pz = head.z - fz * camDist * cp + rz * 0.75;
    py = Math.max(py, A.groundH(px, pz) + 0.6);
    let lx = head.x + fx * 4 + rx * 0.75, ly = head.y - 0.1 - sp * 0.2, lz = head.z + fz * 4 + rz * 0.75;
    if (G.state === 'countdown' && G.cd > G.cdTotal - 6.5) { // cinematic overview
      const k = (G.cdTotal - G.cd) / 6.5, e = k * k * (3 - 2 * k), s = A.slots[p.slot], a0 = s.a + 0.9, a = a0 - 0.9 * e * 1.0;
      const R = A.lerp(70, 40, e), ox = Math.sin(a) * R * 1.05, oz = Math.cos(a) * R * 1.05, oy = A.lerp(34, 8, e);
      const w = e; px = A.lerp(ox, px, w * w); py = A.lerp(oy, py, w * w); pz = A.lerp(oz, pz, w * w);
      lx = A.lerp(0, lx, w * w); ly = A.lerp(6, ly, w * w); lz = A.lerp(0, lz, w * w);
    }
    if (shake > 0.001) { px += (Math.random() - 0.5) * shake * 1.6; py += (Math.random() - 0.5) * shake * 1.6; pz += (Math.random() - 0.5) * shake * 1.6; shake *= Math.pow(0.02, dt); }
    cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz);
  }

  /* ---------- hazards ---------- */
  function startEruption() {
    const n = Math.min(16, 5 + G.day * 2), V = A.craterPos;
    A.ui.banner('VOLCANIC ERUPTION', 'Take cover — fireballs incoming!', 'warn'); SFX.play('rumble', 1); SFX.play('alert', 0.6); A.ui.shake(0.25);
    const alive = A.tributes.filter(o => o.alive);
    for (let i = 0; i < n; i++) {
      let tx, tz;
      if (alive.length && Math.random() < 0.55) { const o = A.pick(alive); tx = o.x + A.rand(-9, 9); tz = o.z + A.rand(-9, 9); }
      else { const a = Math.random() * A.TAU, r = Math.sqrt(Math.random()) * Math.min(G.safeR, 100); tx = Math.sin(a) * r; tz = Math.cos(a) * r; }
      const r = Math.hypot(tx, tz); if (r > A.R_ARENA - 5) { tx *= (A.R_ARENA - 5) / r; tz *= (A.R_ARENA - 5) / r; }
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.set(tx, A.groundH(tx, tz) + 0.25, tz); mesh.visible = false; A.scene.add(mesh); A.scene.add(ring);
      A.fireballs.push({ sx: V.x, sy: V.y, sz: V.z, tx, tz, ty: A.groundH(tx, tz), u: 0, T: A.rand(3.4, 4.4), delay: i * 0.3, mesh, ring });
    }
    for (let i = 0; i < 70; i++) A.fx.add(V.x + A.rand(-6, 6), V.y, V.z + A.rand(-6, 6), A.rand(-8, 8), A.rand(10, 30), A.rand(-8, 8), [1, 0.5, 0.1], 2.4, 7, 1, 7, false);
    for (let i = 0; i < 50; i++) A.blood.add(V.x + A.rand(-6, 6), V.y, V.z + A.rand(-6, 6), A.rand(-5, 5), A.rand(8, 20), A.rand(-5, 5), [0.18, 0.17, 0.17], 4, 12, 3, 2, false);
  }
  A.burns = [];
  function updateFireballs(dt) {
    const F = A.fireballs;
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i];
      if (f.delay > 0) { f.delay -= dt; f.ring.material.opacity = 0.25; continue; }
      f.u += dt / f.T; const u = Math.min(1, f.u);
      f.mesh.visible = true; f.mesh.position.set(A.lerp(f.sx, f.tx, u), A.lerp(f.sy, f.ty, u) + 4 * 120 * u * (1 - u), A.lerp(f.sz, f.tz, u));
      f.ring.material.opacity = 0.4 + 0.4 * Math.sin(performance.now() * 0.02); f.ring.scale.setScalar(0.6 + 0.4 * u);
      A.fx.add(f.mesh.position.x, f.mesh.position.y, f.mesh.position.z, A.rand(-1, 1), A.rand(-1, 1), A.rand(-1, 1), [1, 0.5 + Math.random() * 0.3, 0.1], 0.6, 3.2, 0.3, 0, false);
      if (u >= 1) {
        for (const o of A.tributes) { if (!o.alive) continue; const d = Math.hypot(o.x - f.tx, o.z - f.tz); if (d < 7.5) A.hurt(o, 70 * (1 - d / 7.5) + 15, null, 'fire', (o.x - f.tx) / (d || 1), (o.z - f.tz) / (d || 1)); }
        for (let k = 0; k < 60; k++) { const a = Math.random() * A.TAU, s = A.rand(2, 11); A.fx.add(f.tx, f.ty + 0.5, f.tz, Math.sin(a) * s, A.rand(3, 14), Math.cos(a) * s, [1, 0.55 + Math.random() * 0.3, 0.1], A.rand(0.6, 1.4), 2.6, 0.2, 9, false); }
        for (let k = 0; k < 16; k++) A.blood.add(f.tx + A.rand(-2, 2), f.ty + 1, f.tz + A.rand(-2, 2), A.rand(-2, 2), A.rand(2, 6), A.rand(-2, 2), [0.2, 0.19, 0.19], 2.5, 5, 1.5, -1, false);
        const pd = Math.hypot(f.tx - A.player.x, f.tz - A.player.z); SFX.at('boom', pd, 120); if (pd < 40) A.ui.shake(0.35 * (1 - pd / 40));
        A.flashLight.position.set(f.tx, f.ty + 4, f.tz); A.flashLight.intensity = 6; A.burns.push({ x: f.tx, z: f.tz, until: G.time + 5 });
        A.scene.remove(f.mesh); A.scene.remove(f.ring); F.splice(i, 1);
      }
    }
    A.flashLight.intensity *= Math.pow(0.02, dt);
    for (let i = A.burns.length - 1; i >= 0; i--) {
      const b = A.burns[i]; if (G.time > b.until) { A.burns.splice(i, 1); continue; }
      for (let k = 0; k < 2; k++) A.fx.add(b.x + A.rand(-2.5, 2.5), A.groundH(b.x, b.z) + 0.2, b.z + A.rand(-2.5, 2.5), 0, A.rand(1, 3), 0, [1, 0.4 + Math.random() * 0.3, 0.05], 0.7, 1.3, 0.1, -1, false);
      for (const o of A.tributes) if (o.alive && Math.hypot(o.x - b.x, o.z - b.z) < 2.8) A.hurt(o, 9 * dt, null, 'fire');
    }
  }
  const FOG = [[0.95, 110], [1.35, 88], [1.85, 64], [2.3, 44], [2.7, 26], [3.1, 12], [3.5, 4]];
  function updateFog(dt) {
    const T = G.time / G.dayLen / G.diff.fog; let r = 110, stage = 0;
    if (T > FOG[0][0]) {
      for (let i = 0; i < FOG.length - 1; i++) { if (T >= FOG[i][0] && T <= FOG[i + 1][0]) { r = A.lerp(FOG[i][1], FOG[i + 1][1], (T - FOG[i][0]) / (FOG[i + 1][0] - FOG[i][0])); stage = i + 1; break; } }
      if (T > FOG[FOG.length - 1][0]) { r = FOG[FOG.length - 1][1]; stage = FOG.length; }
    }
    G.safeR = r;
    if (stage > G.fogStage) { G.fogStage = stage; A.ui.banner('TOXIC FOG ADVANCING', 'The safe zone is shrinking — move toward the center!', 'warn'); SFX.play('zone', 0.9); }
    const w = A.fogWall; w.visible = r < A.R_ARENA - 1;
    if (w.visible) { w.scale.set(r, 1, r); A.fogTex.offset.x += dt * 0.02; A.fogTex.offset.y = Math.sin(performance.now() * 0.0005) * 0.05; }
    const p = A.tributes[G.playerDead && G.spec ? G.spec.id : A.player.id] || A.player;
    G.inToxic = w.visible && Math.hypot(p.x, p.z) > r;
    $('toxic-vignette').style.opacity = (G.inToxic && !G.playerDead) ? 1 : 0;
  }

  /* ---------- memorial in the sky ---------- */
  function memTex(t) {
    const c = document.createElement('canvas'); c.width = 220; c.height = 270; const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c), d = DISTRICTS[t.d - 1];
    const draw = img => {
      g.fillStyle = '#050505'; g.fillRect(0, 0, 220, 270);
      if (img) { try { g.filter = 'grayscale(0.85)'; } catch (e) {} g.drawImage(img, 8, 8, 204, 190); g.filter = 'none'; }
      g.fillStyle = d.color; g.fillRect(8, 204, 204, 58); g.fillStyle = d.ink; g.font = 'bold 28px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(t.name, 110, 230); g.font = '18px system-ui,sans-serif'; g.fillText('DISTRICT ' + t.d, 110, 252);
      g.strokeStyle = '#e6b94a'; g.lineWidth = 5; g.strokeRect(2, 2, 216, 266); tex.needsUpdate = true;
    };
    draw(null); const img = new Image(); img.onload = () => draw(img); img.src = t.def.img; return tex;
  }
  function showMemorial(list) {
    const shown = list.slice(0, 10), sprites = shown.map(t => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: memTex(t), transparent: true, opacity: 0, depthWrite: false, fog: false })); s.scale.set(24, 29.5, 1); A.scene.add(s); return s; });
    memories = { t: 0, dur: 18, sprites };
    $('memorial-list').textContent = list.map(t => t.name + ' (D' + t.d + ')').join('  •  ');
    $('memorial').classList.add('show'); SFX.play('anthem', 1);
  }
  function updateMemorial(dt) {
    if (!memories) return; const m = memories; m.t += dt;
    const op = Math.min(1, m.t / 2.5, (m.dur - m.t) / 2.5), cam = A.camera, n = m.sprites.length, cols = Math.min(5, n);
    m.sprites.forEach((s, i) => {
      const col = i % 5, row = Math.floor(i / 5), cnt = row === Math.floor((n - 1) / 5) ? n - row * 5 : 5;
      const ya = camYaw + (col - (cnt - 1) / 2) * 0.16; s.material.opacity = Math.max(0, op);
      s.position.set(cam.position.x + Math.sin(ya) * 180, cam.position.y + 105 - row * 34, cam.position.z + Math.cos(ya) * 180);
    });
    if (m.t > m.dur) { m.sprites.forEach(s => { A.scene.remove(s); s.material.map.dispose(); s.material.dispose(); }); memories = null; $('memorial').classList.remove('show'); }
  }

  /* ---------- HUD ---------- */
  function bar(id, v, max) { const e = $(id); const p = A.clamp(v / max * 100, 0, 100); e.style.width = p + '%'; }
  function updateHud(dt) {
    const p = A.player;
    bar('bar-hp', p.hp, p.maxHp); bar('bar-hunger', p.hunger, 100); bar('bar-thirst', p.thirst, 100); bar('bar-stam', p.stam, 100);
    $('bar-hp').parentElement.classList.toggle('low', p.hp < p.maxHp * 0.3 && p.alive);
    $('val-hp').textContent = Math.ceil(p.hp);
    const alive = A.tributes.filter(o => o.alive).length; $('alive-n').textContent = alive; $('kills-n').textContent = p.kills;
    const tf = (G.time % G.dayLen) / G.dayLen, remain = Math.ceil(G.dayLen - (G.time % G.dayLen));
    $('day-label').textContent = 'DAY ' + G.day; $('day-time').textContent = Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2, '0');
    const ic = $('clock-icon'); ic.style.left = (tf * 100) + '%'; ic.textContent = (tf > 0.62 && tf < 0.95) ? '🌙' : '☀️';
    $('clock-night').style.left = '62%';
    const st = []; if (p.poison > 0) st.push('☠ POISONED'); if (p.bleed > 0) st.push('🩸 BLEEDING'); if (G.inToxic) st.push('☣ TOXIC FOG'); if (p.hunger < 25) st.push('🍖 STARVING'); if (p.thirst < 25) st.push('💧 DEHYDRATED');
    $('hud-status').textContent = st.join('   ');
    document.querySelectorAll('#hud-slots .slot[data-slot]').forEach(s => {
      const i = +s.dataset.slot, k = p.wpn[i], w = k ? WEAPONS[k] : null;
      s.classList.toggle('on', p.active === i); s.classList.toggle('empty', !k);
      s.querySelector('.ico').textContent = w ? w.ico : '—'; s.querySelector('.nm').textContent = w ? w.name : SLOT_NAMES[i];
      s.querySelector('.am').textContent = w && w.ammo ? '×' + p.ammo[w.ammo] : '';
    });
    $('med-n').textContent = p.med;
    const f = p.alive && !G.auto ? A.findInteract(p) : null; const pr = $('hud-prompt');
    if (f) { pr.textContent = (A.mobile ? '[USE] ' : '[E] ') + f.label; pr.classList.add('show'); } else pr.classList.remove('show');
    $('spec-bar').style.display = G.playerDead ? 'block' : 'none'; if (G.playerDead && G.spec) $('spec-name').textContent = G.spec.name + ' (D' + G.spec.d + ')';
    $('auto-ind').style.display = G.auto ? 'block' : 'none';
  }
  const MM = 150;
  function drawMap() {
    const c = $('minimap'), g = c.getContext('2d'), p = A.player, S = (MM / 2 - 4) / A.R_ARENA;
    g.clearRect(0, 0, MM, MM); g.save(); g.translate(MM / 2, MM / 2);
    g.fillStyle = 'rgba(20,35,20,0.78)'; g.beginPath(); g.arc(0, 0, A.R_ARENA * S, 0, A.TAU); g.fill();
    if (G.safeR < A.R_ARENA - 1) { g.fillStyle = 'rgba(120,200,50,0.35)'; g.beginPath(); g.arc(0, 0, A.R_ARENA * S, 0, A.TAU); g.arc(0, 0, G.safeR * S, 0, A.TAU, true); g.fill(); g.strokeStyle = '#b8ff6a'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, G.safeR * S, 0, A.TAU); g.stroke(); }
    g.fillStyle = '#e8c95a'; g.fillRect(-3, -3, 6, 6);
    g.fillStyle = '#3d9cd8'; A.PONDS.forEach(q => { g.beginPath(); g.arc(q.x * S, -q.z * S, 3, 0, A.TAU); g.fill(); });
    g.fillStyle = '#ff4a3a'; A.fireballs.forEach(f => { g.beginPath(); g.arc(f.tx * S, -f.tz * S, 3.5, 0, A.TAU); g.fill(); });
    const cx = G.playerDead && G.spec ? G.spec : p;
    A.tributes.forEach(o => { if (!o.alive || o === cx || (Math.hypot(o.x - cx.x, o.z - cx.z) > 42)) return; g.fillStyle = '#ff6a5a'; g.beginPath(); g.arc(o.x * S, -o.z * S, 2.2, 0, A.TAU); g.fill(); });
    g.translate(cx.x * S, -cx.z * S); g.rotate(-cx.yaw + Math.PI); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
    g.restore(); g.strokeStyle = 'rgba(230,185,74,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(MM / 2, MM / 2, MM / 2 - 1.5, 0, A.TAU); g.stroke();
  }

  /* ---------- items / world setup ---------- */
  function spawnLoot() {
    const pool = []; const cnt = { knife: 5, spear: 3, mace: 3, bow: 3, tknives: 4, sling: 4, axe: 4, sword: 4, trident: 3, blowgun: 3, sickle: 3 };
    for (const k in cnt) for (let i = 0; i < cnt[k]; i++) pool.push(k);
    pool.sort(() => Math.random() - 0.5);
    pool.forEach((k, i) => { const a = i / pool.length * A.TAU + A.rand(-0.1, 0.1), r = A.rand(7.6, 13); A.spawnItem('weapon', k, Math.sin(a) * r, Math.cos(a) * r); });
    for (let i = 0; i < 14; i++) { const a = Math.random() * A.TAU, r = A.rand(8, 16); A.spawnItem('pack', null, Math.sin(a) * r, Math.cos(a) * r); }
    for (let i = 0; i < 14; i++) { const a = Math.random() * A.TAU, r = A.rand(18, 32); A.spawnItem('pack', null, Math.sin(a) * r, Math.cos(a) * r); }
    for (let i = 0; i < 14; i++) { const a = Math.random() * A.TAU, r = A.rand(45, 90); A.spawnItem('pack', null, Math.sin(a) * r, Math.cos(a) * r); }
    const extra = ['knife', 'sling', 'spear', 'sickle', 'knife', 'sling', 'tknives', 'axe'];
    extra.forEach(k => { for (let tries = 0; tries < 20; tries++) { const a = Math.random() * A.TAU, r = A.rand(42, 92), x = Math.sin(a) * r, z = Math.cos(a) * r; if (A.PONDS.some(q => Math.hypot(x - q.x, z - q.z) < q.r * 1.6)) continue; A.spawnItem('weapon', k, x, z); break; } });
  }

  /* ---------- main update ---------- */
  function update(dt) {
    const p = A.player;
    G.shakeT = 0;
    if (G.state === 'intro') {
      G.introT += dt; const k = A.clamp(G.introT / 6.5, 0, 1), e = k * k * (3 - 2 * k);
      A.slots.forEach(s => { s.platY = -6.5 + 6.5 * e; s.plat.position.y = s.platY; });
      if (G.introT >= 6.5) { G.state = 'countdown'; G.cd = G.cdTotal; G.cdLast = 99; $('countdown').classList.add('show'); A.ui.banner('THE ARENA AWAITS', 'You cannot move until the gong.', ''); }
    } else if (G.state === 'countdown') {
      G.cd -= dt; const n = Math.ceil(G.cd);
      if (n !== G.cdLast && n >= 0) { G.cdLast = n; $('countdown').textContent = n > 0 ? n : 'GO'; if (n <= 5 && n > 0) SFX.play('tick', 1); if (n > 0 && n < 99) { const e = $('countdown'); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); } }
      if (G.cd <= 0) {
        G.state = 'play'; G.time = 0; $('countdown').classList.remove('show'); SFX.play('gong', 1); SFX.play('tickHi', 0.5);
        A.ui.banner('THE BLOODBATH BEGINS', 'Fight for the Cornucopia!', 'warn'); A.ui.shake(0.15);
        A.tributes.forEach(t => { if (t.ai) A.startBloodbath(t); });
        if (G.auto && p.ai) A.startBloodbath(p);
        G.nextErupt = G.dayLen * 0.4 * G.diff.hazard;
      }
    } else if (G.state === 'play') {
      G.time += dt;
      const day = Math.floor(G.time / G.dayLen) + 1;
      if (day !== G.day) { G.day = day; G.nightMemo = false; A.ui.banner('DAY ' + day, 'The Games continue. ' + A.tributes.filter(o => o.alive).length + ' tributes remain.', ''); }
      const tf = (G.time % G.dayLen) / G.dayLen;
      if (tf > 0.76 && !G.nightMemo) { G.nightMemo = true; const fallen = G.dead.filter(o => !o.memo); fallen.forEach(o => o.memo = true); if (fallen.length) showMemorial(fallen); }
      if (G.time >= G.nextErupt) { startEruption(); G.nextErupt = G.time + G.dayLen * 0.55 * G.diff.hazard * A.rand(0.8, 1.2); }
      updateFog(dt); updateFireballs(dt);
      G.allyT = (G.allyT || 0) + dt; if (G.allyT > 1) { G.allyT = 0; const al = A.tributes.filter(o => o.alive), ally = al.filter(o => o.ally); if (ally.length && (ally.length >= al.length - 1 || al.length <= 8 || G.time > G.dayLen * 2.2)) { { ally.forEach(o => o.ally = 0); A.ui.feed('The Career alliance has fractured!', ''); } } }
      for (let i = G.cannonQ.length - 1; i >= 0; i--) { const q = G.cannonQ[i]; if (G.time >= q.at) { SFX.play('cannon', 0.9); A.ui.banner('☠  ' + q.t.name.toUpperCase(), 'District ' + q.t.d + ' • cannon fired', 'dead'); G.cannonQ.splice(i, 1); } }
      for (let i = A.regrow.length - 1; i >= 0; i--) { const r = A.regrow[i]; if (G.time >= r.at) { const idx = r.tr.fidx[r.tr.fruit]; const m = new THREE.Matrix4(); const cm = new THREE.Matrix4(); m.makeTranslation(0, 0, 0); r.tr.fruit++; A.fruitMesh.setMatrixAt(idx, new THREE.Matrix4().makeTranslation(r.tr.x + Math.sin(idx) * 2, r.tr.y + 5.2, r.tr.z + Math.cos(idx) * 2)); A.fruitMesh.instanceMatrix.needsUpdate = true; A.regrow.splice(i, 1); } }
      A.updateProjectiles(dt); A.separate();
      if (!G.ending) {
        const alive = A.tributes.filter(o => o.alive);
        if (alive.length <= 1) { G.ending = true; const w = alive[0] || G.dead[G.dead.length - 1]; setTimeout(() => showVictor(w), 3200); }
      }
    }
    A.tributes.forEach(t => A.updateTribute(t, dt));
    // nametags
    A.tributes.forEach(t => { if (!t.alive) return; const d = Math.hypot(t.x - A.camera.position.x, t.z - A.camera.position.z); t.mesh.tag.visible = !t.isPlayer && d < 24 && d > 6 && G.state !== 'intro'; });
    A.items.forEach(it => { if (it.taken) return; it.bob += dt * 2.2; it.inner.position.y = 0.15 + Math.sin(it.bob) * 0.1; it.inner.rotation.y += dt * 0.8; });
    if (G.ff > 0) G.ff = Math.max(0, G.ff - dt * 1.4); A.ffMat.opacity = 0.03 + G.ff * 0.5;
    A.blood.update(dt, (x, y, z) => { if (Math.random() < 0.18) A.addDecal(x, z, A.rand(0.08, 0.28)); }); A.fx.update(dt);
    if (A.lava) { const V = A.craterPos; if (Math.random() < 0.5) A.blood.add(V.x + A.rand(-5, 5), V.y, V.z + A.rand(-5, 5), A.rand(-1, 1), A.rand(4, 8), A.rand(-1, 1), [0.22, 0.2, 0.2], 6, 14, 22, -0.5, false); if (Math.random() < 0.4) A.fx.add(V.x + A.rand(-4, 4), V.y - 1, V.z + A.rand(-4, 4), A.rand(-1, 1), A.rand(3, 8), A.rand(-1, 1), [1, 0.4, 0.1], 1.2, 5, 1, 0, false); }
    updateMemorial(dt);
    const tfv = G.state === 'play' ? (G.time % G.dayLen) / G.dayLen : 0.02;
    const focus = G.playerDead && G.spec ? G.spec : p; lighting(tfv, { x: focus.x, y: 0, z: focus.z });
    updateCamera(dt);
    hudT += dt; if (hudT > 0.08) { hudT = 0; updateHud(dt); }
    mapT += dt; if (mapT > 0.12) { mapT = 0; drawMap(); }
    if (G.state === 'play' && IN.attack && G.playerDead) { /* spectator click handled elsewhere */ }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const raw = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    if (!started || paused) { if (started) A.renderer.render(A.scene, A.camera); return; }
    const n = G.speed || 1; for (let i = 0; i < n; i++) update(raw);
    A.renderer.render(A.scene, A.camera);
  }

  /* ---------- victor ---------- */
  function showVictor(w) {
    if (G.state === 'over') return; G.state = 'over'; started = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const d = DISTRICTS[w.d - 1], you = w === A.player;
    $('v-img').src = w.def.img; $('v-name').textContent = w.name; $('v-dist').textContent = 'District ' + w.d + ' — ' + d.name; $('v-badge').src = 'assets/img/districts/d' + w.d + '.png';
    $('v-title').textContent = you ? 'YOU ARE THE VICTOR!' : 'THE VICTOR OF THE 50th HUNGER GAMES';
    $('v-stats').textContent = 'Eliminations: ' + w.kills + '  •  Survived ' + G.day + ' day' + (G.day > 1 ? 's' : '') + '  •  Difficulty: ' + G.diff.label;
    $('v-you').textContent = you ? 'Panem salutes you.' : (G.playerDead ? 'You fell in the arena as ' + A.player.name + '.' : '');
    $('screen-victor').classList.add('show'); $('screen-death').classList.remove('show'); SFX.play('victor', 1);
    const box = $('confetti'); box.innerHTML = ''; for (let i = 0; i < 60; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.animationDelay = Math.random() * 3 + 's'; s.style.background = ['#f0b13c', '#fff', d.color][i % 3]; box.appendChild(s); }
  }

  /* ---------- input ---------- */
  function bindInput() {
    const vp = $('viewport');
    window.addEventListener('keydown', e => {
      if (!started || G.state === 'over') return; const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
      if (e.repeat) return; IN.keys[k] = true;
      if (k === 'e') { IN.use = true; IN.usePressed = true; } else if (k === 'h') IN.medPressed = true;
      else if (k === ' ') { if (G.playerDead) cycleSpec(); else IN.dashPressed = true; }
      else if (k === '1' || k === '2' || k === '3') IN.slot = +k - 1;
      else if (k === 'q') { const p = A.player; let s = p.active; for (let i = 1; i <= 3; i++) { const n = (s + i + 3) % 3; if (p.wpn[n]) { IN.slot = n; break; } } }
      else if (k === 'm') { A.ui.toast(SFX.toggle() ? 'Sound off' : 'Sound on'); }
      else if (k === 'p' || k === 'escape') setPause(!paused);
      else if (k === 't') { G.auto = !G.auto; A.ui.toast(G.auto ? 'Autopilot ON — watch the Games (T to take over)' : 'You are in control again'); if (G.auto && A.player.ai) { A.player.ai.mode = 'idle'; A.player.ai.thinkT = 0; } }
      syncKeys();
    });
    window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); IN.keys[k] = false; if (k === 'e') IN.use = false; syncKeys(); });
    function syncKeys() {
      const K = IN.keys; IN.x = (K['d'] || K['arrowright'] ? 1 : 0) - (K['a'] || K['arrowleft'] ? 1 : 0); IN.y = (K['w'] || K['arrowup'] ? 1 : 0) - (K['s'] || K['arrowdown'] ? 1 : 0); IN.sprint = !!K['shift'];
    }
    window.addEventListener('blur', () => { IN.keys = {}; syncKeys(); IN.attack = false; IN.use = false; });
    vp.addEventListener('mousedown', e => {
      if (!started || A.mobile) return;
      if (!lockedMouse && !paused && G.state !== 'over') { vp.requestPointerLock && vp.requestPointerLock(); return; }
      if (e.button === 0) { if (G.playerDead) cycleSpec(); else IN.attack = true; }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) IN.attack = false; });
    document.addEventListener('pointerlockchange', () => { lockedMouse = document.pointerLockElement === vp; if (!lockedMouse && started && G.state !== 'over' && !G.playerDead && !paused && !A.mobile && G.state === 'play') $('click-hint').classList.add('show'); else $('click-hint').classList.remove('show'); if (lockedMouse) $('click-hint').classList.remove('show'); });
    window.addEventListener('mousemove', e => { if (!lockedMouse) return; camYaw -= e.movementX * 0.0025; camPitch = A.clamp(camPitch + e.movementY * 0.0022, -0.3, 1.15); });
    vp.addEventListener('wheel', e => { camDist = A.clamp(camDist + e.deltaY * 0.004, 3.2, 10); }, { passive: true });
    // touch controls
    const joy = $('joy'), knob = $('joy-knob'); let jid = null, jc = null;
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; moveJoy(e); });
    const moveJoy = e => { if (e.pointerId !== jid) return; let dx = (e.clientX - jc.x) / jc.R, dy = (e.clientY - jc.y) / jc.R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } IN.jx = dx; IN.jy = -dy; IN.jmax = l > 0.95; knob.style.transform = `translate(${dx * jc.R * 0.6}px,${dy * jc.R * 0.6}px)`; };
    joy.addEventListener('pointermove', moveJoy);
    const endJoy = e => { if (e.pointerId !== jid) return; jid = null; IN.jx = IN.jy = 0; IN.jmax = false; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    let lid = null, lx = 0, ly = 0, lmoved = 0;
    vp.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || lid !== null) return; if (e.target.closest('.touch-ui')) return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; lmoved = 0; });
    vp.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; lmoved += Math.abs(dx) + Math.abs(dy); camYaw -= dx * 0.0055; camPitch = A.clamp(camPitch + dy * 0.0045, -0.3, 1.15); });
    const endLook = e => { if (e.pointerId !== lid) return; lid = null; if (lmoved < 8 && G.playerDead) cycleSpec(); };
    vp.addEventListener('pointerup', endLook); vp.addEventListener('pointercancel', endLook);
    const hold = (id, on, off) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); on(); }); const up = () => { b.classList.remove('down'); off && off(); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); };
    hold('btn-atk', () => IN.attack = true, () => IN.attack = false);
    hold('btn-use', () => { IN.use = true; IN.usePressed = true; }, () => IN.use = false);
    hold('btn-dash', () => IN.dashPressed = true); hold('btn-med', () => IN.medPressed = true);
    hold('btn-run', () => IN.sprint = true, () => IN.sprint = false);
    document.querySelectorAll('#hud-slots .slot[data-slot]').forEach(s => s.addEventListener('pointerdown', e => { e.stopPropagation(); IN.slot = +s.dataset.slot; }));
    $('btn-pause').addEventListener('click', () => setPause(!paused));
    $('btn-mute').addEventListener('click', () => { $('btn-mute').textContent = SFX.toggle() ? '🔇' : '🔊'; });
    $('btn-speed').addEventListener('click', () => { const L = [1, 2, 4, 8]; G.speed = L[(L.indexOf(G.speed || 1) + 1) % L.length]; $('btn-speed').textContent = '⏩ ×' + G.speed; });
    $('btn-resume').addEventListener('click', () => setPause(false));
    $('btn-spectate').addEventListener('click', () => { $('screen-death').classList.remove('show'); G.speed = G.speed || 1; });
    $('btn-skip').addEventListener('click', () => { $('screen-death').classList.remove('show'); G.speed = 8; $('btn-speed').textContent = '⏩ ×8'; });
    $('btn-auto').addEventListener('click', () => { G.auto = !G.auto; A.ui.toast(G.auto ? 'Autopilot ON' : 'You are in control'); if (G.auto && A.player.ai) { A.player.ai.mode = 'idle'; A.player.ai.thinkT = 0; } });
  }
  function cycleSpec() { const L = A.tributes.filter(o => o.alive); if (!L.length) return; const i = L.indexOf(G.spec); G.spec = L[(i + 1) % L.length]; }
  function setPause(v) {
    if (G.state === 'over' || !started) return; paused = v; $('screen-pause').classList.toggle('show', v);
    if (v && document.exitPointerLock) document.exitPointerLock();
  }

  /* ---------- public ---------- */
  function init() {
    if (started || A.renderer) return;
    A.initRenderer($('viewport')); A.buildWorld(); bindInput(); requestAnimationFrame(loop);
  }
  function begin(opts) {
    init();
    G.diff = DIFF[opts.diff] || DIFF.medium; G.dayLen = opts.dayLen || 300; G.state = 'intro'; G.introT = 0; G.cdTotal = 15; G.time = 0; G.day = 1;
    G.cannonQ = []; G.dead = []; G.ff = 0; G.fogStage = 0; G.safeR = A.R_ARENA; G.speed = opts.speed || 1; G.auto = !!opts.auto; G.bloodEnd = 70; G.playerDead = false; G.ending = false;
    TRIBUTES.forEach((def, i) => { const t = A.makeTribute(def, i, def.id === opts.playerId); A.tributes.push(t); if (t.isPlayer) A.player = t; else A.aiInit(t); A.equip(t, -1); });
    spawnLoot();
    const p = A.player; camYaw = A.slots[p.slot].yaw; camPitch = 0.3;
    const d = DISTRICTS[p.d - 1]; $('hp-img').src = p.def.img; $('hp-name').textContent = p.name; $('hp-dist').textContent = 'District ' + p.d + ' • ' + d.name; $('hp-badge').src = 'assets/img/districts/d' + p.d + '.png';
    $('hud-player').style.borderColor = d.color; $('btn-speed').textContent = '⏩ ×' + G.speed; $('diff-ind').textContent = G.diff.label;
    SFX.init(); SFX.play('platform', 0.7);
    started = true; last = performance.now(); A.resize();
    A.ui.banner('ENTERING THE ARENA', 'Your platform is rising…', '');
  }
  return { init, begin, setPause, G, IN, step(n, dt) { for (let i = 0; i < n; i++) update(dt); }, isTouch: () => A.mobile, get started() { return started; } };
})();
