"""
Meridian Entity Graph (GraphRAG-lite)
--------------------------------------
Lexicon-based entity extraction over SOP chunks and cross-SOP conflict
detection on the resulting graph. No ML dependencies.

Research prototype. Not for clinical use.
"""

import re
from typing import Any

# ~40-name drug lexicon
DRUG_LEXICON = [
    "norepinephrine", "epinephrine", "vasopressin", "dopamine", "dobutamine",
    "phenylephrine", "milrinone", "heparin", "warfarin", "enoxaparin",
    "apixaban", "rivaroxaban", "dabigatran", "insulin", "dextrose",
    "glucagon", "metformin", "hydrocortisone", "methylprednisolone",
    "prednisone", "dexamethasone", "diphenhydramine", "famotidine",
    "amiodarone", "lidocaine", "atropine", "adenosine", "vancomycin",
    "piperacillin", "tazobactam", "meropenem", "ceftriaxone", "cefepime",
    "morphine", "fentanyl", "hydromorphone", "acetaminophen", "ibuprofen",
    "propofol", "midazolam", "ketamine", "labetalol", "nicardipine",
    "naloxone",
]

# ~30-term condition lexicon
CONDITION_LEXICON = [
    "sepsis", "septic shock", "shock", "hypotension", "hypertension",
    "hypoglycemia", "hyperglycemia", "anaphylaxis", "allergy",
    "cardiac arrest", "hemorrhage", "bleeding", "coagulopathy",
    "thrombocytopenia", "renal failure", "respiratory failure",
    "pneumonia", "ards", "pulmonary embolism", "deep vein thrombosis",
    "stroke", "seizure", "diabetic ketoacidosis", "arrhythmia",
    "bradycardia", "tachycardia", "hypoxia", "acidosis", "fever",
    "delirium", "pain",
    # D6 corpus expansion: general topic-identifying terms for the three
    # new clinical domains, mirroring "pain" already being a generic
    # symptom rather than a specific disease - these ground a query to its
    # SOP's clinical topic even when no single named drug/condition is
    # present (e.g. "who must verify a chemotherapy dose" names no drug).
    "cardiogenic shock", "chemotherapy", "opioid",
]

# Dose pattern: number + unit (mcg/kg/min, units/min, units/hr, mg, mL/kg, etc.)
_DOSE_RE = re.compile(
    r"(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*"
    r"(mcg/kg/min|mcg/kg/hr|mg/kg/min|mg/kg/hr|units?/min|units?/hr|units?/kg/hr|"
    r"ml/kg/hr|ml/kg|mcg/min|mg/hr|mcg|mg|ml|units?|mmol/l|meq)\b",
    re.IGNORECASE,
)

# Threshold pattern: comparator + number + unit (MAP <65 mmHg, lactate >2 mmol/L)
# Group 2 (the text between the parameter name and the comparator) is kept
# so callers can check it for delta/change language ("drop", "increase") -
# see _is_delta_threshold below.
_THRESHOLD_RE = re.compile(
    r"\b(map|lactate|glucose|blood glucose|inr|platelets?|hemoglobin|hgb|"
    r"systolic(?:\s+bp)?|sbp|heart rate|hr|spo2|temperature|creatinine|potassium)\b"
    r"([^.\n<>]{0,20}?)"
    r"(<=|>=|<|>|below|above|less than|greater than|under|over)\s*"
    r"(\d+(?:\.\d+)?)\s*"
    r"(mmhg|mmol/l|mg/dl|g/dl|%|bpm|meq/l|c|f)?",
    re.IGNORECASE,
)

# A threshold phrased as a *change* ("SBP drop >=30 mmHg" - a transfusion-
# reaction trigger) is not comparable to the same parameter phrased as an
# *absolute* reading ("SBP >200 mmHg" - a hypertension contraindication) -
# they describe different clinical facts that happen to share a parameter
# name and unit. Without this, the conflict detector flagged exactly that
# pair as "conflicting SBP values", which isn't a real conflict.
_DELTA_WORDS_RE = re.compile(r"\b(drop|decrease|increase|rise|fall|change|delta|reduction|increment)\b", re.IGNORECASE)


def _is_delta_threshold(between_text: str) -> bool:
    return bool(_DELTA_WORDS_RE.search(between_text or ""))

_UNIT_NORMALIZE = {
    "microgram": "mcg", "micrograms": "mcg", "ug": "mcg",
    "milligram": "mg", "milligrams": "mg",
    "milliliter": "ml", "milliliters": "ml", "cc": "ml",
    "unit": "units", "u": "units",
    "unit/min": "units/min", "u/min": "units/min",
    "unit/hr": "units/hr", "u/hr": "units/hr",
    "mm hg": "mmhg",
}

# Module-level cached graph (built at startup)
_GRAPH: dict[str, list[dict]] = {}


def _normalize_unit(unit: str) -> str:
    u = (unit or "").strip().lower().replace(" ", "")
    return _UNIT_NORMALIZE.get(u, u)


