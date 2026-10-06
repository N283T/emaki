# emaki

Step-by-step animations of chem/bio informatics algorithms.

An *emaki* (絵巻) is a Japanese picture scroll: a story told in pictures, read as the scroll
is unrolled. Each entry in this repository takes one algorithm and shows it one step at a time,
together with the code that renders the animation.

## Animations

| Animation | Algorithm |
|---|---|
| [ecfp](ecfp/) | How ECFP4 turns a molecule into a folded bit vector, and what Tanimoto similarity makes of it |

Each animation is a [HyperFrames](https://github.com/heygen-com/hyperframes) project: HTML, CSS and
JavaScript that render to video, with no build step. It needs Node.js, and ffmpeg to render.

```bash
cd ecfp
npm run dev     # preview and edit in HyperFrames Studio
npm run check   # lint, runtime, layout, motion, contrast
npm run render  # an MP4 under renders/
```

## How an animation is put together

- `index.html` is a list of clips, one per chapter.
- `compositions/` holds the chapters. Each is a sub-composition whose motion is GSAP tweens, written
  in *story seconds*: the storyboard's own clock.
- `kit.js` is what the chapters share: the tempo, the molecule and its identifiers, and the helpers a
  chapter is built with (the camera, an atom's environment lighting up, flying chips, captions).
- `style.css` has the shared looks.

The pacing is one table, `PLAN` in `kit.js`: how fast each stretch of the storyboard plays. After changing it,
`node sync-clips.mjs` moves the clips in `index.html` to match.

## Reuse

Take anything here and adapt it: change the molecule, the colors, the pacing, the language.

- Code is under the [MIT License](LICENSE).
- Rendered videos and images are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
