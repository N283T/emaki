// ============================================================================
// What every chapter of Inside ECFP4 shares: the film's tempo, the molecule,
// its identifiers and the small drawings made from them. No DOM access, so the
// page can load it in <head>; that is also how a sub-composition opened on its
// own in Studio gets it. Everything hangs off one global, `emaki`.
// ============================================================================
window.emaki = window.emaki || (() => {
  const STORY_END = 99.4;
  // real time → story time: the intro cuts straight to the molecule, the unfolded scene runs slower
  // tempo per scene (story seconds per real second); the intro jumps straight to the molecule
  const PLAN = [
    { s0: 0, s1: 2.3, rate: 2.2 },       // title card, about a second
    { s0: 10.0, s1: 14.2, rate: 2.5 },   // molecule draws in
    { s0: 14.2, s1: 30.9, rate: 1.1 },   // atom invariants
    { s0: 30.9, s1: 50.9, rate: 0.95 },
    { s0: 50.9, s1: 53.7, rate: 3.0 },   // skip the empty beat before radius 2
    { s0: 53.7, s1: 64.8, rate: 0.95 },  // radius 1 and 2
    { s0: 64.8, s1: 66.2, rate: 1.1 },
    { s0: 66.2, s1: 71.2, rate: 1.25 },  // unfolded cards
    { s0: 71.2, s1: 76.0, rate: 1.1 },   // folding
    { s0: 76.0, s1: 79.0, rate: 4.0 },   // (nothing happens here any more)
    { s0: 79.0, s1: 86.4, rate: 1.1 },   // collision, bit vector
    { s0: 86.4, s1: 96.0, rate: 1.0 },   // Tanimoto
    { s0: 96.0, s1: STORY_END, rate: 1.3 },
  ];
  let _r = 0;
  const SEGS = PLAN.map((p) => { const g = { r0: _r, s0: p.s0, rate: p.rate }; _r += (p.s1 - p.s0) / p.rate; return g; });
  const T_END = _r;
  const story = (r) => { let g = SEGS[0]; for (const x of SEGS) if (r >= x.r0) g = x; return g.s0 + (r - g.r0) * g.rate; };
  const real = (s) => { let g = SEGS[0]; for (const x of SEGS) if (s >= x.s0) g = x; return g.r0 + (s - g.s0) / g.rate; };

  // ---------- the molecule (world coordinates) ----------
  const ATOMS = [
    { el: "C", text: "CH₃", x: 660, y: 600, dir: 1 },
    { el: "C", text: "C", x: 860, y: 480, dir: 1 },
    { el: "O", text: "O", x: 860, y: 268, dir: -1 },
    { el: "N", text: "NH", x: 1060, y: 600, dir: 1 },
    { el: "C", text: "CH₃", x: 1260, y: 480, dir: 1 },
  ];
  const BONDS = [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1]];
  function dist(c) {
    const d = ATOMS.map(() => Infinity); d[c] = 0; const q = [c];
    while (q.length) { const u = q.shift(); for (const [i, j] of BONDS) for (const [x, y] of [[i, j], [j, i]]) if (x === u && d[y] > d[u] + 1) { d[y] = d[u] + 1; q.push(y); } }
    return d;
  }
  function env(c, r) {
    const d = dist(c);
    const bonds = new Set(BONDS.map((b, n) => (Math.min(d[b[0]], d[b[1]]) < r ? n : -1)).filter((n) => n >= 0));
    const atoms = new Set([c]); for (const n of bonds) { atoms.add(BONDS[n][0]); atoms.add(BONDS[n][1]); }
    return { atoms, bonds };
  }

  // ---------- identifiers ----------
  const COL = { a: "#8b5cf6", b: "#3b82f6", c: "#f97316", d: "#10b981", e: "#ec4899", f: "#6366f1",
    g: "#f59e0b", h: "#22c55e", i: "#e11d48", j: "#a855f7", k: "#06b6d4", l: "#64748b", m: "#64748b", n: "#64748b", o: "#64748b" };
  // real RDKit Morgan identifiers for CC(=O)NC, radius 2 (rdFingerprintGenerator, RDKit 2026.03)
  const IDS = { a: 2246728737, b: 2246699815, c: 864942730, d: 847961216, e: 3545365497, f: 411967733,
    g: 1510328189, h: 828793177, i: 3824063894, j: 88780136 };
  const ID = (k) => IDS[k];
  const BIT = Object.fromEntries(Object.entries(IDS).map(([k, v]) => [k, v % 16]));
  const fmt = (n) => n.toLocaleString("en-US");
  const KEYS = "abcdefghij".split("");
  const ENVK = { a: [0, 0], b: [1, 0], c: [2, 0], d: [3, 0], e: [0, 1], f: [1, 1], g: [2, 1], h: [3, 1], i: [4, 1], j: [3, 2] };
  const BITSTR = Array.from({ length: 16 }, (_, b) => (KEYS.some((k) => BIT[k] === b) ? 1 : 0));

  // ---------- drawings ----------
  const chipHTML = (k, extra = "") => `<div class="chip ${extra}" style="background:linear-gradient(160deg, ${COL[k]}, ${shade(COL[k])});--glow:${COL[k]}88">${k}</div>`;
  function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.62); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  function miniSVG(key) {
    const [c, r] = ENVK[key], e = env(c, r);
    // crop to the environment plus one shell of faded context, like RDKit's DrawMorganBit
    const d = dist(c), show = new Set(ATOMS.map((_, n) => n).filter((n) => d[n] <= r + 1));
    const xs = [...show].map((n) => ATOMS[n].x), ys = [...show].map((n) => ATOMS[n].y);
    let x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70, y0 = Math.min(...ys) - 70, y1 = Math.max(...ys) + 70;
    const wantW = Math.max(x1 - x0, (y1 - y0) * 1.3), wantH = wantW / 1.3;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let out = `<svg viewBox="${cx - wantW / 2} ${cy - wantH / 2} ${wantW} ${wantH}">`;
    BONDS.forEach(([i, j, o], n) => {
      if (!show.has(i) || !show.has(j)) return;
      const A = ATOMS[i], B = ATOMS[j], on = e.bonds.has(n);
      if (on) out += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#ffb547" stroke-opacity=".5" stroke-width="44" stroke-linecap="round"/>`;
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      for (const off of o === 2 ? [-10, 10] : [0]) {
        const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
        out += `<line x1="${A.x + nx}" y1="${A.y + ny}" x2="${B.x + nx}" y2="${B.y + ny}" stroke="${on ? "#eef1f7" : "#34405e"}" stroke-width="${on ? 10 : 7}" stroke-linecap="round" ${on ? "" : 'stroke-dasharray="14 14"'}/>`;
      }
    });
    ATOMS.forEach((a, n) => {
      if (!show.has(n)) return;
      const centre = n === c, on = e.atoms.has(n);
      const fill = centre ? "#1d3b66" : on ? "#3a2c12" : "#10182b", stroke = centre ? "#4dabf7" : on ? "#ffb547" : "#26304a";
      const col = !on ? "#3a4560" : a.el === "O" ? "#ff7b7b" : a.el === "N" ? "#6cbcff" : "#eef1f7";
      out += `<circle cx="${a.x}" cy="${a.y}" r="46" fill="${fill}" stroke="${stroke}" stroke-width="${centre ? 9 : 6}"/>`;
      out += `<text x="${a.x}" y="${a.y + 3}" text-anchor="middle" dominant-baseline="central" font-family="Inter" font-weight="800" font-size="${a.text.length > 1 ? 40 : 50}" fill="${col}">${a.text}</text>`;
    });
    return out + "</svg>";
  }

  return { STORY_END, PLAN, T_END, story, real, ATOMS, BONDS, dist, env, COL, IDS, ID, BIT, fmt, KEYS, ENVK, BITSTR, chipHTML, shade, miniSVG };
})();
