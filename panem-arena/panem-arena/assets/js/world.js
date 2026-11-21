'use strict';
/* ===== World: renderer, terrain, props, particles ===== */
const A = {
  TAU: Math.PI * 2, R_ARENA: 110, RING_R: 38, N: 48,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  colliders: [], items: [], trees: [], bushes: [], slots: []
};
A.smooth = (a, b, x) => { const t = A.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
A.PONDS = [{ x: 62, z: -48, r: 7 }, { x: -58, z: 52, r: 6.5 }, { x: 18, z: -86, r: 6 }, { x: -72, z: -30, r: 6 }];
A.VOLCANO = { x: -95, z: -190, top: 78 };
(function () {
  let s = 50;
  A.srand = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
})();

A.noise = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.04) * 0.6 + Math.sin(x * 0.1 + 1.3) * Math.sin(z * 0.085) * 0.3 + Math.sin(x * 0.21) * Math.cos(z * 0.17 + 2) * 0.14;
A.groundH = (x, z) => {
  const r = Math.hypot(x, z);
  if (r < 57) return 0;
  let h = A.noise(x, z) * A.smooth(58, 82, r) * 3.4;
  h += A.smooth(100, 170, r) * 16;
  for (const p of A.PONDS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r * 3.2) {
      h = A.lerp(h, 0.3, 1 - A.smooth(p.r * 1.7, p.r * 3.2, d));
      h = A.lerp(h, -0.6, 1 - A.smooth(p.r * 0.85, p.r * 1.7, d));
    }
  }
  return h;
};
// launch slots around the ring (index = tribute order: district 1..12, 4 each)
for (let i = 0; i < A.N; i++) {
  const a = (i + 0.5) / A.N * A.TAU, x = Math.sin(a) * A.RING_R, z = Math.cos(a) * A.RING_R;
  A.slots.push({ x, z, yaw: Math.atan2(-x, -z), a });
}

/* ---------- canvas textures ---------- */
A.canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
};
A.makeGrassTexture = () => A.canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f9a3b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const l = 30 + Math.random() * 28;
    g.fillStyle = `hsl(${85 + Math.random() * 30},${40 + Math.random() * 25}%,${l}%)`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 2 + Math.random() * 5);
  }
}, true);

/* ---------- particles ---------- */
A.Particles = class {
  constructor(n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3); this.alpha = new Float32Array(n); this.size = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.grav = new Float32Array(n); this.ground = new Uint8Array(n);
    for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aCol = new THREE.BufferAttribute(this.col, 3);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1); this.aSize = new THREE.BufferAttribute(this.size, 1);
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol);
    g.setAttribute('alpha', this.aAlpha); g.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute float size;attribute float alpha;attribute vec3 pcolor;varying float vA;varying vec3 vC;uniform float uScale;void main(){vA=alpha;vC=pcolor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*uScale/max(0.5,-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;gl_FragColor=vec4(vC,vA*smoothstep(0.5,0.12,d));}'
    });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false;
  }
  add(x, y, z, vx, vy, vz, color, life, s0, s1, grav, onGround) {
    const k = this.i; this.i = (this.i + 1) % this.n;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.col[k * 3] = color[0]; this.col[k * 3 + 1] = color[1]; this.col[k * 3 + 2] = color[2];
    this.life[k] = this.max[k] = life; this.s0[k] = s0; this.s1[k] = s1; this.grav[k] = grav || 0; this.ground[k] = onGround ? 1 : 0;
  }
  update(dt, onLand) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; this.pos[k * 3 + 1] = -999; } continue; }
      this.life[k] -= dt; const p = k * 3;
      this.vel[p + 1] -= this.grav[k] * dt;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.ground[k]) {
        const gh = A.groundH(this.pos[p], this.pos[p + 2]);
        if (this.pos[p + 1] <= gh + 0.03) { this.life[k] = 0; if (onLand) onLand(this.pos[p], gh, this.pos[p + 2]); }
      }
      const u = Math.max(0, this.life[k] / this.max[k]);
      this.alpha[k] = Math.min(1, u * 1.6); this.size[k] = this.s1[k] + (this.s0[k] - this.s1[k]) * u;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aAlpha.needsUpdate = this.aSize.needsUpdate = true;
  }
};

