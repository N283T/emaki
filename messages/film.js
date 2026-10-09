// ============================================================================
// The Messages film, the second of the Chemprop films: its chapters and their
// pacing, and what more than one chapter needs to agree on. Loaded after
// data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, view } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 8, 1], ["hidden", 24, 1], ["message", 30, 1], ["listen", 24, 1], ["update", 24, 1], ["depth", 30, 1], ["atoms", 26, 1], ["drug", 22, 1], ["outro", 7, 1]];

  // camera views of N-methylacetamide: the whole molecule, aside on the left, set high, and small in a corner;
  // and of paracetamol, whole
  const VIEW = { wide: view("A", [960, 590]), left: view("A", [520, 560], 0.85), high: view("A", [960, 440], 0.85), corner: view("A", [1480, 400], 0.72) };
  VIEW.drug = view("P", [960, 600], 0.62);
  const G = D.graphs.A, M = D.mols.A, edge = (u, v) => G.edges.findIndex(([a, b]) => a === u && b === v);
  const el = (n) => M.atoms[n].el, text = (n) => M.atoms[n].text;
  // the atoms the film names: the carbonyl carbon, its oxygen, the nitrogen, and the methyl on the nitrogen
  const C = M.atoms.findIndex((a, n) => a.el === "C" && a.text === "C"), O = M.atoms.findIndex((a) => a.el === "O");
  const N = M.atoms.findIndex((a) => a.el === "N"), FAR = G.edges.find(([u, v]) => u === N && v !== C)[1];
  // the directed bonds the film follows: C→NH, whose message is worked out, and NH→CH₃, whose reach grows
  const FOCUS = edge(C, N), REACH = edge(N, FAR);
  // the strips are as bright as their numbers are against MAX
  const MAX = 0.4;

  return { title: "Messages", accent: "#a3e635", chapters, VIEW, C, O, N, FAR, FOCUS, REACH, MAX, el, text };
})();
