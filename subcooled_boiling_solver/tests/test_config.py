"""Parameter-status guarantees in the config object."""

import pytest

from ..config import default_config, ParamStatus, Parameter


def test_cannot_free_fixed_or_uncalibrated():
    cfg = default_config("Water")
    with pytest.raises(ValueError):
        cfg.set_free("rohsenow_n", True)        # FIXED_PHYSICAL
    with pytest.raises(ValueError):
        cfg.set_free("chf_subcool_coeff", True)  # UNCALIBRATED


def test_default_free_set_is_the_two_identifiable_params():
    cfg = default_config("Water")
    assert set(cfg.free_names()) == {"C_sf", "nc_factor"}


def test_pack_unpack_roundtrip():
    cfg = default_config("Water")
    x0, lo, hi = cfg.pack()
    assert len(x0) == 2
    cfg2 = cfg.unpack([0.02, 5.0])
    assert cfg2.get("C_sf") == 0.02
    assert cfg2.get("nc_factor") == 5.0
    # original is untouched
    assert cfg.get("C_sf") == 0.013


def test_bounds_enforced_on_construction():
    with pytest.raises(ValueError):
        Parameter("x", 5.0, ParamStatus.BOUNDED_FIT, bounds=(0.0, 1.0))


def test_status_partition_is_exhaustive():
    cfg = default_config("Water")
    counted = sum(len(cfg.by_status(s)) for s in ParamStatus)
    assert counted == len(cfg.params)
