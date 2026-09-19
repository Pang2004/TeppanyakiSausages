# SHM Cumulative-Fatigue Methodology

## Task and approach

The Structural Health Monitoring model predicts one positive cumulative-fatigue damage value for each dynamic-stress history. The dataset contains 64 labelled training histories and 16 unlabelled test histories. Each official file is a headerless, single-column CSV with 581,120 stress samples.

The final model combines a physics-based rainflow/Miner estimate with a regularized data-driven residual correction. The physical component supplies the main damage magnitude; Ridge regression corrects systematic signal-shape effects that the single Miner sum does not capture.

## Feature engineering

The loader preserves the first stress sample by explicitly treating the CSV as headerless and rejects multi-column, non-numeric, non-finite or very short histories. Filenames are identifiers and are not features.

Rainflow counting extracts cycle ranges and counts. For an S–N relation `N = C / amplitude^m`, damage is proportional to:

```text
sum(cycle_count * (cycle_range / 2) ** m)
```

Because the documentation does not provide the material exponent or multiplicative constant, candidate exponents `m = 3, 4, 5, 6, 7` and the damage scale are calibrated from labelled histories.

The feature set contains:

- Miner proxies and equivalent stress amplitudes for the candidate exponents;
- total cycle count, maximum and weighted mean range, range standard deviation and mean cycle stress;
- weighted cycle-range quantiles through the 99.9th percentile;
- signal mean, standard deviation, RMS, range, skewness, kurtosis and tail quantiles;
- centered-amplitude quantiles, first-difference statistics and zero-crossing rate; and
- the distribution of ranges across 128 consecutive blocks to represent non-stationary high-load periods.

The Miner scale is estimated as a weighted median of target-to-proxy ratios. Residual features are standardized inside each training fold before Ridge fitting.

## Model selection and rationale

Nested validation selects the S–N exponent, Ridge strength and whether the residual correction should be used. Ridge `alpha` is searched over `0.1`, `1`, `10` and `100`.

The residual model is retained within an outer fold only when its inner-validation MAPE improves by at least 0.002 without worsening the inner 95th-percentile absolute percentage error. This gate favors the simpler calibrated Miner model unless the correction gives a meaningful average improvement without increasing large errors.

The full-data procedure selects Miner + Ridge with **m = 5** and **alpha = 1.0**. It is preferred to a purely statistical regressor because it preserves the documented fatigue mechanism and needs the learned model only for a smaller residual correction.

## Evaluation protocol

Outer leave-one-file-out validation holds out each complete history once and fits on the remaining 63. Individual samples from one history never cross folds because the target represents accumulated damage over the complete signal.

Within every outer training set, shuffled five-fold validation selects the exponent, Ridge alpha and model family. Scale estimation, standardization and regression use only that inner training subset. Fixed seed 42 defines the primary procedure; seeds 43 and 44 are sensitivity checks rather than candidates selected by their final outcomes.

After evaluation, the selected procedure is fitted to all 64 labelled histories for deployment.

## Metrics and why they suit the task (Section 3.2)

**Mean absolute percentage error (MAPE)** is primary because damage values are positive and vary substantially in magnitude. Percentage error measures relative accuracy across both small and large damage values. It also directly determines the official score:

```text
official_score = max(0, 1 - MAPE)
```

The **95th-percentile absolute percentage error** and maximum absolute percentage error expose tail risk that an average can hide. The historical 95th percentile is shown by the application as an evaluation indicator; it is not a per-file confidence interval or guaranteed error bound.

## Results

| Approach | MAPE | Official score | 95th-percentile absolute percentage error |
| --- | ---: | ---: | ---: |
| Weighted constant | 58.3121% | 0.416879 | — |
| Global-range power model | 27.6468% | 0.723532 | — |
| Calibrated Miner family | 2.5444% | 0.974556 | 8.9458% |
| Fixed Miner + Ridge family | 2.2694% | 0.977306 | 6.7090% |
| **Complete nested family-selection procedure** | **2.2978%** | **0.977022** | **6.7090%** |

The complete nested procedure is the primary estimate because selecting the better fixed-family row after seeing its outer result would reuse evaluation data. Its maximum absolute percentage error is 8.7531%.

| Inner split seed | Nested MAPE | Nested official score |
| --- | ---: | ---: |
| 42, primary | 2.2978% | 0.977022 |
| 43 | 2.5858% | 0.974142 |
| 44 | 2.3514% | 0.976486 |

These sensitivity runs reuse the same 64 histories and do not form 192 independent test cases.

## Assumptions and limitations

- A complete file is the validation unit. Distinct hashes do not prove that histories come from independent vehicles, lines, loads or time periods because those group identifiers are unavailable.
- Leave-one-file-out validation estimates performance within the supplied collection, not transfer to an unseen vehicle, line, material or load regime.
- Rainflow counting and linear Miner accumulation follow the task description. Calibrating the missing S–N exponent and scale assumes consistent stress units, structural details and target definitions between training and inference.
- Five inner folds, seed 42 and the 0.002 correction gate are reproducible engineering choices where the documentation left selection rules open; they are not organizer-prescribed constants.
- The labelled histories describe healthy operating data and accumulated fatigue, not observed structural failure. The prediction is not a remaining-life estimate or a structural-safety verdict.
- The physical sum supports varying history lengths, but the residual model and reported scores were validated only on equal-length official files.

## Reproduction and artifacts

```bash
python Optional_Items/tools/model.py shm train \
  --data-dir PS3/02_Datasets/SHM \
  --model-out app/backend/artifacts/shm_pipeline.joblib

python Optional_Items/tools/model.py shm validation \
  --data-dir PS3/02_Datasets/SHM \
  --inner-seeds 43 44

python Optional_Items/tools/model.py shm predict \
  --input PS3/02_Datasets/SHM/Test \
  --model app/backend/artifacts/shm_pipeline.joblib \
  --output Optional_Items/SHM/code/outputs/shm_predictions.csv \
  --diagnostics-output Optional_Items/SHM/code/outputs/diagnostics.json
```

The active artifact is `app/backend/artifacts/shm_pipeline.joblib`. Nested-validation reports, sensitivity checks and feature provenance are stored under `Optional_Items/SHM/code/outputs/`. The official CSV contains only `file_id,prediction`.
