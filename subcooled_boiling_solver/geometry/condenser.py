"""Tube-bundle condenser geometry, with a volume-based fill-ratio integrator.

Coordinate convention: ``z`` is the vertical (up) axis with the chamber floor
near ``z=0``; tube centres are given as ``(t, z)`` where ``t`` is the
horizontal transverse coordinate. Each tube is a horizontal cylinder of length
``length`` running along the bundle axis.

The fill ratio is *by volume*: water height is found by integrating the free
cross-sectional area (cavity minus tube and manifold cross-sections) until the
enclosed free volume reaches the requested fraction of the total free volume.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import acos, pi, sin
from typing import List, Optional, Tuple

from scipy.optimize import brentq


@dataclass(frozen=True)
class Manifold:
    """A rectangular in-chamber manifold box (displaces liquid volume)."""

    z_lo: float
    z_hi: float
    footprint_area: float   # m^2 in the horizontal plane

    def volume_below(self, h: float) -> float:
        lo, hi = self.z_lo, min(self.z_hi, h)
        return self.footprint_area * max(0.0, hi - lo)


@dataclass(frozen=True)
class FillLevel:
    """A tabulated fill state (authoritative values from experiment/CAD)."""

    fraction: float          # 0.40, 0.60, 0.80
    height: float            # m, water height above floor
    n_submerged: int         # number of submerged tubes (tabulated)


@dataclass
class TubeBundle:
    name: str
    n_tubes: int
    OD: float                # m
    ID: float                # m
    length: float            # m (along bundle axis)
    axis: str                # 'X' or 'Y'
    row_z: List[float]       # m, vertical centre of each row
    tubes_per_row: List[int]
    transverse_span: Tuple[float, float]   # m, tube-centre span (e.g. X for 33t)
    cavity_transverse: Tuple[float, float]
    cavity_axial: Tuple[float, float]      # m, along bundle axis
    cavity_z: Tuple[float, float]
    external_area_given: float             # m^2 (as quoted by the design)
    manifolds: List[Manifold] = field(default_factory=list)
    fill_levels: List[FillLevel] = field(default_factory=list)
    positions: List[Tuple[float, float]] = field(default_factory=list)

    # ------------------------------------------------------------------ #
    def __post_init__(self):
        if sum(self.tubes_per_row) != self.n_tubes:
            raise ValueError(
                f"{self.name}: tubes_per_row sums to {sum(self.tubes_per_row)} "
                f"!= n_tubes {self.n_tubes}"
            )
        if not self.positions:
            self.positions = self._stagger_positions()

    def _stagger_positions(self) -> List[Tuple[float, float]]:
        """Reconstruct approximate staggered (t, z) tube centres.

        NOTE: exact centres come from the STEP file via
        :mod:`geometry.step_extract`. This reconstruction is for visualisation
        and order-of-magnitude geometry only; submerged counts at the
        documented fill ratios use the tabulated :class:`FillLevel` values.
        """
        lo, hi = self.transverse_span
        pos = []
        for i, (z, n) in enumerate(zip(self.row_z, self.tubes_per_row)):
            if n == 1:
                pos.append((0.5 * (lo + hi), z))
                continue
            pitch = (hi - lo) / (n - 1)
            offset = 0.25 * pitch if i % 2 else 0.0
            for j in range(n):
                t = lo + j * pitch + offset
                t = min(t, hi)
                pos.append((t, z))
        return pos

    # ------------------------------------------------------------------ #
    # areas
    # ------------------------------------------------------------------ #
    @property
    def area_per_tube(self) -> float:
        return pi * self.OD * self.length

    @property
    def external_area_geometric(self) -> float:
        """pi * OD * L * N -- the consistent geometric external area."""
        return self.area_per_tube * self.n_tubes

    @property
    def flow_area_per_tube(self) -> float:
        return 0.25 * pi * self.ID ** 2

    def area_discrepancy(self) -> float:
        """Relative gap between quoted and geometric external area."""
        g = self.external_area_geometric
        return abs(self.external_area_given - g) / g

    # ------------------------------------------------------------------ #
    # submersion
    # ------------------------------------------------------------------ #
    def submerged_area_fraction(self, z_center: float, height: float) -> float:
        """Cross-sectional (== volume) fraction of a tube below ``height``."""
        r = 0.5 * self.OD
        a = height - z_center            # waterline height above tube centre
        if a <= -r:
            return 0.0
        if a >= r:
            return 1.0
        theta = acos(-a / r)             # a in (-r, r)
        seg = r * r * (theta - 0.5 * sin(2.0 * theta))
        return seg / (pi * r * r)

    def wetted_perimeter_fraction(self, z_center: float, height: float) -> float:
        """Fraction of a tube's lateral surface below ``height``."""
        r = 0.5 * self.OD
        a = height - z_center
        if a <= -r:
            return 0.0
        if a >= r:
            return 1.0
        return acos(-a / r) / pi

    def submerged_tube_count(self, height: float, threshold: float = 0.5) -> int:
        """Count tubes at least ``threshold`` submerged (reconstructed)."""
        return sum(
            1 for (_, z) in self.positions
            if self.submerged_area_fraction(z, height) >= threshold
        )

    def submerged_external_area(self, height: float) -> float:
        """Wetted external tube area below ``height`` [m^2] (reconstructed)."""
        return sum(
            self.wetted_perimeter_fraction(z, height) * self.area_per_tube
            for (_, z) in self.positions
        )

    def tabulated_fill(self, fraction: float) -> Optional[FillLevel]:
        for fl in self.fill_levels:
            if abs(fl.fraction - fraction) < 1e-6:
                return fl
        return None

    # ------------------------------------------------------------------ #
    # volume-based fill integrator
    # ------------------------------------------------------------------ #
    @property
    def cavity_footprint(self) -> float:
        tlo, thi = self.cavity_transverse
        alo, ahi = self.cavity_axial
        return (thi - tlo) * (ahi - alo)

    def _tube_volume_below(self, h: float) -> float:
        # displaced volume = (cross-section fraction) * (pi r^2) * length;
        # with area_per_tube = pi*OD*L this equals frac*area_per_tube*OD/4.
        return sum(
            self.submerged_area_fraction(z, h) * self.area_per_tube * 0.25 * self.OD
            for (_, z) in self.positions
        )

    def free_volume_below(self, h: float) -> float:
        """Free (liquid-occupiable) volume from floor up to height ``h``."""
        z_floor = self.cavity_z[0]
        box = self.cavity_footprint * max(0.0, h - z_floor)
        tubes = self._tube_volume_below(h)
        mani = sum(m.volume_below(h) for m in self.manifolds)
        return max(0.0, box - tubes - mani)

    def total_free_volume(self) -> float:
        return self.free_volume_below(self.cavity_z[1])

    def fill_height(self, fraction: float) -> float:
        """Water height [m] enclosing ``fraction`` of the total free volume.

        Reconstructed estimate; for the documented designs prefer
        :meth:`tabulated_fill`.
        """
        target = fraction * self.total_free_volume()
        z_lo, z_hi = self.cavity_z
        return brentq(lambda h: self.free_volume_below(h) - target, z_lo, z_hi)
