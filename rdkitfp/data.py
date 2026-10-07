# /// script
# requires-python = ">=3.12"
# dependencies = ["rdkit"]
# ///
"""Write data.js: every number the RDKit fingerprint film shows, computed by RDKit.

    uv run data.py

The film draws what is in data.js and computes nothing chemical itself.
"""

import json
import math
from collections import Counter
from pathlib import Path

import rdkit
from rdkit import Chem, DataStructs
from rdkit.Chem import rdDepictor, rdFingerprintGenerator

BOND = 233.24  # the length of a bond on screen, in world units (1920 x 1080)

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
    "K": ("Caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C"),
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


MASK = 0xFFFFFFFF
FULL = 2048  # RDKit's default length of a bit vector
SHORT = 128  # the length the film explains with: short enough to read, and to collide


def combine(seed: int, value: int) -> int:
    """boost::hash_combine on 32 bits, as RDKit uses it."""
    return (
        seed ^ ((value + 0x9E3779B9 + ((seed << 6) & MASK) + (seed >> 2)) & MASK)
    ) & MASK


def hashes(mol: Chem.Mol, bonds: tuple[int, ...]) -> tuple[list[int], int, int]:
    """RDKit's hashing of one fragment, step by step: a hash per bond, the atom count, the seed."""
    invariant = [
        (a.GetAtomicNum() % 128) << 1 | int(a.GetIsAromatic()) for a in mol.GetAtoms()
    ]
    ends = [
        (mol.GetBondWithIdx(b).GetBeginAtomIdx(), mol.GetBondWithIdx(b).GetEndAtomIdx())
        for b in bonds
    ]
    degree = Counter(
        a for pair in ends for a in pair
    )  # bonds per atom inside the fragment
    per_bond = []
    for k, (b, (i, j)) in enumerate(zip(bonds, ends, strict=True)):
        bond = mol.GetBondWithIdx(b)
        touching = sum(
            1 for n, other in enumerate(ends) if n != k and set(other) & {i, j}
        )
        order = (
            int(Chem.BondType.AROMATIC)
            if bond.GetIsAromatic()
            else int(bond.GetBondType())
        )
        first, second = sorted(
            ((invariant[i], degree[i]), (invariant[j], degree[j])), reverse=True
        )
        h = touching
        for value in (order, *first, *second):
            h = combine(h, value)
        per_bond.append(h)
    if len(per_bond) == 1:
        return per_bond, len(degree), per_bond[0]
    seed = 0
    for value in (*sorted(per_bond), len(degree)):
        seed = combine(seed, value)
    return per_bond, len(degree), seed


def fragments(mol: Chem.Mol, size: int) -> list[dict]:
    """Every fragment of one to seven bonds: how it is hashed, and its two bits in a vector of `size` bits."""
    seeds = rdFingerprintGenerator.GetRDKitFPGenerator(numBitsPerFeature=1)
    gen = rdFingerprintGenerator.GetRDKitFPGenerator(fpSize=size)

    def owners(g, fingerprint: str) -> dict[tuple[int, ...], list[int]]:
        ao = rdFingerprintGenerator.AdditionalOutput()
        ao.AllocateBitPaths()
        getattr(g, fingerprint)(mol, additionalOutput=ao)
        seen: dict[tuple[int, ...], list[int]] = {}
        for bit, paths in ao.GetBitPaths().items():
            for path in paths:
                seen.setdefault(tuple(sorted(path)), []).append(bit)
        return seen

    seed_of, bits_of = (
        owners(seeds, "GetSparseCountFingerprint"),
        owners(gen, "GetFingerprint"),
    )
    out = []
    for bonds, (seed,) in sorted(seed_of.items(), key=lambda kv: (len(kv[0]), kv[0])):
        per_bond, atoms, mine = hashes(mol, bonds)
        assert mine == seed, (bonds, mine, seed)
        first = seed % size
        on = bits_of[bonds]
        second = next((b for b in on if b != first), first)
        assert set(on) == {first, second}
        out.append(
            {
                "bonds": list(bonds),
                "hashes": per_bond,
                "atoms": atoms,
                "seed": seed,
                "bits": [first, second],
            }
        )
    return out


def main() -> None:
    data: dict = {
        "rdkit": rdkit.__version__,
        "mols": {},
        "size": {},
        "fragments": {},
        "bits": {},
    }
    mols = {}
    for key in MOLECULES:
        mols[key], data["mols"][key] = molecule(key)
        # the two small molecules are explained fragment by fragment on the short vector;
        # the drugs are shown at full length, and of their fragments only the bonds are drawn
        size = data["size"][key] = SHORT if key in PLACED else FULL
        found = fragments(mols[key], size)
        data["fragments"][key] = (
            found if key in PLACED else [{"bonds": f["bonds"]} for f in found]
        )
        gen = rdFingerprintGenerator.GetRDKitFPGenerator(fpSize=size)
        data["bits"][key] = list(gen.GetFingerprint(mols[key]).GetOnBits())
    data["ecfp4"] = {
        key: rdFingerprintGenerator.GetMorganGenerator(radius=2)
        .GetFingerprint(mols[key])
        .GetNumOnBits()
        for key in MOLECULES
    }

    # the same two molecules under the four fingerprints of the series, all at 2048 bits
    generators = {
        "ecfp4": rdFingerprintGenerator.GetMorganGenerator(radius=2),
        "atompair": rdFingerprintGenerator.GetAtomPairGenerator(),
        "torsion": rdFingerprintGenerator.GetTopologicalTorsionGenerator(),
        "rdkit": rdFingerprintGenerator.GetRDKitFPGenerator(),
    }
    data["board"] = {}
    for name, g in generators.items():
        a, b = g.GetFingerprint(mols["A"]), g.GetFingerprint(mols["B"])
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
        sizes = Counter(len(f["bonds"]) for f in data["fragments"][key])
        print(
            key,
            len(data["fragments"][key]),
            "fragments",
            dict(sorted(sizes.items())),
            len(data["bits"][key]),
            "bits",
        )
    print({k: round(v["both"] / v["either"], 2) for k, v in data["board"].items()})


if __name__ == "__main__":
    main()