def _snippet(text: str, pos: int, width: int = 90) -> str:
    start = max(0, pos - width // 2)
    return text[start:start + width].replace("\n", " ").strip()


def extract_entities(text: str) -> list[dict[str, Any]]:
    """Extract DRUG, DOSE, THRESHOLD, and CONDITION entities from chunk text."""
    entities: list[dict[str, Any]] = []
    low = text.lower()

    for drug in DRUG_LEXICON:
        for m in re.finditer(r"\b" + re.escape(drug) + r"\b", low):
            # Look for a dose within the 120 chars after the drug mention
            window = low[m.end():m.end() + 120]
            dose_m = _DOSE_RE.search(window)
            value = None
            unit = ""
            if dose_m:
                raw = dose_m.group(1)
                # For ranges take the max value (titration ceiling)
                nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", raw)]
                value = max(nums) if nums else None
                unit = _normalize_unit(dose_m.group(2))
            entities.append({
                "type": "DRUG",
                "name": drug,
                "value": value,
                "unit": unit,
                "snippet": _snippet(text, m.start()),
            })

    for m in _DOSE_RE.finditer(low):
        nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", m.group(1))]
        entities.append({
            "type": "DOSE",
            "name": _normalize_unit(m.group(2)),
            "value": max(nums) if nums else None,
            "unit": _normalize_unit(m.group(2)),
            "snippet": _snippet(text, m.start()),
        })

    for m in _THRESHOLD_RE.finditer(low):
        param = m.group(1).strip()
        entities.append({
            "type": "THRESHOLD",
            "name": param,
            "value": float(m.group(4)),
            "unit": _normalize_unit(m.group(5) or ""),
            "comparator": m.group(3),
            "is_delta": _is_delta_threshold(m.group(2)),
            "snippet": _snippet(text, m.start()),
        })

    for cond in CONDITION_LEXICON:
        if re.search(r"\b" + re.escape(cond) + r"\b", low):
            entities.append({
                "type": "CONDITION",
                "name": cond,
                "value": None,
                "unit": "",
                "snippet": _snippet(text, low.find(cond)),
            })

    return entities


def build_graph(chunks: list[dict[str, Any]]) -> dict[str, list[dict]]:
    """Build adjacency structure: entity key -> list of occurrence edges."""
    graph: dict[str, list[dict]] = {}
    for chunk in chunks:
        text = chunk.get("chunk_text") or chunk.get("text") or ""
        if not text:
            continue
        sop_id = chunk.get("sop_id", "")
        sop_title = chunk.get("sop_title", "")
        chunk_type = chunk.get("chunk_type", "section")
        try:
            for ent in extract_entities(text):
                key = f"{ent['type']}:{ent['name']}"
                graph.setdefault(key, []).append({
                    "sop_id": sop_id,
                    "sop_title": sop_title,
                    "chunk_type": chunk_type,
                    "value": ent.get("value"),
                    "unit": ent.get("unit", ""),
                    "is_delta": ent.get("is_delta", False),
                    "context_snippet": ent.get("snippet", ""),
                })
        except Exception:
            continue
    return graph


def find_conflicts(graph: dict[str, list[dict]]) -> list[dict]:
    """Find DRUG or THRESHOLD entities with different numeric values across SOPs."""
    conflicts: list[dict] = []
    seen_messages: set[str] = set()

    for key, edges in graph.items():
        etype, _, name = key.partition(":")
        if etype not in ("DRUG", "THRESHOLD"):
            continue

        # Group by (sop, unit, is_delta): keep one representative value per
        # SOP+unit+kind. is_delta is part of the key (not just a later
        # filter) so a SOP mentioning both an absolute reading and a delta
        # for the same parameter keeps both, rather than one silently
        # overwriting the other as "the" value for that SOP.
        by_sop: dict[tuple[str, str, bool], dict] = {}
        for e in edges:
            if e.get("value") is None or not e.get("unit"):
                continue
            k = (e.get("sop_id") or e.get("sop_title") or "", e["unit"], bool(e.get("is_delta")))
            if k not in by_sop:
                by_sop[k] = e

        items = list(by_sop.items())
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                (sop_a, unit_a, delta_a), edge_a = items[i]
                (sop_b, unit_b, delta_b), edge_b = items[j]
                if sop_a == sop_b or unit_a != unit_b:
                    continue
                # A delta/change threshold ("SBP drop >=30 mmHg") and an
                # absolute reading ("SBP >200 mmHg") aren't the same fact
                # even though they share a parameter name and unit -
                # comparing them as "conflicting" would be a false positive.
                if delta_a != delta_b:
                    continue
                if edge_a["value"] == edge_b["value"]:
                    continue
                severity = "critical" if etype == "DRUG" else "high"
                message = (
                    f"Conflicting {name} values: "
                    f"{edge_a['sop_title'] or sop_a} states {edge_a['value']} {unit_a}, "
                    f"{edge_b['sop_title'] or sop_b} states {edge_b['value']} {unit_b}."
                )
                if message in seen_messages:
                    continue
                seen_messages.add(message)
                conflicts.append({
                    "entity": name,
                    "type": etype,
                    "sop_a": edge_a["sop_title"] or sop_a,
                    "value_a": f"{edge_a['value']} {unit_a}",
                    "sop_b": edge_b["sop_title"] or sop_b,
                    "value_b": f"{edge_b['value']} {unit_b}",
                    "severity": severity,
                    "message": message,
                    "snippets": [edge_a["context_snippet"], edge_b["context_snippet"]],
                })
    return conflicts


def set_global_graph(graph: dict[str, list[dict]]) -> None:
    global _GRAPH
    _GRAPH = graph or {}


def get_global_graph() -> dict[str, list[dict]]:
    return _GRAPH


def init_entity_graph(chunks: list[dict[str, Any]]) -> dict[str, list[dict]]:
    """Build and cache the global entity graph. Best-effort."""
    try:
        graph = build_graph(chunks)
    except Exception:
        graph = {}
    set_global_graph(graph)
    return graph


def conflicts_for_sops(sop_ids: set[str]) -> list[dict]:
    """Conflicts from the global graph involving any of the given SOP ids/titles."""
    try:
        results = []
        for c in find_conflicts(get_global_graph()):
            if c["sop_a"] in sop_ids or c["sop_b"] in sop_ids:
                results.append(c)
        return results
    except Exception:
        return []