/* ---------- init ---------- */
A.initRenderer = container => {
  A.container = container;
  A.mobile = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  const r = new THREE.WebGLRenderer({ antialias: !A.mobile, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, A.mobile ? 1.25 : 1.75));
  r.setSize(container.clientWidth, container.clientHeight);
  r.shadowMap.enabled = !A.mobile; r.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(r.domElement);
  A.renderer = r;
  A.scene = new THREE.Scene();
  A.scene.background = new THREE.Color(0x8ec3e8);
  A.scene.fog = new THREE.Fog(0x8ec3e8, 70, 420);
  A.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.15, 900);
  A.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a30, 0.7); A.scene.add(A.hemi);
  A.sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
  if (!A.mobile) {
    A.sun.castShadow = true; A.sun.shadow.mapSize.set(1536, 1536);
    const c = A.sun.shadow.camera; c.left = -46; c.right = 46; c.top = 46; c.bottom = -46; c.near = 1; c.far = 260;
    A.sun.shadow.bias = -0.0006;
  }
  A.scene.add(A.sun); A.scene.add(A.sun.target);
  A.moon = new THREE.DirectionalLight(0x7f9bff, 0.0); A.scene.add(A.moon);
  A.flashLight = new THREE.PointLight(0xff8a30, 0, 60); A.scene.add(A.flashLight);
  A.shaftLight = new THREE.PointLight(0xffe2b0, 1.2, 14); A.scene.add(A.shaftLight);
  A.resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    r.setSize(w, h); A.camera.aspect = w / h; A.camera.updateProjectionMatrix();
    A.blood.mat.uniforms.uScale.value = A.fx.mat.uniforms.uScale.value = h * 0.8;
  };
  A.blood = new A.Particles(900, false); A.fx = new A.Particles(900, true);
  A.scene.add(A.blood.obj); A.scene.add(A.fx.obj);
  window.addEventListener('resize', A.resize);
  A.resize();
};

