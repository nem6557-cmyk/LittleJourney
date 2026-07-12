"""Subcooled pool-boiling chamber solver.

A physically-predictive *gray-box* model of a closed subcooled pool-boiling
chamber with a submerged tube-bundle condenser. The design intent is that the
fitted constants are geometry-independent material properties (e.g. the
Rohsenow surface-fluid constant ``C_sf``), not free curve-fit knobs.

Sub-packages
------------
config              Single source of truth for every constant, each tagged with
                    its calibration status (fixed / transferable / per-chamber /
                    bounded-fit / uncalibrated).
properties          CoolProp-backed thermophysical property provider + cache.
correlations        One heat-transfer correlation per module, each unit-tested
                    against a textbook point.
geometry            Chip + tube-bundle geometry, fill-ratio integrator, optional
                    STEP extraction.
model               Chip heat balance (Brent root-find), distributed node
                    network, condenser UA/NTU/effectiveness.
calibration         least_squares driver + identifiability / cross-validation
                    diagnostics.
data                Experimental-workbook loader (exact schema) + a clearly
                    labelled synthetic self-consistency generator.
viz                 Plotting helpers (boiling curves, eps-NTU, fields, dashboard).

Read ``HONESTY.md`` before trusting any number this package prints.
"""

__version__ = "0.1.0"
__all__ = ["config"]
