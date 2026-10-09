// ============================================================================
// The engine of the Chemprop films. molgraph/, messages/, readout/, training/
// and dmpnn/ carry identical copies of this file. It grew out of the
// fingerprint films' kit: the camera, the molecule, captions and the timeline
// helpers are theirs, and what is new draws what Chemprop works with: directed
// bonds, feature vectors as rows of cells cut into blocks, hidden vectors as
// strips, and charts. What differs per film is data.js (the numbers, written
// by data.py), film.js (the chapters and their pacing) and the chapters.
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
  // a repeatable stand-in for Math.random
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- molecules as graphs ----------
  function graph(M) {
    const nbrs = M.atoms.map(() => []); // per atom: [neighbour, bond index]
    M.bonds.forEach(([i, j], b) => { nbrs[i].push([j, b]); nbrs[j].push([i, b]); });
    const bond = (i, j) => nbrs[i].find(([k]) => k === j)[1];
    return { nbrs, bond };
  }
  // the middle of a molecule's picture, in world coordinates
  const centre = (M) => { const xs = M.atoms.map((a) => a.x), ys = M.atoms.map((a) => a.y);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
  // a camera view of molecule `key`: its centre (or the world point `focus`) sits at the screen point `at`, zoomed by s
  const view = (key, at, s = 1, focus = centre(D.mols[key])) => ({ at, s, focus });

  // ---------- words for what Chemprop holds ----------
  // a directed bond as text: CH₃→C. `key` is the molecule, k the directed bond's index.
  const arrowText = (key, k) => { const [u, v] = D.graphs[key].edges[k], A = D.mols[key].atoms;
    return `<b style="color:${INK[A[u].el]}">${A[u].text}</b><span class="to">→</span><b style="color:${INK[A[v].el]}">${A[v].text}</b>`; };
  // a bond as text, its order drawn: C=O
  const bondText = (key, b) => { const [i, j, order] = D.mols[key].bonds[b], A = D.mols[key].atoms;
    return `<b style="color:${INK[A[i].el]}">${A[i].text}</b><span class="to">${["", "–", "=", "≡"][order]}</span><b style="color:${INK[A[j].el]}">${A[j].text}</b>`; };

  // ---------- the cells of a feature vector ----------
  // Where each cell of a vector sits, left to right, and the blocks it is cut into. `kind` is "atom", "bond" or
  // "input" (an atom's cells, then a bond's: what a directed bond starts from). Blocks stand `space` apart, and the
  // two halves of an input three times that.
  const cut = (kind, { cell = 20, gap = 3, space = 12 } = {}) => {
    const halves = kind === "input" ? [["atom", D.blocks.atom], ["bond", D.blocks.bond]] : [[kind, D.blocks[kind]]];
    const xs = [], blocks = []; let x = 0, i = 0;
    halves.forEach(([half, list], h) => list.forEach((b, k) => {
      if (k) x += space - gap; else if (h) x += space * 3 - gap;
      const from = i, x0 = x;
      b.choices.forEach(() => { xs.push(x); x += cell + gap; i++; });
      blocks.push({ ...b, half, from, to: i, x0, x1: x - gap });
    }));
    return { xs, blocks, W: x - gap, size: i };
  };

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
      const path = svg("path", { d: `M ${x0} ${y0} C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1.1", "stroke-dashoffset": 1.05, opacity: 0 }, svgLayer);
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
    // `v` is the view the camera starts on; with `drawn` false the molecule waits for drawIn().
    let serial = 0;
    const mol = (parent, key, v, { drawn = true } = {}) => {
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
      const arrows = svg("g", {}, world), halos = svg("g", {}, world);
      const atoms = M.atoms.map((a) => {
        const g = svg("g", {}, world);
        const disc = svg("circle", { cx: a.x, cy: a.y, r: 50, fill: `url(#${uid}-fill)`, stroke: "#3a4a74", "stroke-width": 3 }, g);
        const label = svg("text", { x: a.x, y: a.y + 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Inter", "font-weight": 800, "font-size": a.text.length > 1 ? 34 : 40, fill: INK[a.el] }, g);
        label.textContent = a.text;
        gsap.set(g, { svgOrigin: `${a.x} ${a.y}`, scale: drawn ? 1 : 0 });
        return { g, disc, label };
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
      // ----- directed bonds -----
      // Directed bond k (D.graphs[key].edges[k], from atom u to atom v) is an arrow beside its bond, on the
      // right of the way it points, so that the two directions of a bond run on either side of it.
      const E = D.graphs?.[key]?.edges ?? [], SIDE = 36, CLEAR = 64; // a film without directed bonds has none
      const along = (k) => { const [u, w] = E[k], A = M.atoms[u], B = M.atoms[w], L = Math.hypot(B.x - A.x, B.y - A.y);
        const dx = (B.x - A.x) / L, dy = (B.y - A.y) / L; return { A, B, L, dx, dy, nx: -dy, ny: dx }; };
      // the world point beside directed bond k, `off` from the bond's axis, halfway along
      const beside = (k, off = SIDE) => { const { A, B, nx, ny } = along(k); return [(A.x + B.x) / 2 + nx * off, (A.y + B.y) / 2 + ny * off]; };
      const arrow = (k, color = ACCENT) => {
        const { A, B, dx, dy, nx, ny } = along(k), HEAD = 26;
        const x0 = A.x + dx * CLEAR + nx * SIDE, y0 = A.y + dy * CLEAR + ny * SIDE, x1 = B.x - dx * CLEAR + nx * SIDE, y1 = B.y - dy * CLEAR + ny * SIDE;
        const g = svg("g", { opacity: 0 }, arrows);
        const line = svg("line", { x1: x0, y1: y0, x2: x1 - dx * HEAD * 0.6, y2: y1 - dy * HEAD * 0.6, stroke: color, "stroke-width": 7, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1.1", "stroke-dashoffset": 1.05 }, g);
        const head = svg("path", { d: `M ${x1} ${y1} L ${x1 - dx * HEAD + nx * 13} ${y1 - dy * HEAD + ny * 13} L ${x1 - dx * HEAD - nx * 13} ${y1 - dy * HEAD - ny * 13} Z`, fill: color }, g);
        gsap.set(head, { svgOrigin: `${x1} ${y1}`, scale: 0 });
        return { g, line, head, color };
      };
      const arrowsOf = E.map((_, k) => arrow(k));
      // directed bond k draws itself from t (or is there from the start, without t); returns its arrow
      const direct = (k, t, { color } = {}) => {
        const a = arrowsOf[k];
        if (color) { a.color = color; gsap.set(a.line, { attr: { stroke: color } }); gsap.set(a.head, { attr: { fill: color } }); }
        if (t == null) { gsap.set(a.g, { autoAlpha: 1 }); gsap.set(a.line, { strokeDashoffset: 0 }); gsap.set(a.head, { scale: 1 }); return a; }
        set(a.g, t, { autoAlpha: 1 }); to(a.line, t, t + 0.45, { strokeDashoffset: 0 }, "power2.inOut"); to(a.head, t + 0.35, t + 0.65, { scale: 1 }, BACK);
        return a;
      };
      // directed bond k turns `color` at t, thicker, and back to what it was at t1 if given
      const hot = (k, t, color, t1) => {
        const a = arrowsOf[k], back = a.color;
        to(a.line, t, t + 0.3, { attr: { stroke: color, "stroke-width": 11 } }); to(a.head, t, t + 0.3, { attr: { fill: color }, scale: 1.3 });
        if (t1 != null) { to(a.line, t1 - 0.3, t1, { attr: { stroke: back, "stroke-width": 7 } }); to(a.head, t1 - 0.3, t1, { attr: { fill: back }, scale: 1 }); }
      };

      return { M, G, cam, bonds, atoms, pins, screen, mark, direct, hot, arrows: arrowsOf, beside,
        at: (n, w) => screen(M.atoms[n].x, M.atoms[n].y, w), tagAt: (n, w) => screen(...tagXY(n), w), tagSize: (w = v) => Math.pow(w.s, 0.6),
        // bonds draw in one after another from t, then the atoms pop onto them
        drawIn: (t) => {
          bonds.forEach((b, n) => to(b.els, t + n * 0.28, t + 0.6 + n * 0.28, { strokeDashoffset: 0 }, "power2.inOut"));
          atoms.forEach((a, n) => to(a.g, t + 0.5 + n * 0.16, t + 1.1 + n * 0.16, { scale: 1 }, BACK));
        },
        move: (t0, t1, w) => { to(cam, t0, t1, pose(w), "power2.inOut"); to(pins, t0, t1, { scale: counter(w) }, "power2.inOut"); v = w; },
        // a box that hangs at atom n's tag place and moves with the camera
        tag: (n, html, more = {}) => box(pins[n], html, 0, 0, more),
        // atom n is singled out from t0 to t1: a ring, and a dashed circle turning around it
        ring: (n, t0, t1, color = ACCENT) => {
          const a = M.atoms[n], dash = svg("circle", { cx: a.x, cy: a.y, r: 62, fill: "none", stroke: color, "stroke-width": 3, "stroke-dasharray": "10 12", opacity: 0 }, under);
          t1 = Math.max(t1, t0 + 0.75);
          show(dash, t0, t1, 0.8); to(dash, t0, t0 + 0.7, { attr: { r: 76 } }, BACK); to(dash, t0, t1, { strokeDashoffset: -(t1 - t0) * 30 }, "none");
          mark(n, t0, t1, color);
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

    // ----- a feature vector as a row of cells -----
    // `values` laid out as cut(kind) says, the row's top centre at the screen point (x, y). A cell that holds 1
    // lights up in its half's colour (atom: ACCENT, bond: AMBER); one that holds a fraction (the mass) fills to
    // that height. Cells start dark; light() turns them on, or `lit` has them on from the start.
    const CELL = { atom: ACCENT, bond: AMBER };
    const vec = (parent, x, y, values, kind, { cell = 20, gap = 3, space = 12, tall = 1.35, lit = false, names = false, choices = false } = {}) => {
      const L = cut(kind, { cell, gap, space }), H = Math.round(cell * tall), R = Math.max(2, cell * 0.22);
      const el = div(parent, "anchor"); gsap.set(el, { x: x - L.W / 2, y });
      const half = (i) => L.blocks.find((b) => i >= b.from && i < b.to).half;
      const cells = values.map((value, i) => {
        const c = div(el, "cell"); gsap.set(c, { x: L.xs[i], width: cell, height: H, borderRadius: R });
        if (value > 0 && value < 1) { const bar = div(c, "bar"); gsap.set(bar, { height: lit ? Math.max(3, value * H) : 0, backgroundColor: CELL[half(i)] }); }
        else if (value && lit) gsap.set(c, { backgroundColor: CELL[half(i)], boxShadow: `0 0 ${cell * 0.6}px ${CELL[half(i)]}` });
        return c;
      });
      // the names of the blocks, over them. A name wider than its block is lifted onto a stalk instead, each in a run
      // of such blocks higher than the last, and ends at its block (or, for the first block, starts at it).
      let run = 0;
      const labels = names ? L.blocks.map((b, n) => {
        const w = b.x1 - b.x0, narrow = b.name.length * 9.6 > w + 10, rule = div(el, "blockrule");
        gsap.set(rule, { x: b.x0, y: -9, width: w });
        const lbl = div(el, "blockname", b.name);
        if (!narrow) { run = 0; gsap.set(lbl, { x: (b.x0 + b.x1) / 2, xPercent: -50, y: -30 }); return [lbl, rule]; }
        const y = -52 - 22 * run++, stalk = div(el, "blockrule");
        gsap.set(stalk, { x: (b.x0 + b.x1) / 2 - 1, y: y + 18, width: 2, height: -9 - (y + 18) });
        gsap.set(lbl, n ? { x: b.x1 + 2, xPercent: -100, y } : { x: b.x0 - 2, y });
        return [lbl, rule, stalk];
      }) : [];
      // what each cell stands for, under it
      const said = choices ? L.blocks.flatMap((b) => b.choices.map((ch, k) => {
        const e = div(el, "choice", ch); gsap.set(e, { x: L.xs[b.from + k] + cell / 2 - 5, y: H + 6 }); return e; })) : [];
      const hotOnes = values.map((v, i) => i).filter((i) => values[i]);
      const light1 = (i, t, color = CELL[half(i)]) => {
        const v = values[i], c = cells[i];
        if (v > 0 && v < 1) to(c.firstChild, t, t + 0.4, { height: Math.max(3, v * H), backgroundColor: color });
        else { to(c, t, t + 0.3, { backgroundColor: color, boxShadow: `0 0 ${cell * 0.6}px ${color}` }); to(c, t, t + 0.15, { scale: 1.35 }, "sine.out"); to(c, t + 0.15, t + 0.4, { scale: 1 }, "sine.inOut"); }
      };
      return { el, cells, L, W: L.W, H, labels, said, hotOnes,
        // the screen point at the middle of cell i
        at: (i) => [x - L.W / 2 + L.xs[i] + cell / 2, y + H / 2],
        // the middle of block b, just over it
        over: (b) => [x - L.W / 2 + (L.blocks[b].x0 + L.blocks[b].x1) / 2, y - 6],
        // every cell that is not 0 lights up, one after another `step` apart from t (or only the cells in `only`)
        light: (t, { step = 0, only = hotOnes, color } = {}) => only.forEach((i, k) => light1(i, t + k * step, color)),
        // the block names come in at t
        name: (t) => [...labels.flat(), ...said].forEach((e) => { gsap.set(e, HIDDEN); appear(e, t); }),
      };
    };
    // vectors stacked into a matrix, one row per entry of `rows` ({values, label}); the top centre of the
    // first row at (x, y). Each row's label sits to its left.
    const matrix = (parent, x, y, rows, kind, { cell = 20, gap = 3, space = 12, tall = 1.35, rowgap = 8, lit = false, names = false } = {}) => {
      const H = Math.round(cell * tall), step = H + rowgap, L = cut(kind, { cell, gap, space });
      const out = rows.map((r, n) => {
        const v = vec(parent, x, y + n * step, r.values, kind, { cell, gap, space, tall, lit: r.lit ?? lit, names: names && !n });
        const lbl = box(parent, `<div class="rowlbl" style="font-size:${Math.min(24, H * 0.8)}px">${r.label}</div>`, x - L.W / 2 - 18, y + n * step + H / 2, { xPercent: -100 });
        return { ...v, lbl };
      });
      const H_ = rows.length * step - rowgap;
      return { rows: out, W: L.W, H: H_, step, left: x - L.W / 2, top: y,
        // a frame around column i from t0 to t1
        col: (i, color, t0, t1) => {
          const f = box(parent, `<div class="colframe" style="width:${cell + 12}px;height:${H_ + 12}px;border-color:${color};box-shadow:0 0 18px ${color}88"></div>`, x - L.W / 2 + L.xs[i] + cell / 2, y + H_ / 2, SMALL);
          pop(f, t0); if (t1 != null) vanish(f, t1); return f;
        },
      };
    };
    // one block of a vector, magnified: a big cell per choice with the choice under it. Centred on (x, y).
    // on(t) lights the cells that are on in `values`.
    const zoom = (parent, x, y, kind, b, values, more = SMALL) => {
      const blk = cut(kind).blocks[b], color = CELL[blk.half];
      const el = box(parent, `<div class="zoom"><div class="zhead">${blk.name}</div><div class="zrow">${
        blk.choices.map((ch) => `<div class="zc"><b></b><span>${ch}</span></div>`).join("")}</div></div>`, x, y, more);
      const cells = [...el.querySelectorAll("b")];
      return { el, cells, blk, on: (t, colour = color) => blk.choices.forEach((_, k) => { if (values[blk.from + k]) {
        to(cells[k], t, t + 0.3, { backgroundColor: colour, boxShadow: `0 0 26px ${colour}` }); to(cells[k], t, t + 0.18, { scale: 1.2 }, "sine.out"); to(cells[k], t + 0.18, t + 0.45, { scale: 1 }, "sine.inOut"); } }) };
    };

    // ----- a hidden vector as a strip -----
    // `values` side by side, `cw` pixels each, the strip's top centre at the screen point (x, y); `upright` stands it
    // on end, the first number at the top. A positive number is ACCENT and a negative one BLUE, as strong as its size
    // against `max`; a 0 leaves the cell dark. wipe(t) draws the strip in from its start, and relu(t) fades its
    // negative numbers out.
    const heat = (parent, x, y, values, { cw = 2, h = 24, max = 0.5, upright = false } = {}) => {
      const long = values.length * cw, [W, H] = upright ? [h, long] : [long, h];
      const el = div(parent, "anchor"), cid = `${id}-heat${serial++}`; gsap.set(el, { x: x - W / 2, y });
      const s = svg("svg", { class: "world", viewBox: `0 0 ${W} ${H}`, width: W, height: H }, el);
      svg("defs", {}, s).innerHTML = `<clipPath id="${cid}"><rect width="${W}" height="${H}"/></clipPath>`;
      const clip = s.querySelector("rect"), body = svg("g", { "clip-path": `url(#${cid})` }, s), side = upright ? "height" : "width";
      svg("rect", { width: W, height: H, fill: "#141c33" }, body);
      const pos = svg("g", {}, body), neg = svg("g", {}, body);
      values.forEach((v, i) => { if (v) svg("rect", { ...(upright ? { y: i * cw, width: h, height: cw } : { x: i * cw, width: cw, height: h }),
        fill: v > 0 ? ACCENT : BLUE, "fill-opacity": Math.min(1, Math.abs(v) / max) }, v > 0 ? pos : neg); });
      return { el, W, H, pos, neg,
        wipe: (t, d = 0.6) => { gsap.set(clip, { attr: { [side]: 0 } }); to(clip, t, t + d, { attr: { [side]: upright ? H : W } }, "power2.inOut"); },
        relu: (t) => to(neg, t, t + 0.6, { autoAlpha: 0 }),
      };
    };
    // strips stacked, one per entry of `rows` ({values, label}), the top centre of the first at (x, y); each
    // row's label sits to its left
    const strips = (parent, x, y, rows, { cw = 2, h = 24, max = 0.5, rowgap = 10, size = 22 } = {}) => {
      const step = h + rowgap;
      const out = rows.map((r, n) => {
        const st = heat(parent, x, y + n * step, r.values, { cw, h, max });
        const lbl = box(parent, `<div class="rowlbl" style="font-size:${size}px">${r.label}</div>`, x - st.W / 2 - 18, y + n * step + h / 2, { xPercent: -100 });
        return { ...st, lbl };
      });
      return { rows: out, W: out[0].W, H: rows.length * step - rowgap, step, left: x - out[0].W / 2, top: y };
    };

    // ----- a chart -----
    // Axes round a box w × h pixels, its top left at the screen point (x, y). xr and yr are the ranges [lo, hi] the
    // axes span, and xticks and yticks the values to mark on them ([value, label]). Returns a group to draw in, and
    // px and py, which turn a value into a pixel.
    const plot = (parent, x, y, w, h, { xr, yr, xticks = [], yticks = [], xlabel = "", ylabel = "" }) => {
      const s = svg("svg", { class: "layer", viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, parent);
      const px = (v) => x + ((v - xr[0]) / (xr[1] - xr[0])) * w, py = (v) => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
      const axes = svg("g", {}, s), text = (tx, ty, str, more = {}) => { const e = svg("text", { x: tx, y: ty, fill: "#9aa5bd", "font-family": "JetBrains Mono", "font-size": 18, "text-anchor": "middle", ...more }, axes); e.textContent = str; return e; };
      xticks.forEach(([v, lbl]) => { svg("line", { x1: px(v), y1: y, x2: px(v), y2: y + h, stroke: "#1c2640", "stroke-width": 1.5 }, axes); text(px(v), y + h + 30, lbl); });
      yticks.forEach(([v, lbl]) => { svg("line", { x1: x, y1: py(v), x2: x + w, y2: py(v), stroke: "#1c2640", "stroke-width": 1.5 }, axes); text(x - 14, py(v) + 6, lbl, { "text-anchor": "end" }); });
      svg("path", { d: `M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h}`, fill: "none", stroke: "#46557c", "stroke-width": 2 }, axes);
      if (xlabel) text(x + w / 2, y + h + 66, xlabel, { "font-family": "Inter", "font-size": 21, "font-weight": 600 });
      if (ylabel) text(x - 70, y + h / 2, ylabel, { "font-family": "Inter", "font-size": 21, "font-weight": 600, transform: `rotate(-90 ${x - 70} ${y + h / 2})` });
      return { s, axes, g: svg("g", {}, s), px, py };
    };

    return { id, root, stage, LEN, ACCENT, svg, div, layer, canvas, box, HIDDEN, SMALL, at, tl, to, set, appear, vanish, show, fadeIn, fadeOut, pop, pulse, fly, link, caption, mol, vec, matrix, zoom, heat, strips, plot };
  }

  return { D, INK, BACK, BLUE, AMBER, GREEN, RED, MUTED, fmt, rnd, graph, centre, view, arrowText, bondText, cut, chapter };
})();
