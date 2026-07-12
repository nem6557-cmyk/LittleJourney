"""Geometry: chip length scale, bundle areas/velocities, submersion, fill."""

from math import isclose

from ..geometry import (
    chip_plain_copper, bundle_33_tube, bundle_42_tube, bundle_66_tube,
)


def test_chip_characteristic_length():
    chip = chip_plain_copper()
    assert isclose(chip.area * 1e4, 11.04, rel_tol=1e-3)      # cm^2
    assert isclose(chip.L_char * 1e3, 8.30, rel_tol=2e-3)     # mm


def test_geometric_external_area_matches_quoted_for_42_and_66():
    # 42-tube and 66-tube quote pi*OD*L*N exactly; 33-tube does not.
    assert bundle_42_tube().area_discrepancy() < 0.02
    assert bundle_66_tube().area_discrepancy() < 0.02
    assert bundle_33_tube().area_discrepancy() > 0.2          # flagged, not hidden


def test_coolant_velocities_at_4Lmin():
    Q = 4e-3 / 60.0
    for b, v_expected in [(bundle_33_tube(), 0.26),
                          (bundle_42_tube(), 1.05),
                          (bundle_66_tube(), 0.40)]:
        V = Q / (b.n_tubes * b.flow_area_per_tube)
        assert isclose(V, v_expected, abs_tol=0.02)


def test_submersion_fractions():
    b = bundle_33_tube()
    zc = 0.010
    # exactly at centre -> half by area and by perimeter
    assert isclose(b.submerged_area_fraction(zc, zc), 0.5, abs_tol=1e-9)
    assert isclose(b.wetted_perimeter_fraction(zc, zc), 0.5, abs_tol=1e-9)
    # fully below / fully above
    assert b.submerged_area_fraction(zc, zc + b.OD) == 1.0
    assert b.submerged_area_fraction(zc, zc - b.OD) == 0.0


def test_fill_height_monotonic_in_fraction():
    b = bundle_33_tube()
    h40 = b.fill_height(0.40)
    h60 = b.fill_height(0.60)
    h80 = b.fill_height(0.80)
    assert h40 < h60 < h80
    # within the cavity
    assert b.cavity_z[0] <= h40 and h80 <= b.cavity_z[1]


def test_tubes_per_row_consistency():
    for b in (bundle_33_tube(), bundle_42_tube(), bundle_66_tube()):
        assert sum(b.tubes_per_row) == b.n_tubes
        assert len(b.positions) == b.n_tubes
