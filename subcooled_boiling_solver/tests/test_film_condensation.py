"""Nusselt filmwise condensation on a horizontal tube (hand-verified point)."""

from math import isclose

from .textbook import water_1atm
from ..correlations.film_condensation import (
    nusselt_horizontal_tube, nusselt_tube_column,
)


def test_single_tube_reference():
    st = water_1atm()
    # Tsat=100C, Ts=90C (dT=10), D=25 mm -> h ~ 12,720 W/m^2.K (hand calc).
    h = nusselt_horizontal_tube(st, T_sat=373.15, T_surf=363.15, D=0.025)
    assert isclose(h, 12720.0, rel_tol=1e-2)


def test_column_reduces_coefficient():
    st = water_1atm()
    h1 = nusselt_horizontal_tube(st, 373.15, 363.15, 0.025)
    h4 = nusselt_tube_column(st, 373.15, 363.15, 0.025, n_in_column=4)
    assert isclose(h4, h1 * 4 ** -0.25, rel_tol=1e-9)


def test_no_condensation_when_wall_above_sat():
    st = water_1atm()
    assert nusselt_horizontal_tube(st, 373.15, 380.0, 0.025) == 0.0
