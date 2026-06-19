"""Cooper (1984) at water/1 atm reference point (hand-verified)."""

from math import isclose

from .textbook import water_1atm
from ..correlations.cooper import cooper_htc, cooper_flux


def test_cooper_reference_htc():
    st = water_1atm()
    # Rp = 1 um, q'' = 1e5 W/m^2 -> h ~ 9528 W/m^2.K (hand evaluation).
    h = cooper_htc(st, q_flux=1e5, Rp_um=1.0)
    assert isclose(h, 9528.0, rel_tol=1e-2)


def test_cooper_flux_inverts_htc():
    st = water_1atm()
    # q'' = h * dT and h ~ q''^0.67 must be self-consistent.
    dT = 8.0
    q = cooper_flux(st, dT_sup=dT, Rp_um=1.0)
    h = cooper_htc(st, q_flux=q, Rp_um=1.0)
    assert isclose(h * dT, q, rel_tol=1e-6)


def test_cooper_zero_below_saturation():
    st = water_1atm()
    assert cooper_flux(st, dT_sup=0.0) == 0.0
    assert cooper_htc(st, q_flux=0.0) == 0.0
