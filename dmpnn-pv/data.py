# /// script
# requires-python = ">=3.12"
# dependencies = ["rdkit"]
# ///
"""Write data.js: the 3D molecules the D-MPNN promo shows, embedded by RDKit.

    uv run data.py

Only the shapes come from RDKit. Everything the promo shows about the model is
illustration, not a computed value.
"""

import json
from pathlib import Path

import numpy as np
import rdkit
from rdkit import Chem
from rdkit.Chem import AllChem

HERO = ("Paracetamol", "CC(=O)Nc1ccc(O)cc1")
# the molecules that stream through the model while it trains
STREAM = [
    ("Ethanol", "CCO"),
    ("Phenol", "Oc1ccccc1"),
    ("Aspirin", "CC(=O)Oc1ccccc1C(=O)O"),
    ("Caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C"),
    ("Naphthalene", "c1ccc2ccccc2c1"),
    ("Ibuprofen", "CC(C)Cc1ccc(cc1)C(C)C(=O)O"),
    ("Pyridine", "c1ccncc1"),
    ("Glycine", "NCC(=O)O"),
    ("Toluene", "Cc1ccccc1"),
    ("Acetone", "CC(C)=O"),
]


def shape(smiles: str, seed: int = 7) -> dict:
    """Atoms (element, x, y, z) and bonds (i, j, order) of one conformer, centred, its longest axis along x."""
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    AllChem.EmbedMolecule(mol, randomSeed=seed)
    AllChem.MMFFOptimizeMolecule(mol)
    xyz = mol.GetConformer().GetPositions()
    xyz -= xyz.mean(axis=0)
    _, _, axes = np.linalg.svd(
        xyz, full_matrices=False
    )  # principal axes, longest first
    xyz = xyz @ axes.T
    return {
        "atoms": [
            [a.GetSymbol(), *(round(float(v), 3) for v in p)]
            for a, p in zip(mol.GetAtoms(), xyz, strict=True)
        ],
        "bonds": [
            [b.GetBeginAtomIdx(), b.GetEndAtomIdx(), b.GetBondTypeAsDouble()]
            for b in mol.GetBonds()
        ],
    }


def main() -> None:
    data = {
        "rdkit": rdkit.__version__,
        "hero": {"name": HERO[0], **shape(HERO[1])},
        "stream": [{"name": name, **shape(smi)} for name, smi in STREAM],
    }
    text = json.dumps(data, separators=(",", ":"))
    header = f"// Written by data.py (uv run data.py) with RDKit {rdkit.__version__}. Do not edit.\n"
    Path(__file__).with_name("data.js").write_text(f"{header}window.pvData = {text};\n")
    print(
        f"data.js: {len(text)} bytes,", len(data["hero"]["atoms"]), "atoms in the hero"
    )


if __name__ == "__main__":
    main()
