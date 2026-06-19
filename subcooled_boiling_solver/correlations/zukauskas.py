r"""Zukauskas tube-bundle external cross-flow correlation.

.. math::
    \overline{Nu}_D = C_2\,C\,Re_{D,max}^{m}\,Pr^{0.36}\,(Pr/Pr_s)^{1/4}

evaluated at the maximum-velocity Reynolds number. ``C`` and ``m`` come from
Zukauskas' arrangement/Re table; ``C_2`` corrects for fewer than 20 rows.

References: Zukauskas (1972); Incropera & DeWitt Tables 7.5 / 7.6.
"""

from __future__ import annotations

from math import sqrt

# C2 row-correction factor (N_L rows < 20). Keys are row counts; values
# interpolated linearly between them.
_C2_ALIGNED = {1: 0.70, 2: 0.80, 3: 0.86, 4: 0.90, 5: 0.92, 7: 0.95,
               10: 0.97, 13: 0.98, 16: 0.99, 20: 1.0}
_C2_STAGGERED = {1: 0.64, 2: 0.76, 3: 0.84, 4: 0.89, 5: 0.92, 7: 0.95,
                 10: 0.97, 13: 0.98, 16: 0.99, 20: 1.0}


def _interp_c2(table, n_rows: int) -> float:
    if n_rows >= 20:
        return 1.0
    keys = sorted(table)
    if n_rows <= keys[0]:
        return table[keys[0]]
    for a, b in zip(keys, keys[1:]):
        if a <= n_rows <= b:
            f = (n_rows - a) / (b - a)
            return table[a] + f * (table[b] - table[a])
    return 1.0


def _C_m(Re: float, arrangement: str, ST: float, SL: float):
    """Return (C, m) for Zukauskas' table."""
    staggered = arrangement == "staggered"
    if Re < 1e2:                      # 1-100
        return (0.90, 0.40) if not staggered else (1.04, 0.40)
    if Re < 1e3:                      # 100-1000 ~ single-cylinder behaviour
        return (0.51, 0.50) if not staggered else (0.71, 0.50)
    if Re < 2e5:                      # 1e3-2e5
        if staggered:
            if ST / SL < 2.0:
                return (0.35 * (ST / SL) ** 0.2, 0.60)
            return (0.40, 0.60)
        return (0.27, 0.63)
    # 2e5-2e6
    if staggered:
        return (0.031 * (ST / SL) ** 0.2, 0.80)
    return (0.021, 0.84)


def v_max_aligned(V: float, ST: float, D: float) -> float:
    """Maximum velocity for an aligned bank."""
    return ST / (ST - D) * V


def v_max_staggered(V: float, ST: float, SL: float, D: float) -> float:
    """Maximum velocity for a staggered bank (transverse vs diagonal plane)."""
    SD = sqrt(SL ** 2 + (ST / 2.0) ** 2)
    if 2.0 * (SD - D) < (ST - D):
        return ST / (2.0 * (SD - D)) * V
    return ST / (ST - D) * V


def zukauskas_nu(
    Re_max: float,
    Pr: float,
    Pr_s: float,
    arrangement: str = "staggered",
    ST: float = 1.0,
    SL: float = 1.0,
    n_rows: int = 20,
) -> float:
    """Bundle-averaged Nusselt number.

    ``ST``/``SL`` are transverse/longitudinal pitches (same units; only their
    ratio matters here). ``Pr_s`` is the Prandtl number at surface
    temperature.
    """
    if Re_max <= 0.0:
        return 0.0
    C, m = _C_m(Re_max, arrangement, ST, SL)
    table = _C2_STAGGERED if arrangement == "staggered" else _C2_ALIGNED
    C2 = _interp_c2(table, n_rows)
    return C2 * C * Re_max ** m * Pr ** 0.36 * (Pr / Pr_s) ** 0.25
