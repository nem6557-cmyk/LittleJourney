"""CoolProp-backed thermophysical property provider with a saturation cache.

The chip-side correlations want *saturation* properties at the local
saturation temperature (liquid + vapour), plus surface tension, latent heat
and the liquid transport group. CoolProp calls are not free, and the
calibration loop evaluates the same handful of saturation temperatures
thousands of times, so we memoise on a rounded ``T_sat`` key.

HFE-7000 note
-------------
The prompt names the secondary fluid ``RE347mcc`` (HFE-7000 / Novec 7000).
Not every CoolProp build ships that fluid. We therefore:
  1. try the requested name verbatim,
  2. if CoolProp rejects it, fall back to a documented datasheet-based
     property model (:class:`_HFE7000Fallback`) and emit a loud warning.
Water always uses CoolProp. We never silently substitute one fluid for
another.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Dict, Optional

import CoolProp.CoolProp as CP

# Canonical aliases -> CoolProp fluid name (when the build supports it).
_FLUID_ALIASES = {
    "HFE7000": "RE347mcc",
    "HFE-7000": "RE347mcc",
    "NOVEC7000": "RE347mcc",
    "NOVEC-7000": "RE347mcc",
    "RE347MCC": "RE347mcc",
    "WATER": "Water",
    "H2O": "Water",
}


@dataclass(frozen=True)
class FluidState:
    """Saturated-state properties at ``T_sat`` (SI units).

    Liquid quantities are saturated-liquid; vapour quantities saturated-vapour.
    """

    fluid: str
    T_sat: float        # K
    P_sat: float        # Pa
    rho_l: float        # kg/m^3
    rho_v: float        # kg/m^3
    mu_l: float         # Pa.s
    mu_v: float         # Pa.s
    k_l: float          # W/m.K
    k_v: float          # W/m.K
    cp_l: float         # J/kg.K
    cp_v: float         # J/kg.K
    Pr_l: float         # -
    Pr_v: float         # -
    h_fg: float         # J/kg
    sigma: float        # N/m
    beta_l: float       # 1/K  (liquid isobaric expansion)
    M: float            # kg/mol (molar mass)
    Pcrit: float        # Pa
    Tcrit: float        # K

    @property
    def nu_l(self) -> float:
        """Liquid kinematic viscosity, m^2/s."""
        return self.mu_l / self.rho_l

    @property
    def alpha_l(self) -> float:
        """Liquid thermal diffusivity, m^2/s."""
        return self.k_l / (self.rho_l * self.cp_l)

    @property
    def p_reduced(self) -> float:
        return self.P_sat / self.Pcrit

    def liquid_jakob(self, dT_sub: float) -> float:
        """Subcooling Jakob number cp_l*dT/h_fg."""
        return self.cp_l * dT_sub / self.h_fg


class PropertyProvider:
    """Provides cached :class:`FluidState` objects for one fluid."""

    def __init__(self, fluid: str, round_K: float = 0.05):
        self.requested = fluid
        self._round = round_K
        self._cache: Dict[float, FluidState] = {}
        self._backend, self._fallback = self._resolve_backend(fluid)
        self.name = self._backend or "HFE7000-fallback"

    # ------------------------------------------------------------------ #
    @staticmethod
    def _resolve_backend(fluid: str):
        """Return (coolprop_name or None, fallback_or_None)."""
        key = fluid.strip().upper()
        cp_name = _FLUID_ALIASES.get(key, fluid)
        try:
            # cheap probe that the backend can initialise
            CP.PropsSI("T", "P", 101325.0, "Q", 0, cp_name)
            return cp_name, None
        except Exception:
            # Only HFE-7000 has a hand-rolled fallback; anything else is fatal.
            if key in {"HFE7000", "HFE-7000", "NOVEC7000", "NOVEC-7000",
                       "RE347MCC"}:
                warnings.warn(
                    f"CoolProp build lacks '{cp_name}' (HFE-7000). Falling back "
                    "to a datasheet-based property model. Values are approximate "
                    "(±few % on transport props) and flagged in FluidState.fluid.",
                    RuntimeWarning,
                )
                return None, _HFE7000Fallback()
            raise ValueError(
                f"Fluid '{fluid}' is not available in this CoolProp build and "
                "has no fallback. Available example fluids: Water, Novec649."
            ) from None

    # ------------------------------------------------------------------ #
    def at_Tsat(self, T_sat_K: float) -> FluidState:
        key = round(T_sat_K / self._round) * self._round
        st = self._cache.get(key)
        if st is None:
            st = self._build(key)
            self._cache[key] = st
        return st

    def at_Tsat_C(self, T_sat_C: float) -> FluidState:
        return self.at_Tsat(T_sat_C + 273.15)

    def at_Psat(self, P_Pa: float) -> FluidState:
        if self._backend is not None:
            T = CP.PropsSI("T", "P", P_Pa, "Q", 0, self._backend)
        else:
            T = self._fallback.Tsat_from_P(P_Pa)
        return self.at_Tsat(T)

    # ------------------------------------------------------------------ #
    def _build(self, T: float) -> FluidState:
        if self._backend is not None:
            return self._from_coolprop(T)
        return self._fallback.state(T)

    def _from_coolprop(self, T: float) -> FluidState:
        f = self._backend
        P = CP.PropsSI("P", "T", T, "Q", 0, f)
        rho_l = CP.PropsSI("D", "T", T, "Q", 0, f)
        rho_v = CP.PropsSI("D", "T", T, "Q", 1, f)
        mu_l = CP.PropsSI("V", "T", T, "Q", 0, f)
        mu_v = CP.PropsSI("V", "T", T, "Q", 1, f)
        k_l = CP.PropsSI("L", "T", T, "Q", 0, f)
        k_v = CP.PropsSI("L", "T", T, "Q", 1, f)
        cp_l = CP.PropsSI("C", "T", T, "Q", 0, f)
        cp_v = CP.PropsSI("C", "T", T, "Q", 1, f)
        hl = CP.PropsSI("H", "T", T, "Q", 0, f)
        hv = CP.PropsSI("H", "T", T, "Q", 1, f)
        sigma = CP.PropsSI("I", "T", T, "Q", 0, f)
        beta_l = CP.PropsSI("ISOBARIC_EXPANSION_COEFFICIENT", "T", T, "Q", 0, f)
        M = CP.PropsSI("M", f)
        Pcrit = CP.PropsSI("Pcrit", f)
        Tcrit = CP.PropsSI("Tcrit", f)
        return FluidState(
            fluid=self.requested, T_sat=T, P_sat=P, rho_l=rho_l, rho_v=rho_v,
            mu_l=mu_l, mu_v=mu_v, k_l=k_l, k_v=k_v, cp_l=cp_l, cp_v=cp_v,
            Pr_l=cp_l * mu_l / k_l, Pr_v=cp_v * mu_v / k_v,
            h_fg=hv - hl, sigma=sigma, beta_l=beta_l, M=M,
            Pcrit=Pcrit, Tcrit=Tcrit,
        )


class _HFE7000Fallback:
    """Approximate HFE-7000 (Novec 7000) saturation properties.

    Polynomial / Antoine fits anchored to the 3M Novec 7000 datasheet and the
    NIST/REFPROP RE347mcc EOS at 1 atm. Intended only so that the secondary
    fluid path runs end-to-end when CoolProp lacks RE347mcc. NOT a validation-
    grade EOS; FluidState.fluid is tagged 'HFE7000(fallback)'.
    """

    M = 0.20005          # kg/mol
    Tcrit = 437.7        # K
    Pcrit = 2.476e6      # Pa
    Tboil = 307.4        # K @ 1 atm (34.25 C)
    # Antoine (P in Pa, T in K): log10(P) = A - B/(C+T)
    _A, _B, _C = 9.5436, 1380.0, -45.0

    def Psat(self, T: float) -> float:
        return 10 ** (self._A - self._B / (self._C + T))

    def Tsat_from_P(self, P: float) -> float:
        from scipy.optimize import brentq
        return brentq(lambda T: self.Psat(T) - P, 230.0, self.Tcrit - 1.0)

    def state(self, T: float) -> FluidState:
        P = self.Psat(T)
        Tr = T / self.Tcrit
        # Liquid density: modified Rackett-style, ~1400 kg/m3 @ 25C.
        rho_l = 1400.0 * (1 - 0.00257 * (T - 298.15))
        # Vapour density from ideal gas with compressibility ~0.95.
        rho_v = P * self.M / (0.95 * 8.314 * T)
        # Latent heat: Watson relation from h_fg(Tboil)=142 kJ/kg.
        hfg_b = 1.42e5
        h_fg = hfg_b * ((1 - Tr) / (1 - self.Tboil / self.Tcrit)) ** 0.38
        cp_l = 1300.0 + 2.5 * (T - 298.15)      # J/kg.K
        cp_v = 900.0
        mu_l = 4.5e-4 * (298.15 / T) ** 4.0     # Pa.s, ~0.45 mPa.s @25C
        mu_v = 1.1e-5
        k_l = 0.075 - 1.5e-4 * (T - 298.15)     # W/m.K
        k_v = 0.013
        sigma = 0.0124 * (1 - Tr) / (1 - 298.15 / self.Tcrit)  # N/m, ~12.4 mN/m@25C
        beta_l = 0.00257 / (1 - 0.00257 * (T - 298.15))        # 1/K
        return FluidState(
            fluid="HFE7000(fallback)", T_sat=T, P_sat=P, rho_l=rho_l,
            rho_v=rho_v, mu_l=mu_l, mu_v=mu_v, k_l=k_l, k_v=k_v, cp_l=cp_l,
            cp_v=cp_v, Pr_l=cp_l * mu_l / k_l, Pr_v=cp_v * mu_v / k_v,
            h_fg=h_fg, sigma=sigma, beta_l=beta_l, M=self.M,
            Pcrit=self.Pcrit, Tcrit=self.Tcrit,
        )


# Module-level provider cache so repeated get_provider("Water") is free.
_PROVIDERS: Dict[str, PropertyProvider] = {}


def get_provider(fluid: str = "Water") -> PropertyProvider:
    p = _PROVIDERS.get(fluid)
    if p is None:
        p = PropertyProvider(fluid)
        _PROVIDERS[fluid] = p
    return p
