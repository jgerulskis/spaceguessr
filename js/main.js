// DOM wiring. Everything the player sees goes through here.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const PARAMS = new URLSearchParams(location.search);
  const DEBUG = PARAMS.get('debug') === '1';
  const SEED = PARAMS.get('seed') || null;
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#0b0e1a"/>' +
    '<text x="50%" y="48%" fill="#8899aa" font-family="sans-serif" font-size="30" text-anchor="middle">Image missing</text>' +
    '<text x="50%" y="56%" fill="#55667a" font-family="monospace" font-size="20" text-anchor="middle">run: node scripts/fetch-images.mjs</text></svg>');
  const RANKS = [[23500, 'Galactic Legend'], [20000, 'Fleet Admiral'], [15000, 'Commander'], [10000, 'Navigator'], [5000, 'Rookie Pilot'], [0, 'Space Cadet']];

  let selectedBody = null;
  let revealed = false;     // the round has been scored
  let revealing = false;    // the rocket is still in the air
  let pinnedExpand = false;

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtKm(d) { return d >= 100 ? fmt(d) : d.toFixed(1); }
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + name); });
  }
  function rankFor(total) { for (const r of RANKS) if (total >= r[0]) return r[1]; return RANKS[RANKS.length - 1][1]; }

  // Deterministic starfield for the title/results backdrops (box-shadow dots on a 1px element).
  function makeStars() {
    const rand = RNG.mulberry32(42);
    document.querySelectorAll('.stars').forEach(function (el) {
      const dot = document.createElement('i');
      const shadows = [];
      for (let i = 0; i < 170; i++) {
        const x = (rand() * 100).toFixed(2), y = (rand() * 100).toFixed(2);
        const a = (0.2 + rand() * 0.8).toFixed(2);
        const spread = rand() < 0.12 ? 1 : 0;
        shadows.push(x + 'vw ' + y + 'vh 0 ' + spread + 'px rgba(255,255,255,' + a + ')');
      }
      dot.style.boxShadow = shadows.join(',');
      el.appendChild(dot);
    });
  }

  // ---------- picker ----------
  function buildPicker() {
    const picker = $('picker');
    picker.innerHTML = '';
    BODY_GROUPS.forEach(function (groupName) {
      const ids = Object.keys(BODIES).filter(function (id) { return BODIES[id].group === groupName; });
      if (!ids.length) return;
      const g = document.createElement('div');
      g.className = 'group';
      const cap = document.createElement('div');
      cap.className = 'group-name';
      cap.textContent = groupName;
      g.appendChild(cap);
      const row = document.createElement('div');
      row.className = 'group-row';
      ids.forEach(function (id) {
        const b = BODIES[id];
        const btn = document.createElement('button');
        btn.className = 'target';
        btn.dataset.id = id;
        btn.type = 'button';
        btn.title = b.name + (b.map ? '' : ' (whole-body guess)');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.setProperty('--c', b.color);
        if (b.thumb) { const im = document.createElement('img'); im.src = b.thumb; im.alt = ''; dot.appendChild(im); }
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = b.name;
        btn.appendChild(dot); btn.appendChild(label);
        btn.addEventListener('click', function () { if (!revealed) { GameAudio.sfx('select'); selectBody(id); } });
        row.appendChild(btn);
      });
      g.appendChild(row);
      picker.appendChild(g);
    });
  }

  function highlightBody(id) {
    document.querySelectorAll('#picker .target').forEach(function (b) { b.classList.toggle('selected', b.dataset.id === id); });
    const el = document.querySelector('#picker .target.selected');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function selectBody(id) {
    selectedBody = id;
    highlightBody(id);
    const hasMap = GameMap.showBody(id);
    $('map-card').classList.toggle('no-map', !hasMap);
    if (hasMap) {
      $('map-note').textContent = 'Click the map to drop your pin';
      if (DEBUG) GameMap.debugOverlay(id);
    } else {
      $('map-note').textContent = BODIES[id].name + ' — whole-body guess. Hit Guess to lock it in.';
    }
    updateGuessButton();
  }

  function onGuessChange() { GameAudio.sfx('pin'); updateGuessButton(); }

  function updateGuessButton() {
    const btn = $('btn-guess');
    if (revealed) { btn.disabled = true; btn.textContent = 'Guess'; return; }
    if (!selectedBody) { btn.disabled = true; btn.textContent = 'Pick a target'; return; }
    const b = BODIES[selectedBody];
    if (b.map && !GameMap.getGuess()) { btn.disabled = true; btn.textContent = 'Drop a pin on ' + b.name; return; }
    btn.disabled = false;
    btn.textContent = 'Guess';
  }

  // ---------- game flow ----------
  function startGame(mode) {
    GameAudio.start();
    GameAudio.sfx('blip');
    Game.newGame(mode, SEED);
    $('hud-mode').textContent = SEED ? 'Seed ' + SEED : mode === 'daily' ? 'Daily ' + Game.state().date : 'Random';
    showScreen('round');
    loadRound();
  }

  function loadRound() {
    const loc = Game.current();
    FX.cancel();
    revealed = false;
    revealing = false;
    selectedBody = null;
    pinnedExpand = false;
    $('reveal').classList.add('hidden');
    $('hint-text').classList.add('hidden');
    $('btn-hint').disabled = false;
    $('hud-round').textContent = 'Round ' + Game.roundNumber() + ' / ' + Game.ROUNDS;
    $('hud-score').textContent = fmt(Game.state().total) + ' pts';
    const photo = $('photo');
    photo.onerror = function () { photo.onerror = null; photo.src = PLACEHOLDER; };
    photo.src = loc.img;
    highlightBody(null);
    GameMap.reset();
    $('map-card').classList.add('no-map');
    $('map-note').textContent = 'Pick a target above';
    setExpanded(false);
    updateGuessButton();
    const next = Game.state().rounds[Game.state().index + 1];
    if (next) { const im = new Image(); im.src = next.img; }
  }

  function doGuess() {
    if (revealed || $('btn-guess').disabled) return;
    const loc = Game.current();
    const guess = { body: selectedBody, latlon: GameMap.getGuess() };
    const r = Game.submit(guess);
    revealed = true;
    revealing = true;
    updateGuessButton();
    GameAudio.sfx('launch');

    const sameBody = guess.body === loc.body;
    const actualBody = BODIES[loc.body];
    const hasTarget = !!(actualBody.map && loc.lat != null);
    if (hasTarget) {
      if (!sameBody) GameMap.showBody(loc.body);
      $('map-card').classList.remove('no-map');
      $('map-note').textContent = actualBody.name;
    } else {
      GameMap.showBody(null);
      $('map-card').classList.add('no-map');
      $('map-note').textContent = 'It was ' + actualBody.name + '.';
    }
    highlightBody(loc.body);
    setExpanded(true, true);

    // Let the panel finish expanding, then aim the rocket at the real pin positions.
    setTimeout(function () {
      let from = null, to = null;
      if (hasTarget) {
        const pos = GameMap.reveal(loc, sameBody, { deferAnswer: true });
        from = sameBody ? pos.guess : null;
        to = pos.actual;
      }
      FX.playReveal({
        from: from, to: to, outcome: r.outcome, points: r.points,
        mapRect: $('map').getBoundingClientRect(),
        onLand: function () {
          if (hasTarget) GameMap.dropAnswer();
          GameAudio.sfx(r.points > 0 ? 'land' : 'fail', r.points);
          showRevealCard(loc, actualBody, guess, r);
        },
        onDone: function () { revealing = false; }
      });
    }, 320);
  }

  function showRevealCard(loc, actualBody, guess, r) {
    $('reveal-title').textContent = loc.name + ' · ' + actualBody.name;
    let outcome, stamp, stampClass;
    switch (r.outcome) {
      case 'pinned':
        outcome = 'Your pin was ' + fmtKm(r.distanceKm) + ' km away.';
        if (r.points >= 4500) { stamp = 'Bullseye!'; stampClass = 'good'; }
        else if (r.points >= 3000) { stamp = 'Nice shot!'; stampClass = 'good'; }
        else if (r.points >= 1000) { stamp = 'Close-ish'; stampClass = 'meh'; }
        else { stamp = 'Way off'; stampClass = ''; }
        break;
      case 'whole': outcome = 'Correct — that is ' + actualBody.name + '.'; stamp = 'Correct!'; stampClass = 'good'; break;
      case 'sibling': outcome = 'Right system, wrong world. You picked ' + BODIES[guess.body].name + '.'; stamp = 'Neighbor'; stampClass = 'meh'; break;
      case 'nopin': outcome = 'Right world, but you never dropped a pin.'; stamp = 'No pin!'; stampClass = ''; break;
      default: outcome = 'Wrong world. You picked ' + (guess.body ? BODIES[guess.body].name : 'nothing') + '.'; stamp = 'Lost in space'; stampClass = '';
    }
    if (r.hintUsed) outcome += ' Hint used (×' + Score.HINT_FACTOR + ').';
    $('reveal-outcome').textContent = outcome;
    $('reveal-stamp').textContent = stamp;
    $('reveal-stamp').className = 'stamp ' + stampClass;
    $('reveal-fact').textContent = loc.fact || '';
    $('reveal-credit').textContent = 'Image: ' + (loc.credit || 'NASA');
    $('reveal').classList.remove('hidden');
    $('reveal').classList.toggle('good', r.points >= 4000);
    $('reveal').classList.toggle('bad', r.points === 0);
    animateCount($('reveal-points'), r.points);
    $('hud-score').textContent = fmt(Game.state().total) + ' pts';
    $('btn-next').textContent = Game.roundNumber() === Game.ROUNDS ? 'See results' : 'Next round';
    $('btn-next').focus();
  }

  function animateCount(el, target) {
    const start = performance.now(), dur = 900;
    let lastTick = 0;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (target > 0 && now - lastTick > 70 && t < 1) { lastTick = now; GameAudio.sfx('tick'); }
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function doNext() {
    if (!revealed || revealing) return;
    GameAudio.sfx('blip');
    const prevBest = Game.best();
    if (Game.next() === 'results') showResults(prevBest); else loadRound();
  }

  function doHint() {
    if (revealed || $('btn-hint').disabled) return;
    GameAudio.sfx('hint');
    const h = Game.useHint();
    $('hint-text').textContent = h;
    $('hint-text').classList.remove('hidden');
    $('btn-hint').disabled = true;
  }

  function showResults(prevBest) {
    const st = Game.state();
    FX.cancel();
    const tbody = $('results-body');
    tbody.innerHTML = '';
    st.results.forEach(function (r, i) {
      const b = BODIES[r.loc.body];
      let detail;
      if (r.outcome === 'pinned') detail = fmtKm(r.distanceKm) + ' km off';
      else if (r.outcome === 'whole') detail = 'identified';
      else if (r.outcome === 'sibling') detail = 'right system (' + BODIES[r.guessBody].name + ')';
      else if (r.outcome === 'nopin') detail = 'no pin';
      else detail = 'guessed ' + (r.guessBody ? BODIES[r.guessBody].name : 'nothing');
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td><b>' + r.loc.name + '</b><br><span class="muted">' + b.name + '</span></td>' +
        '<td class="muted">' + detail + (r.hintUsed ? ' · hint' : '') + '</td><td class="pts">' + fmt(r.points) + '</td>';
      tbody.appendChild(tr);
    });
    $('results-total').textContent = fmt(st.total);
    $('results-max').textContent = fmt(Game.ROUNDS * Score.MAX);
    $('results-best').textContent = fmt(Game.best());
    $('results-rank').textContent = rankFor(st.total);
    $('results-new').classList.toggle('hidden', !(st.total > 0 && st.total > (prevBest || 0)));
    $('results-mode').textContent = st.seed ? 'Seed ' + st.seed : st.mode === 'daily' ? 'Daily ' + st.date : 'Random game';
    $('btn-copy').textContent = 'Copy results';
    showScreen('results');
    GameAudio.sfx('fanfare', st.total);
  }

  function copyResults() {
    const text = Game.shareText();
    const done = function () { $('btn-copy').textContent = 'Copied!'; GameAudio.sfx('blip'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  // ---------- map panel expand/collapse ----------
  function setExpanded(on, pin) {
    if (pin !== undefined) pinnedExpand = pin;
    const panel = $('guess-panel');
    const was = panel.classList.contains('expanded');
    panel.classList.toggle('expanded', on);
    if (was !== on) setTimeout(function () { GameMap.invalidate(); if (!revealed) GameMap.fit(); }, 260);
  }

  // ---------- audio toggles ----------
  function syncAudioButtons() {
    const on = GameAudio.isEnabled();
    document.querySelectorAll('.btn-audio').forEach(function (b) { b.textContent = on ? '🔊' : '🔇'; b.classList.toggle('off', !on); });
  }

  // ---------- init ----------
  function init() {
    makeStars();
    buildPicker();
    GameMap.init($('map'), { onGuessChange: onGuessChange });
    FX.init();
    $('title-best').textContent = fmt(Game.best());
    syncAudioButtons();

    $('btn-random').addEventListener('click', function () { startGame('random'); });
    $('btn-daily').addEventListener('click', function () { startGame('daily'); });
    $('btn-guess').addEventListener('click', doGuess);
    $('btn-next').addEventListener('click', doNext);
    $('btn-hint').addEventListener('click', doHint);
    $('btn-copy').addEventListener('click', copyResults);
    $('btn-again').addEventListener('click', function () { startGame('random'); });
    $('btn-again-daily').addEventListener('click', function () { startGame('daily'); });
    $('btn-home').addEventListener('click', function () { GameAudio.sfx('blip'); $('title-best').textContent = fmt(Game.best()); showScreen('title'); });
    document.querySelectorAll('.btn-audio').forEach(function (b) {
      b.addEventListener('click', function () { GameAudio.toggle(); syncAudioButtons(); if (GameAudio.isEnabled()) GameAudio.sfx('blip'); });
    });

    const panel = $('guess-panel');
    panel.addEventListener('mouseenter', function () { setExpanded(true); });
    panel.addEventListener('mouseleave', function () { if (!pinnedExpand) setExpanded(false); });
    $('btn-expand').addEventListener('click', function () {
      const on = !panel.classList.contains('expanded');
      setExpanded(on, on);
    });

    document.addEventListener('keydown', function (e) {
      if (!$('screen-round').classList.contains('active')) return;
      if (e.key === 'Enter') { e.preventDefault(); if (revealed) doNext(); else doGuess(); }
      if (e.key === 'h' || e.key === 'H') doHint();
      if (e.key === 'm' || e.key === 'M') { GameAudio.toggle(); syncAudioButtons(); }
    });

    if (DEBUG) document.body.classList.add('debug');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