/* ---------- build the arena ---------- */
A.buildWorld = () => {
  const S = A.scene, TAU = A.TAU, rnd = A.srand;
  const grassTex = A.makeGrassTexture();
  const ringTex = grassTex.clone(); ringTex.needsUpdate = true;
  const coreTex = grassTex.clone(); coreTex.repeat.set(1 / 14, 1 / 14); coreTex.needsUpdate = true;

  // --- outer terrain ---
  {
    const TS = 160, RS = 96, r0 = 55, r1 = 330, pos = [], uv = [], col = [], idx = [];
    for (let j = 0; j <= RS; j++) {
      const rr = r0 + (r1 - r0) * Math.pow(j / RS, 1.6);
      for (let i = 0; i <= TS; i++) {
        const a = i / TS * TAU, x = Math.sin(a) * rr, z = Math.cos(a) * rr, h = A.groundH(x, z);
        pos.push(x, h, z); uv.push(x / 14, z / 14);
        const n = A.noise(x * 2.3 + 9, z * 2.3) * 0.5 + 0.5, rock = A.smooth(6, 20, h);
        const gr = [0.34 + n * 0.1, 0.58 + n * 0.1, 0.2], rk = [0.46, 0.42, 0.37];
        col.push(A.lerp(gr[0], rk[0], rock), A.lerp(gr[1], rk[1], rock), A.lerp(gr[2], rk[2], rock));
      }
    }
    for (let j = 0; j < RS; j++) for (let i = 0; i < TS; i++) {
      const a = j * (TS + 1) + i, b = a + 1, c = a + TS + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: ringTex, vertexColors: true }));
    m.receiveShadow = true; S.add(m);
  }
  // --- core disc with launch-tube holes ---
  {
    const sh = new THREE.Shape(); sh.absarc(0, 0, 56, 0, TAU, false);
    A.slots.forEach(s => { const h = new THREE.Path(); h.absarc(s.x, -s.z, 2.05, 0, TAU, true); sh.holes.push(h); });
    const g = new THREE.ShapeGeometry(sh, 72); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: coreTex, color: 0xdfffd0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.y = 0.01; m.receiveShadow = true; S.add(m);
  }
  // --- launch tubes + platforms ---
  {
    const shaftGeo = new THREE.CylinderGeometry(2.1, 2.1, 9, 20, 1, true);
    const shaftMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44, side: THREE.BackSide });
    const rimGeo = new THREE.RingGeometry(1.95, 2.5, 24); rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });
    const platGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.5, 20);
    const platMat = new THREE.MeshLambertMaterial({ color: 0xf1eee6 });
    const ringGeo = new THREE.TorusGeometry(1.5, 0.07, 6, 24); ringGeo.rotateX(Math.PI / 2);
    A.slots.forEach((s, i) => {
      const shaft = new THREE.Mesh(shaftGeo, shaftMat); shaft.position.set(s.x, -4.5, s.z); S.add(shaft);
      const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.set(s.x, 0.04, s.z); rim.receiveShadow = true; S.add(rim);
      const d = DISTRICTS[Math.floor(i / 4)];
      const plat = new THREE.Group();
      const disc = new THREE.Mesh(platGeo, platMat); disc.position.y = -0.25; disc.receiveShadow = true; plat.add(disc);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: d.color })); ring.position.y = 0.02; plat.add(ring);
      plat.position.set(s.x, -6.5, s.z); S.add(plat); s.plat = plat; s.platY = -6.5;
    });
  }
  // --- cornucopia ---
  {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xf3f1ea }), navy = new THREE.MeshLambertMaterial({ color: 0x1d2b5c }), steel = new THREE.MeshLambertMaterial({ color: 0xbfc6d4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 10), white); base.position.y = 0.35; g.add(base);
    const step = new THREE.Mesh(new THREE.BoxGeometry(17, 0.35, 12), steel); step.position.y = 0.17; g.add(step);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.9, 16, 4), navy); spire.position.y = 8.6; spire.rotation.y = Math.PI / 4; g.add(spire);
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 7), white);
      fin.position.set(sx * 3.9, 6.3, 0); fin.rotation.z = -sx * 0.32; g.add(fin);
      const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 6), white);
      fin2.position.set(sx * 6.6, 4.5, 0); fin2.rotation.z = -sx * 0.45; g.add(fin2);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.add(g); A.colliders.push({ x: 0, z: 0, r: 6.2 });
  }
  // --- flower beds ---
  {
    const geo = new THREE.SphereGeometry(0.11, 6, 5), m = 0;
    const cols = [0xe86aa8, 0xf5d142, 0xe5322b, 0xffffff, 0xd048d8, 0xff9a2e];
    const beds = 18, per = 46, mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), beds * per);
    const mat4 = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
    for (let b = 0; b < beds; b++) {
      const a0 = b / beds * TAU + rnd() * 0.1, span = 0.12 + rnd() * 0.08, rr = 15 + rnd() * 16, col = cols[b % cols.length];
      for (let k = 0; k < per; k++) {
        const a = a0 + rnd() * span, r = rr + (rnd() - 0.5) * 2.4;
        mat4.makeTranslation(Math.sin(a) * r, 0.2, Math.cos(a) * r); mesh.setMatrixAt(n, mat4);
        c.setHex(col); c.offsetHSL(0, 0, (rnd() - 0.5) * 0.1); mesh.setColorAt(n, c); n++;
      }
    }
    S.add(mesh);
  }
  // --- trees (some bear fruit) ---
  {
    const N = 74, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 4.4, 7), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), N);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const fruitMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 7, 6), new THREE.MeshLambertMaterial({ color: 0xff8a1d, emissive: 0x552200 }), 18 * 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    let placed = 0, tries = 0, fruitN = 0;
    while (placed < N && tries++ < 4000) {
      const a = rnd() * TAU, r = 48 + rnd() * 58, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (A.PONDS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 2.4)) continue;
      if (A.trees.some(t => Math.hypot(x - t.x, z - t.z) < 7)) continue;
      const y = A.groundH(x, z), s = 0.85 + rnd() * 0.6, fruit = placed < 18;
      sc.set(s, s, s); ps.set(x, y + 2.2 * s, z); m4.compose(ps, q, sc); trunks.setMatrixAt(placed, m4);
      ps.set(x, y + 5.2 * s, z); sc.set(s * 1.1, s * (0.85 + rnd() * 0.3), s * 1.1); m4.compose(ps, q, sc); crowns.setMatrixAt(placed, m4);
      c.setHex(fruit ? 0x4f9a3a : 0x2f6b2c); c.offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08); crowns.setColorAt(placed, c);
      const tree = { x, z, y, r: 0.9 * s, fruit: 0, fidx: [] };
      if (fruit) {
        tree.fruit = 3;
        for (let k = 0; k < 4; k++) {
          const fa = k / 4 * TAU + rnd(), fr = 2.2 * s;
          ps.set(x + Math.sin(fa) * fr, y + (4.6 + rnd()) * s, z + Math.cos(fa) * fr); sc.set(1, 1, 1);
          m4.compose(ps, q, sc); fruitMesh.setMatrixAt(fruitN, m4); tree.fidx.push(fruitN++);
        }
      }
      A.trees.push(tree); A.colliders.push({ x, z, r: tree.r }); placed++;
    }
    A.fruitMesh = fruitMesh; A.fruitCount = fruitN;
    for (const k of [trunks, crowns, fruitMesh]) { k.castShadow = true; S.add(k); }
    crowns.count = placed; trunks.count = placed; fruitMesh.count = fruitN;
  }
  // --- poison berry bushes ---
  {
    const NB = 22, bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0, 0), new THREE.MeshLambertMaterial({ color: 0x2b5a27 }), NB);
    const berry = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshLambertMaterial({ color: 0x8a1fb0, emissive: 0x2a0836 }), NB * 6);
    const m4 = new THREE.Matrix4(); let n = 0, bn = 0, tries = 0;
    while (n < NB && tries++ < 2000) {
      const a = rnd() * TAU, r = 42 + rnd() * 62, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (A.PONDS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 2.4)) continue;
      if (A.trees.some(t => Math.hypot(x - t.x, z - t.z) < 3.5) || A.bushes.some(t => Math.hypot(x - t.x, z - t.z) < 6)) continue;
      const y = A.groundH(x, z);
      m4.makeScale(1.2, 0.8, 1.2).setPosition(x, y + 0.6, z); bush.setMatrixAt(n, m4);
      for (let k = 0; k < 6; k++) { const fa = rnd() * TAU, fr = 0.9 * rnd() + 0.4; m4.makeTranslation(x + Math.sin(fa) * fr, y + 0.7 + rnd() * 0.5, z + Math.cos(fa) * fr); berry.setMatrixAt(bn++, m4); }
      A.bushes.push({ x, z, y, r: 1.3, cd: 0 }); n++;
    }
    bush.count = n; berry.count = bn; bush.castShadow = true; S.add(bush); S.add(berry);
  }
  // --- rocks ---
  {
    const NR = 46, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8b8a84 }), NR);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(); let n = 0, tries = 0;
    while (n < NR && tries++ < 3000) {
      const a = rnd() * TAU, r = 46 + rnd() * 62, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (A.PONDS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 2.2)) continue;
      if (A.trees.some(t => Math.hypot(x - t.x, z - t.z) < 3) || A.colliders.some(t => t.r > 1.2 && Math.hypot(x - t.x, z - t.z) < 5)) continue;
      const s = 0.9 + rnd() * 1.8; e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
      ps.set(x, A.groundH(x, z) + s * 0.4, z); sc.set(s, s * 0.7, s); m4.compose(ps, q, sc); rocks.setMatrixAt(n++, m4);
      A.colliders.push({ x, z, r: s * 0.85 });
    }
    rocks.count = n; rocks.castShadow = rocks.receiveShadow = true; S.add(rocks);
  }
  // --- grass tufts ---
  {
    const NG = 2400, gm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.7, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), NG);
    const m4 = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
    while (n < NG) {
      const a = rnd() * TAU, r = 6 + Math.sqrt(rnd()) * 112, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (A.PONDS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 1.4)) continue;
      if (A.slots.some(s => Math.hypot(x - s.x, z - s.z) < 3)) continue;
      if (Math.hypot(x, z) < 8) continue;
      m4.makeScale(1, 0.6 + rnd() * 1.2, 1).setPosition(x, A.groundH(x, z) + 0.25, z); gm.setMatrixAt(n, m4);
      c.setHSL(0.24 + rnd() * 0.06, 0.5, 0.28 + rnd() * 0.16); gm.setColorAt(n, c); n++;
    }
    S.add(gm);
  }
  // --- ponds ---
  A.pondMat = new THREE.MeshLambertMaterial({ color: 0x2c7fb8, transparent: true, opacity: 0.82, emissive: 0x0a2a44 });
  A.PONDS.forEach(p => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r * 1.15, 32).rotateX(-Math.PI / 2), A.pondMat);
    m.position.set(p.x, -0.1, p.z); S.add(m);
  });
  // --- mountain backdrop from the supplied arena picture ---
  {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false });
    A.backdropMat = mat;
    const geo = new THREE.CylinderGeometry(330, 330, 150, 96, 1, true);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = 40; mesh.renderOrder = -2; S.add(mesh);
    const img = new Image();
    img.onload = () => {
      try {
        const cw = img.width, ch = 262, c = document.createElement('canvas'); c.width = cw * 2; c.height = ch;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);
        g.save(); g.translate(cw * 2, 0); g.scale(-1, 1); g.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch); g.restore();
        g.globalCompositeOperation = 'destination-out';
        const gr = g.createLinearGradient(0, 0, 0, ch * 0.34); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, cw * 2, ch * 0.34);
        const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 1;
        mat.map = t; mat.needsUpdate = true;
      } catch (e) { console.warn('backdrop texture unavailable', e); }
    };
    img.src = 'assets/img/ref/arena.jpg';
  }
  // --- volcano ---
  {
    const V = A.VOLCANO, g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(10, 78, V.top, 30, 4, false);
    const pa = geo.attributes.position, cols = [];
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i) / V.top + 0.5, n = Math.random() * 0.06;
      cols.push(0.22 + n + (1 - y) * 0.05, 0.17 + n, 0.15 + n);
      if (y > 0.2 && y < 0.95) { pa.setX(i, pa.getX(i) * (1 + (Math.random() - 0.5) * 0.12)); pa.setZ(i, pa.getZ(i) * (1 + (Math.random() - 0.5) * 0.12)); }
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); cone.position.y = V.top / 2 - 6; g.add(cone);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(9.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a14, fog: false }));
    lava.position.y = V.top - 6.4; g.add(lava); A.lava = lava;
    g.position.set(V.x, 14, V.z); S.add(g);
    A.craterPos = new THREE.Vector3(V.x, 14 + V.top - 6, V.z);
    A.craterLight = new THREE.PointLight(0xff6a20, 1.6, 260); A.craterLight.position.copy(A.craterPos).add(new THREE.Vector3(0, 8, 0)); S.add(A.craterLight);
  }
  // --- stars ---
  {
    const n = 700, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * TAU, v = Math.acos(Math.random() * 0.95 + 0.05), r = 560;
      p[i * 3] = Math.sin(v) * Math.cos(u) * r; p[i * 3 + 1] = Math.cos(v) * r; p[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    A.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    A.stars = new THREE.Points(g, A.starMat); S.add(A.stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }));
    S.add(moon); A.moonMesh = moon;
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
    S.add(sunM); A.sunMesh = sunM;
  }
  // --- toxic fog wall and force field ---
  {
    const tex = A.canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = 'rgba(120,200,60,0.5)'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60},255,${60 + Math.random() * 60},${Math.random() * 0.35})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 22, 0, TAU); g.fill(); }
    }, true);
    tex.repeat.set(10, 1); A.fogTex = tex;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 46, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, fog: false, color: 0xb6ff6a }));
    wall.position.y = 18; wall.visible = false; S.add(wall); A.fogWall = wall;
    const hex = A.canvasTex(128, 128, (g, w, h) => {
      g.strokeStyle = 'rgba(160,220,255,0.9)'; g.lineWidth = 2;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        const cx = x * 48 + (y % 2) * 24, cy = y * 42;
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); } g.closePath(); g.stroke();
      }
    }, true);
    hex.repeat.set(60, 14);
    A.ffMat = new THREE.MeshBasicMaterial({ map: hex, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, fog: false, color: 0x9fd8ff });
    const ff = new THREE.Mesh(new THREE.CylinderGeometry(A.R_ARENA, A.R_ARENA, 60, 96, 1, true), A.ffMat); ff.position.y = 20; S.add(ff);
  }
  // --- blood decals ---
  {
    const n = 360, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6d0a0a, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false }), n);
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) m.setMatrixAt(i, z);
    m.frustumCulled = false; S.add(m); A.decals = m; A.decalI = 0;
  }
};

