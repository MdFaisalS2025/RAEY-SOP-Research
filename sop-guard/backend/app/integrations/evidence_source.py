"""
Meridian Evidence Source Interface
------------------------------------
Common contract every external evidence integration (PubMed, Europe PMC,
CDC, WHO, ClinicalTrials.gov, ...) implements, so the query pipeline and
Evidence Watch page can treat them uniformly: one normalized record shape,
one way to merge + sort results by recency, and one registry to add a new
source without touching any calling code.

Normalized record fields (all sources must return dicts with at least):
  title, authors, journal, pub_date (raw string), pub_date_parsed
  ("YYYY-MM-DD" or None), url, source_type, study_type

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

#: Some public APIs (e.g. clinicaltrials.gov) return 403 Forbidden for
#: requests with no User-Agent header at all, which is httpx's default. A
#: browser-shaped UA/Accept pair avoids simple header-based bot filters,
#: though at least one of these APIs (clinicaltrials.gov) also fingerprints
#: the TLS handshake itself - no header combination fixes that; see
#: clinicaltrials.py's module docstring.
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Meridian-Research-Prototype/1.0",
    "Accept": "application/json, text/xml, */*",
}

_MONTHS = {
    name: i
    for i, name in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        start=1,
    )
}


def parse_pub_date(raw: Optional[str]) -> Optional[str]:
    """Best-effort parse of a free-text publication date into 'YYYY-MM-DD'
    (unknown month/day default to 01) so records from different evidence
    sources - which each format dates differently - can be sorted on one
    recency axis. Returns None if no year can be found."""
    if not raw:
        return None
    raw = raw.strip()

    m = re.match(r"^(\d{4})-(\d{2})(?:-(\d{2}))?", raw)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3) or "01"
        return f"{y}-{mo}-{d}"

    m = re.match(r"^(\d{4})(?:\s+([A-Za-z]{3,})\s*(\d{0,2}))?", raw)
    if m:
        y = m.group(1)
        mo_name = (m.group(2) or "")[:3].title()
        mo = _MONTHS.get(mo_name, 1)
        d = int(m.group(3)) if m.group(3) else 1
        return f"{y}-{mo:02d}-{d:02d}"

    return None


#: Coarse title-only stance heuristic (Consensus.app-style Yes/Possibly/No
#: signal), NOT a claim-vs-evidence entailment classifier - we only have
#: the title text, not the abstract or full text, from any of these APIs.
#: Purely keyword-based, same spirit as the query-classification heuristics
#: elsewhere in the pipeline (query_agent.py, evidence_sufficiency.py).
_SUPPORT_KEYWORDS = [
    "effective", "efficacy", "improves", "reduces", "reduced", "benefit",
    "recommended", "associated with improved", "successful", "superior",
    "supports", "confirmed", "significant improvement", "safe and effective",
]
_REFUTE_KEYWORDS = [
    "no evidence", "not associated", "ineffective", "no benefit",
    "no significant difference", "failed to", "contraindicated",
    "increased risk", "adverse", "not recommended", "does not improve",
    "no improvement", "lack of evidence", "insufficient evidence",
]


#: Question/connector words stripped before judging title relevance - none
#: of these carry topical signal, and leaving them in would let "what is
#: the maximum dose" match almost any title containing "dose".
_RELEVANCE_STOPWORDS = {
    "what", "which", "who", "why", "when", "how", "does", "do", "did",
    "is", "are", "was", "were", "be", "been", "the", "a", "an", "of",
    "in", "on", "for", "and", "or", "to", "should", "must", "before",
    "after", "apply", "exist", "can", "could", "would", "will", "shall",
    "this", "that", "these", "those", "with", "from", "about", "into",
}


def _significant_words(text: str) -> set[str]:
    words = re.findall(r"[a-z]{4,}", (text or "").lower())
    return {w for w in words if w not in _RELEVANCE_STOPWORDS}


#: Extra function words to drop when building an API *search* term (not when
#: judging relevance). These carry no lookup value for a literature/label
#: search and, left in, actively break some providers: openFDA builds a
#: Lucene phrase query from the term, so a raw question like
#: 'What is the protocol for jellyfish sting treatment?' becomes
#: openfda.*:"what is the protocol for jellyfish sting treatment?" - the
#: '?' and stopword soup make openFDA return 400 Bad Request instead of a
#: clean no-results 404. Stripping to the clinical content words
#: ('jellyfish sting treatment') fixes the 400 and improves relevance on
#: every source, not just openFDA.
_SEARCH_TERM_DROP = _RELEVANCE_STOPWORDS | {
    "protocol", "protocols", "procedure", "procedures", "policy",
    "step", "steps", "guideline", "guidelines", "manage", "managing",
    "give", "given", "use", "used", "using", "need", "needed", "require",
    "required", "there", "here", "our", "your", "their", "its", "some",
    "any", "all", "each", "every", "please", "tell", "show", "explain",
}

#: Characters that break the query parsers of one or more providers
#: (openFDA Lucene, Europe PMC, WHO IRIS). Removed before the term is sent.
_QUERY_BREAKING = re.compile(r'[?"\'\\:()\[\]{}^~*!/<>=&|]+')


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def pick_supporting_excerpt(abstract: str, term: str, max_chars: int = 240) -> str:
    """Pick the single most relevant sentence from an abstract, so an
    evidence card can show *why* a source supports an answer instead of
    just a title. Scored by shared significant-word overlap with the search
    term (same vocabulary the relevance gates already use), falling back to
    the first sentence when nothing scores above zero (still better than no
    excerpt) or when the abstract is too short to split meaningfully.
    Truncated to max_chars on a word boundary."""
    abstract = (abstract or "").strip()
    if not abstract:
        return ""
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(abstract) if s.strip()]
    if not sentences:
        return ""

    term_words = _significant_words(term)
    best = sentences[0]
    if term_words:
        best_score = -1
        for s in sentences:
            score = len(term_words & _significant_words(s))
            if score > best_score:
                best_score, best = score, s

    if len(best) <= max_chars:
        return best
    truncated = best[:max_chars].rsplit(" ", 1)[0]
    return truncated + "..."


def clean_search_term(term: str, max_words: int = 8, preserve_domain_terms: bool = False) -> str:
    """Turn a raw user question into a compact keyword search term for the
    external provider APIs. Strips question phrasing, function words, and
    query-parser-breaking punctuation, preserving clinical content words in
    order. Falls back to the punctuation-stripped original if nothing
    distinctive survives, so a source is never handed an empty term.

    Only for building the API request - relevance gating (is_title_relevant,
    the cross-encoder) still runs against the user's original question,
    which those judges handle better than a stripped keyword bag.

    `preserve_domain_terms=True` keeps "protocol"/"guideline"/"procedure"/
    "policy" and their plurals in the output - words _SEARCH_TERM_DROP
    otherwise strips as noise for a general evidence search, but which are
    exactly the words that matter when the caller (guideline_finder.py) is
    specifically SEEKING a guideline document rather than looking up a
    clinical fact. General evidence search (evidence_registry.search_all)
    is unaffected - this only changes behavior for callers that opt in.
    """
    if not term:
        return ""
    drop_words = _SEARCH_TERM_DROP
    if preserve_domain_terms:
        drop_words = _SEARCH_TERM_DROP - {
            "protocol", "protocols", "procedure", "procedures", "policy",
            "guideline", "guidelines",
        }
    cleaned = _QUERY_BREAKING.sub(" ", term.lower())
    words = re.findall(r"[a-z0-9][a-z0-9\-]*", cleaned)
    kept = [w for w in words if len(w) >= 3 and w not in drop_words]
    # de-dup preserving order
    seen: set[str] = set()
    deduped = [w for w in kept if not (w in seen or seen.add(w))]
    if not deduped:
        # nothing distinctive survived - fall back to the original with only
        # the parser-breaking characters removed, collapsed to single spaces
        return re.sub(r"\s+", " ", _QUERY_BREAKING.sub(" ", term)).strip()
    return " ".join(deduped[:max_words])


def is_title_relevant(term: str, title: str) -> bool:
    """Cheap relevance gate applied after fetching: does this record's
    title share at least one distinctive word with the search term?
    Source APIs (PubMed, Europe PMC, WHO IRIS, ClinicalTrials.gov) can
    all return loosely- or un-related results for a given term - broad
    automatic term expansion, weak full-text-search relevance ranking, or
    (for WHO IRIS specifically) a collection that's mostly institutional
    reports rather than clinical literature. This doesn't replace fixing
    each source's own query construction, but catches what slips through
    regardless of source. Deliberately lenient (ANY shared word, not all)
    so it screens out the clearly-unrelated case (zero overlap) without
    being a de-facto second relevance ranker."""
    term_words = _significant_words(term)
    if not term_words:
        return True  # nothing distinctive to check against - don't filter
    title_words = _significant_words(title)
    if not title_words:
        return True  # can't judge an empty/unparsed title - don't penalize it
    return bool(term_words & title_words)


#: Mirrors the frontend's gradeEvidence() in evidence-panel.tsx - kept as
#: two independent implementations (not a shared package) since frontend
#: and backend don't share a code boundary here, but the classification
#: rules must stay identical so a record's grade never disagrees between
#: what search_all() sorts by and what the UI displays.
_STRONG_STUDY_TYPES = {"Meta-Analysis", "Systematic Review", "Practice Guideline", "Guideline"}
_MODERATE_STUDY_TYPES = {"Randomized Controlled Trial", "Clinical Trial"}
_GRADE_RANK = {"Strong": 5, "Moderate": 4, "Limited": 3, "Research Only": 2, "Unknown": 1, "Outdated": 0}


def grade_evidence(record: dict) -> str:
    """Strong / Moderate / Limited / Research Only / Outdated / Unknown -
    derived entirely from fields already on the record (trust_tier,
    study_type, publication recency), same rules as the frontend badge."""
    import datetime

    pub_date_parsed = record.get("pub_date_parsed")
    year = None
    if pub_date_parsed:
        try:
            year = int(str(pub_date_parsed)[:4])
        except ValueError:
            year = None
    is_old = year is not None and (datetime.date.today().year - year) > 5

    study_type = record.get("study_type") or ""
    trust_tier = record.get("trust_tier")

    if study_type in _STRONG_STUDY_TYPES:
        return "Moderate" if is_old else "Strong"
    if trust_tier == 1:
        return "Moderate" if is_old else "Strong"
    if study_type in _MODERATE_STUDY_TYPES:
        return "Moderate"
    if trust_tier == 2:
        return "Moderate"
    if study_type == "Case Reports":
        return "Limited"
    if is_old:
        return "Outdated"
    if record.get("source_type") == "clinicaltrials":
        return "Research Only"
    if not study_type and not trust_tier:
        return "Unknown"
    return "Limited"


def evidence_grade_rank(record: dict) -> int:
    """Higher is better - used to sort highly-rated evidence to the top."""
    return _GRADE_RANK.get(grade_evidence(record), 1)


def classify_stance(title: str) -> str:
    """Best-effort 'yes' | 'no' | 'unclear' signal from a title's wording
    alone. Deliberately coarse - a real evidence-agreement read requires
    the abstract/full text and ideally an LLM judgment, neither of which
    any of these APIs' summary endpoints provide. 'unclear' is the honest
    default, not a fallback to hide - most titles are purely descriptive
    and don't state a directional finding at all."""
    t = (title or "").lower()
    supports = any(kw in t for kw in _SUPPORT_KEYWORDS)
    refutes = any(kw in t for kw in _REFUTE_KEYWORDS)
    if supports and not refutes:
        return "yes"
    if refutes and not supports:
        return "no"
    return "unclear"


class TTLCache:
    """Small in-memory TTL cache shared by evidence source implementations
    so each one doesn't reinvent request throttling/caching."""

    def __init__(self, ttl_seconds: float = 3600):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, list[dict[str, Any]]]] = {}

    def get(self, key: str) -> Optional[list[dict[str, Any]]]:
        entry = self._store.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.time() - ts > self.ttl_seconds:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: list[dict[str, Any]]) -> None:
        self._store[key] = (time.time(), value)

    def clear(self) -> None:
        self._store.clear()


class EvidenceSource(ABC):
    """Base class for a pluggable external evidence integration."""

    #: short machine name used in API params/registry keys, e.g. "pubmed"
    source_type: str = "unknown"
    #: human label for the UI, e.g. "PubMed"
    display_name: str = "Unknown"

    @abstractmethod
    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        """Search for `term` and return up to `max_results` normalized
        records, most-recent-plausible first. Must never raise - any
        network/parse failure should be caught and result in []."""
        raise NotImplementedError
