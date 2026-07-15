# Meridian — Reviewer Guide

A one-page guide for reviewing this project: what it is, where to try it, and a suggested walkthrough.

## Project Overview

Meridian (research codename SOP-Guard) is an AI-powered hospital SOP intelligence platform. It answers clinical staff questions by retrieving and citing approved hospital Standard Operating Procedures, verifies every generated answer against the source procedure for correctness (thresholds, step order, contraindications), and layers on governance tooling: SOP version history, SOP-vs-external-evidence comparison, committee review workflows, and compliance visibility.

The core research contribution is the **Procedural Faithfulness Verifier** — an automated check that catches wrong dosages/thresholds, missing or reordered steps, and omitted contraindications in generated answers before they're shown to a user. On the project's adversarial test suite it catches 17/17 injected violations.

All SOP content, patient scenarios, and staff accounts in this deployment are **synthetic**. This is a research prototype, not a clinical system.

## Live Demo URL

**[add the deployed URL here after completing the Deployment section of README.md]**

No login is required to explore — use any demo account below, or the "continue as demo user" shortcuts on the sign-in screen.

## Local Setup

If you'd rather run it locally than use the live demo:

```bash
git clone https://github.com/USERNAME/REPO.git
cd REPO/sop-guard
docker compose up --build
```

Open http://localhost:3000. No API keys or manual configuration required — the app runs entirely on a mock/local LLM and auto-seeded demo data out of the box.

Don't have Docker? See [`README.md#local-development`](README.md#local-development) for the two-terminal (`uvicorn` + `npm run dev`) setup instead.

**Demo sign-in:** staff ID `u1` (or `u2`/`u3`/`u4`), password `demo1234`. See [`README.md#demo-accounts`](README.md#demo-accounts) for what each role unlocks.

## Key Features

- **Conversational SOP question answering** — ask in plain language, get a cited, grounded answer with inline `[1]` `[2]` citations
- **Procedural Faithfulness Verifier** — automated threshold/sequence/contraindication checking on every generated answer, visible under "Trust Details"
- **External evidence retrieval** — live search across PubMed, Europe PMC, CDC, WHO, ClinicalTrials.gov, FDA, MedlinePlus, and CMS, opened from any answer
- **SOP vs. Internet comparison** — side-by-side comparison of the internal SOP against current external clinical guidance, with a match/partial/missing verdict per step
- **SOP version history** — full timeline of changes, committee comments, evidence used, and a version-to-version diff viewer
- **Committee review / governance workflow** — update proposals, approvals, audit trail, and compliance tracking
- **Multi-role access** — Clinical Staff, Educator, Governance & Compliance, and System Admin views with different permissions

## Demo Workflow

A suggested 5-minute walkthrough:

1. **Sign in** as `u1` (Dr. Sarah Mitchell, Clinical Staff) and open **Ask Meridian**.
2. **Ask:** *"What are the steps for sepsis management?"* — watch the pipeline animation, then review the grounded, cited answer.
3. Click **View Version History** on the answer — see the SOP's version timeline, committee comments, and try comparing two versions in the diff viewer.
4. Click **Compare SOP vs Internet** — see the internal protocol checked step-by-step against the current Surviving Sepsis Campaign guideline, with match/partial-match/gap verdicts.
5. Click **External Evidence** — see live-retrieved literature and guidance from PubMed/WHO/CDC/etc., graded by evidence strength.
6. Click **Trust Details** — see the Procedural Faithfulness Verifier's threshold/sequence/contraindication checks, confidence score, and audit metadata for this specific answer.
7. Ask a **follow-up question** in the same conversation (e.g. *"What is the maximum norepinephrine dose?"*) — note that the first answer stays fully visible; nothing is discarded as the conversation continues.
8. Sign out and sign back in as `u3` (Dr. Linda Yeo, Governance & Compliance) to see the **committee review / update proposal** workflow and compliance dashboards that a clinical-staff account doesn't have access to.

## Technologies Used

Next.js 14 / React / TypeScript / Tailwind CSS · FastAPI / SQLAlchemy / SQLite · a custom hybrid (TF-IDF + embeddings) retrieval pipeline with SOP-aware chunking · a rule-based Procedural Faithfulness Verifier · optional local LLM generation via Ollama (no third-party API ever receives hospital data). Full stack details in [`README.md#architecture`](README.md#architecture) and [`README.md#tech-stack`](README.md#tech-stack).

## Questions During Review

The codebase is documented inline throughout, and [`README.md`](README.md) covers architecture, API endpoints, and safety design in more depth. `sop-guard/docs/` has additional design notes.
