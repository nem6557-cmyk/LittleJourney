"""Chip heat balance: branch logic, monotonicity, residual closure."""

from math import isclose

from ..config import default_config
from ..geometry import chip_plain_copper
from ..model.chip_balance import solve_chip_surface

L = chip_plain_copper().L_char


def _cfg():
    cfg = default_config("Water")
    cfg.set_value("C_sf", 0.0131)
    cfg.set_value("nc_factor", 9.0)
    return cfg


def test_low_flux_is_single_phase():
    # small flux, strongly subcooled -> surface stays below saturation
    r = solve_chip_surface(_cfg(), 1e4, 327.15, 301.15, L)  # 1 W/cm^2
    assert r.regime == "single-phase"
    assert r.q_nb == 0.0
    assert r.T_surf < r.T_sat


def test_high_flux_is_boiling():
    r = solve_chip_surface(_cfg(), 60e4, 327.15, 301.15, L)  # 60 W/cm^2
    assert r.regime == "boiling"
    assert r.q_nb > 0.0
    assert r.T_surf > r.T_sat


def test_combined_flux_closes_to_imposed():
    r = solve_chip_surface(_cfg(), 30e4, 327.15, 301.15, L)
    combined = (r.q_nc ** 2 + r.q_nb ** 2) ** 0.5
    assert isclose(combined, 30e4, rel_tol=1e-3)


def test_T_surf_monotonic_in_flux():
    cfg = _cfg()
    Ts = [solve_chip_surface(cfg, q, 327.15, 301.15, L).T_surf
          for q in (5e4, 10e4, 20e4, 40e4, 80e4)]
    assert all(b > a for a, b in zip(Ts, Ts[1:]))


def test_documented_operating_point():
    # 33-tube @20C: 40 W/cm^2, T_sat=54C, subcool 26 -> ~60C (target)
    r = solve_chip_surface(_cfg(), 40e4, 54 + 273.15, 28 + 273.15, L)
    assert abs((r.T_surf - 273.15) - 60.0) < 3.0
