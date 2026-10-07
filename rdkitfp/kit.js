// ============================================================================
// The engine of the fingerprint films. atompair/, torsion/ and rdkitfp/ carry
// identical copies of this file; what differs per film is data.js (the numbers,
// written by data.py), film.js (the chapters and their pacing) and the chapters.
// Nothing touches the DOM while it loads, so the page can load it in <head>.
// Everything hangs off one global, `emaki`.
// ============================================================================
window.emaki = window.emaki || (() => {
  const D = window.emakiData;
  const NS = "http://www.w3.org/2000/svg";
  const INK = { C: "#eef1f7", N: "#6cbcff", O: "#ff7b7b" }; // the colour of an element's letter
  const BACK = "back.out(1.9)";
  const BLUE = "#6cbcff", AMBER = "#ffb547", GREEN = "#34d399", RED = "#ff5d5d", MUTED = "#8b95ab";
  const fmt = (n) => n.toLocaleString("en-US");
  const bin = (n, width) => n.toString(2).padStart(width, "0");
  // a repeatable stand-in for Math.random
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- molecules as graphs ----------
  function graph(M) {
    const nbrs = M.atoms.map(() => []); // per atom: [neighbour, bond index]
    M.bonds.forEach(([i, j], b) => { nbrs[i].push([j, b]); nbrs[j].push([i, b]); });
    // the atoms along a shortest path from i to j
    const path = (i, j) => {
      const prev = M.atoms.map(() => -1), q = [i]; prev[i] = i;
      while (q.length) { const u = q.shift(); for (const [v] of nbrs[u]) if (prev[v] < 0) { prev[v] = u; q.push(v); } }
      const out = [j]; while (out[0] !== i) out.unshift(prev[out[0]]);
      return out;
    };
    const bond = (i, j) => nbrs[i].find(([k]) => k === j)[1];
    return { nbrs, path, bond };
  }
  // the middle of a molecule's picture, in world coordinates
  const centre = (M) => { const xs = M.atoms.map((a) => a.x), ys = M.atoms.map((a) => a.y);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
  // a camera view of molecule `key`: its centre (or the world point `focus`) sits at the screen point `at`, zoomed by s
  const view = (key, at, s = 1, focus = centre(D.mols[key])) => ({ at, s, focus });

  // ---------- small drawings ----------
  // an atom code as a capsule: element, heavy neighbours, pi electrons
  const codeHTML = ({ el, n, pi }) => `<span class="code"><b style="color:${INK[el]}">${el}</b><i class="n">${n}</i><i class="pi">π${pi}</i></span>`;
  // a molecule as a still picture `h` pixels high; `on` (bond indices) lights a part of it and greys the rest,
  // and with `plain` the atoms are labelled by element alone
  function molSVG(key, h, { on = null, color = AMBER, pad = 64, plain = false } = {}) {
    const M = D.mols[key], xs = M.atoms.map((a) => a.x), ys = M.atoms.map((a) => a.y);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, hh = Math.max(...ys) - y0 + pad;
    const lit = on && new Set(on.flatMap((b) => M.bonds[b].slice(0, 2)));
    let out = `<svg viewBox="${x0} ${y0} ${w} ${hh}" height="${h}" width="${(h * w) / hh}">`;
    M.bonds.forEach(([i, j, order], b) => {
      const A = M.atoms[i], B = M.atoms[j], L = Math.hypot(B.x - A.x, B.y - A.y), hot = on && on.includes(b);
      if (hot) out += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${color}" stroke-opacity=".45" stroke-width="52" stroke-linecap="round"/>`;
      for (const off of order === 2 ? [-10, 10] : [0]) { const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
        out += `<line x1="${A.x + nx}" y1="${A.y + ny}" x2="${B.x + nx}" y2="${B.y + ny}" stroke="${!on || hot ? "#c8d0e0" : "#2a3552"}" stroke-width="${!on || hot ? 10 : 7}" stroke-linecap="round"/>`; }
    });
    M.atoms.forEach((a, n) => { const hot = !on || lit.has(n), text = plain ? a.el : a.text;
      out += `<circle cx="${a.x}" cy="${a.y}" r="50" fill="${on && hot ? "#222d4a" : "#121a2d"}" stroke="${on && hot ? color : hot ? "#3a4a74" : "#222c46"}" stroke-width="${on && hot ? 7 : 5}"/>`
        + `<text x="${a.x}" y="${a.y + 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter" font-weight="800" font-size="${text.length > 1 ? 36 : 46}" fill="${hot ? INK[a.el] : "#35405c"}">${text}</text>`; });
    return out + "</svg>";
  }

  // ---------- building a chapter ----------
  // A chapter is a sub-composition (compositions/<id>.html) whose root holds one empty layer, #<id>-stage.
  // chapter(id) gives its script what it builds the picture and the timeline with. Every time passed to a
  // helper is in script seconds from the start of the chapter; film.js says how long a chapter's script
  // is and how fast it plays.
  function chapter(id) {
    const film = window.emaki.film, [, LEN, SPEED = 1] = film.chapters.find(([name]) => name === id);
    const ACCENT = film.accent;
    const root = document.querySelector(`[data-composition-id="${id}"]`), stage = root.querySelector(`#${id}-stage`);
    stage.style.setProperty("--accent", ACCENT);
    const svg = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    const div = (parent, cls, html = "") => { const e = document.createElement("div"); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
    const layer = () => div(stage, "layer");
    // a full-frame svg for lines drawn in screen coordinates
    const canvas = () => svg("svg", { class: "layer", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, stage);
    // a box centred on the screen point (x, y). Its content sits in a child, which is what arcs and swells while the box travels.
    const box = (parent, html, x, y, more = {}) => { const el = div(parent, "p", `<div>${html}</div>`); gsap.set(el, { xPercent: -50, yPercent: -50, x, y, ...more }); return el; };
    const HIDDEN = { autoAlpha: 0 }, SMALL = { autoAlpha: 0, scale: 0 };

    const at = (t) => t / SPEED; // script seconds → seconds inside this clip
    const tl = gsap.timeline({ paused: true });
    tl.to({}, { duration: at(LEN) }, 0); // the timeline is as long as its clip, whatever the last tween is
    const to = (el, t0, t1, vars, ease = "power2.out") => tl.to(el, { ...vars, duration: at(t1) - at(t0), ease }, at(t0));
    const set = (el, t, vars) => tl.set(el, vars, at(t));
    const appear = (el, t, d = 0.4, o = 1) => to(el, t, t + d, { autoAlpha: o });
    const vanish = (el, t, d = 0.4) => to(el, t - d, t, { autoAlpha: 0 }); // gone by t
    const show = (el, t0, t1, o = 1) => { appear(el, t0, 0.35, o); vanish(el, t1, 0.35); };
    // where the next chapter is another picture altogether, a chapter leaves through the backdrop and the next arrives from it
    const fadeOut = (d = 0.5) => to(stage, LEN - d, LEN, { autoAlpha: 0 }, "power1.inOut");
    const fadeIn = (d = 0.5) => { gsap.set(stage, { autoAlpha: 0 }); to(stage, 0, d, { autoAlpha: 1 }, "power1.inOut"); };
    // a box made SMALL grows to its size at t
    const pop = (el, t, scale = 1) => { to(el, t, t + 0.5, { scale }, BACK); to(el, t, t + 0.15, { autoAlpha: 1 }); };
    // a quick swell, to point at something
    const pulse = (el, t, by = 1.18, base = 1) => { to(el, t, t + 0.18, { scale: base * by }, "sine.out"); to(el, t + 0.18, t + 0.45, { scale: base }, "sine.inOut"); };
    // a box travels to `dest` ({x, y, scale}) between t0 and t1, its content rising `arc` pixels on the way
    const fly = (el, t0, t1, dest, { arc = 0, ease = "power2.inOut" } = {}) => {
      const mid = (t0 + t1) / 2;
      to(el, t0, t1, dest, ease);
      if (arc) { to(el.firstChild, t0, mid, { y: -arc }, "sine.out"); to(el.firstChild, mid, t1, { y: 0 }, "sine.in"); }
    };
    // a curve from one screen point to another that draws itself at t0 and is gone by t1
    const link = (svgLayer, [x0, y0], [x1, y1], t0, t1, color = ACCENT, bend = 0.5) => {
      const my = y0 + (y1 - y0) * bend;
      const path = svg("path", { d: `M ${x0} ${y0} C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1.1", "stroke-dashoffset": 1.05, autoAlpha: 0 }, svgLayer);
      set(path, t0, { autoAlpha: 0.9 }); to(path, t0, t0 + 0.5, { strokeDashoffset: 0 }, "power2.inOut"); if (t1 != null) vanish(path, t1, 0.3);
      return path;
    };

    // a caption (.cap in style.css): the words rise in one after another and leave together. An `alert` has a red title.
    const caps = div(stage, "layer"); caps.style.zIndex = 5;
    const caption = (t0, t1, { tag, title, sub = "", hero = false, alert = false }) => {
      const el = div(caps, "cap" + (hero ? " hero" : alert ? " alert" : ""));
      const words = (text) => text.split(/(?<=\s)(?![^<]*>)/).map((w) => `<span class="w">${w}</span>`).join("");
      if (tag) { const line = div(el, "tag", tag); gsap.set(line, HIDDEN); show(line, t0, t1); }
      div(el, "title", words(title)); div(el, "sub", words(sub));
      el.querySelectorAll(".w").forEach((w, n) => {
        gsap.set(w, { autoAlpha: 0, y: 26 });
        to(w, t0 + n * 0.045, t0 + n * 0.045 + 0.5, { autoAlpha: 1, y: 0 });
        to(w, t1 - 0.4, t1, { autoAlpha: 0, y: -10 });
      });
      return el;
    };

    // ----- a molecule on a camera -----
    // `v` is the view the camera starts on; with `drawn` false the molecule waits for drawIn(), and with
    // `plain` its atoms are labelled by element alone (C, not CH₃).
    let serial = 0;
    const mol = (parent, key, v, { drawn = true, plain = false } = {}) => {
      const M = D.mols[key], G = graph(M), uid = `${id}-${key}${serial++}`;
      const cam = div(parent, "anchor");
      const world = svg("svg", { class: "world", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, cam);
      svg("defs", {}, world).innerHTML = `<filter id="${uid}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
        <radialGradient id="${uid}-fill" cx="40%" cy="35%"><stop offset="0" stop-color="#23304f"/><stop offset="1" stop-color="#121a2d"/></radialGradient>`;
      const under = svg("g", {}, world);
      const bonds = M.bonds.map(([i, j, order]) => {
        const A = M.atoms[i], B = M.atoms[j], L = Math.hypot(B.x - A.x, B.y - A.y), g = svg("g", {}, world);
        const els = (order === 2 ? [-8, 8] : [0]).map((off) => { const nx = ((B.y - A.y) / L) * off, ny = ((A.x - B.x) / L) * off;
          // the gap is longer than the bond, so that an undrawn bond leaves no dot of round cap at its start
          return svg("line", { x1: A.x + nx, y1: A.y + ny, x2: B.x + nx, y2: B.y + ny, stroke: "#c8d0e0", "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": `${L} ${L + 10}`, "stroke-dashoffset": drawn ? 0 : L + 5 }, g); });
        return { g, els, L };
      });
      const halos = svg("g", {}, world);
      const atoms = M.atoms.map((a) => {
        const g = svg("g", {}, world);
        const disc = svg("circle", { cx: a.x, cy: a.y, r: 50, fill: `url(#${uid}-fill)`, stroke: "#3a4a74", "stroke-width": 3 }, g);
        const write = (text) => { const el = svg("text", { x: a.x, y: a.y + 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 800, "font-size": text.length > 1 ? 34 : 40, fill: INK[a.el] }, g); el.textContent = text; return el; };
        const label = write(plain ? a.el : a.text);
        gsap.set(g, { svgOrigin: `${a.x} ${a.y}`, scale: drawn ? 1 : 0 });
        return { g, disc, label, write };
      });
      const over = svg("g", {}, world);
      // a tag hangs under its atom (over it where the atom's `side` is -1)
      const tagXY = (n) => [M.atoms[n].x, M.atoms[n].y + M.atoms[n].side * 88];
      const pins = M.atoms.map((_, n) => { const el = div(cam, "anchor"); gsap.set(el, { x: tagXY(n)[0], y: tagXY(n)[1] }); return el; });
      // tags grow less than the picture when the camera zooms: zoom^0.6 on screen
      const pose = (w) => ({ x: w.at[0] - w.focus[0] * w.s, y: w.at[1] - w.focus[1] * w.s, scale: w.s }), counter = (w) => Math.pow(w.s, -0.4);
      gsap.set(cam, pose(v)); gsap.set(pins, { scale: counter(v) });
      const screen = (x, y, w = v) => [w.at[0] + (x - w.focus[0]) * w.s, w.at[1] + (y - w.focus[1]) * w.s];
      // a highlight fades out by t1, or as soon after `after`, the end of its fading in, as it can: two tweens of one
      // property must not overlap, or what a frame shows would depend on where the renderer started
      const gone = (el, t1, vars, after = 0) => { const t = Math.max(t1 - 0.35, after); to(el, t, t + 0.35, vars); };
      const badge = (x, y, text, color, parent = over) => {
        const g = svg("g", { opacity: 0 }, parent);
        svg("circle", { cx: x, cy: y, r: 25, fill: color, stroke: "#0b0f1a", "stroke-width": 5 }, g);
        svg("text", { x, y: y + 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 900, "font-size": 30, fill: "#0b0f1a" }, g).textContent = text;
        gsap.set(g, { svgOrigin: `${x} ${y}`, scale: 0, autoAlpha: 0 });
        return g;
      };
      // atom n wears a ring from t0 to t1
      const mark = (n, t0, t1, color = ACCENT) => {
        const a = M.atoms[n], halo = svg("circle", { cx: a.x, cy: a.y, r: 62, fill: "none", stroke: color, "stroke-width": 0, "stroke-opacity": 0 }, halos);
        to(halo, t0, t0 + 0.3, { attr: { "stroke-width": 8, "stroke-opacity": 1 } }); gone(halo, t1, { attr: { "stroke-width": 0, "stroke-opacity": 0 } }, t0 + 0.3);
      };

      return { M, G, cam, bonds, atoms, pins, screen, mark,
        at: (n, w) => screen(M.atoms[n].x, M.atoms[n].y, w), tagAt: (n, w) => screen(...tagXY(n), w), tagSize: (w = v) => Math.pow(w.s, 0.6),
        // bonds draw in one after another from t, then the atoms pop onto them
        drawIn: (t) => {
          bonds.forEach((b, n) => to(b.els, t + n * 0.28, t + 0.6 + n * 0.28, { strokeDashoffset: 0 }, "power2.inOut"));
          atoms.forEach((a, n) => to(a.g, t + 0.5 + n * 0.16, t + 1.1 + n * 0.16, { scale: 1 }, BACK));
        },
        move: (t0, t1, w) => { to(cam, t0, t1, pose(w), "power2.inOut"); to(pins, t0, t1, { scale: counter(w) }, "power2.inOut"); v = w; },
        // atom n's label loses its hydrogens at t: CH₃ becomes C
        strip: (n, t) => { const a = atoms[n]; if (M.atoms[n].text === M.atoms[n].el) return;
          const bare = a.write(M.atoms[n].el); gsap.set(bare, { autoAlpha: 0 }); to(a.label, t, t + 0.3, { autoAlpha: 0 }); to(bare, t + 0.15, t + 0.5, { autoAlpha: 1 }); },
        // a box that hangs at atom n's tag place and moves with the camera
        tag: (n, html, more = {}) => box(pins[n], html, 0, 0, more),
        // atom n is singled out from t0 to t1: a ring, and a dashed circle turning around it
        ring: (n, t0, t1, color = ACCENT) => {
          const a = M.atoms[n], dash = svg("circle", { cx: a.x, cy: a.y, r: 62, fill: "none", stroke: color, "stroke-width": 3, "stroke-dasharray": "10 12", opacity: 0 }, under);
          t1 = Math.max(t1, t0 + 0.75);
          show(dash, t0, t1, 0.8); to(dash, t0, t0 + 0.7, { attr: { r: 76 } }, BACK); to(dash, t0, t1, { strokeDashoffset: -(t1 - t0) * 30 }, "none");
          mark(n, t0, t1, color);
        },
        // a walk along `path` (atom indices) lights up one bond every `step` from t0 and is gone by t1, or as soon
        // after arriving as it can; the bonds (or with numbers: "atoms" the atoms) are counted as it goes.
        // Returns the time the walk arrives.
        trace: (path, t0, t1, { color = ACCENT, step = 0.4, numbers = "bonds" } = {}) => {
          const arrive = t0 + 0.15 + (path.length - 1) * step; t1 = Math.max(t1, arrive + 0.75);
          const band = svg("g", { opacity: 0 }, under); show(band, t0, t1, 0.2);
          const reach = (n, t) => { // the walk gets to atom `n`
            const a = M.atoms[path[n]];
            to(svg("circle", { cx: a.x, cy: a.y, r: 0, fill: color }, band), t, t + 0.3, { attr: { r: 72 } }, BACK);
            mark(path[n], t, t1, color);
            if (numbers === "atoms") { const b = badge(a.x + 46, a.y - 46, n + 1, color); pop(b, t + 0.1); gone(b, t1, { autoAlpha: 0 }, t + 0.25); }
          };
          reach(0, t0);
          path.slice(1).forEach((to_, k) => {
            const A = M.atoms[path[k]], B = M.atoms[to_], g0 = t0 + 0.15 + k * step;
            const line = svg("line", { x1: A.x, y1: A.y, x2: A.x, y2: A.y, stroke: color, "stroke-width": 124, "stroke-linecap": "round", "stroke-opacity": 0 }, band);
            set(line, g0, { attr: { "stroke-opacity": 1 } }); to(line, g0, g0 + step * 0.85, { attr: { x2: B.x, y2: B.y } }, "power2.inOut");
            const glow = svg("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: color, "stroke-width": 40, "stroke-linecap": "round", "stroke-opacity": 0, filter: `url(#${uid}-glow)` }, under);
            to(glow, g0, g0 + step * 0.85, { attr: { "stroke-opacity": 0.75 } }, "none"); gone(glow, t1, { attr: { "stroke-opacity": 0 } }, g0 + step * 0.85);
            if (numbers === "bonds") { const b = badge((A.x + B.x) / 2, (A.y + B.y) / 2, k + 1, color); pop(b, g0 + step * 0.6); gone(b, t1, { autoAlpha: 0 }, g0 + step * 0.6 + 0.15); }
            reach(k + 1, g0 + step * 0.7);
          });
          return arrive;
        },
        // the bonds in `which` light up together from t0 to t1, and with `ends` the atoms on them
        light: (which, t0, t1, color = ACCENT, ends = true) => {
          const band = svg("g", { opacity: 0 }, under); show(band, t0, t1, 0.2);
          for (const b of which) {
            const [i, j] = M.bonds[b], A = M.atoms[i], B = M.atoms[j];
            svg("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: color, "stroke-width": ends ? 124 : 84, "stroke-linecap": ends ? "round" : "butt" }, band);
            const glow = svg("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: color, "stroke-width": 40, "stroke-linecap": "round", "stroke-opacity": 0, filter: `url(#${uid}-glow)` }, under);
            to(glow, t0, t0 + 0.3, { attr: { "stroke-opacity": 0.75 } }); gone(glow, t1, { attr: { "stroke-opacity": 0 } }, t0 + 0.3);
          }
          if (ends) for (const n of new Set(which.flatMap((b) => M.bonds[b].slice(0, 2)))) { svg("circle", { cx: M.atoms[n].x, cy: M.atoms[n].y, r: 72, fill: color }, band); mark(n, t0, t1, color); }
        },
        // a numbered disc on the world point (x, y), for a chapter to pop
        badge: (x, y, text, color = ACCENT) => badge(x, y, text, color),
      };
    };

    // ----- the bit vector as a wall of cells -----
    // Its top left corner is at the screen point (x, y). `size` is the number of bits: 2048 makes 16 rows of 128
    // small cells, a short vector such as 128 makes rows of 32 cells large enough to read one by one. With
    // group = 4 the cells stand in blocks of four, the way RDKit lays out a fingerprint that simulates counts.
    const wall = (parent, x, y, { size = 2048, group = 1 } = {}) => {
      const big = size <= 256, COLS = big ? 32 : 128, ROWS = Math.ceil(size / COLS);
      const CW = big ? 36 : 9, CH = big ? 46 : 13, STEP = big ? 41 : 11, PLAIN = big ? 46 : 12, ROW = big ? 66 : 21, RX = big ? 7 : 2, PAD = big ? 16 : 8;
      const BLOCK = group * STEP + (big ? 22 : 5), SWELL = big ? 1.5 : 2.6;
      const cx = (col) => (group > 1 ? Math.floor(col / group) * BLOCK + (col % group) * STEP : col * PLAIN) + CW / 2;
      const W = cx(COLS - 1) + CW / 2, H = (ROWS - 1) * ROW + CH;
      const el = div(parent, "anchor"); gsap.set(el, { x, y });
      const s = svg("svg", { class: "world", viewBox: `0 0 ${W} ${H}`, width: W, height: H }, el), pid = `${id}-cells${serial++}`;
      const cell = (px) => `<rect x="${px}" width="${CW}" height="${CH}" rx="${RX}" fill="#1a2440"/>`;
      svg("defs", {}, s).innerHTML = `<pattern id="${pid}" width="${group > 1 ? BLOCK : PLAIN}" height="${ROW}" patternUnits="userSpaceOnUse">${Array.from({ length: group }, (_, k) => cell(k * STEP)).join("")}</pattern>`;
      svg("rect", { width: W, height: H, fill: `url(#${pid})` }, s);
      const name = "p walllbl" + (big ? " big" : ""), first = div(el, name, "bit 0"), last = div(el, name, `bit ${size - 1}`);
      gsap.set(first, { x: 0, y: big ? -34 : -26 }); gsap.set(last, { xPercent: -100, x: W, y: H + (big ? 12 : 8) });
      const local = (bit) => [cx(bit % COLS), Math.floor(bit / COLS) * ROW + CH / 2];
      const cells = {};
      const glow = (color) => ({ backgroundColor: color, boxShadow: `0 0 ${big ? 24 : 12}px ${big ? 3 : 2}px ${color}` });
      return { el, W, H, cells,
        at: (bit) => [x + local(bit)[0], y + local(bit)[1]],
        // bit `bit` comes on at t (or is on from the start, without t), with a ring going out from it
        on: (bit, color, t) => {
          const c = (cells[bit] = box(el, `<div class="bit" style="width:${CW}px;height:${CH}px;border-radius:${RX}px"></div>`, ...local(bit), t == null ? {} : HIDDEN));
          gsap.set(c.firstChild, glow(color));
          if (t == null) return c;
          set(c, t, { autoAlpha: 1 }); gsap.set(c.firstChild, { scale: SWELL }); to(c.firstChild, t, t + 0.45, { scale: 1 });
          const ping = box(el, `<div class="ping" style="width:${CW * 2 + 12}px;height:${CW * 2 + 12}px;border-color:${color}"></div>`, ...local(bit), { autoAlpha: 0, scale: 0.3 });
          set(ping, t, { autoAlpha: 0.9 }); to(ping, t, t + 0.7, { scale: big ? 1.7 : 2.4, autoAlpha: 0 });
          return c;
        },
        // many bits come on between t and t + d, row after row, as plain cells; returns them as one svg group
        fill: (bits, color, t, d) => {
          const g = svg("g", {}, s);
          const rows = Array.from({ length: ROWS }, (_, r) => { const row = svg("g", { opacity: 0 }, g); to(row, t + (r / ROWS) * d, t + (r / ROWS) * d + 0.4, { autoAlpha: 1 }); return row; });
          for (const bit of bits) svg("rect", { x: local(bit)[0] - CW / 2, y: local(bit)[1] - CH / 2, width: CW, height: CH, rx: RX, fill: color }, rows[Math.floor(bit / COLS)]);
          return g;
        },
        // a bit that is on changes colour at t, or just swells for a moment to be noticed
        tint: (bit, color, t) => { const c = cells[bit].firstChild, up = (1 + SWELL) / 2; to(c, t, t + 0.3, glow(color)); to(c, t, t + 0.15, { scale: up }, "sine.out"); to(c, t + 0.15, t + 0.4, { scale: 1 }, "sine.inOut"); },
        flash: (bit, t) => pulse(cells[bit].firstChild, t, SWELL),
        // a frame around block n (or, on a wall without blocks, around bit n) from t0 to t1; returns it
        frame: (n, color, t0, t1) => {
          const [px, py] = local(n * group), w = (group - 1) * STEP + CW + PAD, h = CH + PAD;
          const f = box(el, `<div class="frame" style="width:${w}px;height:${h}px;border-color:${color};border-radius:${RX + PAD / 2}px;box-shadow:0 0 ${big ? 26 : 12}px ${color}66"></div>`, px + ((group - 1) * STEP) / 2, py, SMALL);
          pop(f, t0); if (t1 != null) vanish(f, t1);
          return f;
        },
        // from t0 to t1, what each of the four bits of block n stands for is written under it
        thresholds: (n, t0, t1) => ["≥1", "≥2", "≥4", "≥8"].forEach((text, k) => { const [px, py] = local(n * group + k);
          show(box(el, `<div class="walllbl big" style="color:#eef1f7">${text}</div>`, px, py + CH / 2 + 20, HIDDEN), t0 + k * 0.12, t1); }),
      };
    };
    // a block of four bits, magnified: one cell per count threshold. Centred on (x, y); returns its cells to light.
    const lens = (parent, x, y, block, more = SMALL) => {
      const el = box(parent, `<div class="lens"><div class="lenshead">block ${block} · bits ${block * 4}–${block * 4 + 3}</div><div class="lensrow">${
        ["≥1", "≥2", "≥4", "≥8"].map((s) => `<div class="lcell"><b></b><span>${s}</span></div>`).join("")}</div></div>`, x, y, more);
      const cells = [...el.querySelectorAll("b")];
      return { el, cells, on: (k, color, t) => (t == null ? gsap.set(cells[k], { backgroundColor: color, boxShadow: `0 0 26px ${color}` })
        : to(cells[k], t, t + 0.3, { backgroundColor: color, boxShadow: `0 0 26px ${color}` })) };
    };

    // ----- the four fingerprints of the series on the same two molecules -----
    // rows centred on x, the first at y; `me` is this film's row. Returns the rows for the chapter to bring in.
    const board = (parent, x, y, me) => {
      const NAMES = { ecfp4: "ECFP4", atompair: "Atom Pair", torsion: "Topological Torsion", rdkit: "RDKit" };
      return Object.keys(NAMES).map((k, n) => {
        const { both, either } = D.board[k], value = both / either;
        const row = box(parent, `<div class="score${k === me ? " me" : ""}"><span class="name">${NAMES[k]}</span><span class="track"><i></i></span><span class="val">${value.toFixed(2)}</span></div>`, x, y + n * 74, HIDDEN);
        const fill = row.querySelector("i"); gsap.set(fill, { width: 0 });
        return { row, in: (t) => { appear(row, t); to(fill, t + 0.1, t + 0.9, { width: `${Math.max(value, 0.006) * 100}%` }, "power2.inOut"); } };
      });
    };

    return { id, root, stage, LEN, ACCENT, svg, div, layer, canvas, box, HIDDEN, SMALL, at, tl, to, set, appear, vanish, show, fadeIn, fadeOut, pop, pulse, fly, link, caption, mol, wall, lens, board };
  }

  return { D, INK, BACK, BLUE, AMBER, GREEN, RED, MUTED, fmt, bin, rnd, graph, centre, view, codeHTML, molSVG, chapter };
})();
