// ============================================================================
// The Training film, the fourth of the Chemprop films: its chapters and their
// pacing, and what more than one chapter needs to agree on. Loaded after
// data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, view } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. A chapter is compositions/<name>.html;
  // after changing a length or a speed, `node sync-clips.mjs` moves the clips in index.html to match.
  const chapters = [["intro", 8, 1], ["data", 24, 1], ["zscore", 20, 1], ["loss", 22, 1], ["step", 24, 1], ["epochs", 30, 1], ["test", 22, 1], ["last", 18, 1], ["drug", 24, 1], ["outro", 8, 1]];

  const VIEW = { wide: view("A", [960, 590]), drug: view("P", [520, 600], 0.45) };
  const num = (x, places = 2) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(places);
  // the scatter of the test set the chapters share: measured log S along x, predicted up y, the same range on both
  const RANGE = [-9, 2], TICKS = [-8, -6, -4, -2, 0, 2].map((v) => [v, num(v, 0)]);
  const SCATTER = { x: 760, y: 300, w: 600, h: 600 };

  return { title: "Training", accent: "#38bdf8", chapters, VIEW, num, RANGE, TICKS, SCATTER };
})();
