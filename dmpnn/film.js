// ============================================================================
// The D-MPNN film: Chemprop's model in one go, as one scroll the camera runs
// along. Loaded after data.js and kit.js.
// ============================================================================
window.emaki.film = (() => {
  const { D, view } = window.emaki;
  // [chapter, the length of its script in seconds, how fast it plays]. The film is one chapter, compositions/story.html;
  // after changing its length, `node sync-clips.mjs` moves the clip in index.html to match.
  const chapters = [["story", 100, 1]];
  const num = (x, places = 2) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(places);
  // where things stand on the scroll, in world units: the molecule, the sum, the hidden layer, the prediction
  const AT = { mol: 960, pool: 2450, hidden: 2900, out: 3260, y: 560 };

  return { title: "D-MPNN", accent: "#34d399", chapters, num, AT, VIEW: { mol: view("P", [960, 540], 1, [960, 540]) } };
})();
