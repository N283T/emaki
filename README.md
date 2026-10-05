# emaki

Step-by-step animations of chem/bio informatics algorithms.

An *emaki* (絵巻) is a Japanese picture scroll: a story told in pictures, read as the scroll
is unrolled. Each entry in this repository takes one algorithm and shows it one step at a time,
together with the code that renders the animation.

## Animations

| Animation | Algorithm |
|---|---|
| [ecfp](ecfp/) | How ECFP4 turns a molecule into a folded bit vector, and what Tanimoto similarity makes of it |

Each animation is a directory with `index.html`, `style.css` and `movie.js`, and no build step.
Serve the repository locally and open the directory in a browser:

```bash
python3 -m http.server
```

Space plays and pauses, the arrow keys step two seconds, and `?t=30` in the URL starts at that second.

## Export

One self-contained HTML file, with the stylesheet and script inlined:

```bash
python3 tools/bundle.py ecfp
```

A video, recorded frame by frame in headless Chrome (needs [uv](https://docs.astral.sh/uv/); ffmpeg is fetched if it is not installed):

```bash
uv run tools/render.py ecfp
```

The format follows the extension given to `-o` (`.mp4`, `.webm`, `.mov`, `.gif`). `--fps`, `--width`, `--start` and `--end` change the frame rate, the size and the range.

An animation can be recorded when its page, opened with `?capture`, shows only the picture and
sets `window.emaki = { duration, renderAt(seconds) }`.

## HyperFrames (experimental)

[hyperframes/ecfp](hyperframes/ecfp/) is the same ECFP animation as a [HyperFrames](https://github.com/heygen-com/hyperframes)
project. The folding and similarity chapters are sub-compositions built from GSAP tweens
(`compositions/`); the earlier chapters and the outro are still drawn by `movie.js`. Both share
`kit.js`: the tempo, the molecule, and the helpers a chapter is built with.

```bash
cd hyperframes/ecfp
npm run dev     # Studio preview
npm run check   # lint, runtime, layout, motion, contrast
npm run render  # MP4
```

## Reuse

Take anything here and adapt it: change the molecule, the colors, the pacing, the language.

- Code is under the [MIT License](LICENSE).
- Rendered videos and images are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
