# Meridian

**AI-powered clinical SOP assistant with procedural faithfulness verification.**

Meridian is an AI-powered hospital SOP intelligence platform that combines internal SOP retrieval, AI-assisted question answering, external clinical evidence retrieval, SOP-vs-evidence comparison, SOP version history, committee review workflows, and compliance/governance tooling into one conversational assistant.

> Research prototype. Not for clinical use. All SOP data is synthetic.

[![CI](https://github.com/MdFaisalS2025/Meridian-SOP-Research/actions/workflows/ci.yml/badge.svg)](https://github.com/MdFaisalS2025/Meridian-SOP-Research/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2014-000000)](frontend)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)](backend)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

**Live demo:** _add the deployed frontend URL here once deployed (see [Deployment](#deployment))_
**Reviewer / professor guide:** [PROFESSOR_GUIDE.md](PROFESSOR_GUIDE.md)

---

## What It Does

Meridian helps hospital staff find answers from Standard Operating Procedures. You ask a question, the system retrieves relevant SOP sections, generates a grounded answer, and verifies it for procedural correctness before showing it.

The core research contribution is the **Procedural Faithfulness Verifier**: an automated check that catches wrong thresholds, missing steps, and omitted contraindications in generated answers.

## Key Results

Measured 2026-08-05 against the current 22-SOP synthetic corpus, mock/extractive generation mode (no LLM configured in this run - retrieval and verification are unaffected by generation mode, but faithfulness-style metrics are not; see the live evaluation page). These are small, fixed test sets (8-17 cases) that drift as the corpus grows, so treat them as a snapshot, not a permanent claim - the live `/evaluation` page in the running app always reflects the current numbers, computed on demand, and is the authoritative source.

| Metric | Value | Basis |
|--------|-------|-------|
| Adversarial violation detection (sensitivity) | **100%** (17/17) | 17 hand-written adversarial cases (`adversarial_tests.py`) |
| Retrieval precision | **100%** (8/8) | 8 fixed test queries against expected SOP (`rag/evaluator.py`) |
| Keyword coverage | **80%** | Same 8-case set, fraction of expected keywords retrieved |
| Refusal accuracy (unsupported queries) | **0%** (0/1) | Single out-of-scope test query; the naive `relevance_score < 0.01` threshold this specific evaluator uses predates the corpus growing to 22 SOPs and no longer discriminates - this is a known, disclosed regression in a small legacy check, not a claim about the pipeline's real abstention logic, which uses a separately calibrated gate (see `evidence_sufficiency.py`) and is exercised by the adversarial/perturbation benchmarks above instead. |
| Demo SOPs indexed | **22** | `demo_data/demo_sops.py`, all synthetic |
| Query types supported | 6 (procedure, threshold, contraindication, monitoring, medication, general) | Fixed taxonomy, not a measured metric |

## Features

### RAG Pipeline
- SOP-aware chunking (steps, thresholds, contraindications, sections - not fixed-size blocks)
- Hybrid retrieval (TF-IDF + chunk-type boosting + clinical synonym expansion)
- Heuristic reranking with optional cross-encoder support
- Multi-hop retrieval for cross-SOP references
- Evidence sufficiency checking with safe refusal
- Query understanding with clinical entity extraction
- 50+ clinical abbreviation expansions, 28 synonym groups

### Procedural Faithfulness Verifier
- Threshold verification (catches wrong dosages, values, time windows)
- Sequence verification (catches reversed or missing procedure steps)
- Contraindication verification (catches omitted warnings)
- 100% detection rate on adversarial test suite

### Application
- Modern clinical command center UI (Next.js + Tailwind)
- Voice input (Web Speech API with fallback)
- SOP Library with table/card views and 5-tab detail modal
- SOP upload with parsing and metadata editing
- Role-based permissions (admin/editor/viewer)
- Activity logging and feedback tracking
- Query export as JSON reports
- Adversarial verifier demo page
- Onboarding tour for new users
- Dark mode clinical design

### LLM Support
- Works locally without paid API keys (mock/extractive mode)
- Optional Ollama integration (free, local LLM)
- Optional OpenAI-compatible API support
- Graceful fallback chain: LLM -> mock generator

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion, Recharts |
| Backend | FastAPI, SQLAlchemy, SQLite, Pydantic |
| RAG | Custom hybrid retriever, SOP-aware chunker, heuristic reranker |
| Verification | Procedural Faithfulness Verifier (threshold, sequence, contraindication) |
| Voice | Web Speech API (browser) + optional Whisper |
| LLM | Mock (default) / Ollama / OpenAI-compatible |

## Local Development

### Prerequisites
- Python 3.11 (pinned - see [`backend/requirements.txt`](backend/requirements.txt) for why)
- Node.js 18+
- (Optional) Docker + Docker Compose, for the one-command option below

### Option A: One command (Docker Compose)

From `sop-guard/`:
```bash
docker compose up --build
```
This builds and starts both services - backend on `:8000`, frontend on `:3000` - wired together automatically. Open **http://localhost:3000**. No manual `.env` setup needed for the default (mock LLM, SQLite, auto-seeded demo data) configuration.

### Option B: Run backend and frontend directly

**Backend** (terminal 1):
```bash
cd sop-guard/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
The database is created and seeded with demo SOPs, versions, incidents, and notifications automatically on first startup - no manual seed step required.

**Frontend** (terminal 2):
```bash
cd sop-guard/frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

### Environment variables

Copy [`.env.example`](../.env.example) (repo root) into `sop-guard/backend/.env` for backend settings and `sop-guard/frontend/.env.local` for frontend settings. Every variable has a working default for local development - you only need a `.env` file at all if you want to change LLM provider, database, or CORS behavior. See the file for the full list and explanations.

### Optional: Ollama for LLM-generated answers

By default `LLM_PROVIDER=mock` and the app answers using extractive templates - no API key or local model required. For LLM-generated prose:
```bash
# Install Ollama from https://ollama.com
ollama pull llama3.2
# In sop-guard/backend/.env:
LLM_PROVIDER=ollama
```
If Ollama isn't running/reachable, the pipeline gracefully falls back to mock mode - it never calls a third-party LLM API with hospital data.

## Running the Project

| Task | Command |
|---|---|
| Start backend (dev, auto-reload) | `cd sop-guard/backend && uvicorn app.main:app --reload --port 8000` |
| Start frontend (dev) | `cd sop-guard/frontend && npm run dev` |
| Start both via Docker | `cd sop-guard && docker compose up --build` |
| Run backend tests | `cd sop-guard/backend && python -m pytest -q` |
| Type-check frontend | `cd sop-guard/frontend && npx tsc --noEmit` |
| Lint frontend | `cd sop-guard/frontend && npm run lint` |
| End-to-end tests (Playwright) | `cd sop-guard/frontend && npm run test:e2e` |

## Building

```bash
# Frontend production build
cd sop-guard/frontend
npm run build
npm start          # serves the production build on :3000

# Backend - no separate build step; run the same way in production
cd sop-guard/backend
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

## Deployment

The frontend and backend deploy as two separate services. **Vercel** for the Next.js frontend and **Render** for the FastAPI backend is the recommended pairing - both have generous free tiers, both deploy straight from this GitHub repo with no Docker knowledge required, and a blueprint file for the backend is already included.

### 1. Backend on Render

1. Push this repo to GitHub (see the root [README](../README.md) / [PROFESSOR_GUIDE.md](PROFESSOR_GUIDE.md) for git commands).
2. In [Render](https://render.com), click **New +** -> **Blueprint** and point it at this repository. Render will detect [`backend/render.yaml`](backend/render.yaml) automatically (root directory `sop-guard/backend`, Python 3.11, mock/Ollama LLM, SQLite, health check on `/api/health`).
3. Deploy. Note the resulting public URL, e.g. `https://meridian-backend.onrender.com`.
4. In the Render service's environment settings, update `CORS_ORIGINS` to include your Vercel frontend URL once you have it (step 2 below), e.g. `["https://your-app.vercel.app"]`.

SQLite lives on Render's ephemeral disk by design here - the backend auto-seeds fresh demo data on every startup (see `_seed_demo_activity_if_empty` and friends in `app/main.py`), so a restart just resets to a clean demo state rather than losing anything that matters for review. For durable storage instead, attach a Render disk or point `DATABASE_URL` at managed PostgreSQL.

### 2. Frontend on Vercel

1. In [Vercel](https://vercel.com), **Add New** -> **Project**, import this repository.
2. Set **Root Directory** to `sop-guard/frontend` (Vercel's monorepo picker - required, since this repo has the frontend in a subdirectory).
3. Framework preset: Next.js (auto-detected).
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g. `https://meridian-backend.onrender.com`)
   - `BACKEND_URL` = the same URL (used server-side by the `/api/*` rewrite in `next.config.js` - see that file for why both are needed)
5. Deploy. Vercel gives you a `https://<project>.vercel.app` URL immediately - no further routing config needed, since Next.js App Router handles all pages and there's no SPA-refresh/404 issue to work around.
6. Go back to Render and set `CORS_ORIGINS` to this Vercel URL (step 4 above), then redeploy the backend so it accepts requests from the live frontend.

### Alternatives considered

- **Netlify**: works for the frontend similarly to Vercel, but Vercel has first-party Next.js support (App Router, rewrites, image optimization) with zero extra config, so it's the safer default here.
- **Railway**: a solid alternative to Render for the backend (also supports blueprint-style deploys and Python), if Render's free-tier cold starts are a problem for a live demo.
- **Fully static/frontend-only hosting**: not viable - the app is full-stack; the backend does retrieval, verification, and evidence lookups that can't move to the client.

## Demo Accounts

The app uses client-side demo authentication (no real patient or staff data). Sign in with any of the four role accounts below and password **`demo1234`**, or use the "continue as demo user" cards on the login screen:

| Staff ID | Name | Role | Access Level |
|---|---|---|---|
| `u1` | Dr. Sarah Mitchell | Clinical Staff | Level 1 |
| `u2` | Nurse Educator Marcus Chen | Educator / Trainer | Level 2 |
| `u3` | Dr. Linda Yeo | Governance & Compliance | Level 3 |
| `u4` | Tariq Farooq | System Admin | Level 4 (highest) |

## Screenshots

_Add screenshots of the Ask Meridian chat view, SOP Library, Version History drawer, and SOP-vs-Internet Comparison panel here before submission, e.g.:_

```md
![Ask Meridian](docs/screenshots/ask-meridian.png)
![SOP Version History](docs/screenshots/version-history.png)
![SOP vs Internet Comparison](docs/screenshots/comparison.png)
```

## Demo Walkthrough

1. Open the app - see the onboarding tour
2. Go to **Query SOPs** - ask "What are the steps for sepsis management?"
3. Watch the pipeline animation, see all 10 steps in the answer
4. Check the confidence gauge and verification badge
5. Click a source card to see the SOP evidence
6. Go to **SOP Library** - toggle between card and table views
7. Click an SOP to see the 5-tab detail view (Overview, Procedure, Thresholds, Safety, Full Text)
8. Go to **Verifier Demo** - click "Run Verifier Tests" to see 100% detection
9. Go to **AI Insights** - run the RAG evaluation
10. Go to **Settings** - see system status and LLM provider

## Project Structure

```
sop-guard/
  backend/
    app/
      agents/          # Query understanding, pipeline orchestration
      api/             # FastAPI routes
      rag/             # Chunker, retriever, reranker, generator, evaluator
        chunker.py         # SOP-aware typed chunking
        hybrid_retriever.py # TF-IDF + type boosting + synonym expansion
        reranker.py        # Cross-encoder with heuristic fallback
        clinical_terms.py  # 50+ abbreviations, 28 synonym groups
        multihop.py        # Cross-SOP reference detection
        evidence_sufficiency.py # 4-criteria evidence checking
        llm_generator.py   # Ollama/OpenAI with mock fallback
        embeddings.py      # sentence-transformers with TF-IDF fallback
      verifier/        # Procedural Faithfulness Verifier
      services/        # Document parsing, permissions, activity logging
      demo_data/       # 22 synthetic SOPs, queries, adversarial tests
      evaluation/      # RAG evaluation framework
  frontend/
    src/
      app/             # 13 pages (query, library, upload, etc.)
      components/      # UI components, layout, voice recorder
      lib/             # API client, types, utilities
  docs/                # Architecture, thesis summary, dataset plan
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/query | Submit an SOP question |
| POST | /api/query/export | Export query result as JSON report |
| GET | /api/sops | List all SOPs |
| GET | /api/sops/{id} | Get SOP detail with full text |
| POST | /api/sops | Create new SOP (admin/editor) |
| DELETE | /api/sops/{id} | Archive/delete SOP (admin) |
| POST | /api/upload-sop | Upload and parse SOP document |
| POST | /api/evaluate/rag | Run RAG evaluation |
| POST | /api/evaluate/adversarial | Run adversarial verifier tests |
| GET | /api/project/summary | Get static project/dataset metadata |
| GET | /api/evaluation/summary | Get cached/computed RAGAS-lite evaluation results |
| GET | /api/llm/status | Check LLM provider status |
| GET | /api/activity | Get activity log |
| POST | /api/voice/transcribe | Transcribe audio |

## Safety

- All demo SOPs are synthetic and clearly labeled
- System refuses to answer when evidence is insufficient
- Every answer includes source citations
- Verification checks run on every response
- Research prototype disclaimer is shown throughout the app
- No real patient data is used or required

## License

MIT

## Acknowledgments

Built as a research prototype for thesis work on clinical RAG systems with procedural faithfulness verification.
