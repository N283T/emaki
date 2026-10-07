// Sets each chapter clip's data-start / data-duration in index.html, and the film's length, from the
// chapter table in film.js. Run after changing a chapter's length or speed:  node sync-clips.mjs
import { readFileSync, writeFileSync } from "node:fs";

const window = {};
for (const script of ["data.js", "kit.js", "film.js"]) new Function("window", readFileSync(new URL(script, import.meta.url), "utf8"))(window);

const file = new URL("index.html", import.meta.url);
let html = readFileSync(file, "utf8"), start = 0; // whole milliseconds, so neighbouring clips meet exactly
for (const [id, length, speed = 1] of window.emaki.film.chapters) {
  const duration = Math.round((length / speed) * 1000);
  const clip = new RegExp(`(id="el-${id}"[^>]*data-start=")[^"]*(" data-duration=")[^"]*`);
  if (!clip.test(html)) throw new Error(`no clip for chapter "${id}" in index.html`);
  html = html.replace(clip, `$1${start / 1000}$2${duration / 1000}`);
  console.log(id.padEnd(11), (start / 1000).toFixed(3).padStart(8), (duration / 1000).toFixed(3).padStart(8));
  start += duration;
}
writeFileSync(file, html.replace(/(id="root"[^>]*data-duration=")[^"]*/, `$1${start / 1000}`));
console.log("film".padEnd(11), "", (start / 1000).toFixed(3).padStart(16));
