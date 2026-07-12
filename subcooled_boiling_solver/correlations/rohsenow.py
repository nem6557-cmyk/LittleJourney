r"""Rohsenow (1952) nucleate pool-boiling correlation.

.. math::
    q''_{nb} = \mu_l\,h_{fg}\sqrt{\frac{g(\rho_l-\rho_v)}{\sigma}}
        \left(\frac{c_{p,l}\,\Delta T_{sup}}{C_{sf}\,h_{fg}\,Pr_l^{\,s}}\right)^{n}

with the superheat :math:`\Delta T_{sup}=T_{surf}-T_{sat}`, outer exponent
``n = 3`` and Prandtl exponent ``s = 1`` for water (``s = 1.7`` otherwise).
``C_sf`` is the surface-fluid constant (~0.013 for water on polished copper);
it is the transferable calibrated constant of the whole model.

Textbook anchor (``tests/test_rohsenow.py``): Incropera & DeWitt, *Fundamentals
of Heat and Mass Transfer*, Example 10.1 -- water at 1 atm on polished copper,
:math:`\Delta T_e=18` K, :math:`C_{sf}=0.0128`, gives
:math:`q''_s\approx 8.4\times10^5` W/m^2.
"""

from __future__ import annotations

from math import sqrt

from ..properties import FluidState


def rohsenow_flux(
    state: FluidState,
    dT_sup: float,
    C_sf: float,
    superheat_exp: float = 3.0,
    pr_exp: float = 1.0,
    g: float = 9.80665,
) -> float:
    """Nucleate-boiling heat flux [W/m^2].

    Returns 0 for ``dT_sup <= 0`` -- this is what makes the combined chip
    balance collapse onto the single-phase branch automatically when the
    surface is below saturation.
    """
    if dT_sup <= 0.0:
        return 0.0
    sqrt_term = sqrt(g * (state.rho_l - state.rho_v) / state.sigma)
    bracket = state.cp_l * dT_sup / (C_sf * state.h_fg * state.Pr_l ** pr_exp)
    return state.mu_l * state.h_fg * sqrt_term * bracket ** superheat_exp


def rohsenow_superheat(
    state: FluidState,
    q_flux: float,
    C_sf: float,
    superheat_exp: float = 3.0,
    pr_exp: float = 1.0,
    g: float = 9.80665,
) -> float:
    """Invert the correlation: superheat [K] required for a given flux."""
    if q_flux <= 0.0:
        return 0.0
    sqrt_term = sqrt(g * (state.rho_l - state.rho_v) / state.sigma)
    bracket = (q_flux / (state.mu_l * state.h_fg * sqrt_term)) ** (1.0 / superheat_exp)
    return bracket * (C_sf * state.h_fg * state.Pr_l ** pr_exp) / state.cp_l


def rohsenow_htc(
    state: FluidState,
    dT_sup: float,
    C_sf: float,
    superheat_exp: float = 3.0,
    pr_exp: float = 1.0,
    g: float = 9.80665,
) -> float:
    """Nucleate-boiling heat-transfer coefficient [W/m^2.K]."""
    if dT_sup <= 0.0:
        return 0.0
    return rohsenow_flux(state, dT_sup, C_sf, superheat_exp, pr_exp, g) / dT_sup
