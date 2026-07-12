r"""Cooper (1984) reduced-pressure pool-boiling correlation.

Used purely as an *independent cross-check* on the Rohsenow nucleate-boiling
branch -- it has no fitted surface-fluid constant, only the measured surface
roughness, so disagreement between Cooper and the calibrated Rohsenow curve is
a useful sanity flag.

.. math::
    h = 55\,p_r^{\,0.12-0.2\log_{10}R_p}\,(-\log_{10}p_r)^{-0.55}\,M^{-0.5}\,q''^{\,0.67}

with :math:`p_r` reduced pressure, :math:`R_p` surface roughness in microns
(Cooper's original uses :math:`R_p`; taking :math:`R_p\approx R_a`),
:math:`M` molar mass in g/mol, :math:`q''` in W/m^2 and :math:`h` in W/m^2.K.
"""

from __future__ import annotations

from math import log10

from ..properties import FluidState


def cooper_htc(
    state: FluidState,
    q_flux: float,
    Rp_um: float = 1.0,
    surface_factor: float = 1.0,
) -> float:
    """Cooper heat-transfer coefficient [W/m^2.K] at a given heat flux.

    ``surface_factor`` is Cooper's optional multiplier (e.g. 1.7 for copper
    surfaces in some references); default 1.0 keeps the bare correlation.
    """
    if q_flux <= 0.0:
        return 0.0
    pr = state.p_reduced
    M_gmol = state.M * 1e3
    return (
        surface_factor
        * 55.0
        * pr ** (0.12 - 0.2 * log10(Rp_um))
        * (-log10(pr)) ** (-0.55)
        * M_gmol ** (-0.5)
        * q_flux ** 0.67
    )


def cooper_flux(
    state: FluidState,
    dT_sup: float,
    Rp_um: float = 1.0,
    surface_factor: float = 1.0,
) -> float:
    r"""Heat flux [W/m^2] for a given superheat.

    Cooper gives :math:`h\propto q''^{0.67}` and :math:`q''=h\,\Delta T`, so
    :math:`q'' = (A\,\Delta T)^{1/(1-0.67)}` with :math:`A` the prefactor.
    """
    if dT_sup <= 0.0:
        return 0.0
    pr = state.p_reduced
    M_gmol = state.M * 1e3
    A = (
        surface_factor
        * 55.0
        * pr ** (0.12 - 0.2 * log10(Rp_um))
        * (-log10(pr)) ** (-0.55)
        * M_gmol ** (-0.5)
    )
    # q = A q^0.67 dT  ->  q^0.33 = A dT  ->  q = (A dT)^(1/0.33)
    return (A * dT_sup) ** (1.0 / (1.0 - 0.67))
