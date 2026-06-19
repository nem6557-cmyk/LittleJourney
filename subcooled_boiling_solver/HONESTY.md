# Intellectual-honesty contract

This solver is a **gray-box** model. Its value depends entirely on being honest
about which numbers the data can support. This document is the contract; the
code enforces it (`config.ParamStatus`, `chf_guard`, the out-of-scope band in
`model.node_network`).

## Parameter status taxonomy

Every constant in `config.default_config()` carries a status:

| Status | Meaning | Examples |
|---|---|---|
| `FIXED_PHYSICAL` | Known physics, never fitted | Rohsenow superheat exponent (3 for water), Prandtl exponent (s=1 for water), measured roughness |
| `CALIBRATED_TRANSFERABLE` | Fitted, but a genuine material constant expected to transfer between geometries | **`C_sf`** ≈ 0.013 (water / polished copper) |
| `CALIBRATED_PERCHAMBER` | Fitted, and explicitly **does not** transfer | **`nc_factor`** (circulation + partial subcooled boiling; re-fit per condenser) |
| `BOUNDED_FIT` | Fitted only within physical bounds, weakly identified | CHF contact angle |
| `UNCALIBRATED` | No data exists to constrain it; outputs must be flagged | CHF subcooling coefficient, orientation |

The calibrator (`calibration.calibrate`) only ever varies parameters flagged
`free`. By default that is **exactly two**: `C_sf` and `nc_factor`. The
identifiability profile (`calibration.diagnostics.identifiability_profile`)
demonstrates that the chip-temperature data cannot constrain more than these,
so we hold the rest fixed rather than over-fit. Trying to `free` a
`FIXED_PHYSICAL` or `UNCALIBRATED` parameter raises.

## What is validated vs. what is not

**Validated (chip side), given measured `T_sat` and `T_pool` as inputs:**
- The boiling-curve fit `q'' = sqrt(q_nc² + q_nb²)`.
- `C_sf` transfers across condenser geometries within identifiability noise
  (~9%, target ≤10%). `nc_factor` does not transfer and is re-fit per chamber.
- Condenser UA / NTU / effectiveness sit on the **single-phase bound**
  (laminar internal coolant dominates); coolant hydraulics (velocity, Re,
  regime).

**UNCALIBRATED — never a design limit:**
- **CHF.** There is no burnout data anywhere. `chf_guard.assess_chf` will only
  report (a) the *demonstrated lower bound* — the highest flux the chip
  actually survived — and (b) the Kandlikar value, permanently flagged. With
  placeholder constants the Kandlikar value falls **below** the demonstrated
  flux, i.e. it is wrong in the **unsafe** direction. Asking
  `CHFAssessment.absolute_chf` raises `UncalibratedCHFError` by design.

**OUT OF SCOPE — bracket, don't predict:**
- **Operating-condition (T_sat / pressure) prediction from geometry.** The
  condenser saturation/pressure sub-model over-predicts the T_sat rise by
  ~2.7× and area-scaling between geometries fails.
  `model.node_network.predict_operating_point` therefore returns a bracketed
  band with an explicit out-of-scope flag, never a point estimate. For any
  quantitative chip-side work, pass **measured** `(T_sat, T_pool)`.

## Data provenance — read this before trusting any RMSE

The proprietary experimental workbooks
(`Plain_Chip_data_33_tube_condenser.xlsx`, `Plain_Chip_data_older_condenser.xlsx`)
and the STEP CAD files are **not** in this repository. The loader
(`data/loader.py`) reads the exact documented schema, so dropping the real
files into the workspace yields a real validation with no code changes.

When the workbooks are absent, the harness falls back to a **synthetic**
self-consistency campaign (`data/synthetic.py`). Synthetic runs are tagged
`source='SYNTHETIC'`. Recovering the injected `C_sf` from synthetic data proves
the optimiser can invert the forward model under noise — it is a **harness
self-test, not a validation against reality**. The harness says so, loudly,
every run.

## Known reconstruction caveats (surfaced, not hidden)

- **33-tube external area.** The quoted 309 cm² disagrees with the geometric
  `π·OD·L·N` = 469 cm² by 34% (the 42- and 66-tube quotes match geometry
  exactly). `TubeBundle.area_discrepancy()` exposes this; we do not silently
  pick one.
- **Reconstructed tube positions.** Exact `(transverse, z)` centres come from
  the STEP files via `geometry/step_extract.py` (gmsh). Absent those, the
  staggered layout is an approximate reconstruction used only for plots and
  order-of-magnitude geometry; submerged counts at the documented fill ratios
  use the **tabulated** `FillLevel` values, not the reconstruction.
- **42-tube at warm coolant.** At ~50 °C inlet the internal Reynolds number
  reaches ~2670 (water viscosity halves vs 20 °C), crossing out of the laminar
  regime. `CondenserResult.notes` flags this; the UA then leaves the
  single-phase bound and should be treated with caution.
- **HFE-7000.** If the CoolProp build lacks `RE347mcc`, the property provider
  falls back to a datasheet-based model tagged `HFE7000(fallback)` and warns.
  Water always uses CoolProp.
