"""Zukauskas bundle correlation + max-velocity geometry."""

from math import isclose, sqrt

from ..correlations.zukauskas import zukauskas_nu, v_max_staggered, v_max_aligned


def test_reference_nu():
    # staggered, Re_max=1e4, Pr=Pr_s=0.71, ST/SL=2 -> C=0.40, m=0.60.
    # Nu = 0.40 * (1e4)^0.6 * 0.71^0.36 = 88.82  (n_rows>=20 -> C2=1)
    nu = zukauskas_nu(1e4, Pr=0.71, Pr_s=0.71, arrangement="staggered",
                      ST=2.0, SL=1.0, n_rows=20)
    assert isclose(nu, 88.82, rel_tol=3e-3)


def test_row_correction_factor():
    full = zukauskas_nu(1e4, 0.71, 0.71, "staggered", 2.0, 1.0, n_rows=20)
    few = zukauskas_nu(1e4, 0.71, 0.71, "staggered", 2.0, 1.0, n_rows=7)
    # 7 staggered rows -> C2 = 0.95
    assert isclose(few / full, 0.95, rel_tol=1e-9)


def test_vmax_diagonal_vs_transverse():
    # transverse plane governs
    assert isclose(v_max_staggered(1.0, ST=2.0, SL=1.0, D=0.5), 2.0 / 1.5, rel_tol=1e-9)
    # diagonal plane governs (tubes close longitudinally)
    SD = sqrt(0.5 ** 2 + 1.0 ** 2)
    assert isclose(v_max_staggered(1.0, ST=2.0, SL=0.5, D=0.5),
                   2.0 / (2.0 * (SD - 0.5)), rel_tol=1e-9)
    assert isclose(v_max_aligned(1.0, ST=2.0, D=0.5), 2.0 / 1.5, rel_tol=1e-9)