A.addDecal = (x, z, s) => {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
  m.compose(new THREE.Vector3(x, A.groundH(x, z) + 0.04, z), q, new THREE.Vector3(s, 1, s * (0.6 + Math.random() * 0.5)));
  A.decals.setMatrixAt(A.decalI, m); A.decalI = (A.decalI + 1) % 360; A.decals.instanceMatrix.needsUpdate = true;
};
A.bloodBurst = (x, y, z, n, dirx = 0, dirz = 0, power = 1) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * A.TAU, sp = (1.5 + Math.random() * 4) * power;
    A.blood.add(x, y, z, Math.sin(a) * sp + dirx * 3, 1.5 + Math.random() * 3.5, Math.cos(a) * sp + dirz * 3,
      [0.55 + Math.random() * 0.25, 0.02, 0.03], 0.9 + Math.random() * 0.8, 0.16 + Math.random() * 0.14, 0.08, 14, true);
  }
};
A.sparks = (x, y, z, n, color = [1, 0.7, 0.3], spd = 4, life = 0.5) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * A.TAU, e = Math.random() * 1.2;
    A.fx.add(x, y, z, Math.sin(a) * spd * Math.random(), e * spd, Math.cos(a) * spd * Math.random(), color, life * (0.5 + Math.random()), 0.4, 0.05, 6, false);
  }
};

