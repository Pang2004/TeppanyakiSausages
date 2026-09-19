# Fleet Diagnostic Model Write-up

**Team:** TeppanyakiSausages

## Scope

This repository implements four condition-monitoring tasks in one application: Rail corrugation classification, Door operation-resistance diagnosis, ACV refrigerant-leak localisation, and SHM cumulative-fatigue estimation. Each model runs locally through the FastAPI backend and returns the official prediction fields plus diagnostics used by the technician interface.

This document is the single index for the model documentation. Each linked methodology is self-contained and records:

- the modelling approach;
- feature-engineering choices;
- model selection and the reason for the final choice;
- the reported metrics and why they suit the task; and
- assumptions made where the task documentation left a design decision open.

## Methodology index

- [Rail Corrugation methodology](Rail%20Corrugation/METHODOLOGY.md)
- [Door methodology](Door/METHODOLOGY.md)
- [ACV methodology](ACV/METHODOLOGY.md)
- [SHM methodology](SHM/METHODOLOGY.md)

## Approach and evaluation summary

| Subsystem | Final approach | Evaluation protocol | Primary reported result |
| --- | --- | --- | ---: |
| Rail | Class-balanced logistic regression using global statistical/wavelength features, local per-car spectral energy, training-only side mirroring and a tuned Side I decision multiplier | Six repeats of five grouped outer folds; hyperparameters selected in grouped inner folds | Macro F1 **0.7609** |
| Door | Gap/state-machine operation segmentation followed by standardized, class-balanced logistic regression | Five chronological expanding-window folds; detection and labels scored against independent annotations for 90 later operations | Official score **1.0000** |
| ACV | Deterministic within-train anomaly ranker combining directional temperature evidence with pressure-circuit imbalance when available | Retrospective whole-workbook evaluation of all six labelled cases | Mean rank-decay score **1.0000** |
| SHM | Calibrated rainflow/Miner physical model with a regularized Ridge residual correction | Nested leave-one-file-out evaluation over 64 complete histories | Official score **0.977022** |

These are local results on supplied labelled development data. They use different targets and evaluation units and must not be averaged into one fleet-wide score. The supplied test labels are unavailable, so generated test predictions are not accuracy measurements.

## Metric rationale (Section 3.2)

The primary metric for each subsystem follows the structure of its task:

- **Rail — macro F1:** the three classes are strongly imbalanced, including only 14 Side I recordings. Macro F1 gives each class equal weight and penalizes both missed faults and false alarms. Per-class Side I and Side II F1 are reported because macro F1 alone can hide minority-class behavior.
- **Door — official temporal-overlap/classification score:** a useful result needs both a correctly located operation and the correct resistance label. Classification-only F1 would not penalize missing, duplicated or badly segmented movements. A localization-only score and abnormal-only official score are supporting diagnostics.
- **ACV — rank-decay score:** the required output is a complete ordered car list, so the official ranking score rewards placing the true faulty car near the top while retaining partial credit below rank one. Top-1 accuracy and mean true-car rank make the operational meaning easier to interpret.
- **SHM — MAPE-derived official score:** fatigue damage is positive and spans a wide range, making relative error more informative than absolute squared error. The official score is `max(0, 1 - MAPE)`. The 95th-percentile absolute percentage error is also reported to expose tail behavior.

## Shared design assumptions

The task material does not prescribe one common development split. We therefore keep each labelled unit intact and choose a protocol that matches the prediction unit:

- Rail keeps exact-duplicate recordings in the same fold.
- Door trains on earlier complete operations and evaluates later complete operations.
- ACV treats a workbook, not its rows or individual cars, as one labelled case.
- SHM keeps each complete stress history in one fold.

These choices reduce obvious leakage but do not prove deployment independence. Vehicle, journey, installed-door, line, load-condition and chronology identifiers are incomplete or absent. Reported results therefore describe the supplied collection, not guaranteed transfer to a new fleet or operating regime.

Hyperparameter fitting and preprocessing are restricted to training portions wherever supervised fitting is used. The ACV ranker is an exception: all six disclosed cases informed a fixed physics-based design, so its result is explicitly retrospective rather than an independent validation estimate.

## Reproducibility and artifacts

Active inference artifacts are stored in `app/backend/artifacts/`. Development code, model copies and machine-readable evaluation reports are stored under the corresponding `Optional_Items/<subsystem>/` directory. Raw datasets are excluded from this repository.

Run development commands from the repository root after placing the separately supplied datasets under `PS3/02_Datasets/` and installing the Python requirements. The common command dispatcher is:

```bash
python Optional_Items/tools/model.py <rail|door|acv|shm> <train|validation|predict> [arguments]
```

The exact commands, expected data paths, output artifacts and task-specific limitations are given in the four methodology files above.
