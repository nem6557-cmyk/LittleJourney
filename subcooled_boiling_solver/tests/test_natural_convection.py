"""Natural-convection Nusselt correlations at reference Rayleigh numbers."""

from math import isclose

from .textbook import water_1atm
from ..correlations.natural_convection import (
    nu_mcadams_plate_up, nu_churchill_chu_vertical, natural_convection_flux,
    rayleigh_number,
)


def test_mcadams_laminar_branch():
    # 0.54 * (1e6)^0.25 = 0.54 * 31.6228 = 17.076
    assert isclose(nu_mcadams_plate_up(1e6), 17.076, rel_tol=1e-3)


def test_mcadams_turbulent_branch():
    # 0.15 * (1e8)^(1/3) = 0.15 * 464.159 = 69.624
    assert isclose(nu_mcadams_plate_up(1e8), 69.624, rel_tol=1e-3)


def test_churchill_chu_vertical_reference():
    # Hand evaluation at Ra=1e6, Pr=0.7 -> 16.530
    assert isclose(nu_churchill_chu_vertical(1e6, 0.7), 16.530, rel_tol=2e-3)


def test_flux_is_h_times_dT_and_zero_below_pool():
    st = water_1atm()
    flux, h, Ra, Nu = natural_convection_flux(st, dT=10.0, L=8.3e-3)
    assert isclose(flux, h * 10.0, rel_tol=1e-12)
    assert Ra == rayleigh_number(st, 10.0, 8.3e-3)
    # below pool temperature -> no convection
    assert natural_convection_flux(st, dT=-3.0, L=8.3e-3)[0] == 0.0
