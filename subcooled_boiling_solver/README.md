# Subcooled pool-boiling chamber solver

A physically-predictive **gray-box** numerical model of a closed subcooled
pool-boiling chamber cooled by a submerged tube-bundle condenser. A heated chip
on the chamber floor boils a subcooled liquid pool (water; HFE-7000 optionally);
vapour condenses on a partially-submerged tube bundle cooled by pumped coolant;
chamber pressure (hence `T_sat`) floats to balance vapour generation against
condensation.

The design goal is that the fitted constants are **geometry-independent**
(notably the Rohsenow surface-fluid constant `C_sf`), not curve-fit knobs.
**Read [`HONESTY.md`](HONESTY.md) before trusting any number this prints** — the
separation of calibrated / bounded-fit / uncalibrated / out-of-scope quantities
is the whole point.

## Architecture (quasi-3D distributed lumped network, not CFD)

- 1 chip node — heat balance solved for `T_surf` by Brent root-find.
- `K` stacked bulk-liquid layers (thermal stratification, reduced-order).
- `N` condenser tubes × `M` axial segments.
- 1 head-space / vapour node at `T_sat`.
- Global calibration of ~2 identifiable parameters via
  `scipy.optimize.least_squares`.

### Core chip heat balance

```
q'' = sqrt( q_nc**2 + q_nb**2 )
```

- `q_nc` — single-phase / subcooled natural convection on `(T_surf − T_pool)`,
  characteristic length `L = A/P` of the chip, scaled by `nc_factor`.
- `q_nb` — Rohsenow nucleate boiling on `(T_surf − T_sat)`, surface-fluid
  constant `C_sf`; **zero below saturation**, so the balance collapses onto the
  single-phase branch automatically.

## Module map

```
config.py                 every constant + its calibration status (the contract)
properties/               CoolProp-backed property provider + cache, HFE-7000 fallback
correlations/             one correlation per file, each unit-tested vs a textbook point
  rohsenow.py             nucleate boiling           natural_convection.py  McAdams / Churchill-Chu
  cooper.py               alt. boiling (cross-check)  zukauskas.py           tube-bundle external
  internal_flow.py        Gnielinski / laminar 3.66   film_condensation.py   Nusselt filmwise
  chf.py                  Kandlikar (2001) + Zuber
geometry/                 chip, tube bundle, fill-ratio integrator, STEP extractor
  presets.py              33-tube / 42-tube / 66-tube concrete geometry + fill tables
model/
  chip_balance.py         q''=sqrt(q_nc²+q_nb²) via brentq
  condenser_model.py      UA / NTU / effectiveness + hydraulics
  node_network.py         chamber assembly + OUT-OF-SCOPE operating-point band
calibration/
  calibrate.py            least_squares driver
  diagnostics.py          heat partition, identifiability, LORO CV, cross-geometry transfer
data/
  loader.py               real .xlsx loader (exact schema)
  synthetic.py            SYNTHETIC self-consistency generator (clearly labelled)
chf_guard.py              refuses absolute CHF; reports demonstrated lower bound
viz/plots.py              boiling curves, eps-NTU, hydraulics, chamber fields, dashboard
run_validation.py         end-to-end harness -> outputs/
tests/                    46 unit/integration tests
```

## Install & run

```bash
pip install -r subcooled_boiling_solver/requirements.txt      # numpy scipy matplotlib CoolProp openpyxl pytest

# from the repository root:
python -m subcooled_boiling_solver.run_validation             # writes figures to outputs/
python -m pytest subcooled_boiling_solver/tests/ -q           # 46 tests
```

The harness auto-detects the proprietary workbooks. If absent it runs a clearly
labelled **synthetic self-consistency** campaign instead and says so. To run a
real validation, drop these into the workspace (paths are relative to the repo
root):

- `Plain_Chip_data_33_tube_condenser.xlsx`
- `Plain_Chip_data_older_condenser.xlsx`

and, for exact tube positions, the STEP CAD (`CFD_Next_Gen.step`, etc.) with
`gmsh` installed.

### Minimal API example

```python
from subcooled_boiling_solver.config import default_config
from subcooled_boiling_solver.geometry import chip_plain_copper
from subcooled_boiling_solver.model.chip_balance import solve_chip_surface

cfg = default_config("Water")
cfg.set_value("C_sf", 0.0131); cfg.set_value("nc_factor", 9.0)
L = chip_plain_copper().L_char

# 40 W/cm^2, measured T_sat=54 C, pool 28 C (subcool 26 K)
r = solve_chip_surface(cfg, q_flux=40e4, T_sat=54+273.15, T_pool=28+273.15, L_char=L)
print(r.T_surf - 273.15, "C  boiling fraction", r.boiling_fraction)
```

## Validation targets reproduced

| Target | Documented | This solver |
|---|---|---|
| 33-tube fit (88 pts, 4 coolant temps) | `C_sf`≈0.0131, nc≈9.0, RMSE ~3.2 °C | recovers injected 0.0131 / 9.0, RMSE ≈ noise floor (synthetic) |
| Cross-geometry `C_sf` transfer | 0.0131 → 0.0119 (~9%) | 9.0 ± 2.0% over noise ensemble (≤10%) |
| Performance @40 W/cm² 33-tube 20 °C | T_surf/T_sat/sub = 60/54/26 | 60.5 / 54 / 26 |
| Performance @40 W/cm² 33-tube 50 °C | 81/64/10 | 80.8 / 64 / 10 |
| Coolant velocity 33/42/66-tube | 0.26 / 1.05 / 0.40 m/s | 0.26 / 1.05 / 0.40 |
| Coolant regime | laminar (Re 800–1630) | Re 729–1505 (warm 42-tube crosses to ~2670, flagged) |
| ε-NTU | NTU 0.03–0.14, ε 3–13%, UA 12–21 (33t) | NTU 0.06–0.16, ε 5–15%, UA 18–20 (33t) |
| Fill ratio | more submersion → higher T_sat → hotter chip | monotonic rise reproduced |
| CHF | no burnout; CHF > 111 (33t), > 61 (42t) | demonstrated lower bound only; Kandlikar flagged below it |

The synthetic figures and self-test numbers above are a **harness check**, not
an experimental validation; see [`HONESTY.md`](HONESTY.md).

## Outputs

`run_validation.py` writes to `subcooled_boiling_solver/outputs/`: boiling-curve
families, heat partition, `C_sf` identifiability profile, effectiveness–NTU,
coolant hydraulics, reduced-order chamber temperature fields, fill-ratio study,
and a cross-condenser performance dashboard.
