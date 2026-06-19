"""Central configuration with explicit calibration *status* for every constant.

This module is the backbone of the package's intellectual-honesty contract.
Every tunable number carries a :class:`ParamStatus` so that downstream code,
reports and plots can state *exactly* what is calibrated, what merely fits
within physical bounds, and what is uncalibrated and therefore must never be
reported as a trustworthy absolute.

Status taxonomy
---------------
FIXED_PHYSICAL
    Known physics, never fitted. e.g. gravitational acceleration, the
    Rohsenow superheat exponent (3 for water), the Prandtl exponent s=1 for
    water.
CALIBRATED_TRANSFERABLE
    Fitted from data, but expected to be *geometry independent* -- a genuine
    material/surface constant that should transfer between chambers. The
    Rohsenow surface-fluid constant ``C_sf`` is the canonical example
    (~0.013 for water on polished copper). The cross-geometry test asserts it
    stays within ~10 %.
CALIBRATED_PERCHAMBER
    Fitted, but explicitly *does not transfer*. ``nc_factor`` lumps
    circulation + partial subcooled boiling enhancement that depends on the
    condenser geometry and must be re-fit per chamber. We do not pretend
    otherwise.
BOUNDED_FIT
    Fitted only within hard physical bounds, weakly identified by the data.
    The CHF contact angle is bounded-fit; it influences only the (flagged)
    CHF estimate, not the chip-temperature fit.
UNCALIBRATED
    No data exists to constrain it. Any output that depends on an
    UNCALIBRATED parameter MUST be emitted with an explicit warning and may
    never be presented as a validated absolute. The whole CHF sub-model is
    uncalibrated (no burnout data).
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import Enum
from math import inf
from typing import Dict, List, Tuple


class ParamStatus(Enum):
    FIXED_PHYSICAL = "fixed_physical"
    CALIBRATED_TRANSFERABLE = "calibrated_transferable"
    CALIBRATED_PERCHAMBER = "calibrated_perchamber"
    BOUNDED_FIT = "bounded_fit"
    UNCALIBRATED = "uncalibrated"


@dataclass
class Parameter:
    """A single model constant with its calibration provenance."""

    name: str
    value: float
    status: ParamStatus
    bounds: Tuple[float, float] = (-inf, inf)
    free: bool = False  # varied by the active least_squares fit?
    units: str = "-"
    note: str = ""

    def __post_init__(self) -> None:
        lo, hi = self.bounds
        if lo > hi:
            raise ValueError(f"{self.name}: lower bound {lo} > upper bound {hi}")
        if not (lo <= self.value <= hi):
            raise ValueError(
                f"{self.name}: initial value {self.value} outside bounds {self.bounds}"
            )
        if self.free and self.status in (
            ParamStatus.FIXED_PHYSICAL,
            ParamStatus.UNCALIBRATED,
        ):
            # A FIXED_PHYSICAL constant should never be fitted; an UNCALIBRATED
            # one *cannot* be fitted (no data). Guard against silent mistakes.
            raise ValueError(
                f"{self.name}: status {self.status.value} is incompatible with free=True"
            )


@dataclass
class SolverConfig:
    """Holds every model parameter plus fluid choice and numeric settings.

    Construct via :func:`default_config`; mutate through :meth:`set_value`,
    :meth:`set_free` so that status guarantees are preserved.
    """

    fluid: str = "Water"
    params: Dict[str, Parameter] = field(default_factory=dict)

    # --- numeric / solver settings -------------------------------------
    g: float = 9.80665                  # m/s^2
    Tsurf_search_K: Tuple[float, float] = (0.01, 400.0)  # bracket above T_pool
    brent_xtol: float = 1e-4            # K
    ls_xtol: float = 1e-12
    ls_ftol: float = 1e-12
    ls_max_nfev: int = 2000

    # ------------------------------------------------------------------ #
    # construction helpers
    # ------------------------------------------------------------------ #
    def add(self, p: Parameter) -> None:
        if p.name in self.params:
            raise KeyError(f"duplicate parameter {p.name}")
        self.params[p.name] = p

    def get(self, name: str) -> float:
        return self.params[name].value

    def param(self, name: str) -> Parameter:
        return self.params[name]

    def set_value(self, name: str, value: float) -> None:
        p = self.params[name]
        lo, hi = p.bounds
        # Clamp softly to bounds (least_squares respects bounds, but rounding
        # can nudge a hair outside).
        self.params[name] = replace(p, value=min(max(value, lo), hi))

    def set_free(self, name: str, free: bool) -> None:
        p = self.params[name]
        if free and p.status in (ParamStatus.FIXED_PHYSICAL, ParamStatus.UNCALIBRATED):
            raise ValueError(
                f"cannot free {name}: status is {p.status.value}"
            )
        self.params[name] = replace(p, free=free)

    # ------------------------------------------------------------------ #
    # least_squares packing
    # ------------------------------------------------------------------ #
    def free_names(self) -> List[str]:
        return [n for n, p in self.params.items() if p.free]

    def pack(self) -> Tuple[List[float], List[float], List[float]]:
        """Return (x0, lower, upper) for the free parameters."""
        x0, lo, hi = [], [], []
        for n in self.free_names():
            p = self.params[n]
            x0.append(p.value)
            lo.append(p.bounds[0])
            hi.append(p.bounds[1])
        return x0, lo, hi

    def unpack(self, x: List[float]) -> "SolverConfig":
        """Return a copy with free parameters set to the vector ``x``."""
        new = self.copy()
        for n, v in zip(self.free_names(), x):
            new.set_value(n, float(v))
        return new

    def copy(self) -> "SolverConfig":
        return SolverConfig(
            fluid=self.fluid,
            params={k: replace(v) for k, v in self.params.items()},
            g=self.g,
            Tsurf_search_K=self.Tsurf_search_K,
            brent_xtol=self.brent_xtol,
            ls_xtol=self.ls_xtol,
            ls_ftol=self.ls_ftol,
            ls_max_nfev=self.ls_max_nfev,
        )

    # ------------------------------------------------------------------ #
    # reporting
    # ------------------------------------------------------------------ #
    def by_status(self, status: ParamStatus) -> List[Parameter]:
        return [p for p in self.params.values() if p.status == status]

    def summary(self) -> str:
        lines = [f"SolverConfig(fluid={self.fluid})", ""]
        width = max(len(n) for n in self.params)
        for status in ParamStatus:
            ps = self.by_status(status)
            if not ps:
                continue
            lines.append(f"[{status.value}]")
            for p in ps:
                free = " (FREE)" if p.free else ""
                lines.append(
                    f"  {p.name:<{width}} = {p.value:<10.5g} {p.units:<8}{free}"
                    + (f"  # {p.note}" if p.note else "")
                )
            lines.append("")
        return "\n".join(lines)


def default_config(fluid: str = "Water") -> SolverConfig:
    """The canonical parameter set.

    Free-by-default parameters are exactly the two the experimental data can
    identify: ``C_sf`` (transferable) and ``nc_factor`` (per-chamber). The
    identifiability profile in :mod:`calibration.diagnostics` demonstrates why
    freeing more than these is not supported by the data -- we therefore hold
    the rest fixed rather than over-fit, which is itself an honesty choice.
    """
    cfg = SolverConfig(fluid=fluid)

    # --- the two identifiable, calibrated parameters -------------------
    cfg.add(Parameter(
        "C_sf", 0.013, ParamStatus.CALIBRATED_TRANSFERABLE,
        bounds=(0.005, 0.030), free=True, units="-",
        note="Rohsenow surface-fluid constant; ~0.013 water/polished-Cu; transferable",
    ))
    cfg.add(Parameter(
        "nc_factor", 1.0, ParamStatus.CALIBRATED_PERCHAMBER,
        bounds=(0.5, 25.0), free=True, units="-",
        note="single-phase enhancement (circulation + partial subcooled boiling); per-chamber",
    ))

    # --- fixed physics for water ---------------------------------------
    cfg.add(Parameter(
        "rohsenow_n", 3.0, ParamStatus.FIXED_PHYSICAL, bounds=(3.0, 3.0),
        units="-", note="superheat exponent; 3 for water",
    ))
    cfg.add(Parameter(
        "rohsenow_s", 1.0, ParamStatus.FIXED_PHYSICAL, bounds=(1.0, 1.0),
        units="-", note="Prandtl exponent; 1.0 for water (1.7 otherwise)",
    ))

    # --- bounded-fit, used only by the (flagged) CHF model -------------
    cfg.add(Parameter(
        "contact_angle_deg", 45.0, ParamStatus.BOUNDED_FIT, bounds=(20.0, 90.0),
        free=False, units="deg",
        note="receding contact angle for Kandlikar CHF; weakly identified",
    ))

    # --- uncalibrated CHF knobs (NEVER free) ---------------------------
    cfg.add(Parameter(
        "chf_orientation_deg", 0.0, ParamStatus.UNCALIBRATED, bounds=(0.0, 90.0),
        units="deg", note="surface orientation (0=horizontal up); CHF model uncalibrated",
    ))
    cfg.add(Parameter(
        "chf_subcool_coeff", 1.0, ParamStatus.UNCALIBRATED, bounds=(0.0, 5.0),
        units="-", note="Kandlikar subcooling-enhancement coefficient; uncalibrated",
    ))

    # --- measured surface property (not fitted) ------------------------
    cfg.add(Parameter(
        "surface_Ra_um", 2.5, ParamStatus.FIXED_PHYSICAL, bounds=(2.5, 2.5),
        units="um", note="measured chip arithmetic roughness (Cooper correlation input)",
    ))
    return cfg
