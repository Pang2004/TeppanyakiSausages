# TeppanyakiSausages — Fleet Diagnostic

Fleet Diagnostic is a single web application for four train-condition monitoring tasks: rail corrugation classification, door resistance diagnosis, air-conditioning fault ranking, and structural fatigue-damage estimation. Each tab accepts recordings, runs its included model, displays results, and supports CSV downloads.

## Run locally

With Docker installed and running, open a terminal in this folder:

```bash
cd app
docker build -t fleet-diagnostic:local .
docker run --rm -p 8080:8080 --memory=2g --cpus=2 fleet-diagnostic:local
```

Open **http://localhost:8080**. The first build requires internet access to download dependencies. Once built, inference runs inside the container without an external model service. Stop the server with Ctrl+C.

Alternatively, follow the Python and Node.js setup in [app/README.md](app/README.md). The app includes its trained model artifacts; training datasets are not required to run it. The Docker configuration is provided, but container execution has not been verified in the preparation environment. The packaged app was tested natively with real inputs for all four subsystems.

## Use the application

1. Select Rail, Door, ACV, or SHM from the home page.
2. Choose files or a folder, or drag recordings onto the upload panel. Rail, Door and SHM accept CSV; ACV accepts XLSX.
3. Inspect the results and select a recording or detected door operation for details.
4. Download the predictions. For the official Door format, use **Download selected stream submission CSV**; the batch download additionally identifies each source file.

The container accepts files up to 30 MiB each. Recordings are processed sequentially and temporary uploads are removed after processing. Results remain available while switching tabs; refreshing the browser clears them.

## Submission contents

| Item | Contents |
| --- | --- |
| `app/` | Application source, built frontend, model artifacts and deployment configuration |
| `predictions.zip` | Four prediction CSVs generated through the application |
| [Optional_Items/write_up.md](Optional_Items/write_up.md) | Model approaches, validation scores and limitations for all four subsystems |
| `Optional_Items/<subsystem>/` | Detailed methodology, development code, evaluation reports and model copies |
| `MANIFEST.sha256` | SHA-256 hashes for the files in this submission |

The prediction archive contains 68 Rail classifications, 38 Door operation predictions from one stream, one ACV car ranking, and 16 SHM damage predictions. These are outputs for the supplied unlabelled test inputs; their accuracy cannot be measured without the reference answers.

## Interpretation

Rail identifies the predicted corrugation class for a recording. Door shows detected operation boundaries and resistance labels. ACV ranks inspection priority rather than confirming a leak. SHM displays predicted fatigue damage, including a percentage relative to D = 1; this is not a remaining-life estimate or a structural-safety certification.

Local validation results and their evaluation protocols are consolidated in the [write-up](Optional_Items/write_up.md). 
