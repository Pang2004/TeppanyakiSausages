# Door Fault-Diagnosis Methodology

## Task and approach

The Door pipeline receives a continuous telemetry stream, identifies each opening or closing movement, and classifies that operation as `Normal` or `Abnormal resistance`. One prediction represents one movement, not an open/close pair.

The training stream contains 110 labelled operations: 80 Normal and 30 Abnormal resistance. The final system uses gap-aware and state-machine segmentation followed by a standardized, class-balanced logistic-regression classifier. The fitted classifier uses all 110 labelled operations after chronological validation.

## Operation segmentation

Timestamps are parsed and checked for increasing order. The primary segmenter estimates the median sampling cadence and splits blocks when the timestamp gap exceeds five times that cadence, subject to a minimum threshold of 100 ms. This reproduces the boundaries in the supplied 20 ms telemetry format.

A direction-aware state machine supports streams without large gaps. Command, activity, position and terminal-switch states determine the start, direction and end of a movement. A stable terminal state is required for 500 ms, and a 10-second maximum bounds incomplete movements. Position is normalized to each movement's local range instead of assuming universal raw position limits.

Each result retains its boundary reason and quality flags so incomplete or malformed operations remain visible rather than silently becoming Normal predictions.

## Feature engineering

The classifier uses 177 deterministic features per operation:

- duration, sample count and opening/closing direction;
- mean, standard deviation, extrema, quantiles, range, RMS, first-difference magnitude and peak position for motor current, voltage, back-EMF and door position;
- each continuous signal interpolated to 20 normalized-time points to preserve waveform shape across different operation durations;
- locally normalized door position;
- configured opening and closing times; and
- start value, end value, mean and transition count for command, activity, opened, close-switch and lock-switch channels.

The constant `Door Locked` field is excluded. All preprocessing and scaling are fitted within the model pipeline, and extracted features must be finite.

## Model selection and rationale

Four fixed candidates were compared: Always Normal, balanced logistic regression, a balanced RBF SVM with calibration, and balanced ExtraTrees with 500 trees.

All three learned candidates reached the same score on the chronological evaluation. Logistic regression was retained because it was the first learned candidate under the predefined tie-break, uses fewer parameters than the nonlinear alternatives, and gives a compact deterministic artifact. The choice is based on end-to-end segmentation and classification, not operation-level classification alone.

## Evaluation protocol

Five expanding-window folds train only on earlier operations and evaluate the following 18 complete operations. Training sizes are 20, 38, 56, 74 and 92 operations, producing 90 distinct later-operation predictions.

The detector runs afresh on each raw held-out block. Ground-truth boundaries and labels come independently from the supplied annotation file; predicted segments are not reused as truth. This allows missing, duplicate or misplaced operations to affect the score. Scaling, fitting and SVM calibration use only earlier operations in each fold.

## Metrics and why they suit the task (Section 3.2)

The **official temporal-overlap/classification score** is primary because a useful prediction must locate the operation and assign the correct label. Classification F1 alone could appear strong even if the detector missed movements or placed their boundaries incorrectly.

The **localization score** applies the same matcher while treating all operations as one class, isolating boundary quality. The **abnormal-only official score** exposes performance on the less frequent and operationally important resistance faults. These supporting metrics separate segmentation failure from class-label failure.

## Results

| Candidate | Official score | Localization | Abnormal-only official score |
| --- | ---: | ---: | ---: |
| Always Normal | 0.7444 | 1.0000 | 0.0000 |
| **Balanced logistic regression** | **1.0000** | **1.0000** | **1.0000** |
| Balanced RBF SVM | 1.0000 | 1.0000 | 1.0000 |
| Balanced ExtraTrees | 1.0000 | 1.0000 | 1.0000 |

The selected model detected and correctly classified all 90 later operations in the supplied format. This perfect retrospective result does not establish transfer to another physical door.

A fixed corruption audit illustrates recording sensitivity:

| Held-out condition | Official score | Localization |
| --- | ---: | ---: |
| Original stream | 1.0000 | 1.0000 |
| Remove every tenth interior sample, retaining endpoints | 1.0000 | 1.0000 |
| Remove ten midpoint samples per operation | 0.1703 | 0.3114 |
| Set midpoint command/activity flags inactive | 0.1753 | 0.3220 |
| Remove the last 10% of each operation | 0.5510 | 0.9019 |
| Compress gaps between operations | 0.2989 | 0.3212 |

These transformations are robustness diagnostics, not additional independent test cases. They show that interrupted movements and removed idle gaps can break the supplied-format segmentation assumptions.

## Assumptions and limitations

- Earlier operations are assumed to be informative for later operations in the same recording format. The single stream supplies no train, car or installed-door identifier, so leave-one-door-out validation is impossible.
- Splits are placed between complete annotated movements. The evaluation does not measure arbitrary mid-movement upload starts or online detection delay.
- Large timestamp gaps are assumed to separate movements. The 100 ms minimum gap, 500 ms terminal dwell and 10-second maximum are engineering decisions because the documentation does not specify universal segmentation thresholds.
- Candidate comparison is not nested, and the labelled stream informed earlier development. The 1.0000 result is a retrospective check, not an untouched benchmark.
- Confidence values describe the classifier on extracted complete-operation features; they do not quantify boundary uncertainty or guarantee physical safety.

## Reproduction and artifacts

```bash
python Optional_Items/tools/model.py door validation \
  --data-dir PS3/02_Datasets/Door \
  --output Optional_Items/Door/code/outputs/validation_results.json

python Optional_Items/tools/model.py door train \
  --data-dir PS3/02_Datasets/Door \
  --model-out app/backend/artifacts/door_pipeline.joblib

python Optional_Items/tools/model.py door predict \
  --input PS3/02_Datasets/Door/Test.csv \
  --model app/backend/artifacts/door_pipeline.joblib \
  --output Optional_Items/Door/code/outputs/door_predictions.csv \
  --diagnostics-output Optional_Items/Door/code/outputs/diagnostics.json
```

The active artifact is `app/backend/artifacts/door_pipeline.joblib`. Machine-readable candidate, fold and robustness results are under `Optional_Items/Door/code/outputs/`. The official single-stream CSV contains `start_time,end_time,prediction` in chronological order.
