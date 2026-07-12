"""Rohsenow vs Incropera Example 10.1 (water/polished copper, dT_e=18 K)."""

from .textbook import water_1atm
from ..correlations.rohsenow import rohsenow_flux, rohsenow_superheat


def test_incropera_10_1():
    st = water_1atm()
    # C_sf = 0.0128 (water/copper, polished), s = 1, n = 3, dT_e = 18 K.
    q = rohsenow_flux(st, dT_sup=18.0, C_sf=0.0128, superheat_exp=3.0, pr_exp=1.0)
    # Incropera reports q''_s ~ 836 kW/m^2.
    assert abs(q - 8.36e5) / 8.36e5 < 0.05


def test_single_phase_branch_is_zero_below_saturation():
    st = water_1atm()
    assert rohsenow_flux(st, dT_sup=-5.0, C_sf=0.013) == 0.0
    assert rohsenow_flux(st, dT_sup=0.0, C_sf=0.013) == 0.0


def test_invert_roundtrip():
    st = water_1atm()
    q = rohsenow_flux(st, dT_sup=12.0, C_sf=0.013)
    dT = rohsenow_superheat(st, q, C_sf=0.013)
    assert abs(dT - 12.0) < 1e-6
