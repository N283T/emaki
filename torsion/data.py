# /// script
# requires-python = ">=3.12"
# dependencies = ["rdkit"]
# ///
"""Write data.js: every number the Topological Torsion film shows, computed by RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself.
"""

import json
import math
from collections import Counter
from pathlib import Path

import rdkit
from rdkit import Chem, DataStructs
from rdkit.Chem import rdDepictor, rdFingerprintGenerator, rdMolDescriptors

BOND = 233.24  # the length of a bond on screen, in world units (1920 x 1080)
FULL = 2048  # RDKit's default length of a bit vector
SHORT = 128  # the length the film explains with: short enough to read, and to collide

# Hand-placed atoms, the same picture as in the ECFP4 film. `side` is where an
# atom's tag hangs: 1 below the atom, -1 above it.
PLACED = {
    "A": [(660, 600, 1), (860, 480, 1), (860, 268, -1), (1060, 600, 1), (1260, 480, 1)],
    "B": [
        (660, 600, 1),
        (860, 480, 1),
        (860, 268, -1),
        (1060, 600, 1),
        (1260, 480, 1),
        (1460, 600, 1),
    ],
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
    if pts[0][0] > 0:  # the acetyl group goes on the left, as in A and B
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


TYPES = [
    "B",
    "C",
    "N",
    "O",
    "F",
    "Si",
    "P",
    "S",
    "Cl",
    "As",
    "Se",
    "Br",
    "Sb",
    "Te",
    "I",
]
CODE_BITS = 9


def torsions(mol: Chem.Mol, size: int) -> list[dict]:
    """Every path of four atoms: its atom codes, its integer, and its block in a bit vector of `size` bits."""
    gen = rdFingerprintGenerator.GetTopologicalTorsionGenerator(fpSize=size)

    def owners(fingerprint: str) -> dict[tuple[int, ...], list[int]]:
        ao = rdFingerprintGenerator.AdditionalOutput()
        ao.AllocateBitPaths()
        getattr(gen, fingerprint)(mol, additionalOutput=ao)
        seen: dict[tuple[int, ...], list[int]] = {}
        for bit, paths in ao.GetBitPaths().items():
            for path in paths:
                seen.setdefault(tuple(path), []).append(bit)
        return seen

    ids, bits = owners("GetSparseCountFingerprint"), owners("GetFingerprint")
    counts = Counter(i[0] for i in ids.values())
    out = []
    for path, (ident,) in sorted(ids.items(), key=lambda kv: sorted(kv[0])):
        # an atom's code counts only the neighbours that are not on the path: one less at the ends, two less inside
        own = [
            rdMolDescriptors.GetAtomPairAtomCode(mol.GetAtomWithIdx(a))
            - (1 if k in (0, 3) else 2)
            for k, a in enumerate(path)
        ]
        packed = [
            (ident >> (CODE_BITS * k)) & 511 for k in range(4)
        ]  # the first atom sits in the lowest bits
        assert packed in (own, own[::-1]), (path, own, packed)
        order = path if packed == own else path[::-1]
        on = sorted(bits[path])
        out.append(
            {
                # the atoms as the integer holds them, highest bits first
                "atoms": [
                    {
                        "atom": a,
                        "el": TYPES[c >> 5],
                        "n": c & 7,
                        "pi": (c >> 3) & 3,
                        "code": c,
                    }
                    for a, c in zip(order[::-1], packed[::-1], strict=True)
                ],
                "id": ident,
                "count": counts[ident],
                "block": on[0] // 4,
            }
        )
    return out


def main() -> None:
    data: dict = {
        "rdkit": rdkit.__version__,
        "mols": {},
        "size": {},
        "torsions": {},
        "bits": {},
    }
    mols = {}

    def bits(mol: Chem.Mol, size: int) -> list[int]:
        gen = rdFingerprintGenerator.GetTopologicalTorsionGenerator(fpSize=size)
        return list(gen.GetFingerprint(mol).GetOnBits())

    for key in MOLECULES:
        mols[key], data["mols"][key] = molecule(key)
        # the two small molecules are explained on the short vector, the drug is shown at full length
        size = data["size"][key] = SHORT if key in PLACED else FULL
        data["torsions"][key] = torsions(mols[key], size)
        data["bits"][key] = bits(mols[key], size)
    # the drug once more on the short vector, where its paths collide: the block of each path, and the bits
    data["squeezed"] = {
        "size": SHORT,
        "blocks": [t["block"] for t in torsions(mols["P"], SHORT)],
        "bits": bits(mols["P"], SHORT),
    }

    # the same two molecules under the four fingerprints of the series, all at 2048 bits
    generators = {
        "ecfp4": rdFingerprintGenerator.GetMorganGenerator(radius=2),
        "atompair": rdFingerprintGenerator.GetAtomPairGenerator(),
        "torsion": rdFingerprintGenerator.GetTopologicalTorsionGenerator(),
        "rdkit": rdFingerprintGenerator.GetRDKitFPGenerator(),
    }
    data["board"] = {}
    for name, gen in generators.items():
        a, b = gen.GetFingerprint(mols["A"]), gen.GetFingerprint(mols["B"])
        both = len(set(a.GetOnBits()) & set(b.GetOnBits()))
        either = len(set(a.GetOnBits()) | set(b.GetOnBits()))
        assert abs(both / either - DataStructs.TanimotoSimilarity(a, b)) < 1e-9
        data["board"][name] = {"both": both, "either": either}

    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    header = (
        "// Written by data.py (uv run data.py) with RDKit "
        + rdkit.__version__
        + ". Do not edit.\n"
    )
    Path(__file__).with_name("data.js").write_text(
        f"{header}window.emakiData = {text};\n"
    )
    print(f"data.js: {len(text)} bytes")
    for key in MOLECULES:
        distinct = Counter(t["id"] for t in data["torsions"][key])
        print(
            key,
            len(data["torsions"][key]),
            "torsions,",
            len(distinct),
            "distinct,",
            len(data["bits"][key]),
            "bits",
        )
    print({k: round(v["both"] / v["either"], 2) for k, v in data["board"].items()})


if __name__ == "__main__":
    main()
