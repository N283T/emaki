// ============================================================================
// The Topological Torsion film: its chapters and their pacing, and what more
// than one chapter needs to agree on. Loaded after data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, INK, bin, view, codeHTML } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 7.8, 1], ["path", 21.8, 1], ["codes", 31.4, 1], ["integer", 17.6, 1], ["bits", 19, 1], ["similarity", 33, 1], ["drug", 40.4, 1], ["outro", 6, 1]];

  // camera views of N-methylacetamide: the whole molecule, close on the carbonyl carbon, and set aside on the left
  const VIEW = { wide: view("A", [960, 590]), carbonyl: view("A", [640, 680], 1.35, [860, 480]), left: view("A", [520, 630], 0.9) };
  // a path as a token: its atom codes in a row, in the order the integer holds them. `hot` marks one of them.
  const chainHTML = (t, hot = -1) => `<span class="chain">${t.atoms.map((a, n) => (n === hot ? codeHTML(a).replace('class="code"', 'class="code hot"') : codeHTML(a))).join('<span class="link"></span>')}</span>`;
  // the nine bits of an atom code, coloured like the three numbers they hold
  const codeBits = ({ el, code }) => { const b = bin(code, 9);
    return `<span style="color:${INK[el]}">${b.slice(0, 4)}</span><span style="color:var(--pi)">${b.slice(4, 6)}</span><span style="color:var(--nbr)">${b.slice(6)}</span>`; };
  // the atoms of a path in the order they are walked on screen: the order the integer holds them
  const walk = (t) => t.atoms.map((a) => a.atom);
  // where the n-th path of the molecule sits: beside the molecule, in the list with its integer, and over the wall of bits
  const slot = (n) => [1400, 470 + n * 170];
  const list = (n) => [820, 490 + n * 150];
  const LIST = 1.3; // the size of a token in the list
  const grid = (n) => [575 + n * 770, 345];
  const GRID = 0.92; // the size of a token over the wall
  // the wall of bits the film explains with, the full-length one, and the two molecules compared over the first
  const WALL = [230, 650], FULL = [180, 620];
  VIEW.drug = view("P", [960, 545], 0.62); VIEW.drugTop = view("P", [560, 425], 0.46);
  VIEW.a = view("A", [400, 405], 0.5); VIEW.b = view("B", [1520, 405], 0.5);

  return { title: "Topological Torsion", accent: "#f472b6", chapters, VIEW, chainHTML, codeBits, walk, slot, list, LIST, grid, GRID, WALL, FULL };
})();
