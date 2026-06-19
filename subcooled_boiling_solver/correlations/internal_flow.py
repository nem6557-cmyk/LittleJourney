r"""Internal (in-tube) coolant flow: Nusselt number and pressure drop.

* Laminar (``Re < 2300``): fully-developed ``Nu = 3.66`` (constant wall
  temperature) or ``4.36`` (constant heat flux).
* Turbulent (``Re > 3000``): Gnielinski

  .. math::
      Nu = \frac{(f/8)(Re-1000)Pr}{1+12.7\sqrt{f/8}\,(Pr^{2/3}-1)},\quad
      f = (0.790\ln Re - 1.64)^{-2}.

* Transitional (2300-3000): linear blend, flagged as approximate.

Pressure drop uses Darcy friction (``f = 64/Re`` laminar) over ``L/D`` plus an
optional minor-loss coefficient ``K`` for entrance/exit/manifold effects --
the experimental rigs show ~1.5x the bare-friction drop, attributable to these
fittings, so we expose ``K`` rather than silently inflating ``f``.
"""

from __future__ import annotations

from math import log, sqrt

_RE_LAM = 2300.0
_RE_TURB = 3000.0


def _gnielinski(Re: float, Pr: float) -> float:
    f = (0.790 * log(Re) - 1.64) ** -2
    return (f / 8.0) * (Re - 1000.0) * Pr / (1.0 + 12.7 * sqrt(f / 8.0) * (Pr ** (2.0 / 3.0) - 1.0))


def internal_nu(Re: float, Pr: float, bc: str = "T") -> float:
    """Fully-developed internal-flow Nusselt number.

    ``bc='T'`` -> constant wall temperature (Nu_lam=3.66);
    ``bc='H'`` -> constant heat flux (Nu_lam=4.36).
    """
    nu_lam = 3.66 if bc == "T" else 4.36
    if Re <= _RE_LAM:
        return nu_lam
    if Re >= _RE_TURB:
        return _gnielinski(Re, Pr)
    # transitional blend
    nu_turb = _gnielinski(_RE_TURB, Pr)
    f = (Re - _RE_LAM) / (_RE_TURB - _RE_LAM)
    return nu_lam + f * (nu_turb - nu_lam)


def friction_factor(Re: float) -> float:
    """Darcy friction factor."""
    if Re <= 0.0:
        return 0.0
    if Re < _RE_LAM:
        return 64.0 / Re
    # Petukhov for smooth turbulent tubes
    return (0.790 * log(Re) - 1.64) ** -2


def pressure_drop(
    rho: float,
    V: float,
    D: float,
    L: float,
    Re: float,
    K_minor: float = 0.0,
) -> float:
    """Tube pressure drop [Pa] = friction + minor losses.

    ``K_minor`` lumps entrance/exit/manifold dynamic-head losses.
    """
    f = friction_factor(Re)
    dyn = 0.5 * rho * V ** 2
    return (f * L / D + K_minor) * dyn
