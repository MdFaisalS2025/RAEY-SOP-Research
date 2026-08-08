"""
Meridian Guideline Full-Text Fetch (full-text ingestion)
-------------------------------------------------------------------------------
guideline_finder.py's original design deliberately read only a guideline's
abstract, because none of PubMed/Europe PMC's *summary* endpoints expose
full text, and parsing a PDF/HTML page per publisher was flagged as real,
separate integration work. This module does that fetching/extraction; each
provider integration is responsible for discovering a real, freely-fetchable
link (never fabricated) and telling this module what shape it is in.

Coverage, stated plainly: Europe PMC (via fullTextUrlList,
europepmc.py's _free_full_text_link), PubMed (via its own PMC full-text
mirror, pubmed.py's get_pmc_full_text_link - verified live that
elink.fcgi's "pubmed_pmc" linkset, not "pubmed_pmc_refs", points at a real
efetch-able JATS XML document), and WHO (via IRIS's bitstream chain,
who.py's get_iris_full_text_link - verified live: item -> bundles ->
the "ORIGINAL" bundle's bitstreams -> a real downloadable PDF). CDC and
ClinicalTrials.gov are deliberately not wired: CDC's Content Syndication
API returned zero results for multiple real clinical terms in live testing
(confirming this module's own prior limitation note), so there is no link
to fetch in the first place; ClinicalTrials.gov trial records are already
structured data returned directly by its search API, not a separate
document to fetch - "full text" doesn't apply to it the way it does to a
published guideline. Reuses the PDF parser already used for internal SOP
uploads (document_parser.parse_pdf, PyMuPDF/fitz) rather than adding a
second PDF library - PyMuPDF was already a dependency.

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
#: genuine guideline PDFs/HTML/XML pages are almost always well under this.
_MAX_BYTES = 5_000_000
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_JATS_BODY_RE = re.compile(r"<body\b[^>]*>(.*?)</body>", re.IGNORECASE | re.DOTALL)
#: Below this, treat extraction as failed rather than return near-empty
#: "full text" that would silently look complete to a caller.
_MIN_USABLE_CHARS = 200

_SUPPORTED_STYLES = ("pdf", "html", "pmc_xml")


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
    the "html" fidelity this feeds into rather than presented as curated.

    "pmc_xml" extracts only the JATS <body> element (PMC's full-text XML
    wraps front-matter, the body, and a reference list in one document; the
    front/back matter is metadata and citations, not article prose) before
    the same tag-strip - if no <body> is present at all, this returns None
    rather than fall back to stripping the whole document, which would mix
    journal/author metadata into what's presented as guideline text."""
    if not url or document_style not in _SUPPORTED_STYLES:
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
            elif document_style == "pmc_xml":
                if len(resp.content) > _MAX_BYTES:
                    return None
                body_match = _JATS_BODY_RE.search(resp.text)
                if not body_match:
                    return None
                text = _HTML_TAG_RE.sub(" ", body_match.group(1))
                text = re.sub(r"\s+", " ", text).strip()
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
