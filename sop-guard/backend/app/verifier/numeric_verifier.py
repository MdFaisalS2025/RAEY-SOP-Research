"""
Meridian Numeric-Claim Verifier
------------------------------------
A dose or threshold is the highest-stakes thing an answer can get wrong, and
it is exactly what a paraphrasing LLM is most likely to distort ("0.05" ->
"0.5", "mcg/kg/min" dropped, a value invented outright). The procedural
faithfulness verifier checks the answer against the SOP's structured steps;
this is a narrower, harder gate specifically for numbers-with-units: every
clinical value stated in the answer must appear verbatim in the retrieved
evidence it was supposedly drawn from.

Extractive answers (the mock generator) copy values straight from chunks, so
they pass trivially. The check earns its keep on real LLM output, where an
ungrounded number should never be presented as if the SOP said it.

Deliberately narrow to avoid false alarms: it only flags a number that is
paired with a recognized *clinical unit* (so citation markers, step numbers,
version tags, and years are ignored), and it matches on value+unit so a
comparator/format difference (">=65 mmHg" vs "65 mmHg") is not a mismatch.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
from typing import Any

#: Clinical units, longest-first so the alternation matches "mcg/kg/min"
#: before "mcg". Kept lowercase; matching is case-insensitive.
_UNITS = [
    "mcg/kg/min", "mg/kg/min", "mg/kg/hr", "units/kg/hr", "units/kg/min",
    "ml/kg/hr", "ml/kg/min", "units/hr", "units/min", "ml/kg", "mmol/l",
    "mg/dl", "meq/l", "mcg/min", "mg/min", "mmhg", "cmh2o", "mcg", "mg",
    "ml", "bpm", "units", "unit", "mmol", "meq", "hours", "hour", "hrs",
    "hr", "minutes", "mins", "min", "days", "day", "%",
]
_UNIT_ALT = "|".join(re.escape(u) for u in sorted(_UNITS, key=len, reverse=True))
_NUM = r"\d+(?:\.\d+)?"
# number, optional space, unit - unit must not be immediately followed by
# another letter ("min" in "minimum" must not match).
_CLAIM_RE = re.compile(rf"({_NUM})\s*({_UNIT_ALT})(?![a-z])", re.IGNORECASE)
_WS_RE = re.compile(r"\s+")


def _norm(text: str) -> str:
    return _WS_RE.sub(" ", (text or "").lower())


def extract_numeric_claims(text: str) -> list[dict[str, str]]:
    """Every (value, unit) clinical claim in `text`, de-duplicated in order."""
    seen: set[tuple[str, str]] = set()
    claims: list[dict[str, str]] = []
    for m in _CLAIM_RE.finditer(text or ""):
        value = m.group(1)
        unit = m.group(2).lower()
        key = (value, unit)
        if key in seen:
            continue
        seen.add(key)
        claims.append({"value": value, "unit": unit, "text": f"{value} {unit}"})
    return claims


def _is_supported(value: str, unit: str, evidence_blob: str) -> bool:
    """True if this value+unit appears in the evidence, tolerant of spacing
    (SOP "0.05mcg/kg/min" or "0.05 mcg/kg/min" both count)."""
    u = re.escape(unit)
    v = re.escape(value)
    return re.search(rf"{v}\s*{u}(?![a-z])", evidence_blob) is not None


def verify_numeric_claims(answer: str, chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Check every numeric clinical claim in `answer` against `chunks`.

    Returns:
        {
          "claims_total": int,
          "supported": int,
          "unsupported": [{"value","unit","text"}, ...],
          "all_grounded": bool,   # True also when there are no numeric claims
        }
    """
    claims = extract_numeric_claims(answer)
    if not claims:
        return {"claims_total": 0, "supported": 0, "unsupported": [], "all_grounded": True}

    evidence_blob = _norm(
        " ".join(c.get("text", c.get("chunk_text", "")) for c in chunks)
    )

    unsupported: list[dict[str, str]] = []
    for c in claims:
        if not _is_supported(c["value"], c["unit"], evidence_blob):
            unsupported.append(c)

    return {
        "claims_total": len(claims),
        "supported": len(claims) - len(unsupported),
        "unsupported": unsupported,
        "all_grounded": not unsupported,
    }
