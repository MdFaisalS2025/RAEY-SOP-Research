# SOP-Guard

**AI-powered clinical SOP assistant with procedural faithfulness verification.**

> Research prototype. Not for clinical use. All SOP data is synthetic.

---

## What It Does

SOP-Guard helps hospital staff find answers from Standard Operating Procedures. You ask a question, the system retrieves relevant SOP sections, generates a grounded answer, and verifies it for procedural correctness before showing it.

The core research contribution is the **Procedural Faithfulness Verifier**: an automated check that catches wrong thresholds, missing steps, and omitted contraindications in generated answers.

## Key Results

| Metric | Value |
|--------|-------|
| Adversarial violation detection | **100%** (17/17) |
| Retrieval precision | **87.5%** |
| Keyword coverage | **88%** |
| Refusal accuracy (unsupported queries) | **100%** |
| Demo SOPs indexed | 10 |
| Query types supported | 6 (procedure, threshold, contraindication, monitoring, medication, general) |

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

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd sop-guard/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd sop-guard/frontend
npm install
npm run dev
```

Open http://localhost:3000

### Optional: Ollama for LLM answers
```bash
# Install Ollama from https://ollama.com
ollama pull llama3.2
# Set in .env:
LLM_PROVIDER=ollama
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
      demo_data/       # 10 synthetic SOPs, queries, adversarial tests
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
| GET | /api/evaluate/summary | Get complete metrics summary |
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
