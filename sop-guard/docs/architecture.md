# SOP-Guard Architecture

> Research prototype -- NOT for clinical use.

## System Overview

SOP-Guard is built as a multi-agent Retrieval-Augmented Generation (RAG) system orchestrated by LangGraph. The system ingests hospital SOP documents, chunks and embeds them, then answers natural-language queries by retrieving relevant passages, generating answers, and verifying them against source text.

## LangGraph Pipeline

The core of SOP-Guard is a LangGraph `StateGraph` that routes a user query through four specialized agents:

```
                    +------------------+
                    |   User Query     |
                    +--------+---------+
                             |
                    +--------v---------+
                    | 1. CLASSIFY       |
                    | Determine query   |
                    | type, department, |
                    | urgency           |
                    +--------+---------+
                             |
                    +--------v---------+
                    | 2. RETRIEVE       |
                    | Hybrid search:    |
                    | semantic + BM25   |
                    | with RRF fusion   |
                    +--------+---------+
                             |
                    +--------v---------+
                    | 3. GENERATE       |
                    | LLM produces      |
                    | answer from       |
                    | retrieved chunks  |
                    +--------+---------+
                             |
                    +--------v---------+
                    | 4. VERIFY         |
                    | Cross-check       |
                    | answer against    |
                    | source chunks     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Final Response  |
                    | answer + score +  |
                    | sources + status  |
                    +-------------------+
```

### State Schema

The pipeline state flows through each node carrying:

```
AgentState:
  query_text: str              # Original user question
  query_type: str              # classified type (procedural, policy, etc.)
  department: str              # target department
  retrieved_chunks: list       # ranked (chunk_text, score, metadata) tuples
  generated_answer: str        # LLM-produced answer
  confidence_score: float      # 0.0 - 1.0
  verification_status: str     # verified | unverified | flagged
  verification_details: dict   # per-claim support evidence
  sources: list                # SOP IDs and section titles cited
```

## RAG Flow

### Document Ingestion

```
  PDF / DOCX Upload
        |
        v
  +-- Text Extraction --+
  |   (PyMuPDF / docx)  |
  +----------+-----------+
             |
             v
  +-- Section Chunking --+
  |  Split by headings,  |
  |  ~512 tokens/chunk   |
  +----------+-----------+
             |
       +-----+------+
       |            |
       v            v
  Embedding     Store in
  (MiniLM)      SQLite DB
       |
       v
  In-memory
  vector index
```

### Hybrid Retrieval

The retrieval stage combines two complementary strategies:

1. **Dense Retrieval** -- Encode the query with the same sentence-transformer model, compute cosine similarity against all chunk embeddings
2. **Sparse Retrieval** -- BM25 scoring over raw chunk text for keyword-level matching

These are fused using Reciprocal Rank Fusion (RRF):

```
  Query
    |
    +--- Embed query ---> Cosine similarity ---> Rank list A
    |
    +--- BM25 score ----> TF-IDF matching  ---> Rank list B
    |
    +--- RRF Fusion: score(d) = sum( 1 / (k + rank_i(d)) )
    |
    v
  Top-K merged results
```

The default fusion constant `k=60` balances both signals. Top-K is configurable (default 5).

## Verification Layer

The verification agent receives the generated answer and the source chunks, then performs claim-level checking:

```
  Generated Answer
        |
        v
  +-- Decompose into claims --+
  |   "Wash hands for 20s"    |
  |   "Use alcohol-based rub" |
  +----------+-----------------+
             |
             v (for each claim)
  +-- Search source chunks ---+
  |   Find supporting text    |
  +----------+-----------------+
             |
        +----+----+
        |         |
   Supported   Not found
        |         |
        v         v
   VERIFIED    FLAGGED
```

A confidence score is computed as: `supported_claims / total_claims`. If the score falls below a threshold (default 0.7), the answer is flagged and the UI displays a warning.

## Feedback Loop

```
  User sees answer
        |
        v
  Rates quality (1-5)
  + optional comment
        |
        v
  Stored in Feedback table
  linked to Query record
        |
        v
  Evaluation module aggregates
  feedback for metrics
```

Feedback does not directly retrain the model (no fine-tuning in the prototype), but it is used for:
- Evaluation metrics (user satisfaction scores)
- Identifying weak SOPs that need better chunking
- Measuring system performance over time

## Module Responsibilities

| Module       | Path                    | Role                                         |
|-------------|-------------------------|----------------------------------------------|
| Agents      | `app/agents/`           | LangGraph pipeline definition and node logic |
| RAG         | `app/rag/`              | Embedding, BM25, hybrid retrieval, chunking  |
| Verifier    | `app/verifier/`         | Claim decomposition and source checking      |
| API         | `app/api/`              | FastAPI route handlers                       |
| Services    | `app/services/`         | Business logic (SOP CRUD, query processing)  |
| Models      | `app/models/`           | SQLAlchemy ORM models                        |
| Schemas     | `app/schemas/`          | Pydantic request/response schemas            |
| Database    | `app/database/`         | Async SQLAlchemy engine and session setup     |
| Evaluation  | `app/evaluation/`       | Retrieval and generation quality metrics     |
| Demo Data   | `app/demo_data/`        | Sample SOP documents for testing             |

## LLM Provider Abstraction

The system supports pluggable LLM providers via the `LLM_PROVIDER` config:

- **mock** -- Returns canned responses, no API calls (for development)
- **openai** -- OpenAI GPT-4 / GPT-3.5 via the OpenAI Python SDK
- **anthropic** -- Claude via the Anthropic SDK
- **ollama** -- Locally-hosted models via Ollama HTTP API

This abstraction allows testing without API costs and enables on-premise deployment with local models for data privacy.
