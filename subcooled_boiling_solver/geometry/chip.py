"""Heated-chip geometry."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChipGeometry:
    """Rectangular heated chip lying flat on the chamber floor, facing up."""

    width: float          # m  (X)
    length: float         # m  (Y)
    Ra_um: float = 2.5    # arithmetic surface roughness
    material: str = "copper"

    @property
    def area(self) -> float:
        """Heated area [m^2]."""
        return self.width * self.length

    @property
    def perimeter(self) -> float:
        return 2.0 * (self.width + self.length)

    @property
    def L_char(self) -> float:
        """Characteristic length for plate natural convection, L = A/P [m]."""
        return self.area / self.perimeter
