# /// script
# requires-python = ">=3.12"
# dependencies = ["chemprop==2.3.1"]
# ///
"""Write data.js: every number the Training film shows, computed by Chemprop and RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself. It trains the model
of the Readout film, as `chemprop train` would (a random 80/10/10 split, targets as z-scores,
batches of 64, 50 epochs), on ESOL: the water solubilities Delaney collected (J. Chem. Inf.
Comput. Sci. 2004, 44, 1000), as MoleculeNet serves them. Paracetamol is in ESOL; it is kept
out of all three splits, so that the film can end on a molecule the model has never seen.
"""

import csv
import hashlib
import io
import json
import math
import urllib.request
from pathlib import Path

import chemprop
import lightning.pytorch as pl
import rdkit
import torch
from chemprop.data import (
    BatchMolGraph,
    MoleculeDatapoint,
    MoleculeDataset,
    build_dataloader,
    make_split_indices,
    split_data_by_indices,
)
from chemprop.featurizers import SimpleMoleculeMolGraphFeaturizer
from chemprop.models import MPNN
from chemprop.nn import (
    BondMessagePassing,
    NormAggregation,
    RegressionFFN,
    UnscaleTransform,
)
from rdkit import Chem
from rdkit.Chem import rdDepictor

ESOL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/delaney-processed.csv"
ESOL_SHA256 = "8c06a76f0c6487d29ab0f903e6a7a7139f189ab3c1178f159c8be8964602f189"
TARGET = "measured log solubility in mols per litre"
EPOCHS = 50  # chemprop train's default
SHOWN = [
    0,
    1,
    2,
    3,
    5,
    10,
    20,
    30,
    50,
]  # the epochs after which the film shows the test set

SEED = 0
BOND = 233.24  # the length of a bond on screen, in world units (1920 x 1080)

# Hand-placed atoms, the same picture as in the fingerprint films. `side` is where an
# atom's tag hangs: 1 below the atom, -1 above it.
PLACED = {
    "A": [(660, 600, 1), (860, 480, 1), (860, 268, -1), (1060, 600, 1), (1260, 480, 1)]
}
MOLECULES = {
    "A": ("N-methylacetamide", "CC(=O)NC"),
    "P": ("Paracetamol", "CC(=O)Nc1ccc(O)cc1"),
}
SUBSCRIPT = {1: "", 2: "₂", 3: "₃", 4: "₄"}


def label(atom: Chem.Atom) -> str:
    """The text in an atom's disc: CH₃, NH, O …"""
    h = atom.GetTotalNumHs()
    return atom.GetSymbol() + (f"H{SUBSCRIPT[h]}" if h else "")


def depict(mol: Chem.Mol) -> list[tuple[float, float, int]]:
    """RDKit's 2D coordinates, laid along the x axis and scaled to BOND."""
    rdDepictor.Compute2DCoords(mol)
    conf = mol.GetConformer()
    pts = [
        (conf.GetAtomPosition(i).x, -conf.GetAtomPosition(i).y)
        for i in range(mol.GetNumAtoms())
    ]
    cx, cy = (sum(c) / len(pts) for c in zip(*pts, strict=True))
    pts = [(x - cx, y - cy) for x, y in pts]
    sxx = sum(x * x for x, _ in pts)
    syy = sum(y * y for _, y in pts)
    sxy = sum(x * y for x, y in pts)
    turn = -0.5 * math.atan2(2 * sxy, sxx - syy)
    cos, sin = math.cos(turn), math.sin(turn)
    pts = [(x * cos - y * sin, x * sin + y * cos) for x, y in pts]
    bond = mol.GetBondWithIdx(0)
    (x0, y0), (x1, y1) = pts[bond.GetBeginAtomIdx()], pts[bond.GetEndAtomIdx()]
    scale = BOND / math.hypot(x1 - x0, y1 - y0)
    if pts[0][0] > 0:  # the acetyl group goes on the left, as in A
        pts = [(-x, y) for x, y in pts]
    return [(round(960 + x * scale, 1), round(540 + y * scale, 1), 1) for x, y in pts]


