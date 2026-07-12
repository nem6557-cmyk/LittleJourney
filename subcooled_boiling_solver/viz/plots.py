"""Figures: boiling curves, heat partition, identifiability, eps-NTU,
hydraulics, reduced-order chamber fields, and a cross-condenser dashboard.

All functions return a matplotlib Figure; :func:`savefig` writes it out. The
reduced-order field plot is explicitly annotated as illustrative.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Sequence

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from ..config import SolverConfig
from ..geometry import chip_plain_copper
from ..geometry.condenser import TubeBundle
from ..model.chip_balance import boiling_curve
from ..model.node_network import ChamberState
from ..data.loader import RunData

_W = 1e4  # W/m^2 per W/cm^2


def savefig(fig, path: str, dpi: int = 130) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close(fig)
    return path


# ---------------------------------------------------------------------- #
def plot_boiling_curves(
    cfg: SolverConfig,
    runs: Sequence[RunData],
    title: str = "Boiling curves",
    show_data: bool = True,
):
    """T_surf vs q'' family (one curve per run), optionally overlaying data."""
    fig, ax = plt.subplots(figsize=(7, 5))
    L = chip_plain_copper().L_char
    colors = plt.cm.viridis(np.linspace(0, 0.85, len(runs)))
    for run, c in zip(runs, colors):
        qs = np.linspace(np.nanmin(run.q_flux), np.nanmax(run.q_flux), 60)
        Tsat = float(np.nanmedian(run.T_sat))
        Tpool = float(np.nanmedian(run.T_pool))
        curve = boiling_curve(cfg, qs, Tsat, Tpool, L)
        ax.plot([r.T_surf - 273.15 for r in curve], qs / _W, color=c,
                label=f"{run.name} (sub {Tsat-Tpool:.0f}K)")
        if show_data:
            ax.scatter(run.T_surf - 273.15, run.q_flux / _W, s=14,
                       color=c, alpha=0.6, edgecolors="none")
    ax.set_xlabel("Chip surface temperature  T_surf  [degC]")
    ax.set_ylabel("Heat flux  q''  [W/cm^2]")
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=8)
    return fig


def plot_heat_partition(partition: Dict[str, np.ndarray], title: str = "Heat partition"):
    """Single-phase vs nucleate-boiling split across the boiling curve."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
    q = partition["q"] / _W
    ax1.plot(q, partition["q_nc"] / _W, label="single-phase q_nc", lw=2)
    ax1.plot(q, partition["q_nb"] / _W, label="nucleate boiling q_nb", lw=2)
    ax1.plot(q, q, "k--", lw=1, alpha=0.5, label="total")
    ax1.set_xlabel("q''  [W/cm^2]"); ax1.set_ylabel("component flux [W/cm^2]")
    ax1.set_title("Flux components"); ax1.legend(fontsize=8); ax1.grid(True, alpha=0.3)

    ax2.fill_between(q, 0, 1 - partition["boiling_fraction"], alpha=0.6,
                     label="single-phase", color="#4C72B0")
    ax2.fill_between(q, 1 - partition["boiling_fraction"], 1, alpha=0.6,
                     label="boiling", color="#DD8452")
    ax2.set_xlabel("q''  [W/cm^2]"); ax2.set_ylabel("fraction of total flux")
    ax2.set_ylim(0, 1); ax2.set_title("Partition"); ax2.legend(fontsize=8)
    fig.suptitle(title)
    return fig


def plot_identifiability(profile, title: str = "Identifiability profile"):
    fig, ax = plt.subplots(figsize=(6.5, 4.5))
    ax.plot(profile.values, profile.rmse_K, "-o", ms=4)
    ax.axvline(profile.best_value, color="k", ls="--", alpha=0.6,
               label=f"min @ {profile.param}={profile.best_value:.4f}")
    ax.set_xlabel(profile.param)
    ax.set_ylabel("global RMSE [K] (refit others)")
    ax.set_title(title)
    ax.grid(True, alpha=0.3); ax.legend(fontsize=9)
    return fig


def plot_eps_ntu(points: List[dict], title: str = "Effectiveness-NTU"):
    """points: list of {label, NTU, eff} dicts overlaid on the 1-exp(-NTU) curve."""
    fig, ax = plt.subplots(figsize=(6.5, 4.5))
    ntu = np.linspace(0, 0.5, 200)
    ax.plot(ntu, 1 - np.exp(-ntu), "k-", lw=1.5, label=r"$1-e^{-NTU}$  ($C_r\to0$)")
    for p in points:
        ax.scatter(p["NTU"], p["eff"], s=45, label=p["label"])
    ax.set_xlabel("NTU"); ax.set_ylabel("effectiveness")
    ax.set_title(title); ax.grid(True, alpha=0.3); ax.legend(fontsize=8)
    return fig


