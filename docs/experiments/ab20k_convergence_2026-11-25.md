# FEMM AC force convergence: AB 20 kA

Steady-state harmonic AC, not fault transient. Mesh in metal 4/2/1 mm.
Force DC = time-average; 2f is an oscillating complex component. Both Lorentz and WST saved.

| Shell topology | Mesh, mm | Main loss, W/m | Shell loss, W/m | Total, W/m | Δ total vs h=1 | Main A Fx (Lorentz), N/m | Main A Fx (WST), N/m |
|---|---:|---:|---:|---:|---:|---:|---:|
| bonded | 4 | 974.0789 | 925.0034 | 1899.0823 | +0.02% | 0.12071 | 0.12476 |
| bonded | 2 | 973.9561 | 925.0034 | 1898.9595 | +0.01% | 0.12368 | 0.12215 |
| bonded | 1 | 973.9572 | 924.8320 | 1898.7892 | +0.00% | 0.12552 | 0.11886 |
| isolated | 4 | 975.3159 | 889.3965 | 1864.7125 | +0.04% | -0.12652 | -0.12193 |
| isolated | 2 | 975.1910 | 889.4043 | 1864.5953 | +0.03% | -0.12351 | -0.12457 |
| isolated | 1 | 975.1905 | 888.7867 | 1863.9772 | +0.00% | -0.13023 | -0.13615 |

Methodological limitations:
- Need independent validation of conductor and enclosure connection model.
- Magnetic force for real switching fault requires time-domain currents and conductor/structural constraints.
- WST vs Lorentz force differences need inspection before reporting design conclusions.
- Thermal model not included in these harmonic experiments.
---

## Interpreting the convergence data

The reference case is an **AC harmonic** 50 Hz section: phase A = +20 kA RMS, phase B = −20 kA RMS, phase C = 0. This is not the peak electrodynamic load under a generator short-circuit, and no DC offset is included.

For **h = 2 → 1 mm**, the total power-loss change is **0.009%** with connected shells and **0.033%** with isolated shells. Numerically, the loss calculation is stable at this level; it does not validate the assumed terminal connections.

Selected force comparisons (h=1 mm, average horizontal force on the shell of phase A):

| Shell connectivity | Lorentz, N/m | Weighted stress tensor, N/m |
|---|---:|---:|
| Bonded | −0.22544 | −0.21712 |
| Isolated | −88.12165 | −87.71218 |

**Interpretation:** the isolated-shell model predicts a much larger net horizontal force on the shell than the bonded model for this specific AB scenario. This is a result of the present idealized electrical boundary conditions, **not** a proven product-design comparison. The FEMM source's documented force integrals are 11–14 (Lorentz) and 18–21 (weighted stress tensor). WST is the preferred additional check for force extraction in the official FEMM FAQ.

The shell-A WST mean force with isolated shells changes by approximately **0.023%** between h=2 and h=1 mm. By contrast, the small conductor-A mean WST force changes by about **8.5%** in the same refinement. The absolute difference is only about **0.012 N/m**. Small near-cancelling forces should be assessed with absolute tolerances rather than unstable relative errors.

### Observed electrical currents (h=1 mm)

- Bonded: shell A ≈ −20.011 − j0.635 kA RMS, shell B ≈ +20.011 + j0.881 kA RMS, shell C ≈ +0.0003 − j0.246 kA RMS; shell-current sum ≈ 0.
- Isolated: net longitudinal currents in each shell ≈ 0 but shell Joule losses remain substantial because of locally induced currents.
- These results arise from the FEMM circuit constraints. They do **not** establish that a real continuous or multi-point-grounded enclosure has the same current-sharing pattern.

### Remaining verification

1. Refine the mesh further where needed, including elements in the air gap; check outer boundary radius as a separate factor.
2. Confirm the **actual** end connections / cross-bonding and grounding of the shells before interpreting isolated vs bonded as an industrial design comparison.
3. Analyze the **complex 2f** force component, not only the time-average component; obtain a transient source-current model to assess actual fault peaks.
4. Add experimental or independently modeled verification (e.g. published busduct cases) before using results as engineering ratings.

Raw data and FEMM input models are retained in the GitHub Actions artifact of [the six-case run](https://github.com/trashchenkov/ipb-studio/actions/runs/45656799465). Although the six FEMM solves and result packaging succeeded, that run's reporting step failed because Windows console encoding could not print a Greek delta symbol. The Unicode issue has been corrected in the generator; it is not an FEMM solver failure.
