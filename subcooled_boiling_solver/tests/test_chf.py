"""CHF: Zuber reference + Kandlikar reduction and subcooling monotonicity."""

from math import isclose

from .textbook import water_1atm
from ..correlations.chf import kandlikar_chf, zuber_chf


def test_zuber_water_1atm():
    st = water_1atm()
    # Incropera: q''_max ~ 1.26 MW/m^2 for water at 1 atm.
    assert isclose(zuber_chf(st), 1.26e6, rel_tol=2e-2)


def test_kandlikar_beta90_reference():
    st = water_1atm()
    # beta=90, horizontal up, saturated -> 0.6295 MW/m^2 (hand calc).
    q = kandlikar_chf(st, contact_angle_deg=90.0, orientation_deg=0.0)
    assert isclose(q, 6.295e5, rel_tol=1e-2)


def test_kandlikar_below_zuber_for_poorly_wetting():
    st = water_1atm()
    assert kandlikar_chf(st, contact_angle_deg=90.0) < zuber_chf(st)


def test_subcooling_raises_chf_monotonically():
    st = water_1atm()
    sat = kandlikar_chf(st, 45.0, dT_sub=0.0, subcool_coeff=1.0)
    sub = kandlikar_chf(st, 45.0, dT_sub=25.0, subcool_coeff=1.0)
    assert sub > sat
