r"""Global calibration of the chip-side model via ``scipy.optimize.least_squares``.

The objective is the chip-surface-temperature residual, predicted minus
measured, stacked over every data point in every run. Each point is solved at
its *measured* ``T_sat`` and ``T_pool`` -- this is the deliberate decoupling
that isolates the boiling physics from the (out-of-scope) condenser sub-model.

Only the parameters flagged ``free`` in the :class:`SolverConfig` are varied.
By default that is exactly ``C_sf`` (transferable) and ``nc_factor``
(per-chamber). Levenberg-Marquardt (``method='lm'``) is used when the fit is
unbounded; with bounds we fall back to Trust-Region-Reflective, which is the
robust bounded analogue. Both minimise the same least-squares objective.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np
from scipy.optimize import least_squares

from ..config import SolverConfig
from ..geometry import chip_plain_copper
from ..model.chip_balance import solve_chip_surface
from ..properties import get_provider
from ..data.loader import RunData


@dataclass
class CalibrationResult:
    cfg: SolverConfig
    free_names: List[str]
    x: np.ndarray
    global_rmse_K: float
    per_run_rmse_K: Dict[str, float]
    n_points: int
    success: bool
    cost: float
    message: str = ""

    def fitted(self, name: str) -> float:
        return self.cfg.get(name)

    def report(self) -> str:
        lines = [
            "Calibration result",
            f"  free params : {self.free_names}",
            f"  fitted      : "
            + ", ".join(f"{n}={self.cfg.get(n):.4g}" for n in self.free_names),
            f"  global RMSE : {self.global_rmse_K:.2f} K  ({self.n_points} pts)",
            "  per-run RMSE:",
        ]
        for k, v in self.per_run_rmse_K.items():
            lines.append(f"    {k:<34} {v:.2f} K")
        return "\n".join(lines)


def _predict_Tsurf(cfg: SolverConfig, run: RunData, L: float, provider) -> np.ndarray:
    out = np.empty(run.n_points)
    for i in range(run.n_points):
        r = solve_chip_surface(
            cfg, run.q_flux[i], run.T_sat[i], run.T_pool[i], L, provider=provider
        )
        out[i] = r.T_surf
    return out


def predict_run(cfg: SolverConfig, run: RunData, L: Optional[float] = None) -> np.ndarray:
    if L is None:
        L = chip_plain_copper().L_char
    return _predict_Tsurf(cfg, run, L, get_provider(cfg.fluid))


def run_rmse(cfg: SolverConfig, run: RunData, L: Optional[float] = None) -> float:
    pred = predict_run(cfg, run, L)
    return float(np.sqrt(np.nanmean((pred - run.T_surf) ** 2)))


def residuals_for_runs(cfg: SolverConfig, runs: Sequence[RunData], L: float) -> np.ndarray:
    provider = get_provider(cfg.fluid)
    res = []
    for run in runs:
        pred = _predict_Tsurf(cfg, run, L, provider)
        r = pred - run.T_surf
        res.append(r[np.isfinite(r)])
    return np.concatenate(res) if res else np.array([])


def calibrate(
    cfg: SolverConfig,
    runs: Sequence[RunData],
    L: Optional[float] = None,
    verbose: int = 0,
) -> CalibrationResult:
    """Fit the free parameters of ``cfg`` to the chip temperatures in ``runs``."""
    if L is None:
        L = chip_plain_copper().L_char
    x0, lo, hi = cfg.pack()
    if not x0:
        raise ValueError("no free parameters to calibrate")

    def fun(x):
        trial = cfg.unpack(x)
        return residuals_for_runs(trial, runs, L)

    bounded = any(np.isfinite(lo)) or any(np.isfinite(hi))
    method = "trf" if bounded else "lm"
    kwargs = dict(xtol=cfg.ls_xtol, ftol=cfg.ls_ftol, max_nfev=cfg.ls_max_nfev,
                  verbose=verbose)
    if method == "trf":
        kwargs["bounds"] = (lo, hi)
    sol = least_squares(fun, x0, method=method, **kwargs)

    fitted = cfg.unpack(sol.x)
    per_run = {run.name: run_rmse(fitted, run, L) for run in runs}
    all_res = residuals_for_runs(fitted, runs, L)
    grmse = float(np.sqrt(np.mean(all_res ** 2)))
    return CalibrationResult(
        cfg=fitted, free_names=cfg.free_names(), x=sol.x,
        global_rmse_K=grmse, per_run_rmse_K=per_run, n_points=len(all_res),
        success=sol.success, cost=float(sol.cost), message=sol.message,
    )
