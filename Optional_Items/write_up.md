# Fleet Diagnostic — Model Approaches and Evaluation

**Team: TeppanyakiSausages**

## Objective and application

The application brings four train-condition monitoring tasks into one interface: rail corrugation classification, door-operation resistance diagnosis, ACV refrigerant-leak localisation, and structural fatigue-damage estimation. Users upload recordings, inspect model outputs, and download predictions without running model code directly.

The React frontend connects to a FastAPI backend containing all four inference pipelines and saved model artifacts. The backend validates recording schemas, processes uploads sequentially, and removes request-scoped temporary files after inference. Each tab maintains its own results. Model inference does not depend on an external AI service.

## Open design decisions and evaluation assumptions

The supplied data does not prescribe a development split. Each subsystem therefore uses a protocol suited to its label unit and available data, with its limitations stated explicitly:

| Subsystem | Decision and reason | Assumption and limit |
| --- | --- | --- |
| Rail | Repeated stratified grouped five-fold evaluation retains training data, distributes rare classes and prevents exact duplicates crossing folds; tuning uses inner folds. | Distinct recording groups approximate independent units. Related journeys may remain correlated, and exploratory feature-family selection limits independence of the reported estimate. |
| Door | Expanding chronological windows model learning from earlier operations and diagnosing later complete operations; independent annotations assess boundaries. | Later operations in the same stream are informative for this format, but do not establish transfer to unseen physical doors or interrupted movements. |
| ACV | A fixed physics-informed ranker is evaluated retrospectively on all six disclosed cases; no independent split is claimed because case coverage is too limited, particularly for pressure signals. | Most peer cars provide a usable cooling reference. The six-case score informed by feature development is a feasibility result, not an unbiased future-performance estimate. |
| SHM | Whole-file leave-one-out evaluation retains 63 training histories per fit; inner validation selects both hyperparameters and correction family. | Files are the available evaluation units, but missing vehicle/load/chronology identifiers prevent a claim of independence or unseen-group transfer. |

Each linked subsystem methodology includes a **Design assumptions and rationale** section covering these choices, engineering thresholds or physical assumptions, selection criteria and the deployment limits they imply. The choices are explicitly distinguished from organiser requirements; the reported scores have not changed.

## Scoring summary

The following results are local evaluations on supplied labelled development data. They use different task-specific metrics and protocols and should not be averaged into a single overall score. Reference answers for the submitted test inputs are unavailable, so these are **not organiser-held-out results**.

| Subsystem | Evaluation protocol | Primary score | Supporting results |
| --- | --- | ---: | --- |
| Rail v3 | Six repeats of five grouped outer folds; hyperparameters and decision multiplier selected within training folds | Macro F1 **0.7609** | Side I F1 **0.5124**; Side II F1 **0.8006** |
| Door | Five expanding-window folds; detection on raw held-out blocks, scored against independent annotations; 90 evaluated operations | Official temporal-overlap/classification score **1.0000** | Localization **1.0000**; abnormal-only official score **1.0000** |
| ACV | Retrospective ranking of six labelled workbooks | Mean rank-decay score **1.0000** | Top-1 accuracy **100%**; mean true-car rank **1.00** |
| SHM | Outer leave-one-file-out validation over 64 histories, with model-family and hyperparameter selection inside each training fold | Official score **0.977022** | MAPE **2.2978%**; 95th-percentile absolute percentage error **6.7090%** |

Rail feature-family development used earlier experimental results; Door and SHM are retrospective evaluations of previously studied data. ACV's six cases informed feature design. These distinctions limit claims of independent generalisation, particularly for minority classes and new vehicles or operating conditions.

## Rail corrugation

The labelled set contains 272 recordings: 234 Normal, 14 Side I and 24 Side II. Two duplicate Normal pairs are grouped so identical recordings cannot appear in both training and validation within a fold.

The v3 pipeline combines 855 statistical/wavelength features with 702 per-car wavelength-energy and axle-contrast features. Training-only side mirroring swaps side channels and labels. Standardisation and balanced logistic regression are fitted within each training fold; inner validation selects regularisation and a Side I decision-score multiplier. The deployed full-data model uses C = 0.01 and a multiplier of 4.

| Procedure, same six-repeat protocol | Macro F1 | Side I F1 | Side II F1 |
| --- | ---: | ---: | ---: |
| Original statistical/wavelength procedure | 0.7095 | 0.4097 | 0.7623 |
| Local-energy v3 procedure | **0.7609** | **0.5124** | **0.8006** |

These are mean fold scores. A favourable repeat produced pooled macro F1 0.7977 and Side I F1 0.6207, but Side I did not consistently reach 0.60 across repeats. Repeated folds reuse the same recordings. The full-data inner comparison slightly favoured the original family (0.7165 versus 0.7110), while repeated outer results favoured v3. The production implementation reproduced all 1,632 stored held-out predictions exactly; those predictions are not 1,632 independent samples.

Details: [Rail methodology](Rail%20Corrugation/METHODOLOGY.md) and [local spectral study](Rail%20Corrugation/LOCAL_SPECTRA_STUDY.md).

## Door resistance diagnosis

The pipeline first segments individual opening or closing operations from a continuous stream, then classifies each operation as Normal or Abnormal resistance. It uses recording gaps where available and a direction-aware state machine for continuous data. The classifier uses 177 operation features covering signal statistics, waveform shape, timing and control-state transitions. Balanced logistic regression is retained and fitted on all 110 labelled operations.

