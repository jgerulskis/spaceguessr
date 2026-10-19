// Reveal animation (Three.js, classic script build): a tin-toy rocket launches from
// your pin, arcs over the map and lands on the answer with a starburst. Full-screen
// transparent canvas in screen pixels (orthographic camera), so Leaflet pin
// positions can be used directly. Skipped with ?fx=0, prefers-reduced-motion,
// or when WebGL is unavailable — the game then reveals instantly.
window.FX = (function () {
  const PALETTE = [0xf2c14e, 0xef7d57, 0x2fb8a6, 0xf6ecd4, 0xe3485b];
  const skip = new URLSearchParams(location.search).get('fx') === '0' ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let ok = false, renderer, scene, camera, canvas, W = 1, H = 1;
  let rocket, flames, trail, burst, ring, anim = null, raf = 0, lastT = 0;

  function init() {
    if (skip || !window.THREE) return false;
    try {
      canvas = document.createElement('canvas');
      canvas.id = 'fx';
      document.body.appendChild(canvas);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
    } catch (e) {
      if (canvas) canvas.remove();
      return false;
    }
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.2); key.position.set(-0.6, 1, 1.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7cc4ff, 0.7); rim.position.set(1, -0.4, 0.6); scene.add(rim);
    rocket = buildRocket(); rocket.visible = false; scene.add(rocket);
    trail = makeParticles(160, 7); scene.add(trail.points);
    burst = makeParticles(120, 6); scene.add(burst.points);
    ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 56),
      new THREE.MeshBasicMaterial({ color: 0xf6ecd4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.visible = false; ring.userData.t = 0; scene.add(ring);
    resize();
    window.addEventListener('resize', resize);
    canvas.style.display = 'none';
    ok = true;
    return true;
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
    camera.updateProjectionMatrix();
  }

  // ---- the rocket: 1950s tin-toy shape from primitives, nose along +Y ----
  function buildRocket() {
    const g = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xf6ecd4, metalness: 0.4, roughness: 0.32 });
    const red = new THREE.MeshStandardMaterial({ color: 0xe3485b, metalness: 0.3, roughness: 0.4 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x2fb8a6, emissive: 0x2fb8a6, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 });
    const profile = [[0.30, -1.0], [0.42, -0.6], [0.5, -0.1], [0.46, 0.35], [0.3, 0.75], [0.12, 0.95], [0.0, 1.0]]
      .map(function (p) { return new THREE.Vector2(p[0] * 20, p[1] * 28); });
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), cream));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(6.2, 11, 24), red); nose.position.y = 24.5; g.add(nose);
    const band = new THREE.Mesh(new THREE.TorusGeometry(9.7, 1.5, 8, 36), red); band.rotation.x = Math.PI / 2; band.position.y = 3; g.add(band);
    const port = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), teal); port.position.set(0, 9, 8.6); g.add(port);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.9, 8, 24), cream); rimRing.position.set(0, 9, 9.4); g.add(rimRing);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.lineTo(13, -13); finShape.lineTo(13, -22); finShape.lineTo(0, -17); finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 1.8, bevelEnabled: false });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + Math.PI / 2;
      const fin = new THREE.Mesh(finGeo, red);
      fin.position.set(Math.cos(a) * 5, -5, Math.sin(a) * 5);
      fin.rotation.y = -a;
      g.add(fin);
    }
    const flameMat = function (c, o) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); };
    const outer = new THREE.Mesh(new THREE.ConeGeometry(5.5, 24, 16), flameMat(0xff9a3c, 0.85)); outer.rotation.x = Math.PI; outer.position.y = -39; g.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(2.6, 15, 12), flameMat(0xffffff, 0.9)); inner.rotation.x = Math.PI; inner.position.y = -35; g.add(inner);
    flames = [outer, inner];
    return g;
  }

  // ---- particles: round, per-particle alpha (premultiplied additive) so faded
  // ones never leave opaque squares on the transparent canvas ----
  function makeParticles(n, size) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), alp = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { size: { value: size * renderer.getPixelRatio() } },
      vertexShader: 'attribute float alpha; uniform float size; varying vec3 vC; varying float vA;' +
        'void main(){ vC = color; vA = alpha; gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vC; varying float vA;' +
        'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(vC * a, a); }',
      vertexColors: true, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    const p = [];
    for (let i = 0; i < n; i++) { p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: new THREE.Color() }); pos[i * 3 + 2] = -3; }
    return { points: points, geo: geo, pos: pos, col: col, alp: alp, p: p, n: n, next: 0 };
  }
  function emit(sys, x, y, vx, vy, life, color) {
    const q = sys.p[sys.next]; sys.next = (sys.next + 1) % sys.n;
    q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = life; q.max = life; q.c.setHex(color);
  }
  function stepParticles(sys, dt, gravity, drag) {
    let alive = false;
    for (let i = 0; i < sys.n; i++) {
      const q = sys.p[i], k3 = i * 3;
      if (q.life <= 0) { sys.alp[i] = 0; continue; }
      alive = true;
      q.life -= dt; q.vy += gravity * dt; q.vx *= drag; q.vy *= drag;
      q.x += q.vx * dt; q.y += q.vy * dt;
      sys.pos[k3] = q.x; sys.pos[k3 + 1] = -q.y;
      sys.col[k3] = q.c.r; sys.col[k3 + 1] = q.c.g; sys.col[k3 + 2] = q.c.b;
      sys.alp[i] = Math.max(0, q.life / q.max);
    }
    sys.geo.attributes.position.needsUpdate = true;
    sys.geo.attributes.color.needsUpdate = true;
    sys.geo.attributes.alpha.needsUpdate = true;
    return alive;
  }
  function clearParticles(sys) { sys.p.forEach(function (q) { q.life = 0; }); }

  function doBurst(pt, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 340;
      emit(burst, pt.x, pt.y, Math.cos(a) * s, Math.sin(a) * s - 60, 0.5 + Math.random() * 0.6, PALETTE[i % PALETTE.length]);
    }
    ring.position.set(pt.x, -pt.y, 2); ring.visible = true; ring.userData.t = 0;
  }

  function bez(a, c, b, t) {
    const s = 1 - t;
    return { x: s * s * a.x + 2 * s * t * c.x + t * t * b.x, y: s * s * a.y + 2 * s * t * c.y + t * t * b.y };
  }

  // o: { from:{x,y}|null, to:{x,y}|null, outcome, points, mapRect, onLand, onDone }
  function playReveal(o) {
    if (!ok) { if (o.onLand) o.onLand(); if (o.onDone) o.onDone(); return; }
    cancel();
    let from = o.from, to = o.to, kind;
    const wrong = o.outcome === 'wrong' || o.outcome === 'nopin';
    if (to) {
      kind = 'land';
      if (!from) from = { x: Math.max(60, (o.mapRect ? o.mapRect.left : W * 0.5) - 180), y: Math.max(80, to.y - 160) };
    } else if (o.outcome === 'whole' || o.outcome === 'sibling') {
      kind = 'land'; from = { x: -80, y: H * 0.6 }; to = { x: W * 0.32, y: H * 0.4 };
    } else {
      kind = 'flyby'; from = { x: -80, y: H * 0.5 }; to = { x: W + 120, y: H * 0.22 };
    }
    const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist, side = ny < 0 ? 1 : -1;      // bulge upward on screen
    const bulge = Math.min(260, 0.45 * dist + 70);
    const ctrl = { x: (from.x + to.x) / 2 + nx * side * bulge, y: (from.y + to.y) / 2 + ny * side * bulge };
    const dur = kind === 'flyby' ? 1.7 : Math.min(1.9, Math.max(1.0, dist / 480));
    anim = { kind: kind, from: from, ctrl: ctrl, to: to, dur: dur, t: 0, landed: false, done: false, landT: 0, roll: 0,
      wrong: wrong, good: o.points > 0, big: o.points >= 4000, landAt: kind === 'flyby' ? 0.58 : 1,
      onLand: o.onLand, onDone: o.onDone };
    rocket.visible = true;
    canvas.style.display = 'block';
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    let active = false;
    if (anim && !anim.done) {
      active = true;
      const a = anim;
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const p = bez(a.from, a.ctrl, a.to, e), q = bez(a.from, a.ctrl, a.to, Math.min(1, e + 0.01));
      const ddx = q.x - p.x, ddy = q.y - p.y, dl = Math.hypot(ddx, ddy) || 1, ux = ddx / dl, uy = ddy / dl;
      const heading = Math.atan2(-uy, ux) - Math.PI / 2;
      const hop = Math.sin(Math.PI * u);
      const settle = (a.kind === 'land' && u > 0.86) ? Math.max(0.06, 1 - (u - 0.86) / 0.14) : 1;
      rocket.position.set(p.x, -p.y, 0);
      rocket.scale.setScalar((0.85 + 0.6 * hop) * settle);
      a.roll += dt * (a.wrong ? 9 : 2.4);
      rocket.rotation.set(0, a.roll, heading + (a.wrong ? Math.sin(a.t * 7) * 0.9 : 0), 'ZYX');
      const sputter = a.wrong && Math.sin(a.t * 23) > 0.4;
      const fl = sputter ? 0.12 : 0.8 + Math.random() * 0.5;
      flames[0].scale.set(fl, fl * (1 + hop * 0.7), fl);
      flames[1].scale.set(fl, fl, fl);
      if (u < 0.97 && !sputter) {
        for (let i = 0; i < 3; i++) {
          emit(trail, p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6,
            -ux * (90 + Math.random() * 80) + (Math.random() - 0.5) * 60, -uy * (90 + Math.random() * 80) + (Math.random() - 0.5) * 60 + 25,
            0.3 + Math.random() * 0.45, a.wrong ? 0x9a9a9a : (Math.random() < 0.5 ? 0xf2c14e : 0xef7d57));
        }
      }
      if (u >= a.landAt && !a.landed) {
        a.landed = true;
        if (a.kind === 'land') { rocket.visible = false; if (!a.wrong) doBurst(a.to, a.big ? 120 : 50); }
        if (a.onLand) a.onLand();
      }
      if (u >= 1) rocket.visible = false;
      if (a.landed) { a.landT += dt; if (a.landT > (a.kind === 'flyby' ? 1.0 : 0.8)) { a.done = true; rocket.visible = false; if (a.onDone) a.onDone(); } }
    }
    const t1 = stepParticles(trail, dt, 70, 0.96), t2 = stepParticles(burst, dt, 320, 0.985);
    if (ring.visible) {
      ring.userData.t += dt;
      const k = ring.userData.t / 0.6;
      if (k >= 1) ring.visible = false; else { const s = 8 + 100 * k; ring.scale.set(s, s, 1); ring.material.opacity = 0.9 * (1 - k); }
    }
    renderer.render(scene, camera);
    if (active || t1 || t2 || ring.visible) raf = requestAnimationFrame(frame);
    else { canvas.style.display = 'none'; raf = 0; }
  }

  function cancel() {
    anim = null;
    if (!ok) return;
    rocket.visible = false; ring.visible = false;
    clearParticles(trail); clearParticles(burst);
    cancelAnimationFrame(raf); raf = 0;
    renderer.clear();
    canvas.style.display = 'none';
  }

  return { init: init, playReveal: playReveal, cancel: cancel, enabled: function () { return ok; } };
})();