/* ---------- weapon models ---------- */
A.weaponCache = {};
A.makeWeaponModel = type => {
  if (A.weaponCache[type]) return A.weaponCache[type].clone(true);
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5530 }), steel = new THREE.MeshLambertMaterial({ color: 0xc9ced6 }),
    dark = new THREE.MeshLambertMaterial({ color: 0x2c2c30 }), gold = new THREE.MeshLambertMaterial({ color: 0xc9a23a });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const cyl = (r1, r2, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 8), m); o.position.set(x, y, z); g.add(o); return o; };
  switch (type) {
    case 'knife': box(0.05, 0.4, 0.015, steel, 0, 0.3, 0); box(0.07, 0.14, 0.05, dark, 0, 0.03, 0); break;
    case 'spear': cyl(0.025, 0.025, 2.4, wood, 0, 0.9, 0); { const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), steel); t.position.y = 2.25; g.add(t); } break;
    case 'mace': cyl(0.03, 0.035, 0.75, wood, 0, 0.3, 0); { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), dark); s.position.y = 0.75; g.add(s); } break;
    case 'bow': { const t = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 20, Math.PI), wood); t.rotation.z = -Math.PI / 2; t.position.set(0, 0.45, 0); g.add(t); box(0.008, 1.1, 0.008, steel, -0.0, 0.45, 0); } break;
    case 'tknives': for (let i = 0; i < 3; i++) { const k = box(0.04, 0.3, 0.012, steel, (i - 1) * 0.07, 0.2, 0); k.rotation.z = (i - 1) * 0.2; } break;
    case 'sling': cyl(0.025, 0.025, 0.28, wood, 0, 0.15, 0); { const a = cyl(0.02, 0.02, 0.22, wood, -0.08, 0.36, 0); a.rotation.z = 0.5; const b = cyl(0.02, 0.02, 0.22, wood, 0.08, 0.36, 0); b.rotation.z = -0.5; } break;
    case 'axe': cyl(0.03, 0.035, 0.95, wood, 0, 0.4, 0); box(0.03, 0.26, 0.34, steel, 0, 0.82, 0.12); break;
    case 'sword': box(0.07, 1.0, 0.018, steel, 0, 0.65, 0); box(0.3, 0.05, 0.05, gold, 0, 0.13, 0); cyl(0.025, 0.025, 0.2, dark, 0, 0.02, 0); break;
    case 'trident': cyl(0.025, 0.025, 2.0, wood, 0, 0.8, 0); box(0.3, 0.04, 0.04, steel, 0, 1.78, 0); for (const x of [-0.14, 0, 0.14]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.035, x === 0 ? 0.42 : 0.3, 5), steel); p.position.set(x, 1.95, 0); g.add(p); } break;
    case 'blowgun': cyl(0.03, 0.03, 1.1, dark, 0, 0.45, 0); break;
    case 'sickle': cyl(0.025, 0.03, 0.5, wood, 0, 0.2, 0); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 5, 14, Math.PI * 1.1), steel); t.position.set(0, 0.6, 0); t.rotation.z = -0.4; g.add(t); } break;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  A.weaponCache[type] = g; return g.clone(true);
};