def plot_coolant_hydraulics(bundles_results: List[dict], title: str = "Coolant hydraulics"):
    """bundles_results: list of {name, V, Re, dP}."""
    names = [b["name"] for b in bundles_results]
    fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(12, 4))
    x = np.arange(len(names))
    a1.bar(x, [b["V"] for b in bundles_results], color="#4C72B0")
    a1.set_ylabel("velocity [m/s]"); a1.set_title("Tube velocity")
    a2.bar(x, [b["Re"] for b in bundles_results], color="#55A868")
    a2.axhline(2300, color="r", ls="--", alpha=0.7, label="laminar limit")
    a2.set_ylabel("Re"); a2.set_title("Reynolds number"); a2.legend(fontsize=8)
    a3.bar(x, [b["dP"] for b in bundles_results], color="#C44E52")
    a3.set_ylabel("dP [Pa]"); a3.set_title("Pressure drop")
    for a in (a1, a2, a3):
        a.set_xticks(x); a.set_xticklabels(names, rotation=20, ha="right", fontsize=8)
        a.grid(True, axis="y", alpha=0.3)
    fig.suptitle(title)
    return fig


def plot_chamber_field(state: ChamberState, bundle: TubeBundle,
                       title: Optional[str] = None):
    """Reduced-order chamber temperature field: cross-section + longitudinal.

    ILLUSTRATIVE -- the liquid stratification is a reduced-order reconstruction,
    not a CFD field.
    """
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 4.6),
                                   constrained_layout=True)

    # --- cross-section (transverse vs z), liquid stratification + tubes ---
    tlo, thi = bundle.cavity_transverse
    zlo, zhi = bundle.cavity_z
    zc = state.layer_z
    Tc = state.layer_T_C
    grid_z = np.linspace(zlo, zhi, 120)
    grid_T = np.interp(grid_z, zc, Tc, left=Tc[0], right=state.vapor_T_C)
    field = np.tile(grid_T[:, None], (1, 40))
    im = ax1.imshow(field, origin="lower", aspect="auto",
                    extent=[tlo * 1e3, thi * 1e3, zlo * 1e3, zhi * 1e3],
                    cmap="inferno")
    ax1.axhline(state.water_height * 1e3, color="cyan", ls="--", lw=1.5,
                label="water line")
    for (t, z) in bundle.positions:
        ax1.add_patch(plt.Circle((t * 1e3, z * 1e3), 0.5 * bundle.OD * 1e3,
                                 fill=False, ec="white", lw=0.8))
    ax1.scatter([0], [zlo * 1e3 + 0.3], marker="s", s=80, c="lime",
                edgecolors="k", label="chip", zorder=5)
    ax1.set_xlabel("transverse [mm]"); ax1.set_ylabel("height z [mm]")
    ax1.set_title("Cross-section (reduced-order)")
    ax1.set_aspect("equal")          # round tubes (true geometry aspect)
    ax1.legend(fontsize=8, loc="upper right")
    fig.colorbar(im, ax=ax1, label="T [degC]", location="bottom",
                 shrink=0.8, pad=0.18)

    # --- longitudinal (axial vs z): coolant warming along tubes ---
    a_lo, a_hi = bundle.cavity_axial
    if state.tubes:
        seg = state.tubes[0]
        ax2.plot(seg.axial * 1e3, seg.temps_C, "-o", ms=3,
                 label="coolant along tube")
    ax2.axhline(state.vapor_T_C, color="r", ls="--", alpha=0.6,
                label=f"T_sat={state.vapor_T_C:.0f}C")
    ax2.set_xlabel("axial position [mm]"); ax2.set_ylabel("T [degC]")
    ax2.set_title("Longitudinal: coolant warming"); ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=8)

    fig.suptitle(title or f"{state.design}: {state.summary()}", fontsize=9)
    return fig


def plot_performance_dashboard(rows: List[dict], title: str = "Condenser comparison"):
    """rows: list of {design, coolant_C, UA, eff, Tsurf40, coolant_dT}."""
    designs = sorted(set(r["design"] for r in rows))
    fig, axes = plt.subplots(2, 2, figsize=(11, 8))
    metrics = [("UA", "UA [W/K]"), ("eff", "effectiveness"),
               ("Tsurf40", "T_surf @40 W/cm^2 [degC]"), ("coolant_dT", "coolant dT [K]")]
    for ax, (key, lab) in zip(axes.ravel(), metrics):
        for d in designs:
            pts = sorted([r for r in rows if r["design"] == d],
                         key=lambda r: r["coolant_C"])
            ax.plot([p["coolant_C"] for p in pts], [p[key] for p in pts],
                    "-o", label=d)
        ax.set_xlabel("coolant inlet [degC]"); ax.set_ylabel(lab)
        ax.grid(True, alpha=0.3); ax.legend(fontsize=8)
    fig.suptitle(title)
    return fig


def plot_fill_ratio_study(rows: List[dict], title: str = "Fill-ratio study"):
    """rows: list of {fraction, T_sat_C, T_surf_C} at fixed flux."""
    rows = sorted(rows, key=lambda r: r["fraction"])
    fr = [r["fraction"] * 100 for r in rows]
    fig, ax = plt.subplots(figsize=(6.8, 4.6))
    ax.plot(fr, [r["T_surf_C"] for r in rows], "-o", label="chip T_surf", lw=2)
    ax.plot(fr, [r["T_sat_C"] for r in rows], "-s", label="T_sat", lw=2)
    ax.set_xlabel("fill ratio [%]"); ax.set_ylabel("temperature [degC]")
    ax.set_title(title + "\n(more submersion -> higher T_sat -> hotter chip)",
                 fontsize=10)
    ax.grid(True, alpha=0.3); ax.legend()
    return fig
