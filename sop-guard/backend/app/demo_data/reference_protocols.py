"""
Curated offline fallback reference protocols
=============================================
Used by sop_comparison.py ONLY when live guideline retrieval
(compare_sop_to_guideline) is unavailable - no network, no qualifying
provider result, or nothing extractable from the retrieved abstract. Live
retrieval is the primary path for every SOP, including SOP-ICU-001; this
dict is a stored, hand-transcribed fallback so the comparison feature still
demos something concrete without internet access, and it is always
disclosed as such (see sop_comparison.py's IllustrativeNote-style note).

Every step below carries real per-step provenance rather than a blanket
"grade: Strong": `fidelity` marks whether the text is the guideline's own
wording (verbatim) or an adjacent paraphrase, and `source_locus` says
exactly where it sits relative to the named bundle. For SOP-ICU-001, the
5 true 2021 Surviving Sepsis Campaign Hour-1 Bundle elements (lactate,
cultures, antibiotics, fluids, vasopressors) are verbatim/Strong; the other
4 steps are real SSC guideline recommendations but are not themselves
Hour-1 Bundle elements, so they are marked paraphrase/Moderate rather than
implied to carry the bundle's own authority.
"""

from __future__ import annotations

from typing import Any

REFERENCE_PROTOCOLS: dict[str, dict[str, Any]] = {
    "SOP-ICU-001": {
        "source_name": "Surviving Sepsis Campaign - Hour-1 Bundle",
        "source_type": "Professional Society Guideline",
        "publisher": "Society of Critical Care Medicine / European Society of Intensive Care Medicine",
        "year": 2021,
        "url": "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
        "steps": [
            {
                "text": "Screen for suspected sepsis",
                "fidelity": "paraphrase",
                "source_locus": "SSC guideline, adjacent recommendation - not a Hour-1 Bundle element",
                "grade": "Moderate",
            },
            {
                "text": "Measure lactate",
                "fidelity": "verbatim",
                "source_locus": "Hour-1 Bundle, element 1",
                "grade": "Strong",
            },
            {
                "text": "Obtain blood cultures before antibiotics when feasible",
                "fidelity": "verbatim",
                "source_locus": "Hour-1 Bundle, element 2",
                "grade": "Strong",
            },
            {
                "text": "Administer broad-spectrum antibiotics rapidly",
                "fidelity": "verbatim",
                "source_locus": "Hour-1 Bundle, element 3",
                "grade": "Strong",
            },
            {
                "text": "Begin fluid resuscitation when indicated",
                "fidelity": "verbatim",
                "source_locus": "Hour-1 Bundle, element 4",
                "grade": "Strong",
            },
            {
                "text": "Reassess hemodynamic status",
                "fidelity": "paraphrase",
                "source_locus": "SSC guideline, adjacent recommendation - not a Hour-1 Bundle element",
                "grade": "Moderate",
            },
            {
                "text": "Consider vasopressors if hypotension persists",
                "fidelity": "verbatim",
                "source_locus": "Hour-1 Bundle, element 5",
                "grade": "Strong",
            },
            {
                "text": "Monitor urine output and organ dysfunction",
                "fidelity": "paraphrase",
                "source_locus": "SSC guideline, adjacent recommendation - not a Hour-1 Bundle element",
                "grade": "Moderate",
            },
            {
                "text": "Escalate to ICU/critical care when needed",
                "fidelity": "paraphrase",
                "source_locus": "SSC guideline, adjacent recommendation - not a Hour-1 Bundle element",
                "grade": "Moderate",
            },
        ],
    },
}
