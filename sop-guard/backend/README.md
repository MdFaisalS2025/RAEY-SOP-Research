# SOP-Guard Backend

Agentic RAG for clinical SOP question-answering with procedural faithfulness
verification. FastAPI + SQLAlchemy (async) + SQLite.

RESEARCH PROTOTYPE - NOT FOR CLINICAL USE.

## Run locally

```bash
cd sop-guard/backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure environment (copy and edit)
cp .env.example .env   # or create .env with the vars below

uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API.
Demo SOPs load automatically on first startup if the database is empty.

### Key environment variables (.env)

| Var | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | Async DB URL | `sqlite+aiosqlite:///./sop_guard.db` |
| `LLM_PROVIDER` | `mock` \| `ollama` | `ollama` |
| `LLM_MODEL` | Ollama model tag | `llama3.2` |
| `LLM_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `CORS_ORIGINS` | Allowed frontend origins (JSON list) | `["http://localhost:5173"]` |

No third-party LLM API is ever called - patient/query data never leaves
infrastructure the hospital controls. Run `ollama pull llama3.2 && ollama serve`
locally to enable real generation. If Ollama is unreachable, the pipeline
falls back to deterministic mock mode, so the rest of the system (retrieval,
verification, faithfulness, governance) still works offline.

### Run the tests

```bash
python -m pytest -q            # tests/ and app/tests/
```

## Notable endpoints

- `POST /api/query` - run the RAG pipeline (also writes an audit log row)
- `GET  /api/evidence/pubmed?term=sepsis&max=5` - live PubMed lookup (Evidence Watch)
- `GET/POST /api/governance/proposals`, `POST /api/governance/proposals/{id}/vote`
- `GET/POST /api/governance/attestations`, `/api/governance/acknowledgments`
- `GET  /api/governance/query-log?limit=50` - AI usage audit trail
- `GET  /api/evaluation/summary` - cached RAGAS-lite (zero-dependency proxy metrics) eval run
- `GET  /api/evaluation/ragas` - cached real RAGAS library eval run (faithfulness, response relevancy,
  context precision), judged by the self-hosted Ollama model - requires `ragas` + Ollama with the
  configured model pulled; degrades to `{"available": false, "reason": ...}` otherwise
- `GET  /api/evaluation/ablation` - reranker on-vs-off comparison

## Deploy to Render

A `render.yaml` blueprint is included.

1. Push this repository to GitHub.
2. In Render: **New + -> Blueprint**, select the repo. Render reads
   `sop-guard/backend/render.yaml`.
3. Set `LLM_BASE_URL` in the Render dashboard to point at an Ollama instance
   the hospital controls - it is marked `sync: false` so it is never committed.
4. Deploy. Health check is `GET /api/health`; start command is
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Notes:
- SQLite on Render's free tier is ephemeral (resets on redeploy). For durable
  storage, attach a Render disk or switch `DATABASE_URL` to managed Postgres
  (`postgresql+asyncpg://user:pass@host/db`).
- A `Dockerfile` is also provided if you prefer container deploys; it honors
  `$PORT`.
