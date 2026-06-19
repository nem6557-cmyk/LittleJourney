r"""Nusselt laminar-film condensation on horizontal tubes.

Single tube:

.. math::
    \bar h_D = 0.729\left[\frac{g\,\rho_l(\rho_l-\rho_v)k_l^3\,h'_{fg}}
        {\mu_l(T_{sat}-T_s)D}\right]^{1/4},\qquad
    h'_{fg}=h_{fg}+0.68\,c_{p,l}(T_{sat}-T_s).

For a vertical column of ``N`` tubes the condensate cascades, lowering the
average coefficient: :math:`\bar h_{D,N}=\bar h_D\,N^{-1/4}`.

Liquid properties should be evaluated at the film temperature
:math:`T_f=(T_{sat}+T_s)/2`; the caller passes a :class:`FluidState` it has
already prepared at the desired reference temperature.
"""

from __future__ import annotations

from ..properties import FluidState


def nusselt_horizontal_tube(
    state: FluidState,
    T_sat: float,
    T_surf: float,
    D: float,
    g: float = 9.80665,
) -> float:
    """Average condensation coefficient on a single horizontal tube [W/m^2.K]."""
    dT = T_sat - T_surf
    if dT <= 0.0:
        return 0.0
    hfg_prime = state.h_fg + 0.68 * state.cp_l * dT
    num = g * state.rho_l * (state.rho_l - state.rho_v) * state.k_l ** 3 * hfg_prime
    return 0.729 * (num / (state.mu_l * dT * D)) ** 0.25


def nusselt_tube_column(
    state: FluidState,
    T_sat: float,
    T_surf: float,
    D: float,
    n_in_column: int = 1,
    g: float = 9.80665,
) -> float:
    """Column-averaged coefficient for ``n_in_column`` stacked tubes."""
    h1 = nusselt_horizontal_tube(state, T_sat, T_surf, D, g)
    if n_in_column <= 1:
        return h1
    return h1 * n_in_column ** -0.25
