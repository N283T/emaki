// ============================================================================
// The Readout film, the third of the Chemprop films: its chapters and their
// pacing, and what more than one chapter needs to agree on. Loaded after
// data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, INK, view } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 8, 1], ["atoms", 18, 1], ["pool", 28, 1], ["fingerprint", 22, 1], ["ffn", 28, 1], ["model", 24, 1], ["drug", 22, 1], ["outro", 7, 1]];

  // camera views of N-methylacetamide: the whole molecule, aside on the left, and small in a corner; and of
  // paracetamol, aside on the left
  const VIEW = { wide: view("A", [960, 590]), left: view("A", [520, 560], 0.85), corner: view("A", [1480, 400], 0.72) };
  VIEW.drugLeft = view("P", [450, 560], 0.45);
  // an atom's name, after its index: its row in the atom matrix
  const atomLabel = (key, n) => { const a = D.mols[key].atoms[n]; return `<span class="ix">${n}</span><span style="color:${INK[a.el]}">${a.text}</span>`; };
  // the strips are as bright as their numbers are against MAX
  const MAX = 0.4;
  const num = (x, places = 4) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(places);

  return { title: "Readout", accent: "#e879f9", chapters, VIEW, atomLabel, MAX, num };
})();
