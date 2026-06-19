r"""Core chip heat balance.

The chip is heat-flux controlled (the experiments impose ``q''``). The surface
temperature is whatever satisfies the asymptotic combination of a single-phase
(natural-convection / subcooled) branch and a nucleate-boiling branch:

.. math::
    q'' = \sqrt{q_{nc}^2 + q_{nb}^2}

* :math:`q_{nc} = \mathrm{NC\_factor}\times` natural-convection flux on
  :math:`(T_{surf}-T_{pool})` with chip length :math:`L=A/P`.
* :math:`q_{nb} =` Rohsenow flux on :math:`(T_{surf}-T_{sat})`, which is zero
  below saturation -- so the balance collapses onto the single-phase branch
  automatically.

We solve for :math:`T_{surf}` with Brent's method. Properties are taken at the
(measured) saturation temperature, which decouples this fit from the condenser
sub-model exactly as the calibration strategy requires.
"""

from __future__ import annotations

from dataclasses import dataclass

from scipy.optimize import brentq

from ..config import SolverConfig
from ..correlations.natural_convection import natural_convection_flux
from ..correlations.rohsenow import rohsenow_flux
from ..properties import FluidState, PropertyProvider, get_provider


@dataclass
class ChipBalanceResult:
    q_flux: float          # W/m^2 imposed
    T_surf: float          # K
    T_sat: float           # K
    T_pool: float          # K
    q_nc: float            # W/m^2 single-phase part
    q_nb: float            # W/m^2 boiling part
    h_nc: float            # W/m^2.K
    Ra: float
    Nu: float
    dT_sup: float          # K, T_surf - T_sat (superheat)
    dT_pool: float         # K, T_surf - T_pool (wall-to-pool)
    subcool: float         # K, T_sat - T_pool
    regime: str            # 'single-phase' | 'boiling'

    @property
    def boiling_fraction(self) -> float:
        denom = self.q_flux if self.q_flux > 0 else 1.0
        return self.q_nb / denom


def _combined_flux(T_surf, state, cfg, T_pool, T_sat, L, nc_corr):
    nc_flux, h_nc, Ra, Nu = natural_convection_flux(
        state, T_surf - T_pool, L, g=cfg.g, correlation=nc_corr,
    )
    nc_flux *= cfg.get("nc_factor")
    h_nc *= cfg.get("nc_factor")
    nb_flux = rohsenow_flux(
        state, T_surf - T_sat, cfg.get("C_sf"),
        superheat_exp=cfg.get("rohsenow_n"), pr_exp=cfg.get("rohsenow_s"), g=cfg.g,
    )
    total = (nc_flux ** 2 + nb_flux ** 2) ** 0.5
    return total, nc_flux, nb_flux, h_nc, Ra, Nu


def solve_chip_surface(
    cfg: SolverConfig,
    q_flux: float,
    T_sat: float,
    T_pool: float,
    L_char: float,
    provider: PropertyProvider | None = None,
    nc_correlation: str = "mcadams_up",
    state: FluidState | None = None,
) -> ChipBalanceResult:
    """Solve for chip surface temperature at an imposed heat flux.

    ``T_sat``, ``T_pool`` in kelvin; ``q_flux`` in W/m^2; ``L_char`` in m.
    """
    if provider is None:
        provider = get_provider(cfg.fluid)
    if state is None:
        state = provider.at_Tsat(T_sat)

    def residual(T_surf):
        total, *_ = _combined_flux(T_surf, state, cfg, T_pool, T_sat, L_char, nc_correlation)
        return total - q_flux

    lo = T_pool + 1e-6
    hi = T_sat + cfg.Tsurf_search_K[1]
    # Guarantee a bracket: push hi up until residual is positive.
    f_hi = residual(hi)
    tries = 0
    while f_hi < 0 and tries < 8:
        hi += 100.0
        f_hi = residual(hi)
        tries += 1
    T_surf = brentq(residual, lo, hi, xtol=cfg.brent_xtol)

    total, nc_flux, nb_flux, h_nc, Ra, Nu = _combined_flux(
        T_surf, state, cfg, T_pool, T_sat, L_char, nc_correlation
    )
    dT_sup = T_surf - T_sat
    return ChipBalanceResult(
        q_flux=q_flux, T_surf=T_surf, T_sat=T_sat, T_pool=T_pool,
        q_nc=nc_flux, q_nb=nb_flux, h_nc=h_nc, Ra=Ra, Nu=Nu,
        dT_sup=dT_sup, dT_pool=T_surf - T_pool, subcool=T_sat - T_pool,
        regime="boiling" if dT_sup > 0 else "single-phase",
    )


def boiling_curve(
    cfg: SolverConfig,
    q_fluxes,
    T_sat: float,
    T_pool: float,
    L_char: float,
    provider: PropertyProvider | None = None,
    nc_correlation: str = "mcadams_up",
):
    """Solve the chip balance across a sequence of heat fluxes.

    Returns a list of :class:`ChipBalanceResult`. ``q_fluxes`` in W/m^2.
    """
    if provider is None:
        provider = get_provider(cfg.fluid)
    state = provider.at_Tsat(T_sat)
    return [
        solve_chip_surface(cfg, q, T_sat, T_pool, L_char, provider,
                           nc_correlation, state=state)
        for q in q_fluxes
    ]
