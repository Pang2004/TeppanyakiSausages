# Rail Corrugation Methodology

## Task and approach

The Rail model classifies each one-second axle-box recording as `Normal`, `Side I` or `Side II`. The labelled set contains 272 recordings: 234 Normal, 14 Side I and 24 Side II. Each recording contains 10,000 samples at 10 kHz, one tachometer channel, and vibration and shock channels for 64 axle boxes.

The final `rail-pipeline-v3` combines global signal summaries with speed-adjusted local spectral evidence. A standardized, class-balanced logistic-regression classifier is trained with side-mirrored examples. Grouped inner validation selects regularization and a Side I decision-score multiplier. The production estimator is fitted on all labelled recordings after the evaluation procedure is fixed.

## Feature engineering

Headers, rather than filenames, identify sensors and their physical side. Filenames are used only as recording identifiers.

The model uses three feature groups:

1. **Global time and fixed-frequency features (684):** distribution, magnitude, RMS, extrema, quantiles and Welch spectral summaries for vibration and shock, aggregated by side with side differences and ratios.
2. **Speed-adjusted wavelength features (171):** tachometer transitions estimate mean train speed using the documented 0.85 m wheel diameter and 90-tooth wheel. Frequency is converted to wavelength bands with edges from 0.01 m to 0.64 m. Band power, dominant wavenumber, speed availability and speed variability make the spectrum comparable across operating speeds.
3. **Local wavelength-energy features (702):** absolute and fractional band energy are retained for each of eight cars and both signal types. Matched axle positions across the two sides contribute per-car contrasts, medians, directional agreement and signed moments. These features preserve local defects that can be diluted by whole-side aggregation.

An additional 192 spectral-shape features were evaluated but excluded because they did not improve the selected procedure. A zero-transition tachometer recording receives zero wavelength features plus a speed-unavailable indicator; the global features remain usable.

Training-only side mirroring swaps the two sides, changes Side I labels to Side II and vice versa, and reverses signed contrasts. This increases minority-side examples without copying mirrored records into validation.

## Model selection and rationale

Class-balanced logistic regression was retained because it produced the strongest repeated grouped-validation result while remaining compact and deterministic. Standardization, mirroring, estimator fitting and decision tuning are performed only on each training portion.

The inner search compares logistic `C` values `0.01`, `0.1`, `1` and `10`, and Side I score multipliers `0.5`, `1`, `2` and `4`. The multiplier changes the final class decision; the returned decision scores are not calibrated probabilities. The full-data search selected **C = 0.01** and a **Side I multiplier of 4**.

The adopted global-plus-local procedure was compared with global-only features, local-only features, added spectral-shape features and a global/local score blend. The blend reached macro F1 0.7444 and Side I F1 0.4832, below the selected model. The selected procedure was retained because it had the best six-repeat macro F1 and improved both fault-side F1 scores. Its full-data inner score (0.7110) was slightly below the old feature family's score (0.7165), so the choice is an explicit repeated-validation trade-off rather than proof of hidden-test superiority.

## Evaluation protocol

SHA-256 grouping identifies 270 unique byte contents. Two duplicate Normal pairs remain in the same fold so identical recordings cannot occur in both training and validation.

The outer evaluation uses five-fold `StratifiedGroupKFold`, repeated with seeds 42–47. Within each outer training portion, three grouped inner folds with fixed seed 142 select `C` and the Side I multiplier using macro F1. The untouched outer fold is then predicted. The reported values average fold scores across all six repeats.

The 1,632 stored outer predictions were reproduced exactly after production integration. They are repeated predictions of 272 recordings, not 1,632 independent examples.

## Metrics and why they suit the task (Section 3.2)

**Macro F1** is the primary metric because the three classes are highly imbalanced. It gives Normal, Side I and Side II equal importance and penalizes both false alarms and missed defects. Accuracy would be dominated by the 234 Normal recordings.

**Side I F1** and **Side II F1** are reported separately because macro F1 can conceal which physical side remains difficult. F1 is appropriate for both fault classes because technicians need reasonable precision as well as recall: excessive false alarms and missed corrugation are both costly.

## Results

| Procedure on the same six-repeat grouped protocol | Macro F1 | Side I F1 | Side II F1 |
| --- | ---: | ---: | ---: |
| Previous global statistical/wavelength procedure | 0.7095 | 0.4097 | 0.7623 |
| **Selected local-energy procedure** | **0.7609** | **0.5124** | **0.8006** |

One favourable repeat produced pooled macro F1 0.7977 and Side I F1 0.6207, but Side I did not consistently reach 0.60 across repeats. Across all repeats, the selected procedure produced 47 Side I true positives, 53 false positives and 37 false negatives. The six-repeat result is therefore the headline estimate.

The supplied 68 test recordings have no published labels. Their predictions are submission outputs, not an accuracy measurement.

## Assumptions and limitations

- A complete recording is the prediction and validation unit. Different file hashes are treated as the best available approximation to independent examples, but may still represent related journeys, vehicles or sessions.
- Five folds and six repeats are practical choices for distributing only 14 Side I recordings; repeated folds are correlated sensitivity checks, not a confidence interval.
- Mirroring assumes the physical fault mechanism is comparable across sides. Persistent sensor-calibration or operating differences between sides could violate this symmetry.
- Mean recording speed is used instead of instantaneous order tracking. Stationary operation and tachometer failure cannot be distinguished from the tachometer signal alone.
- The local feature family was selected after exploratory comparisons on the same labelled collection. Nested hyperparameter tuning does not remove that broader research-selection optimism.
- The final model is fitted on all labelled data for deployment. Reported F1 belongs to the validation procedure, not an independent test of the final full-data weights.

## Reproduction and artifacts

From the repository root, with the separately supplied dataset available:

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python Optional_Items/tools/model.py rail train \
  --data-dir PS3/02_Datasets/Rail_Corrugation \
  --model-out app/backend/artifacts/rail_pipeline.joblib

python Optional_Items/tools/model.py rail predict \
  --input PS3/02_Datasets/Rail_Corrugation/Test \
  --model app/backend/artifacts/rail_pipeline.joblib \
  --output "Optional_Items/Rail Corrugation/code/outputs/rail_predictions.csv" \
  --diagnostics-output "Optional_Items/Rail Corrugation/code/outputs/diagnostics.json"
```

The active artifact is `app/backend/artifacts/rail_pipeline.joblib`. Evaluation reports and feature provenance are stored under `Optional_Items/Rail Corrugation/code/outputs/`. The official prediction file contains only `file_id,prediction`.
