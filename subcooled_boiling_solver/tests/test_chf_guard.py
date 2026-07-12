"""CHF guard enforces the honesty contract."""

import pytest

from ..config import default_config
from ..chf_guard import assess_chf, UncalibratedCHFError


def test_absolute_chf_refuses():
    a = assess_chf(default_config("Water"), 111.0, 54.0, 26.0)
    with pytest.raises(UncalibratedCHFError):
        _ = a.absolute_chf


def test_demonstrated_lower_bound_is_reported():
    a = assess_chf(default_config("Water"), 111.0, 54.0, 26.0)
    assert a.demonstrated_lower_bound_Wcm2 == 111.0


def test_placeholder_kandlikar_is_below_demonstrated_unsafe():
    # the whole point: uncalibrated correlation errs in the unsafe direction
    a = assess_chf(default_config("Water"), 111.0, 54.0, 26.0)
    assert a.kandlikar_below_demonstrated
    assert a.kandlikar_uncalibrated_Wcm2 < a.demonstrated_lower_bound_Wcm2


def test_emits_warning_when_unsafe():
    with pytest.warns(RuntimeWarning):
        assess_chf(default_config("Water"), 111.0, 54.0, 26.0)
