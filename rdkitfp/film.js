// ============================================================================
// The RDKit fingerprint film: its chapters and their pacing, and what more
// than one chapter needs to agree on. Loaded after data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, view, molSVG } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 7.8, 1], ["atoms", 18, 1], ["fragments", 32.2, 1], ["hash", 26, 1], ["bits", 37.4, 1], ["similarity", 38.4, 1], ["drug", 25, 1], ["outro", 6, 1]];
  const accent = "#fb923c";

  // camera views of N-methylacetamide: the whole molecule, and set aside on the left
  const VIEW = { wide: view("A", [960, 590]), left: view("A", [450, 640], 0.8) };
  // the fragments of molecule A, smallest first, and the picture of one
  const F = D.fragments.A, sizes = [...new Set(F.map((f) => f.bonds.length))];
  const thumbHTML = (f, key = "A") => `<div class="thumb">${molSVG(key, 100, { on: f.bonds, color: accent, plain: true })}</div>`;
  // where fragment n sits: in the gallery beside the molecule (a row per size), and in one row over the wall of bits
  const row = (n) => sizes.indexOf(F[n].bonds.length), col = (n) => n - F.findIndex((f) => f.bonds.length === F[n].bonds.length);
  const slot = (n) => [1110 + col(n) * 200, 345 + row(n) * 152];
  const rowLabel = (r) => [1000, 345 + r * 152]; // the right edge of a row's name
  const rowHTML = (size) => `<div class="lbl">${size} bond${size > 1 ? "s" : ""}</div>`;
  // a bond as text, C–N or C=O, its elements in alphabetical order
  const bondName = (b, key = "A") => { const M = D.mols[key], [i, j, order] = M.bonds[b], [p, q] = [M.atoms[i].el, M.atoms[j].el].sort(); return `${p}${order === 2 ? "=" : "–"}${q}`; };
  // the fragment the film looks at closely: two bonds, one of them the double bond, the other to the nitrogen
  const FOCUS = F.findIndex((f) => f.bonds.length === 2 && f.bonds.map((b) => bondName(b)).sort().join() === "C=O,C–N");
  const strip = (n) => [960 + (n - (F.length - 1) / 2) * 151, 372];
  const STRIP = 0.8; // the size of a picture in the strip
  // the wall of bits the film explains with, the full-length one, and the two molecules compared over the first
  const WALL = [229, 650], FULL = [194, 620];
  VIEW.a = view("A", [400, 405], 0.5); VIEW.b = view("B", [1520, 405], 0.5);
  VIEW.drug = view("P", [520, 430], 0.46); VIEW.big = view("K", [520, 418], 0.32);

  return { title: "RDKit Fingerprint", accent, chapters, VIEW, F, sizes, thumbHTML, rowHTML, bondName, FOCUS, slot, rowLabel, strip, STRIP, WALL, FULL };
})();
