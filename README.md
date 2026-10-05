# komaokuri

Step-by-step animations of chem/bio informatics algorithms.

*Komaokuri* (コマ送り) is Japanese for advancing a film one frame at a time.
Each entry in this repository takes one algorithm and shows it one step at a time,
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
sets `window.komaokuri = { duration, renderAt(seconds) }`.

## Reuse

Take anything here and adapt it: change the molecule, the colors, the pacing, the language.

- Code is under the [MIT License](LICENSE).
- Rendered videos and images are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
