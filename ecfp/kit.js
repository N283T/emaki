// ============================================================================
// What every chapter of the ECFP4 film shares: the film's tempo, the molecule,
// its identifiers, the small drawings made from them and the helpers a chapter
// is built with. Nothing touches the DOM while it loads, so the page can load
// it in <head>; that is also how a sub-composition opened on its
// own in Studio gets it. Everything hangs off one global, `emaki`.
// ============================================================================
window.emaki = window.emaki || (() => {
  const STORY_END = 136.4;
  // The storyboard is written in story seconds; PLAN says how fast each stretch of it plays
  // (story seconds per second of film). To change the pacing, edit the rates here and run
  // `node sync-clips.mjs`, which moves the clips in index.html to match. The story skips 2.3 → 10.
  const PLAN = [
    { s0: 0, s1: 2.3, rate: 1.4 },       // title card
    { s0: 10.0, s1: 14.2, rate: 2.0 },   // molecule draws in
    { s0: 14.2, s1: 30.9, rate: 0.95 },  // radius 0
    { s0: 30.9, s1: 50.9, rate: 0.85 },  // radius 1
    { s0: 50.9, s1: 53.7, rate: 3.0 },   // skip the empty beat before radius 2
    { s0: 53.7, s1: 64.8, rate: 0.85 },  // radius 2
    { s0: 64.8, s1: 66.2, rate: 0.95 },
    { s0: 66.2, s1: 71.2, rate: 1.05 },  // unfolded cards
    { s0: 71.2, s1: 76.0, rate: 0.95 },  // folding
    { s0: 76.0, s1: 79.0, rate: 4.0 },   // skip: the chips have landed, nothing moves
    { s0: 79.0, s1: 86.4, rate: 0.95 },  // collision, bit vector
    { s0: 86.4, s1: 96.0, rate: 0.9 },   // Tanimoto
    { s0: 96.0, s1: 103.0, rate: 1.0 },  // the four fingerprints of the series
    { s0: 103.0, s1: 133.0, rate: 1.0 }, // paracetamol
    { s0: 133.0, s1: STORY_END, rate: 1.0 },
  ];
  // the chapters, as [composition id, first story second, last]. The similarity and the drug chapter
  // each run 0.6 s past the start of the next one, over which they fade out.
  const CHAPTERS = [["intro", 0, 14.2], ["radius0", 14.2, 30.9], ["radius1", 30.9, 51.6], ["radius2", 51.6, 64.8], ["unfolded", 64.8, 71.2],
    ["folding", 71.2, 86.4], ["similarity", 86.4, 103.6], ["drug", 103.0, 133.6], ["outro", 133.0, STORY_END]];
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
  // graph distances from atom c, and its environment out to radius r, in a molecule given as atoms and bonds
  function distIn(c, atoms, bonds) {
    const d = atoms.map(() => Infinity); d[c] = 0; const q = [c];
    while (q.length) { const u = q.shift(); for (const [i, j] of bonds) for (const [x, y] of [[i, j], [j, i]]) if (x === u && d[y] > d[u] + 1) { d[y] = d[u] + 1; q.push(y); } }
    return d;
  }
  function envIn(c, r, all, links) {
    const d = distIn(c, all, links);
    const bonds = new Set(links.map((b, n) => (Math.min(d[b[0]], d[b[1]]) < r ? n : -1)).filter((n) => n >= 0));
    const atoms = new Set([c]); for (const n of bonds) { atoms.add(links[n][0]); atoms.add(links[n][1]); }
    return { atoms, bonds };
  }
  // the same in the film's own molecule
  const dist = (c) => distIn(c, ATOMS, BONDS), env = (c, r) => envIn(c, r, ATOMS, BONDS);

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

  // ---------- the second molecule and the comparison ----------
  // N-ethylacetamide, CC(=O)NCC: real RDKit ECFP4 folded to 16 bits
  const BVEC = Array.from({ length: 16 }, (_, b) => ([0, 1, 5, 6, 7, 8, 9, 10, 11, 13, 14].includes(b) ? 1 : 0));
  const ACCIDENT = [6, 8]; // on in both, but from different substructures
  const INTER = [...Array(16).keys()].filter((b) => BITSTR[b] && BVEC[b]);
  const ONLY = [...Array(16).keys()].filter((b) => (BITSTR[b] || BVEC[b]) && !(BITSTR[b] && BVEC[b]));
  const UNION = [...Array(16).keys()].filter((b) => BITSTR[b] || BVEC[b]);
  const ATOMS_B = [...ATOMS.slice(0, 4), { ...ATOMS[4], text: "CH₂" }, { el: "C", text: "CH₃", x: 1460, y: 600 }];
  const BONDS_B = [...BONDS, [4, 5, 1]];
  function molSVG(atoms, bonds, h = 150) {
    const xs = atoms.map((a) => a.x), ys = atoms.map((a) => a.y);
    const x0 = Math.min(...xs) - 60, y0 = Math.min(...ys) - 60, w = Math.max(...xs) - x0 + 60, hh = Math.max(...ys) - y0 + 60;
    let o = `<svg viewBox="${x0} ${y0} ${w} ${hh}" height="${h}" width="${(h * w) / hh}">`;
    for (const [i, j, ord] of bonds) {
      const A = atoms[i], B = atoms[j], L = Math.hypot(B.x - A.x, B.y - A.y);
      for (const off of ord === 2 ? [-10, 10] : [0]) { const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
        o += `<line x1="${A.x + nx}" y1="${A.y + ny}" x2="${B.x + nx}" y2="${B.y + ny}" stroke="#c8d0e0" stroke-width="10" stroke-linecap="round"/>`; }
    }
    for (const a of atoms) o += `<circle cx="${a.x}" cy="${a.y}" r="50" fill="#121a2d" stroke="#3a4a74" stroke-width="5"/><text x="${a.x}" y="${a.y + 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter" font-weight="800" font-size="${a.text.length > 1 ? 38 : 46}" fill="${a.el === "O" ? "#ff7b7b" : a.el === "N" ? "#6cbcff" : "#eef1f7"}">${a.text}</text>`;
    return o + "</svg>";
  }

  // ---------- a real drug, and the series ----------
  // paracetamol, CC(=O)Nc1ccc(O)cc1: its atoms in RDKit's 2D coordinates, and every environment that ECFP4 keeps
  // as [atom, radius, identifier] (rdFingerprintGenerator, RDKit 2026.03)
  const PARACETAMOL = {
    atoms: [
      { el: "C", text: "CH₃", x: 302.1, y: 583.2, dir: 1 },
      { el: "C", text: "C", x: 527.3, y: 522.9, dir: 1 },
      { el: "O", text: "O", x: 587.7, y: 297.6, dir: 1 },
      { el: "N", text: "NH", x: 692.3, y: 687.8, dir: 1 },
      { el: "C", text: "C", x: 917.6, y: 627.4, dir: 1 },
      { el: "C", text: "CH", x: 977.9, y: 402.1, dir: 1 },
      { el: "C", text: "CH", x: 1203.2, y: 341.8, dir: 1 },
      { el: "C", text: "C", x: 1368.2, y: 506.7, dir: 1 },
      { el: "O", text: "OH", x: 1593.4, y: 446.3, dir: 1 },
      { el: "C", text: "CH", x: 1307.8, y: 732.0, dir: 1 },
      { el: "C", text: "CH", x: 1082.5, y: 792.3, dir: 1 },
    ],
    bonds: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 2], [6, 7, 1], [7, 8, 1], [7, 9, 2], [9, 10, 1], [10, 4, 2]],
    envs: [[0, 0, 2246728737], [1, 0, 2246699815], [2, 0, 864942730], [3, 0, 847961216], [4, 0, 3217380708], [5, 0, 3218693969], [6, 0, 3218693969], [7, 0, 3217380708], [8, 0, 864662311], [9, 0, 3218693969], [10, 0, 3218693969], [0, 1, 3545365497], [1, 1, 411967733], [2, 1, 1510328189], [3, 1, 1790668568], [4, 1, 3918336191], [5, 1, 951226070], [6, 1, 951226070], [7, 1, 2905660137], [8, 1, 26234434], [9, 1, 951226070], [10, 1, 951226070], [1, 2, 43357009], [3, 2, 2734098962], [4, 2, 353395765], [5, 2, 2560252747], [6, 2, 2629723425], [7, 2, 859799282], [9, 2, 2629723425], [10, 2, 2560252747]],
  };
  // the same two molecules, A and B, under the four fingerprints of the series, all at 2048 bits:
  // [bits on in both, bits on in either]
  const BOARD = { "ECFP4": [7, 17], "Atom Pair": [6, 19], "Topological Torsion": [0, 5], "RDKit": [22, 28] };

  // ---------- shared numbers ----------
  // camera views: the world point at the centre of the frame, and the zoom
  const VIEW = { wide: { cx: 960, cy: 430, s: 1 }, methyl: { cx: 1066, cy: 470, s: 1.55 }, carbonyl: { cx: 1000, cy: 380, s: 1.3 },
    high: { cx: 960, cy: 330, s: 0.8 }, corner: { cx: 233, cy: 900, s: 0.55 } };
  const BACK = "back.out(1.9)", AMBER = "#ffb547", RED = "#ff5d5d";
  // a repeatable stand-in for Math.random
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // 0 → 1 → 0 between a and b, for things drawn from the time itself
  const fade = (t, a, b, fi = 0.4, fo = 0.4) => { const P = (x, u, v) => Math.min(1, Math.max(0, (x - u) / (v - u))), out = (x) => 1 - Math.pow(1 - x, 3);
    return Math.min(out(P(t, a, a + fi)), 1 - out(P(t, b - fo, b))); };

  // ---------- building a chapter ----------
  // A chapter is a sub-composition (compositions/<name>.html). chapter("folding", 71.2) gives its
  // script what it builds the picture and the timeline with. Every time passed to at / from / to /
  // show / wave / caption is in story seconds, the storyboard's clock (PLAN above).
  function chapter(id, S0) {
    // by composition id: once mounted in the film, the chapter's root is the host's clip element
    const root = document.querySelector(`[data-composition-id="${id}"]`);
    const q = (s) => root.querySelector(s);
    const svg = (tag, attrs, parent) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    const div = (parent, cls, html = "") => { const e = document.createElement("div"); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
    // .p boxes sit at (x, y), centred on that point
    const put = (el, x, y, more = {}) => gsap.set(el, { xPercent: -50, yPercent: -50, x, y, ...more });
    const at = (s) => real(s) - real(S0); // story seconds → seconds inside this clip
    const tl = gsap.timeline({ paused: true });
    const from = (el, s0, s1, a, b, ease = "none") => tl.fromTo(el, a, { ...b, duration: at(s1) - at(s0), ease }, at(s0));
    const to = (el, s0, s1, b, ease = "none") => tl.to(el, { ...b, duration: at(s1) - at(s0), ease }, at(s0));
    // appear at s0, disappear by s1
    const show = (el, s0, s1, o = 1, fi = 0.35, fo = 0.35) => { from(el, s0, s0 + fi, { opacity: 0 }, { opacity: o }, "power2.out"); to(el, s1 - fo, s1, { opacity: 0 }, "power2.out"); };
    // an oscillation between s0 and s1 as keyframes: valueAt(j, s) gives the j-th key, `step` story seconds apart
    const wave = (el, prop, s0, s1, step, rest, valueAt) => {
      const keys = { "0%": { [prop]: rest }, "100%": { [prop]: rest }, easeEach: "sine.inOut" };
      for (let j = 1, s = s0 + step; s < s1 - step / 2; j++, s += step) keys[`${(((s - s0) / (s1 - s0)) * 100).toFixed(3)}%`] = { [prop]: valueAt(j, s) };
      to(el, s0, s1, { keyframes: keys });
    };
    // a caption (.cap in style.css): the words rise in one after another and leave together.
    // [a] in the text becomes the chip of that identifier.
    const caption = (layer, s0, s1, { tag, title, sub, alert, hero }) => {
      const el = div(layer, "cap" + (alert ? " alert" : hero ? " hero" : ""));
      const chips = (text) => text.replace(/\[([a-k])\]/g, (_, key) => `<span class="k" style="background:${COL[key]}">${key}</span>`);
      const words = (text) => chips(text).split(/(?<=\s)(?![^<]*>)/).map((w) => `<span class="w">${w}</span>`).join("");
      if (tag) show(div(el, "tag", tag), s0, s1, 1, 0.4, 0.45);
      div(el, "title", words(title)); div(el, "sub", words(sub));
      el.querySelectorAll(".w").forEach((w, n) => {
        from(w, s0 + n * 0.045, s0 + n * 0.045 + 0.5, { opacity: 0, y: 26 }, { opacity: 1, y: 0 }, "power2.out");
        to(w, s1 - 0.45, s1, { opacity: 0, y: -10 }, "power2.out");
      });
      if (alert) wave(el, "x", s0, s0 + 0.6, Math.PI / 60, 0, (j, t) => (j % 2 ? 6 : -6) * (1 - (t - s0) / 0.6));
    };

    // ----- actors: boxes on the screen that travel -----
    // an actor is a .p box whose content sits in a child, so the content can arc and swell while the box travels
    const actor = (layer, html, x, y, more = {}) => { const el = div(layer, "p", `<div>${html}</div>`); put(el, x, y, more); return el; };
    const fly = (el, s0, s1, dest, { arc = 0, bulge = 1, ease = "power2.inOut" } = {}) => {
      const mid = (s0 + s1) / 2;
      to(el, s0, s1, dest, ease);
      to(el.firstChild, s0, mid, { y: -arc, scale: bulge }, "sine.out"); to(el.firstChild, mid, s1, { y: 0, scale: 1 }, "sine.in");
    };
    const chip = (parent, key, { grey = false, size = 1, hidden = false } = {}) => {
      const el = div(parent, "p", chipHTML(key, grey ? "grey" : "")); put(el, 0, 0, { scale: size, opacity: hidden ? 0 : 1 }); return el;
    };
    // the spinning hexagon that stands for the hash function, on screen from s0 to s1
    let hashes = 0;
    const hashIcon = (layer, x, y, s0, s1) => {
      const g = `${id}-hash${hashes++}`;
      const el = div(layer, "p", `<div class="hash"><svg viewBox="0 0 150 150"><defs><linearGradient id="${g}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4dabf7"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>
        <polygon points="75,8 133,41 133,109 75,142 17,109 17,41" fill="#0f1830" stroke="url(#${g})" stroke-width="5"/></svg><span>hash</span></div>`);
      put(el, x, y, { scale: 0, opacity: 0 });
      to(el, s0, s0 + 0.3, { scale: 1, opacity: 1 }, "power2.out"); to(el, s1 - 0.3, s1, { scale: 0, opacity: 0 }, "power2.out");
      from(el.querySelector("svg"), s0, s1, { rotation: s0 * 90 }, { rotation: s1 * 90 });
      wave(el.firstChild, "scale", s0, s1, Math.PI / 18, 1, (j) => 1 + (j % 2 ? 0.08 : -0.08));
    };
    // the row of collected features along the bottom; the first `have` are already there
    const tray = (layer, have = 0) => {
      const xy = (i) => [960 + (i - 4.5) * 80, 1000];
      const lbl = div(layer, "p traylbl", "FEATURES"); put(lbl, 960 - 4.5 * 80 - 150, 1000, { opacity: have ? 1 : 0 });
      const chips = KEYS.map((key, i) => actor(layer, chipHTML(key), ...xy(i), { scale: 0.85, opacity: i < have ? 1 : 0 }));
      // chip i leaves the screen point `start` at s and lands in its place, with a little bounce
      const collect = (i, s, start) => {
        const el = chips[i];
        gsap.set(el, { x: start[0], y: start[1], scale: 1 }); tl.set(el, { opacity: 1 }, at(s));
        fly(el, s, s + 0.9, { x: xy(i)[0], y: xy(i)[1], scale: 0.85 }, { arc: 150, bulge: 1.2 });
        to(el.firstChild, s + 0.9, s + 1.05, { scale: 1.15 }, "sine.out"); to(el.firstChild, s + 1.05, s + 1.2, { scale: 1 }, "sine.in");
      };
      return { lbl, chips, xy, collect };
    };

    // ----- the molecule on a camera -----
    // `labels` are the identifiers already under the atoms; `view` is where the camera starts; `of` is the
    // molecule to draw, when it is not the film's own.
    const molecule = (layer, { labels = [], view = VIEW.wide, of = { atoms: ATOMS, bonds: BONDS } } = {}) => {
      const { atoms: ATOMS, bonds: BONDS } = of, dist = (c) => distIn(c, ATOMS, BONDS), env = (c, r) => envIn(c, r, ATOMS, BONDS);
      const cam = div(layer, "anchor");
      const s = svg("svg", { class: "world", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, cam);
      svg("defs", {}, s).innerHTML = `<filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
        <radialGradient id="${id}-atomfill" cx="40%" cy="35%"><stop offset="0" stop-color="#23304f"/><stop offset="1" stop-color="#121a2d"/></radialGradient>`;
      const under = svg("g", {}, s);
      const bonds = BONDS.map(([i, j, order]) => {
        const A = ATOMS[i], B = ATOMS[j], L = Math.hypot(B.x - A.x, B.y - A.y), g = svg("g", {}, s);
        const els = (order === 2 ? [-8, 8] : [0]).map((off) => { const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
          return svg("line", { x1: A.x + nx, y1: A.y + ny, x2: B.x + nx, y2: B.y + ny, stroke: "#c8d0e0", "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": L }, g); });
        return { g, els, L };
      });
      const halos = svg("g", {}, s);
      const atoms = ATOMS.map((a) => {
        const g = svg("g", {}, s);
        const disc = svg("circle", { cx: a.x, cy: a.y, r: 50, fill: `url(#${id}-atomfill)`, stroke: "#3a4a74", "stroke-width": 3 }, g);
        svg("text", { x: a.x, y: a.y + 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 800, "font-size": a.text.length > 1 ? 34 : 40,
          fill: a.el === "O" ? "#ff7b7b" : a.el === "N" ? "#6cbcff" : "#eef1f7" }, g).textContent = a.text;
        gsap.set(g, { svgOrigin: `${a.x} ${a.y}` });
        return { g, disc };
      });
      const over = svg("g", {}, s);
      // identifiers hang under each atom (above the oxygen), the next round's a little further out
      const labelXY = (n) => [ATOMS[n].x, ATOMS[n].y + ATOMS[n].dir * 84];
      const badgeXY = (n) => (ATOMS[n].dir < 0 ? [ATOMS[n].x + 76, ATOMS[n].y - 84] : [ATOMS[n].x, ATOMS[n].y + 158]);
      const pin = ([x, y]) => { const el = div(cam, "anchor"); gsap.set(el, { x, y }); return el; };
      const label = ATOMS.map((_, n) => pin(labelXY(n))), badge = ATOMS.map((_, n) => pin(badgeXY(n))), pins = [...label, ...badge];
      const chips = labels.map((key, n) => chip(label[n], key));
      // chips grow less than the picture when the camera zooms: zoom^0.6 on screen
      const pose = (v) => ({ x: 960 - v.cx * v.s, y: 540 - v.cy * v.s, scale: v.s }), counter = (v) => Math.pow(v.s, -0.4);
      gsap.set(cam, pose(view)); gsap.set(pins, { scale: counter(view) });
      const screen = (x, y, v = VIEW.wide) => [960 + (x - v.cx) * v.s, 540 + (y - v.cy) * v.s];
      const gone = (el, s1, vars) => to(el, s1 - 0.35, s1, vars, "power2.out");

      return { cam, bonds, atoms, label, badge,
        screen, labelAt: (n, v) => screen(...labelXY(n), v), badgeAt: (n, v) => screen(...badgeXY(n), v), chipSize: (v) => Math.pow(v.s, 0.6),
        move: (s0, s1, v) => { to(cam, s0, s1, pose(v), "power2.inOut"); to(pins, s0, s1, { scale: counter(v) }, "power2.inOut"); },
        // everything but the atoms in `keep` steps back between s0 and s1
        dim: (s0, s1, keep) => {
          const off = ATOMS.map((_, n) => n).filter((n) => !keep.includes(n));
          const els = [...off.map((n) => atoms[n].g), ...off.map((n) => label[n]), ...bonds.filter((_, n) => off.includes(BONDS[n][0]) || off.includes(BONDS[n][1])).map((b) => b.g)];
          to(els, s0, s0 + 0.5, { opacity: 0.15 }, "power2.out"); to(els, s1 - 0.5, s1, { opacity: 1 }, "power2.out");
        },
        // the environment of atom c out to radius r lights up from s0 to s1: it spreads bond by bond,
        // counting the steps, so its size is a graph distance and not a distance on the page
        reach: (c, r, s0, s1, red = false) => {
          const col = red ? RED : AMBER, d = dist(c), e = env(c, r), C = ATOMS[c];
          const ring = svg("circle", { cx: C.x, cy: C.y, r: 62, fill: "none", stroke: red ? RED : "#6cbcff", "stroke-width": 3, "stroke-dasharray": "10 12" }, under);
          show(ring, s0, s1, 0.75);
          from(ring, s0, s0 + 0.7, { attr: { r: 62 } }, { attr: { r: 76 } }, BACK);
          from(ring, s0, s1, { strokeDashoffset: -s0 * 30 }, { strokeDashoffset: -s1 * 30 });
          const blob = svg("g", {}, under);
          show(blob, s0, s1, 0.17);
          for (const b of e.bonds) {
            let [u, v] = BONDS[b]; if (d[u] > d[v]) [u, v] = [v, u];
            const A = ATOMS[u], B = ATOMS[v], lv = d[u], g0 = s0 + 0.15 + lv * 0.4, x = (A.x + B.x) / 2, y = (A.y + B.y) / 2;
            const line = svg("line", { x1: A.x, y1: A.y, x2: A.x, y2: A.y, stroke: col, "stroke-width": 150, "stroke-linecap": "round", "stroke-opacity": 0 }, blob);
            tl.set(line, { attr: { "stroke-opacity": 1 } }, at(g0)); to(line, g0, g0 + 0.35, { attr: { x2: B.x, y2: B.y } }, "power2.inOut");
            const glow = svg("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: col, "stroke-width": 44, "stroke-linecap": "round", "stroke-opacity": 0, filter: `url(#${id}-glow)` }, under);
            to(glow, g0, g0 + 0.35, { attr: { "stroke-opacity": 0.7 } }); gone(glow, s1, { attr: { "stroke-opacity": 0 } });
            const step = svg("g", {}, over);
            svg("circle", { cx: x, cy: y, r: 25, fill: col, stroke: "#0b0f1a", "stroke-width": 5 }, step);
            svg("text", { x, y: y + 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 900, "font-size": 30, fill: "#0b0f1a" }, step).textContent = lv + 1;
            from(step, g0 + 0.3, g0 + 0.6, { svgOrigin: `${x} ${y}`, scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }, BACK); gone(step, s1, { opacity: 0 });
          }
          for (const a of e.atoms) {
            const A = ATOMS[a], n = d[a], g1 = n ? s0 + 0.4 + (n - 1) * 0.4 : s0, h0 = n ? s0 + 0.3 + (n - 1) * 0.4 : s0;
            to(svg("circle", { cx: A.x, cy: A.y, r: 0, fill: col }, blob), g1, g1 + 0.3, { attr: { r: 75 } }, BACK);
            const halo = svg("circle", { cx: A.x, cy: A.y, r: 62, fill: "none", stroke: red ? RED : n ? AMBER : "#4dabf7", "stroke-width": 0, "stroke-opacity": 0 }, halos);
            to(halo, h0, h0 + 0.3, { attr: { "stroke-width": 8, "stroke-opacity": 1 } }); gone(halo, s1, { attr: { "stroke-width": 0, "stroke-opacity": 0 } });
          }
          tl.set(atoms[c].disc, { attr: { stroke: "#6cbcff" } }, at(s0 + 0.04)); tl.set(atoms[c].disc, { attr: { stroke: "#3a4a74" } }, at(s1 - 0.23));
        },
        // atom n gets its identifier at s
        pop: (n, key, s, bounce = true) => {
          const el = (chips[n] = chip(label[n], key, { hidden: true }));
          tl.set(el, { opacity: 1 }, at(s)); if (bounce) from(el.firstChild, s, s + 0.5, { scale: 0 }, { scale: 1 }, BACK);
        },
        // atom n's identifier turns over into a new one at s
        flip: (n, key, s) => {
          const old = chips[n], el = (chips[n] = chip(label[n], key, { hidden: true })), mid = s + 0.25;
          to(old, s, mid, { scaleX: 0 }, "sine.in"); to(old.firstChild, s, mid, { scale: 1.25 }, "sine.out");
          tl.set(old, { opacity: 0 }, at(mid)); tl.set(el, { opacity: 1 }, at(mid));
          from(el, mid, s + 0.5, { scaleX: 0 }, { scaleX: 1 }, "sine.out"); from(el.firstChild, mid, s + 0.5, { scale: 1.25 }, { scale: 1 }, "sine.in");
        },
        // the identifier atom n will get next waits below its current one from s0 to s1.
        // A grey one is a duplicate about to be dropped: it falls away, with `stamp` saying of what.
        next: (n, key, s0, s1, { grey = false, bounce = true, stamp } = {}) => {
          const el = chip(badge[n], key, { grey, size: 0.9, hidden: true });
          tl.set(el, { opacity: 1 }, at(s0)); if (bounce) from(el.firstChild, s0, s0 + 0.45, { scale: 0 }, { scale: 1 }, BACK);
          if (!grey) { tl.set(el, { opacity: 0 }, at(s1)); return; }
          to(el, s1 - 0.35, s1, { opacity: 0 }); to(el, s1 - 0.35, s1, { y: 40 }, "power2.in");
          const mark = div(badge[n], "p", `<div class="stamp">DUPLICATE ${stamp[0]}</div>`);
          put(mark, 170, 0, { rotation: -9, scale: 2.4, opacity: 0 });
          to(mark, stamp[1], stamp[1] + 0.25, { scale: 1, opacity: 1 }, "power2.out"); to(mark, s1 - 0.35, s1, { opacity: 0 });
        },
      };
    };

    // binary rain over the backdrop, as strong as strength(story seconds) says. It is drawn from the
    // timeline's own time on every update, the one thing here that is not a tween; S1 is the clip's end.
    const rain = (canvas, S1, strength) => {
      const c = canvas.getContext("2d");
      const draw = () => {
        backdrop(canvas);
        const t = story(real(S0) + tl.time()), k = strength(t);
        if (k <= 0) return;
        c.font = "500 22px 'JetBrains Mono', monospace";
        for (let col = 0; col < 64; col++) {
          const speed = 60 + rnd(col) * 140, off = rnd(col + 99) * 1080;
          for (let r = 0; r < 14; r++) {
            c.fillStyle = `rgba(110,170,255,${k * (1 - r / 14) * 0.35 * rnd(col * 7 + r)})`;
            c.fillText(rnd(col * 31 + r + Math.floor(t * 3)) > 0.5 ? "1" : "0", col * 30 + 6, ((t * speed + off + r * 30) % 1480) - 200);
          }
        }
      };
      tl.to({}, { duration: at(S1) }, 0); // keeps the timeline, and with it this drawing, running to the end of the clip
      tl.eventCallback("onUpdate", draw); draw();
    };

    return { root, q, svg, div, put, at, tl, from, to, show, wave, caption, actor, fly, chip, hashIcon, tray, molecule, rain };

  }
  // the film's still background, painted once on a 1920×1080 canvas
  function backdrop(canvas) {
    const c = canvas.getContext("2d"), grad = c.createRadialGradient(960, 454, 100, 960, 540, 1200);
    grad.addColorStop(0, "#111b33"); grad.addColorStop(1, "#05070d");
    c.fillStyle = grad; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = "rgba(120,140,190,0.07)";
    for (let x = 40; x < 1920; x += 60) for (let y = 40; y < 1080; y += 60) c.fillRect(x, y, 2, 2);
  }
  // the molecule in world coordinates, drawn into an svg <g>; `fill` paints the atom discs.
  // Returns one { halo, disc } per atom for a chapter to light up.
  function world(g, svg, fill) {
    BONDS.forEach(([i, j, order]) => {
      const A = ATOMS[i], B = ATOMS[j], L = Math.hypot(B.x - A.x, B.y - A.y);
      for (const off of order === 2 ? [-8, 8] : [0]) { const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
        svg("line", { x1: A.x + nx, y1: A.y + ny, x2: B.x + nx, y2: B.y + ny, stroke: "#c8d0e0", "stroke-width": 7, "stroke-linecap": "round" }, g); }
    });
    return ATOMS.map((a) => {
      const halo = svg("circle", { cx: a.x, cy: a.y, r: 62, fill: "none", "stroke-width": 0 }, g);
      const disc = svg("circle", { cx: a.x, cy: a.y, r: 50, fill, stroke: "#3a4a74", "stroke-width": 3 }, g);
      svg("text", { x: a.x, y: a.y + 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 800, "font-size": a.text.length > 1 ? 34 : 40,
        fill: a.el === "O" ? "#ff7b7b" : a.el === "N" ? "#6cbcff" : "#eef1f7" }, g).textContent = a.text;
      return { halo, disc };
    });
  }

  return { STORY_END, PLAN, CHAPTERS, T_END, story, real, ATOMS, BONDS, dist, env, COL, IDS, ID, BIT, fmt, KEYS, ENVK, BITSTR, chipHTML, shade, miniSVG,
    BVEC, ACCIDENT, INTER, ONLY, UNION, ATOMS_B, BONDS_B, molSVG, PARACETAMOL, BOARD, VIEW, BACK, AMBER, RED, rnd, fade, chapter, backdrop, world };
})();
