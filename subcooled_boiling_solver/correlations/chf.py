r"""Critical heat flux models -- Kandlikar (2001) and Zuber (for reference).

.. warning::
   The CHF path of this package is **UNCALIBRATED**. There is no burnout data
   in the experimental campaign, so neither model here may be reported as a
   trustworthy absolute CHF. They exist to (a) provide a flagged estimate and
   (b) cross-check the demonstrated-flux lower bound. See
   :mod:`subcooled_boiling_solver.chf_guard`.

Kandlikar (2001), incorporating contact angle and orientation:

.. math::
    q''_{CHF} = h_{fg}\,\rho_v^{1/2}\,\frac{1+\cos\beta}{16}
        \left[\frac{2}{\pi}+\frac{\pi}{4}(1+\cos\beta)\cos\varphi\right]^{1/2}
        \left[\sigma\,g(\rho_l-\rho_v)\right]^{1/4}

with receding contact angle :math:`\beta` and surface orientation
:math:`\varphi` (0 = horizontal, facing up). A subcooling enhancement factor
:math:`(1+C_{sub}\,Ja_{sub})` is applied; ``C_sub`` is itself uncalibrated.

Zuber (1959) hydrodynamic CHF is included as a textbook reference point:

.. math::
    q''_{max}=0.149\,h_{fg}\,\rho_v\left[\frac{\sigma g(\rho_l-\rho_v)}
        {\rho_v^2}\right]^{1/4}.
"""

from __future__ import annotations

from math import cos, pi, radians

from ..properties import FluidState


def kandlikar_chf(
    state: FluidState,
    contact_angle_deg: float = 45.0,
    orientation_deg: float = 0.0,
    dT_sub: float = 0.0,
    subcool_coeff: float = 0.0,
    g: float = 9.80665,
) -> float:
    """Kandlikar (2001) CHF [W/m^2]. UNCALIBRATED -- flag any output."""
    beta = radians(contact_angle_deg)
    phi = radians(orientation_deg)
    base = (
        state.h_fg
        * state.rho_v ** 0.5
        * (1.0 + cos(beta)) / 16.0
        * (2.0 / pi + pi / 4.0 * (1.0 + cos(beta)) * cos(phi)) ** 0.5
        * (state.sigma * g * (state.rho_l - state.rho_v)) ** 0.25
    )
    ja_sub = state.cp_l * max(dT_sub, 0.0) / state.h_fg
    return base * (1.0 + subcool_coeff * ja_sub)


def zuber_chf(state: FluidState, g: float = 9.80665, C: float = 0.149) -> float:
    """Zuber hydrodynamic CHF [W/m^2] (reference; saturated, horizontal)."""
    return (
        C
        * state.h_fg
        * state.rho_v
        * (state.sigma * g * (state.rho_l - state.rho_v) / state.rho_v ** 2) ** 0.25
    )
