# /// script
# requires-python = ">=3.12"
# dependencies = ["chemprop==2.3.1"]
# ///
"""Write data.js: every number the Readout film shows, computed by Chemprop and RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself. The model is the one
`chemprop train` builds by default (norm aggregation, a feed-forward network with one hidden
layer of 300), with the weights a new model starts with (seed 0, made in the same order as in
the Messages film, so its message passing is the same). Nothing is learned yet.
"""

import json
import math
from pathlib import Path

import chemprop
import rdkit
import torch
from chemprop.data import BatchMolGraph
from chemprop.featurizers import SimpleMoleculeMolGraphFeaturizer
from chemprop.models import MPNN
from chemprop.nn import (
    BondMessagePassing,
    MeanAggregation,
    NormAggregation,
    RegressionFFN,
)
from rdkit import Chem
from rdkit.Chem import rdDepictor, rdFingerprintGenerator

SEED = 0
BOND = 233.24  # the length of a bond on screen, in world units (1920 x 1080)

# Hand-placed atoms, the same picture as in the fingerprint films. `side` is where an
# atom's tag hangs: 1 below the atom, -1 above it.
PLACED = {
    "A": [(660, 600, 1), (860, 480, 1), (860, 268, -1), (1060, 600, 1), (1260, 480, 1)]
}
MOLECULES = {
    "A": ("N-methylacetamide", "CC(=O)NC"),
    "B": ("N-ethylacetamide", "CC(=O)NCC"),
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


def rows(t: torch.Tensor) -> list[list[float]]:
    return [[round(float(x), 5) for x in row] for row in t]


def params(module: torch.nn.Module) -> int:
    return sum(p.numel() for p in module.parameters())


def main() -> None:
    torch.manual_seed(SEED)
    mp = (
        BondMessagePassing()
    )  # first, as in the Messages film, so that it draws the same weights
    agg = (
        NormAggregation()
    )  # chemprop train's default: --aggregation norm, --aggregation-norm 100
    ffn = (
        RegressionFFN()
    )  # chemprop train's default: --ffn-hidden-dim 300, --ffn-num-layers 1
    model = MPNN(mp, agg, ffn)
    model.eval()
    featurizer = SimpleMoleculeMolGraphFeaturizer()
    linear = [
        layer for layer in ffn.ffn.modules() if isinstance(layer, torch.nn.Linear)
    ]
    data: dict = {
        "chemprop": chemprop.__version__,
        "rdkit": rdkit.__version__,
        "seed": SEED,
        "dims": {
            "v": featurizer.atom_fdim,
            "h": mp.output_dim,
            "depth": mp.depth,
            "ffn": linear[0].out_features,
        },
        "norm": agg.norm,
        "params": {
            "W_i": params(mp.W_i),
            "W_h": params(mp.W_h),
            "W_o": params(mp.W_o),
            "mp": params(mp),
            "agg": params(agg),
            "ffn": params(ffn),
            "layers": [params(layer) for layer in linear],
            "all": params(model),
        },
        "mols": {},
        "graphs": {},
    }
    morgan = rdFingerprintGenerator.GetMorganGenerator(radius=2)
    with torch.no_grad():
        for key in MOLECULES:
            mol, data["mols"][key] = molecule(key)
            bmg = BatchMolGraph([featurizer(mol)])
            atoms = mp(bmg)  # one row per atom
            fp = model.fingerprint(bmg)  # NormAggregation: the rows added up, over 100
            assert torch.allclose(fp, atoms.sum(0, keepdim=True) / agg.norm, atol=1e-6)
            hidden = linear[0](fp)  # the FFN's hidden layer, before ReLU
            y = model(bmg)
            assert torch.allclose(y, linear[1](torch.relu(hidden)))
            data["graphs"][key] = {
                "atoms": rows(atoms),
                "sum": rows(atoms.sum(0, keepdim=True))[0],
                "fp": rows(fp)[0],
                "mean": rows(MeanAggregation()(atoms, bmg.batch))[0],
                "hidden": rows(hidden)[0],
                "y": round(float(y), 5),
                "ecfp": list(morgan.GetFingerprint(mol).GetOnBits()),
            }

    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    header = (
        f"// Written by data.py (uv run data.py) with Chemprop {chemprop.__version__} "
        f"and RDKit {rdkit.__version__}. Do not edit.\n"
    )
    Path(__file__).with_name("data.js").write_text(
        f"{header}window.emakiData = {text};\n"
    )
    print(f"data.js: {len(text)} bytes", data["dims"], data["params"])
    for key, g in data["graphs"].items():
        print(
            key,
            "y",
            g["y"],
            "sum|fp|",
            round(sum(g["fp"]), 4),
            "sum|mean|",
            round(sum(g["mean"]), 4),
            "max sum",
            max(g["sum"]),
            "max fp",
            max(g["fp"]),
            "ecfp bits",
            len(g["ecfp"]),
        )


if __name__ == "__main__":
    main()
