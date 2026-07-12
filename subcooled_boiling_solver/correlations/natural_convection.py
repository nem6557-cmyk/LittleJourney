r"""Single-phase natural convection on the chip.

Two correlations are provided:

* **McAdams** upward-facing heated horizontal plate (the chip lies on the
  chamber floor facing up), with characteristic length :math:`L=A_s/P`:

  .. math::
      Nu = 0.54\,Ra_L^{1/4}\quad(10^4<Ra_L<10^7),\qquad
      Nu = 0.15\,Ra_L^{1/3}\quad(10^7<Ra_L<10^{11}).

* **Churchill-Chu** all-:math:`Ra` vertical-plate form (available for
  cross-checks / submerged vertical surfaces):

  .. math::
      Nu = \left\{0.825 + \frac{0.387\,Ra^{1/6}}
      {[1+(0.492/Pr)^{9/16}]^{8/27}}\right\}^2.

Property evaluation follows the prompt: saturated-liquid properties at the
local saturation temperature (a simplification; the film temperature would be
marginally more accurate but the calibration absorbs the offset into
``nc_factor``).
"""

from __future__ import annotations

from ..properties import FluidState


def rayleigh_number(state: FluidState, dT: float, L: float, g: float = 9.80665) -> float:
    """:math:`Ra_L = g\\beta\\,\\Delta T\\,L^3/(\\nu\\alpha)` using liquid props."""
    return g * state.beta_l * dT * L ** 3 / (state.nu_l * state.alpha_l)


def nu_mcadams_plate_up(Ra: float) -> float:
    """McAdams Nu for a hot horizontal plate facing up."""
    if Ra <= 0.0:
        return 0.0
    if Ra < 1e7:
        # 0.54 Ra^1/4 branch; below 1e4 it under-predicts but the chip always
        # sits in the laminar/turbulent plate range in practice.
        return 0.54 * Ra ** 0.25
    return 0.15 * Ra ** (1.0 / 3.0)


def nu_churchill_chu_vertical(Ra: float, Pr: float) -> float:
    """Churchill-Chu vertical-plate Nu, valid for all Ra."""
    if Ra <= 0.0:
        return 0.0
    denom = (1.0 + (0.492 / Pr) ** (9.0 / 16.0)) ** (8.0 / 27.0)
    return (0.825 + 0.387 * Ra ** (1.0 / 6.0) / denom) ** 2


def nu_churchill_chu_cylinder(Ra: float, Pr: float) -> float:
    """Churchill-Chu horizontal-cylinder Nu (submerged tubes), Ra_D < 1e12.

    .. math::
        Nu = \\left\\{0.60 + \\frac{0.387\\,Ra_D^{1/6}}
        {[1+(0.559/Pr)^{9/16}]^{8/27}}\\right\\}^2
    """
    if Ra <= 0.0:
        return 0.0
    denom = (1.0 + (0.559 / Pr) ** (9.0 / 16.0)) ** (8.0 / 27.0)
    return (0.60 + 0.387 * Ra ** (1.0 / 6.0) / denom) ** 2


def natural_convection_flux(
    state: FluidState,
    dT: float,
    L: float,
    g: float = 9.80665,
    correlation: str = "mcadams_up",
):
    """Return (flux [W/m^2], h [W/m^2.K], Ra, Nu).

    ``dT`` is ``T_surf - T_pool`` (drive the single-phase term on pool
    subcooling, not on saturation). Non-positive ``dT`` returns zeros.
    """
    if dT <= 0.0:
        return 0.0, 0.0, 0.0, 0.0
    Ra = rayleigh_number(state, dT, L, g)
    if correlation == "mcadams_up":
        Nu = nu_mcadams_plate_up(Ra)
    elif correlation == "churchill_chu":
        Nu = nu_churchill_chu_vertical(Ra, state.Pr_l)
    else:
        raise ValueError(f"unknown correlation '{correlation}'")
    h = Nu * state.k_l / L
    return h * dT, h, Ra, Nu
