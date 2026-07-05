# Deployment Notes

> SOP-Guard deployment options and considerations.

---

## 1. Local Development

The simplest setup for development and testing.

### Requirements
- Python 3.11+
- Node.js 20+
- ~2 GB disk space (for embedding model and dependencies)

### Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The SQLite database is created automatically on first run. No external services needed.

### Mock Mode

Set `LLM_PROVIDER=mock` in `.env` to run without any API keys. The system returns canned responses, which is sufficient for UI development and integration testing.

## 2. Docker Deployment

For reproducible environments and simple deployment.

```bash
cp .env.example .env
# Edit .env with your configuration
docker-compose up --build
```

This starts:
- **backend** on port 8000 (FastAPI + uvicorn)
- **frontend** on port 3000 (Next.js)

The SQLite database file is persisted via the volume mount (`./backend:/app`).

### Production Docker Considerations

For a more robust Docker setup:
- Remove `--reload` from the backend CMD
- Use `npm run build && npm start` instead of `npm run dev` for the frontend
- Add health checks to docker-compose
- Pin exact dependency versions
- Use multi-stage builds to reduce image size

## 3. On-Premise Hospital Deployment (Concept)

For actual hospital use, the system would need to run entirely within the hospital's network to protect sensitive SOP content.

### Architecture

```
  Hospital Network (Air-gapped or VPN)
  +------------------------------------------+
  |                                          |
  |   +-------------+    +---------------+   |
  |   | SOP-Guard   |    | Local LLM     |   |
  |   | Application +--->| (Ollama /     |   |
  |   | Server      |    |  vLLM)        |   |
  |   +------+------+    +---------------+   |
  |          |                               |
  |   +------v------+                        |
  |   | PostgreSQL  |                        |
  |   | Database    |                        |
  |   +-------------+                        |
  |                                          |
  |   +-------------+                        |
  |   | Nginx       |                        |
  |   | Reverse     |                        |
  |   | Proxy + TLS |                        |
  |   +------+------+                        |
  |          |                               |
  +----------+-------------------------------+
             |
        Hospital Intranet
        (staff browsers)
```

### Key Changes from Dev Setup

| Component   | Dev                  | On-Premise                        |
|-------------|----------------------|-----------------------------------|
| Database    | SQLite               | PostgreSQL with backups            |
| LLM         | OpenAI API (cloud)   | Ollama or vLLM (local GPU)        |
| Embeddings  | In-process           | Dedicated embedding service       |
| Auth        | None                 | LDAP / Active Directory SSO       |
| TLS         | None                 | Nginx with hospital CA certs      |
| Logging     | Console              | Centralized logging (ELK / Splunk)|

### Hardware Requirements (Estimated)

- **CPU-only (small model)**: 32 GB RAM, 8 cores, 100 GB storage
- **GPU (larger model)**: Above + NVIDIA A10/A100 for local LLM inference
- **Storage**: Depends on SOP corpus size; 100 GB sufficient for most hospitals

## 4. Privacy and Security Considerations

### Data Classification

| Data Type              | Sensitivity | Handling                              |
|------------------------|-------------|---------------------------------------|
| SOP documents          | Internal    | Encrypted at rest, access-controlled  |
| User queries           | Internal    | Logged with user ID, retained for eval|
| Generated answers      | Internal    | Stored with source citations          |
| Feedback               | Internal    | Anonymized for aggregate analysis     |
| Embedding vectors      | Low         | Derived data, not human-readable      |
| LLM API calls (cloud)  | High        | Contains SOP text -- avoid if possible|

### Key Principles

1. **No patient data** -- SOP-Guard processes institutional procedures, not patient records. The system should never ingest, store, or transmit protected health information (PHI).

2. **Local LLM preferred** -- For production, use locally-hosted models (Ollama, vLLM) to avoid sending SOP content to third-party APIs. Cloud LLM APIs should only be used for development with synthetic data.

3. **Access control** -- Integrate with hospital identity systems (LDAP, Active Directory). SOPs may have department-level access restrictions.

4. **Audit logging** -- Log all queries, answers, and feedback with timestamps and user IDs for accountability and compliance.

5. **Encryption** -- TLS for all network traffic. Encrypt the database at rest if the host OS supports it.

6. **Data retention** -- Define retention policies for query logs and feedback. Allow administrators to purge old data.

### Compliance Considerations

- **HIPAA**: Not directly applicable (no PHI), but institutional policies may extend HIPAA-like controls to internal documents
- **Hospital IT policies**: Must comply with the specific hospital's information security policies
- **Data residency**: All data must remain within the hospital's jurisdiction and network
- **Vendor risk**: If using cloud LLM APIs, the hospital's vendor risk assessment process applies

### Threat Model (Simplified)

| Threat                          | Mitigation                                  |
|---------------------------------|---------------------------------------------|
| Unauthorized SOP access         | Authentication + role-based access control  |
| LLM hallucination causing harm  | Verification layer + confidence scoring     |
| SOP content leaking via API     | Local LLM deployment, no cloud APIs         |
| Query logs revealing sensitive info | Retention limits, access controls on logs |
| Model prompt injection          | Input sanitization, system prompt hardening |
