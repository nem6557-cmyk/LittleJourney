"""Chip and condenser geometry, fill-ratio integration, optional STEP extract."""

from .chip import ChipGeometry
from .condenser import TubeBundle, Manifold, FillLevel
from .presets import (
    chip_plain_copper, bundle_33_tube, bundle_42_tube, bundle_66_tube,
    DESIGNS,
)

__all__ = [
    "ChipGeometry", "TubeBundle", "Manifold", "FillLevel",
    "chip_plain_copper", "bundle_33_tube", "bundle_42_tube", "bundle_66_tube",
    "DESIGNS",
]
