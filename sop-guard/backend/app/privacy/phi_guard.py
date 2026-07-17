"""
Meridian PHI Guard (OpenMed-inspired, rule-based)
-------------------------------------------------
Detects likely Protected Health Information (PHI) / direct identifiers in a
free-text clinical question *before* it reaches the LLM, and can redact it.

This is a **rule-based, OpenMed-inspired** detector - it takes the ideas from
OpenMed (PHI/PII detection, de-identification, local-first "clinical text
never leaves the device") without shipping OpenMed's 434M-parameter transformer
models, which are impractical for this local demo. It is a heuristic, NOT an
exhaustive or clinical-grade de-identifier; it errs toward precision so that
legitimate clinical vocabulary (drug names, doses, thresholds, SOP versions)
is never flagged, at the cost of missing some cleverly-worded identifiers.

Design goals, in priority order:
  1. Never flag ordinary clinical content. A physician asking "What is the
     maximum norepinephrine dose?" or "8 mcg/min" or "SOP v4.2" must come back
     clean - a guard that cries wolf on every question is worse than none.
  2. Catch the direct identifiers that actually show up when someone pastes
     patient context by habit: names, MRNs, SSNs, phones, emails, street
     addresses, and explicit dates of birth.
  3. Stay dependency-free (stdlib `re` only) and fast enough to run on every
     keystroke-debounced request.

Provider interface (get_phi_provider) mirrors the graceful-degradation pattern
used for the cross-encoder reranker: an optional "openmed" backend can be
selected via settings, but falls back to the rule provider with a logged
warning if the package isn't present, so the system never hard-fails.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.rag.entity_graph import DRUG_LEXICON, CONDITION_LEXICON

logger = logging.getLogger(__name__)


@dataclass
class PhiSpan:
    """One detected identifier occurrence in the source text."""

    type: str          # NAME | MRN | SSN | PHONE | EMAIL | ADDRESS | DATE
    start: int         # inclusive character offset into the original text
    end: int           # exclusive character offset
    text: str          # the exact matched substring
    replacement: str   # what redact() substitutes, e.g. "[REDACTED-MRN]"


# --- Negative guard: clinical vocabulary that must never be treated as PHI ---
# The name heuristic below keys off capitalized words; a question can legitimately
# start with or contain capitalized clinical terms ("Sepsis", "Norepinephrine",
# "ICU"). Anything in this set is exempt from the name heuristic.
_CLINICAL_TERMS: set[str] = (
    {w.lower() for term in DRUG_LEXICON for w in term.split()}
    | {w.lower() for term in CONDITION_LEXICON for w in term.split()}
    | {
        # departments / units / common clinical acronyms and nouns that get
        # capitalized at the start of a sentence or mid-question.
        "icu", "er", "ed", "or", "pacu", "nicu", "picu", "ccu", "sop", "sops",
        "protocol", "policy", "procedure", "patient", "patients", "nurse",
        "physician", "doctor", "pharmacist", "dose", "dosage", "lactate",
        "sepsis", "code", "blue", "stroke", "central", "line", "blood",
        "transfusion", "insulin", "fall", "hypoglycemia", "monitoring",
        "management", "insertion", "response", "team", "rapid", "bundle",
        "what", "when", "where", "how", "who", "why", "which", "should",
        "the", "a", "an", "is", "are", "do", "does", "can", "my", "for",
    }
)

# Common honorifics/labels that strongly signal a following proper name.
_NAME_TRIGGERS = r"(?:mr|mrs|ms|miss|dr|prof|patient|pt|name\s+is|named|for)"

# Month names for written-out dates (e.g. "January 5, 1980", "5 Jan 1980").
_MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|"
    "november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)


# --- Detection patterns (ordered; earlier, more-specific ones win overlaps) ---
# Each entry: (type, compiled regex). The capturing behavior is "match the whole
# identifier"; group(0) is used as the span.
_PATTERNS: list[tuple[str, re.Pattern]] = [
    # Email - unambiguous, do first.
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    # US SSN: 3-2-4 with separators, or a bare 9-digit run explicitly labeled.
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    # MRN / record numbers: an explicit label followed by an alphanumeric id.
    # Requires the label so we don't grab dosing numbers or lab values.
    ("MRN", re.compile(
        r"\b(?:mrn|medical\s+record(?:\s+(?:no|number|#))?|record\s+(?:no|number|#)|"
        r"account\s+(?:no|number|#)|acct)\b[:#\s]*([A-Za-z]?\d[\d-]{3,})",
        re.IGNORECASE,
    )),
    # Phone: US-style 10-digit with common separators / parens / +1.
    ("PHONE", re.compile(
        r"(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\d)"
    )),
    # Street address: number + street name + street-type suffix.
    ("ADDRESS", re.compile(
        r"\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,3}"
        r"(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|"
        r"court|ct|place|pl|way|terrace|ter|circle|cir|highway|hwy)\b\.?",
        re.IGNORECASE,
    )),
    # Dates: numeric M/D/Y (or D/M/Y) and written "Month D, YYYY" / "D Month YYYY".
    ("DATE", re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")),
    ("DATE", re.compile(
        rf"\b(?:{_MONTHS})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}\b",
        re.IGNORECASE,
    )),
    ("DATE", re.compile(
        rf"\b\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{_MONTHS})\.?\s+\d{{4}}\b",
        re.IGNORECASE,
    )),
]

# Name heuristic: an honorific/label trigger followed by 1-2 capitalized words.
# e.g. "patient John Smith", "Mr. Doe", "name is Jane R. Roe". Kept deliberately
# conservative - a trigger word is required, so ordinary capitalized clinical
# nouns at the start of a question are not swept up.
# The middle-initial group requires a trailing period ([A-Z]\.) so a lone
# capital cannot swallow the first letter of a following surname - without
# it, "John Smith" matched "John S" and left "mith" behind.
_NAME_RE = re.compile(
    rf"\b{_NAME_TRIGGERS}\b[.:]?\s+((?:[A-Z][a-zA-Z'’-]+)(?:\s+[A-Z]\.)*(?:\s+[A-Z][a-zA-Z'’-]+){{0,2}})"
)


class PhiDetectionProvider(ABC):
    """Pluggable PHI detector. Implementations return non-overlapping spans."""

    name: str = "base"

    @abstractmethod
    def detect(self, text: str) -> list[PhiSpan]:
        ...


class RuleBasedPhiProvider(PhiDetectionProvider):
    """Fast, dependency-free regex/heuristic PHI detector. Default provider."""

    name = "rule-based"

    def detect(self, text: str) -> list[PhiSpan]:
        if not text or not text.strip():
            return []

        spans: list[PhiSpan] = []

        for phi_type, pattern in _PATTERNS:
            for m in pattern.finditer(text):
                # For labeled patterns (MRN) the identifier is in group 1; for
                # the rest the whole match is the identifier.
                if m.groups():
                    start, end = m.start(1), m.end(1)
                else:
                    start, end = m.start(), m.end()
                spans.append(PhiSpan(
                    type=phi_type, start=start, end=end,
                    text=text[start:end], replacement=f"[REDACTED-{phi_type}]",
                ))

        # Name heuristic - skip any candidate that is purely clinical vocabulary
        # (e.g. a trigger like "for" followed by "Sepsis Management").
        for m in _NAME_RE.finditer(text):
            candidate = m.group(1)
            words = [w for w in re.split(r"\s+", candidate) if w]
            non_clinical = [w for w in words if w.strip(".'’-").lower() not in _CLINICAL_TERMS]
            if not non_clinical:
                continue
            spans.append(PhiSpan(
                type="NAME", start=m.start(1), end=m.end(1),
                text=candidate, replacement="[REDACTED-NAME]",
            ))

        return _dedupe_overlapping(spans)


class _OpenMedUnavailable(PhiDetectionProvider):
    """Placeholder selected when PHI_PROVIDER_BACKEND=openmed but the optional
    OpenMed adapter/package isn't installed. Never used directly - get_phi_provider
    logs a warning and hands back the rule provider instead."""

    name = "openmed-unavailable"

    def detect(self, text: str) -> list[PhiSpan]:  # pragma: no cover - never reached
        return RuleBasedPhiProvider().detect(text)


def _dedupe_overlapping(spans: list[PhiSpan]) -> list[PhiSpan]:
    """Keep the earliest, longest span on any overlap so redaction offsets stay
    clean (e.g. an ADDRESS number shouldn't also surface as a bare DATE)."""
    if not spans:
        return []
    ordered = sorted(spans, key=lambda s: (s.start, -(s.end - s.start)))
    kept: list[PhiSpan] = []
    last_end = -1
    for s in ordered:
        if s.start >= last_end:
            kept.append(s)
            last_end = s.end
    return kept


def redact(text: str, spans: list[PhiSpan]) -> str:
    """Replace each detected span with its placeholder. Applies right-to-left so
    earlier offsets remain valid as the string is rewritten."""
    if not spans:
        return text
    out = text
    for s in sorted(spans, key=lambda s: s.start, reverse=True):
        out = out[: s.start] + s.replacement + out[s.end:]
    return out


# --- Provider factory (graceful degradation, mirrors get_reranker) ---
_shared: PhiDetectionProvider | None = None


def get_phi_provider(backend: str | None = None) -> PhiDetectionProvider:
    """Return the configured PHI provider. Defaults to the rule-based detector.

    backend="openmed" is honored only if a real adapter is importable; otherwise
    we log a warning and fall back to the rule provider, so selecting an
    unavailable backend degrades to working behavior rather than crashing.
    """
    global _shared
    if backend is None:
        from app.config import settings
        backend = settings.PHI_PROVIDER_BACKEND

    if backend == "openmed":
        # No OpenMed adapter is bundled in this deployment. Kept as a documented
        # extension point (see module docstring) rather than a silent no-op.
        logger.warning(
            "PHI_PROVIDER_BACKEND=openmed requested but no OpenMed adapter is "
            "installed; falling back to the rule-based PHI provider."
        )
        return RuleBasedPhiProvider()

    if _shared is None:
        _shared = RuleBasedPhiProvider()
    return _shared


def scan(text: str, backend: str | None = None) -> dict:
    """Convenience one-shot used by the API/audit paths: detect + redact in one
    call, returning a JSON-serializable summary. Never returns the raw PHI in a
    form intended for logging - callers that log should use `types`/counts only.
    """
    provider = get_phi_provider(backend)
    spans = provider.detect(text)
    return {
        "has_phi": bool(spans),
        "provider": provider.name,
        "spans": [
            {"type": s.type, "start": s.start, "end": s.end} for s in spans
        ],
        "types": sorted({s.type for s in spans}),
        "redacted_text": redact(text, spans),
    }
