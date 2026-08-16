# RAEY

**An AI-powered hospital SOP intelligence platform** that combines internal SOP retrieval, procedural faithfulness verification, external clinical evidence retrieval, SOP-vs-evidence comparison, version history, and governance/compliance workflows into a single conversational assistant.

> Research prototype for thesis work on clinical RAG systems. Not for clinical use. All SOP data, patients, and hospital staff referenced in the demo are synthetic.

[![CI](https://github.com/MdFaisalS2025/RAEY-SOP-Research/actions/workflows/ci.yml/badge.svg)](https://github.com/MdFaisalS2025/RAEY-SOP-Research/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](sop-guard/README.md#license)

---

## This repository contains

| Path | What it is |
|---|---|
| **[`sop-guard/`](sop-guard/)** | The application — Next.js frontend + FastAPI backend. **Start here.** Full setup, architecture, and API docs live in [`sop-guard/README.md`](sop-guard/README.md). |
| **[`sop-guard/PROFESSOR_GUIDE.md`](sop-guard/PROFESSOR_GUIDE.md)** | One-page reviewer guide: live demo link, local setup, and a guided demo script. |
| `ClinicalSOP_RAG_Research_Proposal.docx`, `Hospital_SOP_Research_Analysis.docx`, `SOP-Guard_Research_Proposal.pdf`, `SOP-Guard_Thesis_Proposal.pdf`, `SOP-Guard_Summary.pdf` | Supporting thesis/research documents for the academic submission. |
| `generate_pdf.py`, `generate_summary.py`, `generate_thesis_proposal.py` | Scripts used to generate the above PDFs from source content. |

## Quick links

- **Live demo:** _see [`sop-guard/PROFESSOR_GUIDE.md`](sop-guard/PROFESSOR_GUIDE.md) for the current deployed URL_
- **Local setup:** [`sop-guard/README.md#local-development`](sop-guard/README.md#local-development)
- **Architecture & tech stack:** [`sop-guard/README.md#architecture`](sop-guard/README.md#architecture)

## Getting the code

```bash
git clone https://github.com/MdFaisalS2025/RAEY-SOP-Research.git
cd RAEY-SOP-Research/sop-guard
```

Then follow [`sop-guard/README.md`](sop-guard/README.md) for setup.

## License

MIT — see [`sop-guard/README.md`](sop-guard/README.md#license).
