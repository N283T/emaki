# komaokuri

Step-by-step animations of chem/bio informatics algorithms.

*Komaokuri* (コマ送り) is Japanese for advancing a film one frame at a time.
Each entry in this repository takes one algorithm and shows it one step at a time,
together with the code that renders the animation.

## Animations

| Animation | Algorithm |
|---|---|
| [ecfp](ecfp/) | How ECFP4 turns a molecule into a folded bit vector, and what Tanimoto similarity makes of it |

Each animation is a single HTML file with no build step. Open it in a browser, or serve the
repository locally:

```bash
python3 -m http.server
```

Space plays and pauses, the arrow keys step two seconds, and `?t=30` in the URL starts at that second.

## Reuse

Take anything here and adapt it: change the molecule, the colors, the pacing, the language.

- Code is under the [MIT License](LICENSE).
- Rendered videos and images are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
