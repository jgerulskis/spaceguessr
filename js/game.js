// Game state machine: newGame -> (current, submit, next)* -> results.
window.Game = (function () {
  const ROUNDS = 5;
  const MAX_PER_BODY = 2;
  const BEST_KEY = 'spaceguessr.best';
  let state = null;

  function pickRounds(rand) {
    const pool = RNG.shuffle(LOCATIONS.slice(), rand);
    const picked = [], perBody = {};
    for (const loc of pool) {
      if ((perBody[loc.body] || 0) >= MAX_PER_BODY) continue;
      picked.push(loc);
      perBody[loc.body] = (perBody[loc.body] || 0) + 1;
      if (picked.length === ROUNDS) break;
    }
    return picked;
  }

  // seedOverride (from ?seed=...) makes any game reproducible/shareable.
  function newGame(mode, seedOverride) {
    const date = RNG.todayISO();
    const seedStr = seedOverride ? 'seed:' + seedOverride
      : mode === 'daily' ? 'daily:' + date
      : 'random:' + Date.now() + ':' + Math.random();
    const rand = RNG.mulberry32(RNG.hash(seedStr));
    state = { mode, date, seed: seedOverride || null, rounds: pickRounds(rand), index: 0, results: [], total: 0, hintUsed: false };
    return state;
  }

  function current() { return state.rounds[state.index]; }
  function roundNumber() { return state.index + 1; }
  function useHint() { state.hintUsed = true; return current().hint; }

  function submit(guess) {
    const loc = current();
    const r = Score.scoreFor({ guessBody: guess.body, guessLatLon: guess.latlon, loc, hintUsed: state.hintUsed });
    const result = Object.assign({ loc, guessBody: guess.body, guessLatLon: guess.latlon, hintUsed: state.hintUsed }, r);
    state.results.push(result);
    state.total += r.points;
    return result;
  }

  function next() {
    state.index++;
    state.hintUsed = false;
    if (state.index >= state.rounds.length) { recordBest(); return 'results'; }
    return 'round';
  }

  function best() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }
  function recordBest() {
    try { if (state.total > best()) localStorage.setItem(BEST_KEY, String(state.total)); } catch (e) { /* private mode */ }
  }

  function fmt(n) { return n.toLocaleString('en-US'); }

  function shareText() {
    const head = 'SpaceGuessr · ' + (state.seed ? 'Seed ' + state.seed : state.mode === 'daily' ? 'Daily ' + state.date : 'Random') +
      ' · ' + fmt(state.total) + ' / ' + fmt(ROUNDS * Score.MAX);
    const lines = state.results.map(function (r, i) {
      const b = BODIES[r.loc.body];
      let mid;
      if (r.outcome === 'pinned') mid = r.loc.name + ' · ' + fmt(Math.round(r.distanceKm)) + ' km';
      else if (r.outcome === 'whole') mid = '✔ ' + r.loc.name;
      else if (r.outcome === 'sibling') mid = r.loc.name + ' · right system, wrong moon';
      else if (r.outcome === 'nopin') mid = r.loc.name + ' · no pin';
      else mid = r.loc.name + ' · ✘ guessed ' + (r.guessBody ? BODIES[r.guessBody].name : 'nothing');
      return (i + 1) + '. ' + (b.emoji || '') + ' ' + b.name + ' · ' + mid + ' · ' + fmt(r.points);
    });
    return [head].concat(lines).join('\n');
  }

  return { ROUNDS, newGame, current, roundNumber, useHint, submit, next, best, shareText, state: function () { return state; } };
})();
