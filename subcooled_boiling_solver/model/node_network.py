r"""Quasi-3D distributed lumped node network for the chamber.

Nodes
-----
* 1 chip node (solved by :mod:`model.chip_balance`).
* ``K`` stacked bulk-liquid layers (thermal stratification, reduced-order).
* ``N`` condenser tubes, each split into ``M`` axial segments (coolant warms
  along the tube).
* 1 head-space / vapour node at ``T_sat``.

What is trustworthy here
------------------------
The chip node and the condenser duty/hydraulics are validated. The stratified
liquid field is an **illustrative reduced-order** reconstruction for the
cross-section / longitudinal plots -- it is not a CFD solution and is not
claimed to be quantitatively accurate.

Operating-point closure is **OUT OF SCOPE**: the condenser saturation/pressure
sub-model over-predicts the T_sat rise by ~2.7x and area-scaling between
geometries fails. :func:`predict_operating_point` therefore refuses to emit a
point estimate; it returns a bracketed band with an explicit out-of-scope flag.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from ..config import SolverConfig
from ..geometry.chip import ChipGeometry
from ..geometry.condenser import TubeBundle
from .chip_balance import ChipBalanceResult, solve_chip_surface
from .condenser_model import CondenserResult, solve_condenser

# Documented bias of the (broken) operating-point sub-model. We expose it but
# never silently apply it -- applying a fudge factor would defeat the purpose.
KNOWN_TSAT_OVERPREDICTION = 2.7


@dataclass
class TubeField:
    index: int
    position: Tuple[float, float]      # (transverse, z) [m]
    axial: np.ndarray                  # M axial coordinates [m]
    temps_C: np.ndarray                # coolant temperature along the tube [C]
    submerged: bool


@dataclass
class ChamberState:
    design: str
    chip: ChipBalanceResult
    condenser: CondenserResult
    water_height: float                          # m
    layer_z: np.ndarray                          # K layer centres [m]
    layer_T_C: np.ndarray                        # K layer temperatures [C]
    tubes: List[TubeField] = field(default_factory=list)
    vapor_T_C: float = 0.0
    pressure_Pa: float = 0.0

    def summary(self) -> str:
        c = self.chip
        return (
            f"{self.design}: q''={c.q_flux/1e4:.1f} W/cm^2, "
            f"T_surf={c.T_surf-273.15:.1f} C, T_sat={c.T_sat-273.15:.1f} C, "
            f"subcool={c.subcool:.1f} K | UA={self.condenser.UA:.1f} W/K, "
            f"eff={self.condenser.effectiveness*100:.1f}%, "
            f"coolant +{self.condenser.coolant_dT:.2f} K"
        )


def _smoothstep(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def build_chamber(
    cfg: SolverConfig,
    bundle: TubeBundle,
    chip: ChipGeometry,
    q_flux: float,
    T_sat_C: float,
    T_pool_C: float,
    coolant_in_C: float,
    flow_Lmin: float,
    submerged_count: int,
    water_height: float,
    K_layers: int = 7,
    M_segments: int = 12,
    pressure_Pa: Optional[float] = None,
) -> ChamberState:
    """Assemble a :class:`ChamberState` for visualisation / diagnostics."""
    T_sat = T_sat_C + 273.15
    T_pool = T_pool_C + 273.15

    chip_res = solve_chip_surface(cfg, q_flux, T_sat, T_pool, chip.L_char)
    cond = solve_condenser(
        bundle, submerged_count, coolant_in_C, flow_Lmin, T_sat_C, T_pool_C,
        fluid=cfg.fluid,
    )

    # --- reduced-order liquid stratification (illustrative) -----------
    floor = bundle.cavity_z[0]
    zc = np.linspace(floor, water_height, K_layers)
    f = (zc - floor) / max(water_height - floor, 1e-9)
    # subcooled liquid feeds the chip at the bottom (near T_pool); the liquid
    # warms toward saturation up at the vapour interface.
    layer_T = T_pool + (T_sat - T_pool) * _smoothstep(f)
    layer_T_C = layer_T - 273.15

    # --- tube segment temperatures (coolant warms inlet->outlet) ------
    tubes: List[TubeField] = []
    cool_in, cool_out = coolant_in_C, cond.coolant_out_C
    a_lo, a_hi = bundle.cavity_axial
    axial = np.linspace(a_lo, a_hi, M_segments)
    seg_T = np.linspace(cool_in, cool_out, M_segments)
    for i, (t, z) in enumerate(bundle.positions):
        tubes.append(TubeField(
            index=i, position=(t, z), axial=axial, temps_C=seg_T.copy(),
            submerged=(z <= water_height),
        ))

    return ChamberState(
        design=bundle.name, chip=chip_res, condenser=cond,
        water_height=water_height, layer_z=zc, layer_T_C=layer_T_C,
        tubes=tubes, vapor_T_C=T_sat_C,
        pressure_Pa=pressure_Pa if pressure_Pa is not None else chip_res_pressure(cfg, T_sat),
    )


def chip_res_pressure(cfg: SolverConfig, T_sat: float) -> float:
    from ..properties import get_provider
    return get_provider(cfg.fluid).at_Tsat(T_sat).P_sat


@dataclass
class OperatingBand:
    """Bracketed operating-point estimate. NOT a point prediction."""

    out_of_scope: bool
    T_sat_lower_C: float
    T_sat_upper_C: float
    raw_model_C: float
    note: str

    def __str__(self) -> str:
        return (
            f"OPERATING-POINT (OUT OF SCOPE): T_sat in "
            f"[{self.T_sat_lower_C:.1f}, {self.T_sat_upper_C:.1f}] C "
            f"(raw sub-model {self.raw_model_C:.1f} C). {self.note}"
        )


def predict_operating_point(
    cfg: SolverConfig,
    bundle: TubeBundle,
    chip: ChipGeometry,
    q_flux: float,
    coolant_in_C: float,
    flow_Lmin: float,
    submerged_count: int,
    water_height: float,
    T_pool_guess_C: float,
) -> OperatingBand:
    """Attempt the closed-chamber T_sat closure -- returns a *band*, not a point.

    The vapour generated by chip boiling must be condensed by the bundle; T_sat
    floats to balance them. This sub-model is known to over-predict the T_sat
    rise by ~2.7x, so we deliberately do not return a single number.
    """
    warnings.warn(
        "predict_operating_point: operating-condition prediction is OUT OF "
        "SCOPE (condenser sat/pressure sub-model over-predicts T_sat rise by "
        f"~{KNOWN_TSAT_OVERPREDICTION}x). Returning a bracketed band.",
        RuntimeWarning,
    )

    # Raw closure: find T_sat where condenser duty equals the imposed chip
    # power (all of q'' eventually leaves through the coolant at steady state).
    from scipy.optimize import brentq

    A_chip = chip.area
    power = q_flux * A_chip

    def imbalance(T_sat_C):
        cond = solve_condenser(
            bundle, submerged_count, coolant_in_C, flow_Lmin, T_sat_C,
            T_pool_guess_C, fluid=cfg.fluid,
        )
        return cond.Q - power

    try:
        raw = brentq(imbalance, coolant_in_C + 0.5, coolant_in_C + 150.0)
    except ValueError:
        raw = float("nan")

    # Honest band: the *floor* is roughly the coolant inlet plus the minimum
    # sat-rise the data ever shows; the *ceiling* is the raw (over-predicting)
    # sub-model. We bracket rather than pretend precision.
    rise = raw - coolant_in_C
    lower = coolant_in_C + rise / KNOWN_TSAT_OVERPREDICTION
    upper = raw
    return OperatingBand(
        out_of_scope=True,
        T_sat_lower_C=lower, T_sat_upper_C=upper, raw_model_C=raw,
        note="Use measured (T_sat, T_pool) as inputs for any quantitative work.",
    )
