r"""CHF honesty guard.

There is **no burnout data** anywhere in the experimental campaign. Therefore
the solver is forbidden from reporting an absolute critical heat flux. This
module enforces that contract:

* It reports the **demonstrated lower bound** -- the highest heat flux the chip
  actually survived in the data. CHF is *at least* this.
* It reports the **Kandlikar (2001) estimate**, permanently flagged
  UNCALIBRATED, computed from the bounded-fit contact angle and the
  uncalibrated subcooling coefficient.
* It checks the direction of the error. With placeholder constants the
  correlation typically falls *below* the demonstrated flux -- i.e. it is wrong
  in the **unsafe** direction (it would predict burnout at a flux the device
  already survived). That is surfaced loudly.

Asking this module for a single trustworthy CHF number raises -- by design.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from .config import SolverConfig
from .correlations.chf import kandlikar_chf, zuber_chf
from .properties import FluidState, get_provider
from .data.loader import RunData


class UncalibratedCHFError(RuntimeError):
    """Raised when code asks for an absolute CHF the data cannot support."""


@dataclass
class CHFAssessment:
    demonstrated_lower_bound_Wcm2: float
    kandlikar_uncalibrated_Wcm2: float
    zuber_reference_Wcm2: float
    kandlikar_below_demonstrated: bool
    T_sat_C: float
    contact_angle_deg: float

    # The package contract: never expose a single trusted CHF.
    @property
    def absolute_chf(self):
        raise UncalibratedCHFError(
            "Absolute CHF is not available: no burnout data exists to calibrate "
            "it. Use demonstrated_lower_bound_Wcm2 (a true lower bound) and treat "
            "kandlikar_uncalibrated_Wcm2 as an UNCALIBRATED, unsafe-direction "
            "estimate only."
        )

    def __str__(self) -> str:
        direction = (
            "BELOW the demonstrated flux -> WRONG IN THE UNSAFE DIRECTION "
            "(would predict burnout the device already survived)"
            if self.kandlikar_below_demonstrated else
            "above the demonstrated flux"
        )
        return (
            "CHF assessment (UNCALIBRATED -- no burnout data):\n"
            f"  demonstrated lower bound : q''_CHF > {self.demonstrated_lower_bound_Wcm2:.0f} W/cm^2\n"
            f"  Kandlikar (FLAGGED)      : {self.kandlikar_uncalibrated_Wcm2:.0f} W/cm^2 "
            f"[contact angle {self.contact_angle_deg:.0f} deg, uncalibrated]\n"
            f"  Zuber (reference)        : {self.zuber_reference_Wcm2:.0f} W/cm^2\n"
            f"  -> Kandlikar is {direction}.\n"
            "  Defensible statement: CHF is at least the demonstrated lower bound; "
            "the correlation values must not be used as design limits."
        )


def assess_chf(
    cfg: SolverConfig,
    demonstrated_max_Wcm2: float,
    T_sat_C: float,
    dT_sub_K: float = 0.0,
    state: Optional[FluidState] = None,
) -> CHFAssessment:
    """Build an honest CHF assessment around a demonstrated-flux lower bound."""
    if state is None:
        state = get_provider(cfg.fluid).at_Tsat(T_sat_C + 273.15)
    beta = cfg.get("contact_angle_deg")
    q_kand = kandlikar_chf(
        state, contact_angle_deg=beta,
        orientation_deg=cfg.get("chf_orientation_deg"),
        dT_sub=dT_sub_K, subcool_coeff=cfg.get("chf_subcool_coeff"), g=cfg.g,
    ) / 1e4
    q_zuber = zuber_chf(state, g=cfg.g) / 1e4

    if q_kand < demonstrated_max_Wcm2:
        warnings.warn(
            f"Kandlikar CHF ({q_kand:.0f} W/cm^2) is below the demonstrated flux "
            f"({demonstrated_max_Wcm2:.0f} W/cm^2): the uncalibrated correlation "
            "errs in the UNSAFE direction. Do not use as a design limit.",
            RuntimeWarning,
        )
    return CHFAssessment(
        demonstrated_lower_bound_Wcm2=demonstrated_max_Wcm2,
        kandlikar_uncalibrated_Wcm2=q_kand,
        zuber_reference_Wcm2=q_zuber,
        kandlikar_below_demonstrated=(q_kand < demonstrated_max_Wcm2),
        T_sat_C=T_sat_C, contact_angle_deg=beta,
    )


def demonstrated_max_flux_Wcm2(runs: Sequence[RunData]) -> float:
    """Highest heat flux survived across a set of runs [W/cm^2]."""
    return max(float(np.nanmax(r.q_flux)) for r in runs) / 1e4
