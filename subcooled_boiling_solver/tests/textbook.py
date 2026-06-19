"""Hand-specified textbook fluid states for correlation unit tests.

Using fixed property values (rather than CoolProp) makes each correlation test
validate the *formula*, with a tolerance tight enough to catch coding errors,
independent of which CoolProp build is installed.

Water at 1 atm, saturated -- Incropera & DeWitt Table A.6 (T_sat = 100 C).
"""

from __future__ import annotations

from ..properties import FluidState


def water_1atm() -> FluidState:
    return FluidState(
        fluid="Water(textbook)",
        T_sat=373.15,
        P_sat=101325.0,
        rho_l=957.9,
        rho_v=1.0 / 1.679,      # vg = 1.679 m^3/kg  -> 0.5955 kg/m^3
        mu_l=279.0e-6,
        mu_v=12.02e-6,
        k_l=0.680,
        k_v=0.0248,
        cp_l=4217.0,
        cp_v=2029.0,
        Pr_l=1.76,
        Pr_v=1.0,
        h_fg=2257.0e3,
        sigma=58.9e-3,
        beta_l=7.64e-4,
        M=18.02e-3,
        Pcrit=22.06e6,
        Tcrit=647.1,
    )
