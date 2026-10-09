# /// script
# requires-python = ">=3.12"
# dependencies = ["chemprop==2.3.1"]
# ///
"""Write data.js: every number the MolGraph film shows, computed by Chemprop and RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself.
"""

import json
import math
from pathlib import Path

import chemprop
import rdkit
from chemprop.featurizers import SimpleMoleculeMolGraphFeaturizer
from chemprop.nn import BondMessagePassing
from rdkit import Chem
from rdkit.Chem import rdDepictor

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
    # the picture draws Kekulé bonds; the features see the aromatic ones
    bonds = [
        [b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(b.GetBondTypeAsDouble())]
        for b in kekule.GetBonds()
    ]
    return mol, {"name": name, "smiles": smiles, "atoms": atoms, "bonds": bonds}


def blocks(featurizer: SimpleMoleculeMolGraphFeaturizer) -> dict:
    """The blocks a feature vector is cut into: their names, and what each position in them stands for.
    Read off Chemprop's own featurizers, so that they follow its choices and their order."""
    af, bf = featurizer.atom_featurizer, featurizer.bond_featurizer
    table = Chem.GetPeriodicTable()
    unknown = "?"
    atom = [
        (
            "atomic number",
            [table.GetElementSymbol(z) for z in af.atomic_nums] + [unknown],
        ),
        ("degree", [str(d) for d in af.degrees] + [unknown]),
        (
            "formal charge",
            [f"{q:+d}" if q else "0" for q in af.formal_charges] + [unknown],
        ),
        (
            "chirality",
            ["none", "CW", "CCW", "other"][: len(af.chiral_tags)] + [unknown],
        ),
        ("hydrogens", [str(h) for h in af.num_Hs] + [unknown]),
        ("hybridization", [str(h) for h in af.hybridizations] + [unknown]),
        ("aromatic", ["yes"]),
        ("mass / 100", ["mass"]),
    ]
    bond = [
        ("null", ["null"]),
        ("bond type", [str(t).lower() for t in bf.bond_types]),
        ("conjugated", ["yes"]),
        ("in ring", ["yes"]),
        (
            "stereo",
            [
                str(Chem.BondStereo.values[s]).removeprefix("STEREO").lower()
                for s in bf.stereo
            ]
            + [unknown],
        ),
    ]
    out = {}
    for key, spec, size in (("atom", atom, len(af)), ("bond", bond, len(bf))):
        start, rows = 0, []
        for name, choices in spec:
            rows.append({"name": name, "start": start, "choices": choices})
            start += len(choices)
        assert start == size, (key, start, size)
        out[key] = rows
    return out


def num(x: float) -> int | float:
    """A feature as the film shows it: 0 and 1 as integers, the mass to five places."""
    return int(x) if float(x).is_integer() else round(float(x), 5)


def main() -> None:
    featurizer = SimpleMoleculeMolGraphFeaturizer()
    mp = BondMessagePassing()
    data: dict = {
        "chemprop": chemprop.__version__,
        "rdkit": rdkit.__version__,
        "dims": {
            "v": featurizer.atom_fdim,
            "e": featurizer.bond_fdim,
            "in": mp.W_i.in_features,
            "h": mp.W_i.out_features,
            "depth": mp.depth,
        },
        "blocks": blocks(featurizer),
        "mols": {},
        "graphs": {},
    }
    for key in MOLECULES:
        mol, data["mols"][key] = molecule(key)
        g = featurizer(mol)
        assert (
            g.E[0::2] == g.E[1::2]
        ).all()  # the two directions of a bond carry the same features
        data["graphs"][key] = {
            "V": [[num(x) for x in row] for row in g.V],
            "E": [[num(x) for x in row] for row in g.E],
            "edges": g.edge_index.T.tolist(),  # directed bond k goes from atom edges[k][0] to atom edges[k][1]
            "rev": g.rev_edge_index.tolist(),  # the same bond the other way
            # what the atoms are, in words the film can show next to their features
            "info": [
                {
                    "hyb": str(a.GetHybridization()),
                    "degree": a.GetTotalDegree(),
                    "hs": a.GetTotalNumHs(),
                    "mass": round(a.GetMass(), 3),
                    "aromatic": a.GetIsAromatic(),
                }
                for a in mol.GetAtoms()
            ],
            "bondinfo": [
                {
                    "type": str(b.GetBondType()).lower(),
                    "conj": b.GetIsConjugated(),
                    "ring": b.IsInRing(),
                }
                for b in mol.GetBonds()
            ],
        }

    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    header = (
        f"// Written by data.py (uv run data.py) with Chemprop {chemprop.__version__} "
        f"and RDKit {rdkit.__version__}. Do not edit.\n"
    )
    Path(__file__).with_name("data.js").write_text(
        f"{header}window.emakiData = {text};\n"
    )
    print(f"data.js: {len(text)} bytes", data["dims"])
    for key in MOLECULES:
        g = data["graphs"][key]
        print(key, len(g["V"]), "atoms,", len(g["E"]), "directed bonds")
        for n, row in enumerate(g["V"]):
            print(
                " ",
                data["mols"][key]["atoms"][n]["text"],
                [i for i, x in enumerate(row) if x],
                g["info"][n],
            )
        for b, row in zip(data["mols"][key]["bonds"], g["E"][0::2]):
            print(" ", b, [i for i, x in enumerate(row) if x])


if __name__ == "__main__":
    main()
