"""Internal-flow Nu (laminar 3.66 / Gnielinski) + pressure drop."""

from math import isclose

from ..correlations.internal_flow import internal_nu, friction_factor, pressure_drop


def test_laminar_constants():
    assert internal_nu(1000.0, Pr=5.0, bc="T") == 3.66
    assert internal_nu(1000.0, Pr=5.0, bc="H") == 4.36


def test_gnielinski_reference():
    # Re=1e4, Pr=4.34 -> Nu = 66.16 (hand evaluation)
    assert isclose(internal_nu(1e4, Pr=4.34), 66.16, rel_tol=2e-3)


def test_friction_factor_laminar():
    assert isclose(friction_factor(1000.0), 0.064, rel_tol=1e-9)


def test_pressure_drop_matches_hand_calc():
    # 33-tube coolant: rho=998, V=0.261, D=3.14e-3, L=0.095, Re=818
    dp = pressure_drop(rho=998.0, V=0.261, D=3.14e-3, L=0.095, Re=818.0, K_minor=0.0)
    assert isclose(dp, 80.5, rel_tol=2e-2)
    # with entrance/exit/manifold minor losses the drop roughly matches
    # the measured ~122 Pa.
    dp_minor = pressure_drop(998.0, 0.261, 3.14e-3, 0.095, 818.0, K_minor=1.5)
    assert 120.0 < dp_minor < 140.0
