r"""Calibration diagnostics: heat partition, identifiability, cross-validation.

These are the tools that keep the fit honest:

* **partition_vs_flux** -- how the imposed flux splits between the single-phase
  and nucleate-boiling branches across the boiling curve.
* **identifiability_profile** -- freeze ``C_sf`` at a grid of values, refit the
  remaining free parameters at each, and trace the global RMSE. A sharp,
  well-defined minimum means ``C_sf`` is identifiable; a flat valley would mean
  the data cannot pin it down (and we should not over-claim precision).
* **leave_one_run_out** -- hold out one run, fit on the rest, score the
  held-out run. Probes how well the fit generalises across coolant temperature.
* **cross_geometry_transfer** -- the crux test: does ``C_sf`` (transferable)
  survive moving to a *different* condenser geometry, while ``nc_factor``
  (per-chamber) is allowed to change?
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import numpy as np

from ..config import SolverConfig
from ..geometry import chip_plain_copper
from ..model.chip_balance import solve_chip_surface
from ..properties import get_provider
from ..data.loader import RunData
from .calibrate import calibrate, run_rmse, residuals_for_runs


def partition_vs_flux(cfg: SolverConfig, run: RunData, L: Optional[float] = None):
    """Return dict of arrays: q, q_nc, q_nb, boiling_fraction, T_surf."""
    if L is None:
        L = chip_plain_copper().L_char
    provider = get_provider(cfg.fluid)
    q_nc, q_nb, bf, Ts = [], [], [], []
    for i in range(run.n_points):
        r = solve_chip_surface(cfg, run.q_flux[i], run.T_sat[i], run.T_pool[i],
                               L, provider=provider)
        q_nc.append(r.q_nc); q_nb.append(r.q_nb); bf.append(r.boiling_fraction)
        Ts.append(r.T_surf)
    return {
        "q": np.asarray(run.q_flux), "q_nc": np.asarray(q_nc),
        "q_nb": np.asarray(q_nb), "boiling_fraction": np.asarray(bf),
        "T_surf": np.asarray(Ts),
    }


@dataclass
class IdentifiabilityProfile:
    param: str
    values: np.ndarray
    rmse_K: np.ndarray
    best_value: float
    best_rmse_K: float

    def curvature(self) -> float:
        """Crude sharpness metric: RMSE rise per unit fractional change."""
        i = int(np.argmin(self.rmse_K))
        if 0 < i < len(self.values) - 1:
            dv = (self.values[-1] - self.values[0]) / self.best_value
            drmse = max(self.rmse_K[0], self.rmse_K[-1]) - self.best_rmse_K
            return drmse / dv if dv else 0.0
        return 0.0


def identifiability_profile(
    cfg: SolverConfig,
    runs: Sequence[RunData],
    param: str = "C_sf",
    values: Optional[Sequence[float]] = None,
    refit: str = "nc_factor",
    L: Optional[float] = None,
) -> IdentifiabilityProfile:
    """Profile RMSE over a frozen ``param``, refitting ``refit`` at each node."""
    if L is None:
        L = chip_plain_copper().L_char
    if values is None:
        lo, hi = cfg.param(param).bounds
        c0 = cfg.get(param)
        values = np.linspace(max(lo, 0.5 * c0), min(hi, 1.5 * c0), 21)
    values = np.asarray(values, dtype=float)

    rmses = np.empty_like(values)
    for k, v in enumerate(values):
        trial = cfg.copy()
        trial.set_value(param, v)
        trial.set_free(param, False)
        trial.set_free(refit, True)
        res = calibrate(trial, runs, L=L)
        rmses[k] = res.global_rmse_K
    i = int(np.argmin(rmses))
    return IdentifiabilityProfile(param, values, rmses, float(values[i]), float(rmses[i]))


def leave_one_run_out(
    cfg: SolverConfig, runs: Sequence[RunData], L: Optional[float] = None
) -> Dict[str, float]:
    """Hold out each run; fit on the rest; RMSE on the held-out run."""
    if L is None:
        L = chip_plain_copper().L_char
    scores: Dict[str, float] = {}
    for held in runs:
        train = [r for r in runs if r is not held]
        if not train:
            continue
        res = calibrate(cfg.copy(), train, L=L)
        scores[held.name] = run_rmse(res.cfg, held, L)
    return scores


@dataclass
class TransferResult:
    C_sf_A: float
    C_sf_B_free: float
    pct_diff: float
    rmse_B_free_K: float
    rmse_B_frozen_K: float
    nc_A: float
    nc_B_free: float
    nc_B_frozen: float
    within_tol: bool

    def report(self) -> str:
        return (
            "Cross-geometry transfer (C_sf is supposed to be transferable):\n"
            f"  geometry A : C_sf={self.C_sf_A:.4f}, nc_factor={self.nc_A:.2f}\n"
            f"  geometry B : C_sf={self.C_sf_B_free:.4f} (free), "
            f"nc_factor={self.nc_B_free:.2f}\n"
            f"  Delta C_sf : {self.pct_diff:.1f}%  -> "
            f"{'WITHIN' if self.within_tol else 'OUTSIDE'} 10% tolerance\n"
            f"  freezing C_sf=A on B: nc_factor={self.nc_B_frozen:.2f}, "
            f"RMSE={self.rmse_B_frozen_K:.2f} K "
            f"(vs free-fit RMSE {self.rmse_B_free_K:.2f} K)"
        )


def cross_geometry_transfer(
    runs_A: Sequence[RunData],
    runs_B: Sequence[RunData],
    cfg_template: Optional[SolverConfig] = None,
    tol: float = 0.10,
    L: Optional[float] = None,
) -> TransferResult:
    """Fit A, fit B freely, and re-fit B with C_sf frozen at A's value."""
    from ..config import default_config
    if cfg_template is None:
        cfg_template = default_config("Water")
    if L is None:
        L = chip_plain_copper().L_char

    fit_A = calibrate(cfg_template.copy(), runs_A, L=L)
    fit_B = calibrate(cfg_template.copy(), runs_B, L=L)

    C_sf_A = fit_A.cfg.get("C_sf")
    C_sf_B = fit_B.cfg.get("C_sf")
    pct = 100.0 * abs(C_sf_B - C_sf_A) / C_sf_A

    # freeze C_sf at A's value, refit nc_factor on B
    frozen = cfg_template.copy()
    frozen.set_value("C_sf", C_sf_A)
    frozen.set_free("C_sf", False)
    frozen.set_free("nc_factor", True)
    fit_B_frozen = calibrate(frozen, runs_B, L=L)

    return TransferResult(
        C_sf_A=C_sf_A, C_sf_B_free=C_sf_B, pct_diff=pct,
        rmse_B_free_K=fit_B.global_rmse_K,
        rmse_B_frozen_K=fit_B_frozen.global_rmse_K,
        nc_A=fit_A.cfg.get("nc_factor"),
        nc_B_free=fit_B.cfg.get("nc_factor"),
        nc_B_frozen=fit_B_frozen.cfg.get("nc_factor"),
        within_tol=(pct <= tol * 100.0),
    )
