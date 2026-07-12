"""Calibration self-consistency: recover injected constants from synthetic data.

This is a HARNESS test (can the optimiser invert the forward model under
noise?), not a validation against experiment.
"""

from ..config import default_config
from ..data.synthetic import generate_campaign
from ..calibration import calibrate, cross_geometry_transfer


def test_recovers_injected_constants_33tube():
    runs = generate_campaign("33-tube", noise_K=0.5, seed=7)
    res = calibrate(default_config("Water"), runs)
    # injected: C_sf=0.0131, nc_factor=9.0
    assert abs(res.cfg.get("C_sf") - 0.0131) / 0.0131 < 0.06
    assert abs(res.cfg.get("nc_factor") - 9.0) / 9.0 < 0.10
    assert res.global_rmse_K < 1.5
    assert res.n_points >= 80


def test_csf_transfers_within_identifiability_noise():
    runs33 = generate_campaign("33-tube", noise_K=0.5, seed=3)
    runs42 = generate_campaign("42-tube", noise_K=0.5, seed=4)
    tr = cross_geometry_transfer(runs33, runs42)
    # injected truth differs by ~9%; with low noise the recovered gap is close
    assert tr.pct_diff < 14.0
    # freezing C_sf from A on B should still fit B acceptably
    assert tr.rmse_B_frozen_K < 3.5
