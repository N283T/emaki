# /// script
# requires-python = ">=3.12"
# dependencies = ["chemprop==2.3.1"]
# ///
"""Write data.js: every number the Messages film shows, computed by Chemprop and RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself. The weights are the
ones a new BondMessagePassing starts with (seed 0): the numbers are real, nothing is learned yet.
"""

import json
import math
from pathlib import Path

import chemprop
import rdkit
import torch
from chemprop.data import BatchMolGraph
from chemprop.featurizers import SimpleMoleculeMolGraphFeaturizer
from chemprop.nn import BondMessagePassing
from rdkit import Chem
from rdkit.Chem import rdDepictor

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


def rows(t: torch.Tensor) -> list[list[float]]:
    return [[round(float(x), 4) for x in row] for row in t]


def run(mp: BondMessagePassing, bmg: BatchMolGraph) -> dict:
    """BondMessagePassing.forward, one step at a time, keeping what each step makes."""
    pre = mp.initialize(bmg)  # W_i [x_u ‖ e_uv], before the activation
    H = [mp.tau(pre)]
    M, WM = [None], [None]
    for _ in range(1, mp.depth):
        M.append(mp.message(H[-1], bmg))
        WM.append(mp.W_h(M[-1]))
        H.append(mp.update(M[-1], pre))
    index = bmg.edge_index[1].unsqueeze(1).repeat(1, H[-1].shape[1])
    gather = torch.zeros(bmg.V.shape[0], H[-1].shape[1]).scatter_reduce_(
        0, index, H[-1], reduce="sum", include_self=False
    )
    out = mp.finalize(gather, bmg.V, None)
    assert torch.allclose(
        out, mp(bmg)
    )  # the steps add up to Chemprop's own forward pass
    return {"pre": pre, "H": H, "M": M, "WM": WM, "gather": gather, "out": out}


def feeds(mp: BondMessagePassing, bmg: BatchMolGraph) -> list[list[int]]:
    """For each directed bond, the directed bonds its message adds up: Chemprop's own message step, run on
    one-hot rows, so that row k of its output says which rows of H went into message k."""
    n = bmg.E.shape[0]
    M = mp.message(torch.eye(n), bmg)
    return [[j for j in range(n) if M[k, j] > 0.5] for k in range(n)]


def reach(
    edges: list[list[int]], into: list[list[int]], n_atoms: int, depth: int
) -> dict:
    """Which atoms each directed bond has heard from after each step, and each atom at the end."""
    seen = [[{u}] for u, _ in edges]
    for t in range(1, depth):
        for k, (u, _) in enumerate(edges):
            seen[k].append({u}.union(*(seen[j][t - 1] for j in into[k])))
    atoms = [
        {v}.union(*(seen[k][-1] for k, (_, w) in enumerate(edges) if w == v))
        for v in range(n_atoms)
    ]
    return {
        "bonds": [[sorted(s) for s in steps] for steps in seen],
        "atoms": [sorted(s) for s in atoms],
    }


def main() -> None:
    torch.manual_seed(SEED)
    mp = BondMessagePassing()
    mp.eval()
    featurizer = SimpleMoleculeMolGraphFeaturizer()
    data: dict = {
        "chemprop": chemprop.__version__,
        "rdkit": rdkit.__version__,
        "torch": torch.__version__.split("+")[0],
        "seed": SEED,
        "dims": {
            "v": featurizer.atom_fdim,
            "e": featurizer.bond_fdim,
            "in": mp.W_i.in_features,
            "h": mp.W_h.out_features,
            "depth": mp.depth,
        },
        "mols": {},
        "graphs": {},
    }
    with torch.no_grad():
        for key in MOLECULES:
            mol, data["mols"][key] = molecule(key)
            g = featurizer(mol)
            bmg = BatchMolGraph([g])
            edges = g.edge_index.T.tolist()
            into = feeds(mp, bmg)
            graph = {
                "edges": edges,
                "rev": g.rev_edge_index.tolist(),
                "feeds": into,
                "reach": reach(edges, into, mol.GetNumAtoms(), mp.depth),
            }
            if key == "A":  # the small molecule is shown number by number
                r = run(mp, bmg)
                graph |= {
                    "pre": rows(r["pre"]),
                    "H": [rows(h) for h in r["H"]],
                    "M": [None] + [rows(m) for m in r["M"][1:]],
                    "WM": [None] + [rows(w) for w in r["WM"][1:]],
                    # what the activation is applied to in an update: W_i [x_u ‖ e_uv] + W_h m
                    "Z": [None] + [rows(r["pre"] + w) for w in r["WM"][1:]],
                    "gather": rows(r["gather"]),
                    "out": rows(r["out"]),
                }
            data["graphs"][key] = graph

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
        print(key, "feeds:", g["feeds"])
        print(
            "  reach of bonds at the last step:",
            [len(s[-1]) for s in g["reach"]["bonds"]],
        )
        print("  reach of atoms:", [len(s) for s in g["reach"]["atoms"]])
    A = data["graphs"]["A"]
    for name in ("pre",):
        flat = [x for row in A[name] for x in row]
        print(
            name,
            "min",
            min(flat),
            "max",
            max(flat),
            "neg",
            sum(x < 0 for x in flat) / len(flat),
        )
    for t, h in enumerate(A["H"]):
        flat = [x for row in h for x in row]
        print("H", t, "max", max(flat), "zeros", sum(x == 0 for x in flat) / len(flat))
    flat = [x for row in A["out"] for x in row]
    print("out max", max(flat), "zeros", sum(x == 0 for x in flat) / len(flat))
    print("methyls same in out:", A["out"][0] == A["out"][4])


if __name__ == "__main__":
    main()