def molecule(key: str) -> tuple[Chem.Mol, dict]:
    name, smiles = MOLECULES[key]
    mol = Chem.MolFromSmiles(smiles)
    kekule = Chem.Mol(mol)
    Chem.Kekulize(kekule, clearAromaticFlags=True)
    placed = PLACED.get(key) or depict(mol)
    atoms = [
        {"el": a.GetSymbol(), "text": label(a), "x": x, "y": y, "side": side}
        for a, (x, y, side) in zip(mol.GetAtoms(), placed, strict=True)
    ]
    bonds = [
        [b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(b.GetBondTypeAsDouble())]
        for b in kekule.GetBonds()
    ]
    return mol, {"name": name, "smiles": smiles, "atoms": atoms, "bonds": bonds}


def esol() -> list[tuple[str, str, float]]:
    """ESOL's rows as (name, SMILES, measured log solubility), checked against a known copy."""
    raw = urllib.request.urlopen(ESOL, timeout=60).read()
    assert hashlib.sha256(raw).hexdigest() == ESOL_SHA256, (
        "ESOL is not the file this film was made from"
    )
    rows = csv.DictReader(io.StringIO(raw.decode()))
    return [(r["Compound ID"], r["smiles"].strip(), float(r[TARGET])) for r in rows]


class Watch(pl.Callback):
    """Keeps what the film shows of training: the loss of each batch and its learning rate, the mean loss of each
    epoch on the training and validation sets, and the predictions for the test set after the epochs in SHOWN."""

    def __init__(self, show):
        self.show, self.steps, self.lr, self.train, self.val, self.seen = (
            show,
            [],
            [],
            [],
            [],
            {},
        )
        self._epoch = []

    def on_train_batch_end(self, trainer, model, outputs, batch, batch_idx):
        loss = float(outputs["loss"] if isinstance(outputs, dict) else outputs)
        self.steps.append(round(loss, 5))
        self._epoch.append(loss)
        self.lr.append(trainer.optimizers[0].param_groups[0]["lr"])

    def on_train_epoch_end(self, trainer, model):
        self.train.append(round(sum(self._epoch) / len(self._epoch), 5))
        self._epoch = []
        val = trainer.callback_metrics.get("val_loss")
        self.val.append(round(float(val), 5) if val is not None else None)
        if trainer.current_epoch + 1 in SHOWN:
            self.seen[trainer.current_epoch + 1] = self.show(model)


