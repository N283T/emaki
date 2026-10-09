# emaki

Step-by-step animations of chem/bio informatics algorithms.

An *emaki* (絵巻) is a Japanese picture scroll: a story told in pictures, read as the scroll
is unrolled. Each entry in this repository takes one algorithm and shows it one step at a time,
together with the code that renders the animation.

## Animations

| Animation | Algorithm |
|---|---|
| [ecfp](ecfp/) | How ECFP4 turns a molecule into a folded bit vector, and what Tanimoto similarity makes of it |
| [atompair](atompair/) | Atom Pair: every pair of atoms and the bonds between them, packed into integers, with counts kept in the bits |
| [torsion](torsion/) | Topological Torsion: every path of four atoms, and why one extra carbon can leave two molecules with no bit in common |
| [rdkitfp](rdkitfp/) | The RDKit fingerprint: every fragment up to seven bonds, two bits each, and why it suits substructure search |

The four fingerprint films follow the same two molecules, N-methylacetamide and N-ethylacetamide, and each
ends on their Tanimoto similarity under its fingerprint: 0.41, 0.32, 0.00 and 0.79.

### D-MPNN

| Animation | Algorithm |
|---|---|
| [dmpnn-pv](dmpnn-pv/) | A 72-second promo for D-MPNN in 3D (three.js): directed bonds, messages, the molecule's vector, a prediction, training. Illustrative, not computed |
| [dmpnn](dmpnn/) | Chemprop's D-MPNN in one film: paracetamol through the whole model, the model training on ESOL, and paracetamol again |

### Chemprop, step by step

A series on [Chemprop](https://github.com/chemprop/chemprop)'s directed message passing neural network (D-MPNN),
from the molecule in to the prediction out.

| Animation | Algorithm |
|---|---|
| [molgraph](molgraph/) | What a molecule becomes before Chemprop learns anything: 72 numbers per atom, 14 per bond, and every bond turned into two directed ones |
| [messages](messages/) | Directed message passing: what each directed bond hears, why never its own reverse, and how far it hears in Chemprop's three steps |
| [readout](readout/) | From a row per atom to one prediction: the rows added up and divided by 100, a learned fingerprint, and the feed-forward network |
| [training](training/) | The same model trained on ESOL's measured solubilities: z-scores, the loss, 50 epochs, the test set, and paracetamol, kept out to the end |

Every film starts from N-methylacetamide, the molecule of the fingerprint films, and ends on paracetamol. The last one
finds paracetamol's solubility within 0.25 log units of its measured value, without having seen it.

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
- `compositions/` holds the chapters. Each is a sub-composition whose motion is GSAP tweens.
- `kit.js` is what the chapters share: the helpers a chapter is built with (the camera, a walk along
  the bonds, flying boxes, captions, the wall of bits).
- `style.css` has the shared looks.

`ecfp` also keeps its molecule, its identifiers and its pacing in `kit.js`: the `PLAN` table says how fast each
stretch of the storyboard plays, and the chapters are written in *story seconds*, the storyboard's own clock.

`atompair`, `torsion` and `rdkitfp` share one `kit.js` and one `style.css`, as identical copies so that each
project stands on its own, and keep what differs in three more files:

- `data.py` computes every number the film shows with RDKit and writes it to `data.js` (`uv run data.py`).
  The film draws what is there and computes nothing chemical itself.
- `film.js` has the chapter table, each chapter's length and speed, and the layout its chapters agree on.
- Chapters are written in seconds from their own start.

After changing the pacing of any of them, `node sync-clips.mjs` moves the clips in `index.html` to match.

The Chemprop films are built the same way, and share a `kit.js` and a `style.css` of their own (identical copies in
`molgraph`, `messages`, `readout`, `training` and `dmpnn`): they keep the fingerprint films' camera, molecule and captions, and add directed bonds,
feature vectors drawn as rows of cells cut into blocks, and hidden vectors drawn as strips. Their `data.py` runs
Chemprop 2.3.1 itself, so `uv run data.py` installs PyTorch the first time. The hidden vectors in `messages` and `readout` come
from the weights a new model starts with (seed 0): real numbers, nothing learned yet. `training` trains that same
model on ESOL (Delaney, *J. Chem. Inf. Comput. Sci.* 2004), which its `data.py` downloads from MoleculeNet and checks
against a SHA-256; the training takes a few minutes on a CPU and comes out the same every time.

`dmpnn-pv` stands apart: one `index.html` whose words are GSAP and whose pictures are one three.js scene in `scene.js`,
drawn from HyperFrames time on every seek. Its `data.py` only embeds the 3D shapes of the molecules with RDKit; the
model's numbers in it are made up for the look. It renders through WebGL, in software where there is no GPU.

Every `npm run render` here passes `--no-experimental-fast-capture`: HyperFrames' fast capture left the wall
of bits out of some stretches of two of the videos, which `snapshot` and `check` do not show.

## Reuse

Take anything here and adapt it: change the molecule, the colors, the pacing, the language.

- Code is under the [MIT License](LICENSE).
- Rendered videos and images are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
