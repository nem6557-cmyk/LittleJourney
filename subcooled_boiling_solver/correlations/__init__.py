"""Heat-transfer correlations, one physical model per module.

Every public function is a pure function of a :class:`~subcooled_boiling_solver.
properties.FluidState` plus scalars, so each can be unit-tested in isolation
against a hand-verifiable textbook point (see ``tests/``).
"""

from .rohsenow import rohsenow_flux, rohsenow_superheat, rohsenow_htc
from .natural_convection import (
    rayleigh_number, nu_mcadams_plate_up, nu_churchill_chu_vertical,
    nu_churchill_chu_cylinder, natural_convection_flux,
)
from .cooper import cooper_htc, cooper_flux
from .zukauskas import zukauskas_nu, v_max_staggered, v_max_aligned
from .internal_flow import internal_nu, friction_factor, pressure_drop
from .film_condensation import nusselt_horizontal_tube, nusselt_tube_column
from .chf import kandlikar_chf, zuber_chf

__all__ = [
    "rohsenow_flux", "rohsenow_superheat", "rohsenow_htc",
    "rayleigh_number", "nu_mcadams_plate_up", "nu_churchill_chu_vertical",
    "nu_churchill_chu_cylinder", "natural_convection_flux",
    "cooper_htc", "cooper_flux",
    "zukauskas_nu", "v_max_staggered", "v_max_aligned",
    "internal_nu", "friction_factor", "pressure_drop",
    "nusselt_horizontal_tube", "nusselt_tube_column",
    "kandlikar_chf", "zuber_chf",
]