def main() -> None:
    torch.manual_seed(SEED)
    mp = (
        BondMessagePassing()
    )  # the Readout film's model: same seed, made in the same order
    agg = NormAggregation()
    featurizer = SimpleMoleculeMolGraphFeaturizer()

    rows = esol()
    para = Chem.MolToSmiles(Chem.MolFromSmiles(MOLECULES["P"][1]))
    kept = [r for r in rows if Chem.MolToSmiles(Chem.MolFromSmiles(r[1])) == para]
    assert len(kept) == 1
    rows = [r for r in rows if r not in kept]
    points = [MoleculeDatapoint.from_smi(smi, [y], name=name) for name, smi, y in rows]
    train_i, val_i, test_i = make_split_indices(
        [p.mol for p in points], "random", (0.8, 0.1, 0.1), seed=SEED
    )
    train, val, test = split_data_by_indices(points, train_i, val_i, test_i)
    train, val, test = (MoleculeDataset(d[0], featurizer) for d in (train, val, test))
    scaler = train.normalize_targets()
    val.normalize_targets(scaler)

    ffn = RegressionFFN(output_transform=UnscaleTransform.from_standard_scaler(scaler))
    model = MPNN(mp, agg, ffn)
    last = [m for m in ffn.ffn.modules() if isinstance(m, torch.nn.Linear)][-1]

    # the molecules the film follows, outside the data, and the test set
    extra = {
        key: featurizer(Chem.MolFromSmiles(smi)) for key, (_, smi) in MOLECULES.items()
    }
    test_graphs = [featurizer(p.mol) for p in test.data]

    def show(m: MPNN) -> dict:
        was = m.training
        m.eval()
        with torch.no_grad():
            out = {
                "test": [
                    round(float(y), 3) for y in m(BatchMolGraph(test_graphs)).flatten()
                ],
                **{k: round(float(m(BatchMolGraph([g]))), 3) for k, g in extra.items()},
                "last": [round(float(w), 4) for w in last.weight.flatten()]
                + [round(float(last.bias), 4)],
            }
        m.train(was)
        return out

    watch = Watch(show)
    watch.seen[0] = show(model)
    trainer = pl.Trainer(
        max_epochs=EPOCHS,
        accelerator="cpu",
        devices=1,
        deterministic=True,
        logger=False,
        enable_checkpointing=False,
        enable_progress_bar=False,
        enable_model_summary=False,
        callbacks=[watch],
    )
    pl.seed_everything(SEED, verbose=False)
    trainer.fit(
        model,
        build_dataloader(train, batch_size=64, num_workers=0, seed=SEED),
        build_dataloader(val, batch_size=64, num_workers=0, shuffle=False),
    )

    measured = [float(p.y[0]) for p in test.data]
    final = watch.seen[EPOCHS]["test"]
    rmse = math.sqrt(sum((a - b) ** 2 for a, b in zip(final, measured)) / len(measured))
    mean = sum(measured) / len(measured)
    r2 = 1 - sum((a - b) ** 2 for a, b in zip(final, measured)) / sum(
        (b - mean) ** 2 for b in measured
    )
    data: dict = {
        "chemprop": chemprop.__version__,
        "rdkit": rdkit.__version__,
        "seed": SEED,
        "epochs": EPOCHS,
        "batch": 64,
        "esol": {
            "n": len(rows) + len(kept),
            "kept": {"name": kept[0][0], "y": kept[0][2]},
        },
        "split": {"train": len(train), "val": len(val), "test": len(test)},
        "scaler": {
            "mean": round(float(scaler.mean_[0]), 4),
            "std": round(float(scaler.scale_[0]), 4),
        },
        "train_y": [
            float(p.y[0]) for p in train.data
        ],  # the datapoints keep their measured values
        "test": {
            "names": [p.name for p in test.data],
            "smiles": [Chem.MolToSmiles(p.mol) for p in test.data],
            "y": measured,
        },
        "steps": watch.steps,
        "lr": [float(f"{x:.3g}") for x in watch.lr],
        "loss": {"train": watch.train, "val": watch.val},
        "seen": watch.seen,
        "rmse": round(rmse, 3),
        "r2": round(r2, 3),
        "mols": {},
    }
    for key in MOLECULES:
        _, data["mols"][key] = molecule(key)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    header = (
        f"// Written by data.py (uv run data.py) with Chemprop {chemprop.__version__} "
        f"and RDKit {rdkit.__version__}. Do not edit.\n"
    )
    Path(__file__).with_name("data.js").write_text(
        f"{header}window.emakiData = {text};\n"
    )
    print(
        f"data.js: {len(text)} bytes",
        data["split"],
        data["scaler"],
        "rmse",
        data["rmse"],
        "r2",
        data["r2"],
    )
    print(
        "train", watch.train[:3], watch.train[-3:], "val", watch.val[:3], watch.val[-3:]
    )
    print("lr", watch.lr[0], max(watch.lr), watch.lr[-1], len(watch.lr), "steps")
    for e in SHOWN:
        print(e, {k: v for k, v in watch.seen[e].items() if k not in ("test", "last")})
    print("paracetamol measured", kept[0])


if __name__ == "__main__":
    main()
