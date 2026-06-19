"""Concrete geometry presets for the three condenser designs.

All lengths in metres. Tube-centre vertical positions ``row_z`` and the
tabulated :class:`FillLevel` values are taken verbatim from the design
specification; reconstructed staggered (t, z) centres are only for plots.

Axis convention here: ``z`` vertical (chip surface plane at z=0); the bundle
runs along ``axis`` and tubes are staggered across the transverse direction.
"""

from __future__ import annotations

mm = 1e-3
cm2 = 1e-4

from .chip import ChipGeometry
from .condenser import TubeBundle, Manifold, FillLevel


def chip_plain_copper() -> ChipGeometry:
    """Plain copper chip shared by all condensers: 34.5 x 32 mm, Ra 2.5 um."""
    return ChipGeometry(width=34.5 * mm, length=32.0 * mm, Ra_um=2.5, material="copper")


def bundle_33_tube() -> TubeBundle:
    """Design A -- 33 tubes, OD 4.76 / ID 3.14 mm, L 95 mm, axis Y."""
    return TubeBundle(
        name="33-tube (Design A)",
        n_tubes=33,
        OD=4.76 * mm, ID=3.14 * mm, length=95.0 * mm, axis="Y",
        row_z=[4 * mm, 5 * mm, 8 * mm, 11 * mm, 14 * mm, 17 * mm],
        tubes_per_row=[6, 5, 6, 5, 6, 5],
        transverse_span=(-33.5 * mm, 33.5 * mm),
        cavity_transverse=(-47.5 * mm, 47.5 * mm),
        cavity_axial=(-47.5 * mm, 47.5 * mm),    # along Y ~ tube length
        cavity_z=(-0.3 * mm, 22.0 * mm),
        external_area_given=309.0 * cm2,
        manifolds=[],                            # external manifolds
        fill_levels=[
            FillLevel(0.40, 8.2 * mm, 13),
            FillLevel(0.60, 13.6 * mm, 20),
            FillLevel(0.80, 18.5 * mm, 33),
        ],
    )


def bundle_42_tube() -> TubeBundle:
    """Design 3 -- 42 tubes, OD 3.175 / ID 1.39 mm, L 62.6 mm, axis X."""
    floor = -7.5 * mm
    man_foot = (12 * mm) * (68 * mm)             # 12 x 68 mm footprint
    return TubeBundle(
        name="42-tube (Design 3)",
        n_tubes=42,
        OD=3.175 * mm, ID=1.39 * mm, length=62.6 * mm, axis="X",
        row_z=[9 * mm, 13 * mm, 18 * mm, 22 * mm],
        tubes_per_row=[11, 10, 11, 10],
        transverse_span=(-26.0 * mm, 26.0 * mm),
        cavity_transverse=(-45.0 * mm, 45.0 * mm),
        cavity_axial=(-31.3 * mm, 31.3 * mm),    # along X ~ tube length
        cavity_z=(floor, 27.5 * mm),
        external_area_given=262.0 * cm2,
        manifolds=[
            Manifold(z_lo=floor, z_hi=floor + 27.5 * mm, footprint_area=man_foot),
            Manifold(z_lo=floor, z_hi=floor + 27.5 * mm, footprint_area=man_foot),
        ],
        fill_levels=[
            FillLevel(0.40, 5.0 * mm, 0),
            FillLevel(0.60, 12.5 * mm, 11),
            FillLevel(0.80, 20.4 * mm, 32),
        ],
    )


def bundle_66_tube() -> TubeBundle:
    """Design B -- 66 tubes, OD 2.0 / ID 1.8 mm, L 95 mm. No experimental data.

    Row layout is a placeholder (the STEP file would supply exact centres);
    only count / ID / length feed the validated hydraulic outputs.
    """
    return TubeBundle(
        name="66-tube (Design B)",
        n_tubes=66,
        OD=2.0 * mm, ID=1.8 * mm, length=95.0 * mm, axis="Y",
        row_z=[4 * mm, 6.6 * mm, 9.2 * mm, 11.8 * mm, 14.4 * mm, 17 * mm],
        tubes_per_row=[11, 11, 11, 11, 11, 11],
        transverse_span=(-33.5 * mm, 33.5 * mm),
        cavity_transverse=(-47.5 * mm, 47.5 * mm),
        cavity_axial=(-47.5 * mm, 47.5 * mm),
        cavity_z=(-0.3 * mm, 22.0 * mm),
        external_area_given=394.0 * cm2,
        manifolds=[],
        fill_levels=[],     # no experimental fill sweep
    )


DESIGNS = {
    "33-tube": bundle_33_tube,
    "42-tube": bundle_42_tube,
    "66-tube": bundle_66_tube,
}
