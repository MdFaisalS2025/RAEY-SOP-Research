"""
VLM boundary anchor (audit round 4, Phase 3c): a real, second attempt at
a mid-curve structure-quality anchor for section 61's curve, using native
PDF understanding rather than a layout-detection model's generic label.

Docling (audit round 3, section 70) supplied high recall (87.65%) but
low precision (25.72%) because its "section_header" label mixes running
headers, ToC entries, category headers, and per-protocol sub-headers at
a finer granularity than this study's "one header per protocol"
definition. This module tests whether that mismatch, not a genuine
boundary-finding weakness, was the actual problem - by prompting the VLM
for EXACTLY the granularity the human annotators used, reusing their own
instructions verbatim rather than inventing new prompt language.

Model: gemini-3.5-flash-lite (the only model with confirmed headroom
this study has established - baseline_b6_llm.py's gemini-2.5-flash hit
a 20-requests/day cap, gemini-2.5-flash-lite is deprecated for new
users). Called via the Gemini Files API so the model reads the actual
PDF natively, not pre-extracted text or rendered page images.

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, run_boundary_scoring.py, run_calibration.py, or
docling_boundaries.py.

Requires GEMINI_API_KEY in the environment (never read back or logged
by this module).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.vlm_boundaries <pdf_path>
"""
from __future__ import annotations

import json
import os
import re
import sys
import time

MODEL_ID = "gemini-3.5-flash-lite"

# Reused VERBATIM from build_boundary_workbooks.py's own annotator
# instructions and known-subsection list - not paraphrased, so the VLM
# is asked for the exact same granularity the human ground truth used.
KNOWN_SUBSECTIONS = (
    "Treatment Pathway, Paramedic Stop, Signs and Symptoms, AEMT Stop Here, "
    "EMT Stop Here, Paramedic, Reference, Paramedic Only, Medical Emergency, "
    "Procedure, Indications, Contraindications, Notes"
)

PROMPT = f"""You are reading through one edition of a Tennessee EMS protocol PDF and \
writing down, IN ORDER, every distinct protocol's name as you reach it - like \
building a table of contents by hand, from the document itself, not from any \
existing index.

A GUIDELINE is a distinct named clinical protocol - e.g. "Adult Cardiac Arrest", \
"Anaphylaxis", "Torsades de Pointes". Record its title exactly as printed, once, \
the first time it starts.

Do NOT record these - they are recurring SUB-HEADINGS that appear inside many \
different protocols, not protocols themselves: {KNOWN_SUBSECTIONS}.

Work through the PDF page by page, front to back. Do not skip around. Each time \
you reach a new protocol, note its title.

Reply with ONLY a JSON array of strings, one per protocol title, in document \
order - e.g. ["Adult Cardiac Arrest", "Anaphylaxis", "Torsades de Pointes"]. \
No other text, no markdown code fences, just the raw JSON array."""


def _extract_retry_delay(exc: Exception) -> float | None:
    m = re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+(?:\.\d+)?)s", str(exc))
    if m:
        return float(m.group(1))
    m = re.search(r"retry in (\d+(?:\.\d+)?)s", str(exc))
    return float(m.group(1)) if m else None


def parse_vlm_reply(reply: str) -> list[str]:
    """Parses the VLM's JSON-array reply into a title list. Strips markdown
    code fences if the model added them despite being asked not to -
    guarded, not assumed away, since the prompt cannot force compliance."""
    cleaned = reply.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    titles = json.loads(cleaned)
    if not isinstance(titles, list):
        raise ValueError(f"expected a JSON array, got {type(titles)}")
    return [str(t).strip() for t in titles if str(t).strip()]


def extract_vlm_titles(pdf_path: str, cache_path: str | None = None) -> dict:
    """Uploads the PDF to Gemini's Files API and asks for protocol titles
    in the annotators' own granularity. Returns {"titles": [...],
    "raw_reply": str, "call_succeeded": bool} - fails loudly (raises)
    rather than silently falling back, per the B6 rate-limit incident's
    corrective (baseline_b6_llm.py's call_succeeded tracking)."""
    from google import genai
    from google.genai import types

    cache: dict = {}
    if cache_path and os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)
    if cache.get("call_succeeded"):
        return cache

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    client = genai.Client(api_key=api_key)

    uploaded = client.files.upload(file=pdf_path)
    # Wait for the file to finish processing before querying it.
    while uploaded.state.name == "PROCESSING":
        time.sleep(2)
        uploaded = client.files.get(name=uploaded.name)
    if uploaded.state.name != "ACTIVE":
        raise RuntimeError(f"file upload for {pdf_path!r} ended in state "
                            f"{uploaded.state.name!r}, not ACTIVE")

    reply = None
    for attempt in range(5):
        try:
            resp = client.models.generate_content(
                model=MODEL_ID,
                contents=[uploaded, PROMPT],
                config=types.GenerateContentConfig(temperature=0.0),
            )
            reply = (resp.text or "").strip()
            break
        except Exception as e:
            delay = _extract_retry_delay(e) or (2 ** attempt)
            if attempt == 4:
                raise RuntimeError(
                    f"VLM call failed for {pdf_path!r} after 5 attempts - "
                    f"failing loudly rather than silently falling back "
                    f"(see the B6 rate-limit incident, PREREGISTRATION.md "
                    f"2026-08-18): {e}"
                ) from e
            time.sleep(delay + 1)

    titles = parse_vlm_reply(reply)
    result = {"titles": titles, "raw_reply": reply, "call_succeeded": True,
              "model": MODEL_ID, "n_titles": len(titles)}
    if cache_path:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
    return result


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    result = extract_vlm_titles(argv[1])
    print(f"{result['n_titles']} protocol titles")
    for t in result["titles"][:30]:
        print(" ", repr(t))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
