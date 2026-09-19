# ACV Refrigerant-Leak Localisation Methodology

## Task and approach

The ACV task ranks every car in a workbook from most to least likely to have a refrigerant leak. Six labelled workbooks are available, each with one disclosed faulty car. Five contain compact temperature/controller telemetry; one has a rich 483-column schema with pressure telemetry.

This sample is too small for a flexible supervised classifier. The final model is therefore a deterministic, physics-informed anomaly ranker that compares each car with peers operating in the same train and time period. It combines directional cabin-temperature evidence with refrigerant-circuit imbalance when pressure and compressor measurements are available.

## Feature engineering

The loader reads the first worksheet regardless of its name, discovers cars from `Car <NN> - <parameter>` headers, and preserves two-digit car identifiers for output. Equivalent fields are mapped to canonical cabin temperature, ambient temperature, cooling target, running mode, information-valid status, compressor state, and high/low refrigerant pressure.

Invalid, missing and implausible temperatures outside 10–50 are excluded from physical scoring. Unsupported cars remain in the complete output ranking but follow cars with usable evidence. Ties are resolved by data coverage and then car identifier.

### Temperature evidence

Analysis is restricted to Automatic Cooling, Full Cooling and Half Cooling modes. At each usable timestamp, the median cabin temperature across at least three valid cars provides a same-train reference.

For each car, the model calculates:

- positive mean deviation from the fleet median;
- 75th, 90th and 95th percentiles of positive deviation;
- fractions of samples above 0.25, 0.50 and 1.00 temperature-unit deviations;
- cabin-to-target error relative to peer cars; and
- the longest sustained excursion above 0.50.

Evidence is directional: sustained warmer behavior is suspicious, while an unusually cold car is not assigned an equivalent leak score. Each feature becomes a within-workbook percentile rank before averaging, reducing sensitivity to weather, target settings and between-workbook calibration.

### Pressure evidence

Where both circuits have sufficient data, the model compares median high pressure, median low pressure, pressure lift and compressor duty cycle within each car. These differences are normalized and percentile-ranked across usable cars. An abnormal circuit mismatch is treated as additional leak evidence.

When both branches are available, the final score is 70% pressure and 30% temperature. With compact schemas, the temperature score is used alone. Scores are comparable ranking evidence, not calibrated probabilities.

## Model selection and rationale

The hybrid ranker was compared with fixed identifier order, hottest median cabin temperature, and temperature anomaly without pressure. It was retained because it placed the disclosed fault first in all six workbooks and improved the rich case from second to first using directly relevant circuit evidence.

A fixed gap-aware persistence candidate was also audited. It broke hot runs at invalid or non-increasing timestamps and large sampling gaps, but produced the same whole-workbook and robustness ranking scores. It was not adopted because it provided no measured ranking improvement.

## Evaluation protocol

Each workbook is one evaluation unit because its cars and timestamps share the same ambient conditions and fault event. Workbooks receive equal weight so recording length does not dominate. The fixed ranker is evaluated retrospectively on all six labelled workbooks; it is not fitted fold-by-fold and no independent subset is claimed.

Four consecutive portions from each workbook and controlled missing-signal conditions are used as robustness checks. Portions from one workbook remain correlated and are not treated as new labelled cases.

## Metrics and why they suit the task (Section 3.2)

The **official linear rank-decay score** is primary because the required output is a complete ordering. It rewards placing the true car near the top while retaining partial credit when it is not ranked first.

**Top-1 accuracy** reports how often the first-ranked car matches the disclosed fault, which directly reflects the technician's first inspection target. **Mean true-car rank** indicates how far down the inspection list the correct car appears and distinguishes ranking quality that top-1 accuracy alone can hide.

## Results

| Ranking method | Mean rank-decay score | Top-1 accuracy | Mean true-car rank |
| --- | ---: | ---: | ---: |
| Fixed identifier order | 0.7708 | 33.3% | 2.83 |
| Hottest median cabin temperature | 0.8125 | 66.7% | 2.50 |
| Temperature anomaly | 0.9792 | 83.3% | 1.17 |
| **Hybrid temperature/pressure ranker** | **1.0000** | **100%** | **1.00** |

| Robustness condition | Rank-decay score | Top-1 rate |
| --- | ---: | ---: |
| Four consecutive portions per workbook | 0.9688 | 83.3% |
| Cooling targets removed | 1.0000 | 100% |
| Pressure/compressor data removed | 0.9792 | 83.3% |
| Another car's cabin sensor removed | 1.0000 | 100% |
| Faulty car's cabin sensor removed | 0.2708 | 16.7% |

The sharp drop when the faulty car's cabin sensor is removed shows that unsupported cars cannot be diagnosed reliably from compact telemetry. The unlabelled test ordering is a model output, not a confirmed result.

## Assumptions and limitations

- Exactly one faulty car is assumed because that is the disclosed labelled-case design. Multiple simultaneous faults or common-mode cooling failures could invalidate the peer comparison.
- Most peer cars are assumed to provide a usable cooling reference under broadly shared conditions. Unequal passenger load, target settings or operating modes can weaken that assumption.
- The six labelled workbooks informed feature design. The 1.0000 score is a retrospective feasibility result, not an unbiased future-performance estimate.
- Only one labelled case contains rich pressure telemetry, so the 70/30 hybrid weight and pressure branch have very limited validation support.
- The 10–50 plausibility range and minimum coverage rules are engineering data-quality choices left open by the documentation; they are not learned proof that a car is healthy or faulty.
- A car with missing evidence stays in the required ranking, but its fallback position must not be interpreted as a healthy diagnosis.

## Reproduction and artifacts

```bash
python Optional_Items/tools/model.py acv train \
  --data-dir PS3/02_Datasets/ACV \
  --model-out app/backend/artifacts/acv_pipeline.joblib

python Optional_Items/tools/model.py acv predict \
  --input PS3/02_Datasets/ACV/Test \
  --model app/backend/artifacts/acv_pipeline.joblib \
  --output Optional_Items/ACV/code/outputs/acv_predictions.csv \
  --diagnostics-output Optional_Items/ACV/code/outputs/diagnostics.json
```

The active artifact is `app/backend/artifacts/acv_pipeline.joblib`. Evaluation and robustness results are under `Optional_Items/ACV/code/outputs/`. The official CSV contains `file_id,ranked_cars`, with every discovered identifier included exactly once and joined by `|`.