/* ---------- items on the ground ---------- */
A.spawnItem = (kind, type, x, z, extra) => {
  const g = new THREE.Group();
  const cat = kind === 'weapon' ? WEAPONS[type].cat : 3;
  const col = [0xff9a3c, 0x45d4ff, 0x6bff7a, 0xffffff][cat];
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 }));
  ring.position.y = 0.06; g.add(ring);
  const inner = new THREE.Group(); g.add(inner);
  if (kind === 'weapon') {
    const w = A.makeWeaponModel(type); w.rotation.z = Math.PI / 2; w.position.y = 0.45;
    const s = WEAPONS[type].range > 3 || type === 'bow' ? 0.8 : 1.15; w.scale.setScalar(s); inner.add(w);
  } else {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.38), new THREE.MeshLambertMaterial({ color: 0x4a5c36 })); bag.position.y = 0.5; inner.add(bag);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x2f3b22 })); flap.position.y = 0.8; inner.add(flap);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.02), new THREE.MeshBasicMaterial({ color: 0xff3b3b })); cross.position.set(0, 0.5, 0.2); inner.add(cross);
  }
  const y = A.groundH(x, z); g.position.set(x, y, z); A.scene.add(g);
  const it = { kind, type, x, z, y, mesh: g, inner, taken: false, claim: -1, cat, name: kind === 'weapon' ? WEAPONS[type].name : 'Supply backpack', bob: Math.random() * 6 };
  if (kind === 'pack') it.pack = extra || { food: 40, water: 35, med: Math.random() < 0.55 ? 1 : 0, ammo: 4 };
  A.items.push(it); return it;
};
A.removeItem = it => { it.taken = true; A.scene.remove(it.mesh); };
