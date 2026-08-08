"""
Curated offline fallback reference protocols
=============================================
Used by sop_comparison.py ONLY when live guideline retrieval
(compare_sop_to_guideline) is unavailable - no network, no qualifying
provider result, or nothing extractable from the retrieved abstract. Live
retrieval is the primary path for every SOP, including the ones below; this
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

SOP-ICU-003 and SOP-NEURO-011 below are held to the same standard, with one
honest difference worth stating plainly: their primary-source pages
(cdc.gov, stroke.org) returned HTTP 403 to a direct fetch during
verification (the same bot-mitigation already documented elsewhere in this
codebase - see cdc.py's and clinicaltrials.py's module docstrings), so
every step for these two SOPs is marked `fidelity: paraphrase` rather than
`verbatim` - each was checked against a real secondary source (an NCBI
Bookshelf/StatPearls article summarizing the same CDC bundle and AHA/ASA
guideline, respectively) rather than the primary document's own wording,
and `source_locus` says so explicitly. No step in this file is ever marked
verbatim without the primary document's own text in hand.
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
    "SOP-ICU-003": {
        "source_name": "Central Line Insertion Bundle (CLABSI Prevention)",
        "source_type": "Public Health Agency Guideline",
        "publisher": "Centers for Disease Control and Prevention",
        "year": 2011,
        "url": "https://www.cdc.gov/hai/bsi/bsi-tools/impl-central-line-bundle.html",
        "steps": [
            {
                "text": "Perform hand hygiene before insertion, with soap and water or an alcohol-based hand rub",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI insertion bundle, hand hygiene element - verified via a secondary NCBI Bookshelf/StatPearls summary of the CDC bundle, not the CDC page itself (see module docstring)",
                "grade": "Strong",
            },
            {
                "text": "Use maximal sterile barrier precautions during insertion, including a full-body drape",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI insertion bundle, aseptic technique element",
                "grade": "Strong",
            },
            {
                "text": "Disinfect the skin with 2% chlorhexidine before insertion",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI insertion bundle, skin antisepsis element",
                "grade": "Strong",
            },
            {
                "text": "Avoid the femoral vein; prefer the subclavian vein for non-tunneled catheters when clinically appropriate",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI insertion bundle, optimal catheter site selection element",
                "grade": "Strong",
            },
            {
                "text": "Use ultrasound guidance for insertion when available",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI prevention guidance, supplementary technique recommendation - not one of the core insertion-bundle elements",
                "grade": "Moderate",
            },
            {
                "text": "Review daily whether the central line is still necessary and remove it promptly once it is not",
                "fidelity": "paraphrase",
                "source_locus": "CLABSI prevention guidance, maintenance/removal element",
                "grade": "Strong",
            },
        ],
    },
    "SOP-NEURO-011": {
        "source_name": "AHA/ASA Acute Ischemic Stroke Guideline - Thrombolytic Time Targets",
        "source_type": "Professional Society Guideline",
        "publisher": "American Heart Association / American Stroke Association",
        "year": 2019,
        "url": "https://www.stroke.org/en/professionals/stroke-resources/stroke-treatments-guidelines",
        "steps": [
            {
                "text": "Achieve a door-to-needle time of 60 minutes or less for eligible patients receiving IV thrombolytic therapy",
                "fidelity": "paraphrase",
                "source_locus": "AHA/ASA acute ischemic stroke guideline, door-to-needle target - verified via a secondary NCBI Bookshelf summary of the guideline, not the AHA/ASA source page itself (see module docstring)",
                "grade": "Strong",
            },
            {
                "text": "Shorter door-to-needle times, particularly under 30 minutes, are associated with better functional outcomes",
                "fidelity": "paraphrase",
                "source_locus": "AHA/ASA acute ischemic stroke guideline, outcome-related recommendation - a stated rationale for the 60-minute target, not itself a separate mandated threshold",
                "grade": "Moderate",
            },
        ],
    },
}
