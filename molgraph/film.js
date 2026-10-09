// ============================================================================
// The MolGraph film, the first of the Chemprop films: its chapters and their
// pacing, and what more than one chapter needs to agree on. Loaded after
// data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, view } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 8, 1], ["atom", 31, 1], ["matrix", 22, 1], ["bond", 23, 1], ["directed", 31, 1], ["input", 27, 1], ["drug", 25, 1], ["outro", 7, 1]];

  // camera views of N-methylacetamide: the whole molecule, close on the carbonyl carbon, small in a corner, and
  // set high, aside on the left, or above a row of cells; and of paracetamol, whole and aside
  const VIEW = { wide: view("A", [960, 590]), carbonyl: view("A", [520, 600], 1.3, [860, 480]), carbonylUp: view("A", [560, 560], 1.0, [860, 480]), corner: view("A", [1480, 390], 0.72), high: view("A", [960, 470], 0.9), left: view("A", [520, 560], 0.85), arrows: view("A", [960, 500], 0.85), input: view("A", [960, 440], 0.8) };
  VIEW.drug = view("P", [960, 560], 0.62); VIEW.drugLeft = view("P", [450, 540], 0.45);
  // the atoms of N-methylacetamide in the order the film takes them: the carbonyl carbon first
  const CARBONYL = 1;
  // the directed bond the film follows: from the carbonyl carbon to its oxygen, and the same bond back
  const k = D.graphs.A.edges.findIndex(([u, v]) => u === CARBONYL && D.mols.A.atoms[v].el === "O");
  const CO = [k, D.graphs.A.rev[k]];

  return { title: "MolGraph", accent: "#a78bfa", chapters, VIEW, CARBONYL, CO };
})();