Validation trains only on earlier operations and evaluates detection and labels against independent annotations for later raw-stream blocks.

| Candidate | Official score | Localization | Abnormal-only official score |
| --- | ---: | ---: | ---: |
| Always Normal | 0.7444 | 1.0000 | 0.0000 |
| Balanced logistic regression | **1.0000** | **1.0000** | **1.0000** |
| Balanced RBF SVM | 1.0000 | 1.0000 | 1.0000 |
| Balanced ExtraTrees | 1.0000 | 1.0000 | 1.0000 |

Recording robustness is materially weaker than performance on the supplied format:

| Held-out condition | Official score | Localization |
| --- | ---: | ---: |
| Original stream | 1.0000 | 1.0000 |
| Remove every tenth interior sample, retaining endpoints | 1.0000 | 1.0000 |
| Remove ten midpoint samples per operation | 0.1703 | 0.3114 |
| Set midpoint command/activity flags inactive | 0.1753 | 0.3220 |
| Remove the last 10% of each operation | 0.5510 | 0.9019 |
| Compress gaps between operations | 0.2989 | 0.3212 |

Only one labelled source stream is available. The perfect original-format score does not establish robustness to interrupted recordings or transfer to unseen physical doors. Historical repeated-stratified classification macro F1 was 0.99596; it used a different protocol and does not replace the end-to-end temporal score above.

Details: [Door methodology](Door/METHODOLOGY.md).

## ACV refrigerant-leak localisation

With only six labelled workbooks, the model uses a deterministic, physics-informed within-train ranker. It compares sustained warm-cabin behaviour against peer cars and cooling targets, adding pressure/compressor evidence when present. Car identifiers are preserved exactly and every car remains in the output ranking. Missing measurements are treated as missing evidence rather than confirmed healthy behaviour.

| Ranking method | Mean rank-decay score | Top-1 accuracy | Mean true-car rank |
| --- | ---: | ---: | ---: |
| Fixed identifier order | 0.7708 | 33.3% | 2.83 |
| Hottest median | 0.8125 | 66.7% | 2.50 |
| Temperature anomaly | 0.9792 | 83.3% | 1.17 |
| Hybrid temperature/pressure | **1.0000** | **100%** | **1.00** |

| Robustness condition | Rank-decay score | Top-1 rate |
| --- | ---: | ---: |
| Four consecutive portions per workbook | 0.9688 | 83.3% |
| Cooling targets removed | 1.0000 | 100% |
| Pressure/compressor data removed | 0.9792 | 83.3% |
| Another car's cabin sensor removed | 1.0000 | 100% |
| One temperature scoring feature removed | 1.0000 | 100% |
| Faulty car's cabin sensor removed | 0.2708 | 16.7% |

A fixed gap-aware candidate produced the same scores and was not adopted. The six workbooks informed feature design, and only one labelled case has rich pressure telemetry. The perfect retrospective ranking is therefore not an independent estimate of performance on new faults. Removing the pressure-mismatch field from the UI does not remove pressure evidence from the model.

Details: [ACV methodology](ACV/METHODOLOGY.md).

## SHM fatigue damage

Rainflow counting converts each stress history into cycle amplitudes and counts. A calibrated Miner/S–N damage model supplies the physical estimate; a regularised Ridge residual model captures remaining signal-shape effects. Inner validation selects the S–N exponent, Ridge strength and whether to use the residual correction. The final model uses exponent 5 and Ridge alpha 1.0.

| Approach | MAPE | Official score | 95th-percentile absolute percentage error |
| --- | ---: | ---: | ---: |
| Weighted constant | 58.3121% | 0.416879 | — |
| Global-range power model | 27.6468% | 0.723532 | — |
| Calibrated Miner family | 2.5444% | 0.974556 | 8.9458% |
| Miner + Ridge family | 2.2694% | 0.977306 | 6.7090% |
| Complete nested family-selection procedure | **2.2978%** | **0.977022** | **6.7090%** |

The complete selection procedure is the primary estimate; selecting the best fixed-family row from its outer results would reuse evaluation data. Its maximum absolute percentage error is 8.7531%.

| Inner split seed | Nested MAPE | Nested official score |
| --- | ---: | ---: |
| 42, primary | 2.2978% | 0.977022 |
| 43 | 2.5858% | 0.974142 |
| 44 | 2.3514% | 0.976486 |

These sensitivity runs reuse the same 64 histories. The historical error percentile is not an individual prediction interval. File-level validation cannot establish transfer to different vehicles, structural details, stress units or load regimes without additional data. The train battery displays D × 100%, not remaining service life; only its fill is capped at 100%.

Details: [SHM methodology](SHM/METHODOLOGY.md).

## Submitted predictions and reproducibility

The application generated all four files in `predictions.zip`: 68 Rail classifications, 38 Door segments from one stream, a complete eight-car ranking for one ACV workbook, and 16 SHM damage predictions. Door uses `start_time,end_time,prediction`; ACV uses `file_id,ranked_cars`; Rail and SHM use `file_id,prediction`. No held-out accuracy is inferred from the predicted-label distributions.

The application runtime and model artifacts are under `app/`. This optional folder contains subsystem methodology, evaluation reports, development code and copies of the active models. Raw datasets are excluded. Optional reproduction uses `python Optional_Items/tools/model.py <subsystem> <train|validation|predict> ...` from the team-folder root with separately supplied data paths; subsystem documents describe the evaluation settings.
