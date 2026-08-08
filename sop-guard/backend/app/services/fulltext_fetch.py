"""
Meridian Guideline Full-Text Fetch (small first slice of full-text ingestion)
-------------------------------------------------------------------------------
guideline_finder.py's original design deliberately read only a guideline's
abstract, because none of PubMed/Europe PMC's *summary* endpoints expose
full text, and parsing a PDF/HTML page per publisher was flagged as real,
separate integration work. This module is that first, narrow slice of it -
not a general "ingest any guideline PDF" pipeline.

Scope, stated plainly: only Europe PMC's fullTextUrlList is wired to this
(see europepmc.py's _parse_result), and only entries whose
availabilityCode is "F" (genuinely free, no login/paywall - verified
against the real API response shape before writing this, not assumed) with
documentStyle "pdf" or "html". PubMed, CDC, WHO, and ClinicalTrials.gov are
untouched - each would need its own real full-text link discovery, which
this slice does not attempt. Reuses the PDF parser already used for
internal SOP uploads (document_parser.parse_pdf, PyMuPDF/fitz) rather than
adding a second PDF library - PyMuPDF was already a dependency.

Research prototype. Not for clinical use.
"""

import logging
import re
from typing import Optional

import httpx

from app.services.document_parser import parse_pdf

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0
#: A hard stop against something absurd (a mislabeled non-PDF resource, a
#: redirect loop landing on a large binary), not a real content-size limit -
#: genuine guideline PDFs/HTML pages are almost always well under this.
_MAX_BYTES = 5_000_000
_HTML_TAG_RE = re.compile(r"<[^>]+>")
#: Below this, treat extraction as failed rather than return near-empty
#: "full text" that would silently look complete to a caller.
_MIN_USABLE_CHARS = 200


async def fetch_full_text(url: str, document_style: str) -> Optional[str]:
    """Fetch and extract plain text from a real, freely-available guideline
    URL. Returns None on ANY failure - network error, unsupported format,
    oversized response, or extraction yielding suspiciously little text -
    never raises, matching every other evidence-fetch function in this
    codebase (integrations/*.py). Every caller must treat None as "not
    available" and fall back to the abstract-only path.

    HTML extraction here is a plain tag-strip, not a real content-extraction
    pipeline (no readability/main-content detection) - genuinely "whatever
    text is on the page" including nav/boilerplate, disclosed as such by
    the "html" fidelity this feeds into rather than presented as curated."""
    if not url or document_style not in ("pdf", "html"):
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            if document_style == "pdf":
                content = resp.content
                if len(content) > _MAX_BYTES:
                    return None
                text = parse_pdf(content)
            else:
                if len(resp.content) > _MAX_BYTES:
                    return None
                text = _HTML_TAG_RE.sub(" ", resp.text)
                text = re.sub(r"\s+", " ", text).strip()
        text = (text or "").strip()
        if len(text) < _MIN_USABLE_CHARS:
            return None
        return text
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"Full-text fetch failed for {url}: {e}")
        return None
