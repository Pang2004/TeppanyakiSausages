# TeppanyakiSausages Fleet Diagnostic

An end-to-end condition-monitoring application for four rail subsystems:

- **Rail Corrugation:** classifies each recording as Normal, Side I or Side II.
- **Door:** segments door operations and classifies Normal or Abnormal resistance.
- **ACV:** ranks train cars by refrigerant-leak likelihood.
- **SHM:** estimates cumulative fatigue damage from a stress history.

The application combines a React/TypeScript interface with a FastAPI inference service. It runs all four saved models locally, shows a technician-oriented diagnosis for each result, generates a downloadable diagnosis PDF, and exports prediction CSV files.

## Repository contents

| Path | Purpose |
| --- | --- |
| `app/` | Deployable application, Docker configuration, model inference code and active model artifacts. |
| `app/frontend/` | React interface, frontend tests and production build configuration. |
| `app/backend/` | FastAPI service, validation, feature extraction and inference adapters. |
| `Optional_Items/` | Model-development code, evaluation outputs and the consolidated model write-up. |
| `predictions.zip` | Prediction CSV files generated for the supplied test inputs. |
| `MANIFEST.sha256` | SHA-256 checksums for the submitted repository snapshot. |

The model report is [Optional_Items/write_up.md](Optional_Items/write_up.md). It is the documentation index for the four subsystem methodologies. Raw training and test datasets are intentionally excluded.

## Quick start with Docker Compose

Requirements: Docker Engine or Docker Desktop with the Compose plugin.

```bash
cd app
docker compose up --build -d
```

Open <http://localhost:8080>. Check readiness or follow the logs with:

```bash
docker compose ps
docker compose logs -f fleet-diagnostic
```

Later starts can reuse the built image:

```bash
docker compose up -d
```

Rebuild after changing application or model code:

```bash
docker compose up --build -d
```

Stop the application with `docker compose down`.

If Docker reports permission denied for `/var/run/docker.sock` after adding your user to the `docker` group, log out and back in or run `newgrp docker`, then confirm that `docker info` shows the server section before retrying Compose.

### Runtime configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| `APP_PORT` | `8080` | Host port exposed by Compose. |
| `APP_CPUS` | `2.0` | Container CPU limit. |
| `APP_MEMORY` | `2g` | Container memory limit. |
| `RAIL_MAX_FILE_BYTES` | `67108864` | Per-file upload limit shared by all prediction endpoints (64 MiB). |

Example:

```bash
APP_PORT=8090 RAIL_MAX_FILE_BYTES=100000000 docker compose up -d --force-recreate
```

## Using the application

1. Select Rail, Door, ACV or SHM on the main page.
2. Upload one or more supported files. Analysis starts automatically and files are processed sequentially.
3. Select a completed recording to inspect the prediction, evidence, recommended technician action and known limitation.
4. Download the detailed diagnosis PDF or export the prediction CSV.

| Subsystem | Input | Prediction output |
| --- | --- | --- |
| Rail | Official 10,000-row, 129-column CSV recording | `file_id,prediction` |
| Door | Door telemetry CSV stream | `start_time,end_time,prediction` for a single-stream submission |
| ACV | ACV telemetry XLSX workbook | `file_id,ranked_cars` |
| SHM | Headerless single-column stress CSV | `file_id,prediction` |

Uploaded files use request-scoped temporary storage and are removed after processing. Results remain only in the current browser tab and are cleared by a refresh. Model scores and diagnostic guidance support inspection; they do not replace engineering judgement or safety procedures.

## Native development

Requirements: Python 3.12 and Node.js 24.

```bash
cd app
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm ci --prefix frontend
npm run build --prefix frontend
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python -m uvicorn backend.api:app --host 0.0.0.0 --port 8000
```

Open <http://localhost:8000>. The Python service serves the built frontend and the API, so a second production server is unnecessary.

For frontend hot reload, keep FastAPI on port 8000 and run from the repository root:

```bash
npm run dev --prefix app/frontend
```

## Verification

From the repository root:

```bash
docker compose -f app/compose.yaml config --quiet
npm test --prefix app/frontend
npm run build --prefix app/frontend
sha256sum --quiet -c MANIFEST.sha256
```

With the application running on port 8080:

```bash
python app/scripts/smoke.py --url http://127.0.0.1:8080
```

The optional development pipelines and their exact reproduction commands require the separately supplied datasets and are documented through the consolidated model write-up.

## API

- `GET /api/health` reports readiness, subsystem availability and the upload limit.
- `POST /api/predict/rail`
- `POST /api/predict/door`
- `POST /api/predict/acv`
- `POST /api/predict/shm`

Each prediction endpoint accepts one multipart field named `file`. Invalid schemas return `422`, oversized uploads return `413`, and unavailable model artifacts return `503`.
