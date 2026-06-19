"""Synthetic self-consistency data generator.

.. warning::
   Data produced here is **SYNTHETIC**. It exists solely to exercise the
   calibration/diagnostic harness end-to-end when the proprietary experimental
   workbooks are not in the workspace, and to verify that the calibrator can
   *recover injected constants* from noisy data. It is NOT experimental data
   and recovering the injected ``C_sf`` is a self-consistency check, NOT a
   validation against reality. Every :class:`RunData` it returns is tagged
   ``source='SYNTHETIC'``.

The generator runs the *forward* chip model with a chosen "true" ``C_sf`` and
``nc_factor``, at operating conditions (T_sat, subcool) anchored to the
documented performance points, then adds Gaussian thermocouple-like noise to
``T_surf``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from ..config import SolverConfig, default_config
from ..geometry import chip_plain_copper
from ..model.chip_balance import solve_chip_surface
from .loader import RunData


@dataclass
class RunSpec:
    """Operating condition for one synthetic run."""

    design: str
    coolant_in_C: float
    fill_fraction: float
    T_sat_C_at40: float        # T_sat near 40 W/cm^2
    subcool_at40: float        # K
    C_sf_true: float
    nc_factor_true: float
    n_points: int = 22
    q_min_Wcm2: float = 1.0
    q_max_Wcm2: float = 50.0


def _operating_profiles(spec: RunSpec, q_Wcm2: np.ndarray):
    """T_sat and T_pool profiles vs flux (mild, physically-plausible slopes).

    T_sat rises slightly with flux (more vapour -> higher chamber pressure);
    subcooling shrinks as flux rises. Anchored so that the 40 W/cm^2 point hits
    the documented (T_sat, subcool).
    """
    f = (q_Wcm2 - 40.0) / 40.0
    T_sat_C = spec.T_sat_C_at40 + 6.0 * f            # ~+/-6 K across the sweep
    subcool = np.clip(spec.subcool_at40 - 4.0 * f, 0.0, None)
    T_pool_C = T_sat_C - subcool
    return T_sat_C, T_pool_C


def generate_run(spec: RunSpec, noise_K: float = 1.5, seed: Optional[int] = 0) -> RunData:
    """Forward-model a synthetic boiling-curve run with injected true params."""
    rng = np.random.default_rng(seed)
    cfg = default_config("Water")
    cfg.set_value("C_sf", spec.C_sf_true)
    cfg.set_value("nc_factor", spec.nc_factor_true)
    L = chip_plain_copper().L_char

    q_Wcm2 = np.linspace(spec.q_min_Wcm2, spec.q_max_Wcm2, spec.n_points)
    T_sat_C, T_pool_C = _operating_profiles(spec, q_Wcm2)

    q = q_Wcm2 * 1e4
    T_surf = np.empty_like(q)
    for i in range(len(q)):
        r = solve_chip_surface(cfg, q[i], T_sat_C[i] + 273.15, T_pool_C[i] + 273.15, L)
        T_surf[i] = r.T_surf
    T_surf_noisy = T_surf + rng.normal(0.0, noise_K, size=T_surf.shape)

    subcool = T_sat_C - T_pool_C
    return RunData(
        name=f"SYN {spec.design} {int(spec.coolant_in_C)}C fill{int(spec.fill_fraction*100)}",
        source="SYNTHETIC",
        q_flux=q,
        T_surf=T_surf_noisy,                 # already in K
        T_sat=T_sat_C + 273.15,
        T_pool=T_pool_C + 273.15,
        subcool=subcool,
        dT_sat=(T_surf - (T_sat_C + 273.15)),
        design=spec.design,
        coolant_in_C=spec.coolant_in_C,
        fill_fraction=spec.fill_fraction,
        tsurf_note="SYNTHETIC forward-model output + Gaussian noise",
    )


# ---- canonical synthetic campaigns mirroring the documented conditions ----
_CAMP_33 = [
    RunSpec("33-tube", 20, 0.40, 54.0, 26.0, 0.0131, 9.0),
    RunSpec("33-tube", 30, 0.40, 57.0, 22.0, 0.0131, 9.0),
    RunSpec("33-tube", 40, 0.40, 60.0, 16.0, 0.0131, 9.0),
    RunSpec("33-tube", 50, 0.40, 64.0, 10.0, 0.0131, 9.0),
]
_CAMP_42 = [
    RunSpec("42-tube", 20, 0.40, 54.0, 4.0, 0.0119, 3.3),
    RunSpec("42-tube", 30, 0.40, 60.0, 3.0, 0.0119, 3.3),
    RunSpec("42-tube", 40, 0.40, 66.0, 1.0, 0.0119, 3.3),
    RunSpec("42-tube", 50, 0.40, 73.0, 0.0, 0.0119, 3.3),
]


def generate_campaign(
    design: str, noise_K: float = 1.5, seed: int = 0
) -> List[RunData]:
    """Generate the 4-coolant-temperature synthetic campaign for a design."""
    specs = {"33-tube": _CAMP_33, "42-tube": _CAMP_42}[design]
    return [generate_run(s, noise_K=noise_K, seed=seed + i) for i, s in enumerate(specs)]
