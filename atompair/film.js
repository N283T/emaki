// ============================================================================
// The Atom Pair film: its chapters and their pacing, and what more than one
// chapter needs to agree on. Loaded after data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, INK, bin, view, codeHTML } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 7.8, 1], ["atoms", 24.8, 1], ["pairs", 30, 1], ["integer", 24, 1], ["bits", 34.4, 1], ["similarity", 38, 1], ["drug", 30.6, 1], ["outro", 6, 1]];

  // camera views of N-methylacetamide: the whole molecule, close on the carbonyl carbon, and set aside on the left
  const VIEW = { wide: view("A", [960, 590]), carbonyl: view("A", [640, 680], 1.35, [860, 480]), left: view("A", [545, 630], 0.9) };
  // an atom pair as a token: the two atom codes, smaller first, and the bonds between them
  const pairHTML = (key, p) => `<span class="pair">${codeHTML(D.codes[key][p.lo])}<span class="dist"><em>${p.d}</em></span>${codeHTML(D.codes[key][p.hi])}</span>`;
  // the nine bits of an atom code, coloured like the three numbers they hold
  const codeBits = ({ el, code }) => { const b = bin(code, 9);
    return `<span style="color:${INK[el]}">${b.slice(0, 4)}</span><span style="color:var(--pi)">${b.slice(4, 6)}</span><span style="color:var(--nbr)">${b.slice(6)}</span>`; };
  // where the n-th pair of the molecule sits: in the list beside the molecule (two columns of five),
  // and in the grid it is later laid out in (two rows of five, the first at height y)
  const slot = (n) => [1215 + Math.floor(n / 5) * 420, 366 + (n % 5) * 100];
  const list = (n) => [490 + Math.floor(n / 5) * 700, 392 + (n % 5) * 96]; // centred, with room for each pair's integer
  const grid = (n) => [960 + ((n % 5) - 2) * 356, 322 + Math.floor(n / 5) * 112]; // two rows of five over the wall of bits
  const GRID = 0.88; // the size of a token in the grid
  // the wall of bits the film explains with, the full-length one, and the two molecules compared over the first
  const WALL = [230, 650], FULL = [180, 620];
  // the bits of a fingerprint that keeps counts: in each block, one bit for each of 1, 2, 4 and 8 pairs it has reached
  const BOUNDS = [1, 2, 4, 8];
  VIEW.drug = view("P", [960, 545], 0.62); VIEW.drugTop = view("P", [560, 425], 0.46);
  VIEW.a = view("A", [400, 405], 0.5); VIEW.b = view("B", [1520, 405], 0.5);

  return { title: "Atom Pair", accent: "#2dd4bf", chapters, VIEW, pairHTML, codeBits, slot, list, grid, GRID, WALL, FULL, BOUNDS };
})();
