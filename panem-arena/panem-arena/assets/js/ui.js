'use strict';
/* ===== Screens: Welcome -> Select -> Game ===== */
(function () {
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const S = { id: null, diff: DIFF[Q.get('diff')] ? Q.get('diff') : 'medium', day: +Q.get('day') || 300 };
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id)); document.body.classList.toggle('playing', id === 'screen-game'); window.scrollTo(0, 0); };

  // build tribute grid
  const grid = $('tribute-grid');
  DISTRICTS.forEach(d => {
    const row = document.createElement('div'); row.className = 'drow'; row.style.setProperty('--dc', d.color);
    row.innerHTML = '<div class="dhead"><img src="assets/img/districts/d' + d.n + '.png" alt=""><div><b>District ' + d.n + '</b><small>' + d.name + '</small></div></div><div class="dcards"></div>';
    const box = row.querySelector('.dcards');
    TRIBUTES.filter(t => t.d === d.n).forEach(t => {
      const b = document.createElement('button'); b.className = 'tcard'; b.dataset.id = t.id;
      b.innerHTML = '<img src="' + t.img + '" alt="' + t.name + '" loading="lazy"><span>' + t.name + '</span>';
      b.addEventListener('click', () => pick(t.id)); box.appendChild(b);
    });
    grid.appendChild(row);
  });
  const dp = $('diff-pick');
  Object.keys(DIFF).forEach(k => {
    const b = document.createElement('button'); b.className = 'diff'; b.dataset.diff = k; b.innerHTML = '<b>' + DIFF[k].label + '</b><small>' + DIFF[k].desc + '</small>';
    b.addEventListener('click', () => { S.diff = k; syncDiff(); }); dp.appendChild(b);
  });
  const syncDiff = () => dp.querySelectorAll('.diff').forEach(b => b.classList.toggle('on', b.dataset.diff === S.diff));
  syncDiff();
  $('day-pick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.day = +b.dataset.day; syncDay(); }));
  const syncDay = () => $('day-pick').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.day === S.day));
  syncDay();

  function pick(id) {
    S.id = id; const t = TRIBUTES[id], d = DISTRICTS[t.d - 1];
    grid.querySelectorAll('.tcard').forEach(c => c.classList.toggle('on', +c.dataset.id === id));
    $('tp-img').src = t.img; $('tp-img').style.borderColor = d.color; $('tp-name').textContent = t.name;
    $('tp-dist').textContent = 'District ' + d.n + ' — ' + d.name; $('tp-dist').style.color = d.color === '#1b1b1b' ? '#fff' : d.color;
    $('tp-meta').textContent = (t.g === 'F' ? 'Female' : 'Male') + ' • ' + t.ft + '\'' + t.inch + '"'; $('tp-badge').src = 'assets/img/districts/d' + d.n + '.png';
    $('tp-perk').textContent = '★ ' + PERKS[d.n].txt;
    $('tp-bio').textContent = KNOWN_BIOS[t.name] || ('District ' + d.n + ' tribute (' + d.industry + '). Reaped for the Second Quarter Quell.');
    $('btn-start').disabled = false; $('btn-start').textContent = 'ENTER THE ARENA AS ' + t.name.toUpperCase();
    if (window.innerWidth < 900) $('tribute-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('btn-enter').addEventListener('click', () => { SFX.init(); show('screen-select'); if (S.id === null) pick(TRIBUTES.findIndex(t => t.name === 'Haymitch')); });
  $('btn-back-welcome').addEventListener('click', () => show('screen-welcome'));
  function start() {
    if (S.id === null) return; SFX.init(); show('screen-game'); const L = $('loading'); L.classList.add('show');
    setTimeout(() => {
      try { Main.begin({ playerId: S.id, diff: S.diff, dayLen: S.day, speed: +Q.get('speed') || 1, auto: Q.get('auto') === '1' }); }
      catch (e) { console.error(e); L.querySelector('p').textContent = 'Could not start the 3D arena: ' + e.message + ' (WebGL needed).'; return; }
      setTimeout(() => L.classList.remove('show'), 300);
    }, 80);
  }
  $('btn-start').addEventListener('click', start);
  if (Q.get('select') === '1' || Q.get('go') === '1') { show('screen-select'); if (Q.get('tribute')) pick(+Q.get('tribute')); else pick(TRIBUTES.findIndex(t => t.name === 'Haymitch')); }
  if (Q.get('go') === '1') start();
})();
