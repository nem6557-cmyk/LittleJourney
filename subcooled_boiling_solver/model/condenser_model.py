r"""Submerged tube-bundle condenser: UA / NTU / effectiveness + hydraulics.

Heat path (chamber -> coolant), per tube, as series resistances:

    R_tube = R_ext + R_wall + R_int

* **R_int** internal coolant convection. The coolant is laminar in every
  design (Re ~ 800-1630), so :math:`Nu=3.66` and this resistance *dominates* --
  which is exactly why the measured effectiveness sits on the single-phase
  bound (~5 %).
* **R_wall** tube-wall conduction, :math:`\ln(OD/ID)/(2\pi k_w L)`.
* **R_ext** external. Submerged tubes: subcooled single-phase natural
  convection (Churchill-Chu horizontal cylinder). Vapour-space tubes: laminar
  filmwise condensation (Nusselt). Because R_int dominates, R_ext is evaluated
  at a fixed nominal :math:`\Delta T` (documented), which barely moves UA.

:math:`UA=\sum_{tubes} 1/R_{tube}`. The chamber side is near-isothermal at
:math:`T_{sat}` (large pool + phase change), so :math:`C_r\to0` and
:math:`\varepsilon = 1-e^{-NTU}`, :math:`NTU=UA/C_{min}`.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import exp, log, pi

from ..correlations.film_condensation import nusselt_horizontal_tube
from ..correlations.internal_flow import internal_nu, pressure_drop
from ..correlations.natural_convection import (
    nu_churchill_chu_cylinder, rayleigh_number,
)
from ..geometry.condenser import TubeBundle
from ..properties import get_provider


@dataclass
class CondenserResult:
    UA: float                 # W/K
    NTU: float
    effectiveness: float
    Q: float                  # W removed by coolant
    coolant_dT: float         # K rise
    coolant_out_C: float
    # hydraulics
    velocity: float           # m/s
    Re: float
    dP: float                 # Pa
    # breakdown
    n_submerged: int
    n_vapor: int
    h_int: float              # W/m^2.K
    h_ext_submerged: float
    h_cond_vapor: float
    R_int: float              # K/W per tube
    R_wall: float
    notes: str = ""

    @property
    def coolant_warming(self) -> float:
        return self.coolant_dT


def solve_condenser(
    bundle: TubeBundle,
    submerged_count: int,
    coolant_in_C: float,
    flow_Lmin: float,
    T_sat_C: float,
    T_pool_C: float,
    fluid: str = "Water",
    coolant_fluid: str = "Water",
    k_tube: float = 385.0,          # copper
    nominal_dT_ext: float = 5.0,    # K, for the (sub-dominant) external coeff
    K_minor: float = 0.0,
) -> CondenserResult:
    """Compute condenser UA/NTU/effectiveness, duty and coolant hydraulics."""
    n_sub = max(0, min(submerged_count, bundle.n_tubes))
    n_vap = bundle.n_tubes - n_sub

    T_sat = T_sat_C + 273.15
    T_pool = T_pool_C + 273.15

    # --- coolant side (laminar internal flow) --------------------------
    cool = get_provider(coolant_fluid).at_Tsat(coolant_in_C + 273.15 + 1.0)
    Q_vol = flow_Lmin / 60.0 / 1000.0           # m^3/s total
    mdot = cool.rho_l * Q_vol
    cp_c = cool.cp_l
    C_min = mdot * cp_c
    V = Q_vol / (bundle.n_tubes * bundle.flow_area_per_tube)
    Re = cool.rho_l * V * bundle.ID / cool.mu_l
    Nu_i = internal_nu(Re, cool.Pr_l, bc="T")
    h_int = Nu_i * cool.k_l / bundle.ID
    A_int = pi * bundle.ID * bundle.length
    R_int = 1.0 / (h_int * A_int)

    # --- wall conduction ----------------------------------------------
    R_wall = log(bundle.OD / bundle.ID) / (2.0 * pi * k_tube * bundle.length)

    # --- external coefficients (chamber side) -------------------------
    chamber = get_provider(fluid).at_Tsat(T_sat)
    A_ext = bundle.area_per_tube

    # submerged: subcooled single-phase natural convection on a cylinder
    Ra_D = rayleigh_number(chamber, nominal_dT_ext, bundle.OD, g=9.80665)
    Nu_cyl = nu_churchill_chu_cylinder(Ra_D, chamber.Pr_l)
    h_ext_sub = Nu_cyl * chamber.k_l / bundle.OD if n_sub else 0.0

    # vapour space: laminar filmwise condensation
    h_cond = nusselt_horizontal_tube(
        chamber, T_sat, T_sat - nominal_dT_ext, bundle.OD
    ) if n_vap else 0.0

    def ua_of(n, h_ext):
        if n == 0 or h_ext <= 0.0:
            return 0.0
        R_ext = 1.0 / (h_ext * A_ext)
        return n / (R_ext + R_wall + R_int)

    UA = ua_of(n_sub, h_ext_sub) + ua_of(n_vap, h_cond)

    NTU = UA / C_min if C_min > 0 else 0.0
    eff = 1.0 - exp(-NTU)                            # Cr -> 0
    Q = eff * C_min * (T_sat - (coolant_in_C + 273.15))
    coolant_dT = Q / C_min if C_min > 0 else 0.0

    dP = pressure_drop(cool.rho_l, V, bundle.ID, bundle.length, Re, K_minor=K_minor)

    note = ""
    if n_vap and n_sub == 0:
        note = "fully vapour-space (no submerged tubes at this fill)"
    elif n_sub == bundle.n_tubes:
        note = "fully submerged (no condensation surface)"
    if Re > 2300.0:
        note = (note + "; " if note else "") + (
            f"internal flow transitional (Re={Re:.0f}>2300): UA leaves the "
            "laminar single-phase bound; treat with caution"
        )
    return CondenserResult(
        UA=UA, NTU=NTU, effectiveness=eff, Q=Q, coolant_dT=coolant_dT,
        coolant_out_C=coolant_in_C + coolant_dT, velocity=V, Re=Re, dP=dP,
        n_submerged=n_sub, n_vapor=n_vap, h_int=h_int,
        h_ext_submerged=h_ext_sub, h_cond_vapor=h_cond,
        R_int=R_int, R_wall=R_wall, notes=note,
    )
