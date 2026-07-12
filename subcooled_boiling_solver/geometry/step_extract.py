"""Optional STEP tube-centre extraction via gmsh.

The exact (transverse, z) tube centres live in the proprietary CAD:
``CFD_Next_Gen.step`` (33-tube), ``Heat_Exchanger_Design_3.step`` (42-tube),
``Full_Assembly_V1_2mm_OD_66_Tubes.step`` (66-tube). When those files and
``gmsh`` are present, :func:`extract_tube_centers` finds the cylindrical tube
solids by their bounding-box signature and returns their centroids.

This degrades gracefully: if gmsh is missing or the file is absent, it raises a
clear error and callers fall back to the reconstructed staggered layout in
:mod:`geometry.presets`. We never fabricate "extracted" coordinates.
"""

from __future__ import annotations

import os
from typing import List, Tuple

_AXIS_INDEX = {"X": 0, "Y": 1, "Z": 2}


def gmsh_available() -> bool:
    try:
        import gmsh  # noqa: F401
        return True
    except Exception:
        return False


def extract_tube_centers(
    step_path: str,
    axis: str = "Y",
    expected_len_mm: float = 95.0,
    expected_od_mm: float = 4.76,
    len_tol: float = 0.15,
    od_tol: float = 0.30,
) -> List[Tuple[float, float]]:
    """Return reconstructed ``(transverse, z)`` tube centres in metres.

    A solid is treated as a tube if its bounding box is long along ``axis``
    (~``expected_len_mm``) and roughly ``expected_od_mm`` in the two transverse
    directions (the "solid-bbox signature" quoted in the spec).
    """
    if not gmsh_available():
        raise RuntimeError(
            "gmsh is not installed; cannot extract tube centres from STEP. "
            "Install gmsh or use the tabulated geometry in geometry.presets."
        )
    if not os.path.exists(step_path):
        raise FileNotFoundError(
            f"STEP file not found: {step_path}. The proprietary CAD is not in "
            "this workspace; falling back to tabulated geometry is expected."
        )

    import gmsh

    ax = _AXIS_INDEX[axis.upper()]
    transverse_axes = [i for i in range(3) if i != ax and i != 2]
    # 'z' is always index 2; the remaining non-axis, non-z index is the
    # horizontal transverse coordinate.
    t_idx = transverse_axes[0] if transverse_axes else 0

    gmsh.initialize()
    try:
        gmsh.open(step_path)
        centers: List[Tuple[float, float]] = []
        for dim, tag in gmsh.model.getEntities(3):
            xmin, ymin, zmin, xmax, ymax, zmax = gmsh.model.getBoundingBox(dim, tag)
            box = [xmax - xmin, ymax - ymin, zmax - zmin]
            length = box[ax]
            others = [box[i] for i in range(3) if i != ax]
            if abs(length - expected_len_mm) / expected_len_mm > len_tol:
                continue
            if any(abs(o - expected_od_mm) / expected_od_mm > od_tol for o in others):
                continue
            cx = 0.5 * (xmin + xmax)
            cy = 0.5 * (ymin + ymax)
            cz = 0.5 * (zmin + zmax)
            c = [cx, cy, cz]
            centers.append((c[t_idx] * 1e-3, c[2] * 1e-3))
        return centers
    finally:
        gmsh.finalize()
