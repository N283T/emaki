// Sets each chapter clip's data-start / data-duration in index.html, and the film's length, from
// the tempo table in kit.js. Run after changing PLAN or CHAPTERS:  node sync-clips.mjs
import { readFileSync, writeFileSync } from "node:fs";

const window = {};
new Function("window", readFileSync(new URL("kit.js", import.meta.url), "utf8"))(window);
const { CHAPTERS, STORY_END, real } = window.emaki;

const ms = (s) => Math.round(real(s) * 1000); // whole milliseconds, so neighbouring clips meet exactly
const end = Math.floor(real(STORY_END) * 1000);
const file = new URL("index.html", import.meta.url);
let html = readFileSync(file, "utf8").replace(/(id="root"[^>]*data-duration=")[^"]*/, `$1${end / 1000}`);
for (const [id, s0, s1] of CHAPTERS) {
  const start = ms(s0), stop = Math.min(ms(s1), end);
  const clip = new RegExp(`(id="el-${id}"[^>]*data-start=")[^"]*(" data-duration=")[^"]*`);
  if (!clip.test(html)) throw new Error(`no clip for chapter "${id}" in index.html`);
  html = html.replace(clip, `$1${start / 1000}$2${(stop - start) / 1000}`);
  console.log(id.padEnd(11), (start / 1000).toFixed(3).padStart(7), ((stop - start) / 1000).toFixed(3).padStart(7));
}
writeFileSync(file, html);
console.log("film".padEnd(11), "", (end / 1000).toFixed(3).padStart(14));
