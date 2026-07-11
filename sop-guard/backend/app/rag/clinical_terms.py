"""
Meridian Clinical Terms
Synonym expansion, abbreviation mapping, and clinical NLP utilities.
Research prototype. Not for clinical use.
"""

import re
from typing import Any


# Comprehensive clinical abbreviation expansions
ABBREVIATIONS: dict[str, str] = {
    "bp": "blood pressure",
    "hr": "heart rate",
    "rr": "respiratory rate",
    "spo2": "oxygen saturation",
    "map": "mean arterial pressure",
    "cvp": "central venous pressure",
    "co": "cardiac output",
    "svr": "systemic vascular resistance",
    "abg": "arterial blood gas",
    "cbc": "complete blood count",
    "bmp": "basic metabolic panel",
    "cmp": "comprehensive metabolic panel",
    "inr": "international normalized ratio",
    "ptt": "partial thromboplastin time",
    "pt": "prothrombin time",
    "gcs": "glasgow coma scale",
    "egfr": "estimated glomerular filtration rate",
    "crcl": "creatinine clearance",
    "bun": "blood urea nitrogen",
    "hit": "heparin induced thrombocytopenia",
    "dvt": "deep vein thrombosis",
    "pe": "pulmonary embolism",
    "vte": "venous thromboembolism",
    "ams": "altered mental status",
    "acls": "advanced cardiac life support",
    "bls": "basic life support",
    "cpr": "cardiopulmonary resuscitation",
    "ppe": "personal protective equipment",
    "aiir": "airborne infection isolation room",
    "afb": "acid fast bacillus",
    "mrsa": "methicillin resistant staphylococcus aureus",
    "vre": "vancomycin resistant enterococcus",
    "cdiff": "clostridium difficile",
    "npo": "nothing by mouth",
    "prn": "as needed",
    "iv": "intravenous",
    "im": "intramuscular",
    "sq": "subcutaneous",
    "po": "by mouth",
    "bid": "twice daily",
    "tid": "three times daily",
    "qid": "four times daily",
    "sofa": "sequential organ failure assessment",
    "qsofa": "quick sequential organ failure assessment",
    "sirs": "systemic inflammatory response syndrome",
    "icu": "intensive care unit",
    "ed": "emergency department",
    "or": "operating room",
    "pacu": "post anesthesia care unit",
    "nicu": "neonatal intensive care unit",
    "cvc": "central venous catheter",
    "picc": "peripherally inserted central catheter",
    "bg": "blood glucose",
    "poc": "point of care",
    "prbc": "packed red blood cells",
    "ffp": "fresh frozen plasma",
    "d50": "dextrose 50 percent",
    "d10": "dextrose 10 percent",
    "nsr": "normal sinus rhythm",
    "vfib": "ventricular fibrillation",
    "vtach": "ventricular tachycardia",
    "pea": "pulseless electrical activity",
    "rosc": "return of spontaneous circulation",
}

# Bidirectional clinical synonym groups
SYNONYM_GROUPS: list[set[str]] = [
    {"low blood pressure", "hypotension", "low bp", "decreased map", "hemodynamic instability"},
    {"high blood pressure", "hypertension", "elevated bp", "htn"},
    {"low blood sugar", "hypoglycemia", "low glucose", "glucose below normal"},
    {"high blood sugar", "hyperglycemia", "high glucose", "elevated glucose", "elevated blood sugar"},
    {"blood thinner", "anticoagulant", "anticoagulation therapy"},
    {"infection", "sepsis", "septic", "bacteremia", "infectious disease"},
    {"septic shock", "severe sepsis", "hemodynamic sepsis"},
    {"breathing tube", "intubation", "endotracheal tube", "ett", "mechanical ventilation"},
    {"ventilator", "mechanical ventilation", "ventilatory support"},
    {"heart attack", "myocardial infarction", "mi", "stemi", "nstemi", "acute coronary syndrome"},
    {"stroke", "cerebrovascular accident", "cva", "cerebral ischemia"},
    {"kidney function", "renal function", "egfr", "creatinine clearance", "nephrology"},
    {"liver function", "hepatic function", "lfts", "hepatology"},
    {"bleeding", "hemorrhage", "hemorrhagic", "active bleeding", "blood loss"},
    {"clot", "thrombus", "thrombosis", "thromboembolism", "embolism"},
    {"allergic reaction", "anaphylaxis", "hypersensitivity", "allergy"},
    {"pain medication", "analgesic", "pain management", "pain relief"},
    {"antibiotic", "antimicrobial", "anti-infective", "antibacterial"},
    {"fluid resuscitation", "volume resuscitation", "iv fluids", "crystalloid", "fluid bolus"},
    {"vasopressor", "pressor", "vasoactive", "hemodynamic support"},
    {"chest compressions", "cpr", "cardiopulmonary resuscitation", "basic life support"},
    {"defibrillation", "cardioversion", "shock", "aed"},
    {"isolation precautions", "infection control", "ppe", "personal protective equipment"},
    {"ppe", "personal protective equipment", "gloves", "gown", "mask", "n95", "face shield", "eye protection"},
    {"airborne", "airborne isolation", "airborne precautions", "n95 respirator", "aiir", "negative pressure room"},
    {"droplet", "droplet precautions", "surgical mask", "droplet isolation"},
    {"contact", "contact precautions", "contact isolation", "gown and gloves"},
    {"fall risk", "fall prevention", "falls", "fall assessment", "morse fall scale", "fall precautions"},
    {"medication reconciliation", "med rec", "medication review", "med review"},
    {"blood transfusion", "transfusion", "blood products", "packed red blood cells", "prbc"},
    {"central line", "central venous catheter", "cvc", "central venous access", "picc", "central line insertion"},
    {"monitoring", "monitor", "vital signs", "assessment", "reassess", "observe", "watch for", "check"},
    {"hold medication", "hold", "withhold", "do not give", "skip dose", "hold insulin"},
    {"transfusion reaction", "blood reaction", "stop transfusion", "transfusion complication"},
    {"code blue", "cardiac arrest", "resuscitation", "cpr", "acls", "code"},
    {"glucose", "blood sugar", "blood glucose", "glucose level", "bg"},
    {"warfarin", "coumadin", "inr", "anticoagulation", "blood thinner"},
    {"insulin", "insulin therapy", "glycemic control", "blood sugar management"},
]


def expand_query(query: str, max_variants: int = 6) -> list[str]:
    """
    Expand a query with clinical synonyms and abbreviation expansions.
    Returns list of query variants for multi-query retrieval.
    """
    variants = [query]
    q_lower = query.lower()

    # 1. Abbreviation expansion
    expanded = _expand_abbreviations(q_lower)
    if expanded != q_lower:
        variants.append(expanded)

    # 2. Synonym expansion. Iterate groups/synonyms in a fixed (sorted)
    # order rather than raw set order: Python's string hashing is
    # randomized per-process by default, so iterating a set directly here
    # would make which synonym variants get generated - and therefore
    # retrieval results and abstention decisions - depend on the process's
    # random hash seed instead of the query text. Same query in, same
    # variants out, every time.
    for group in SYNONYM_GROUPS:
        sorted_group = sorted(group)
        for term in sorted_group:
            if term in q_lower:
                for synonym in sorted_group:
                    if synonym != term and synonym not in q_lower:
                        new_variant = q_lower.replace(term, synonym)
                        if new_variant not in variants:
                            variants.append(new_variant)
                        if len(variants) >= max_variants:
                            return variants
                break  # Only use first matching term per group

    # 3. Keyword extraction variant (just key clinical terms)
    keywords = extract_clinical_keywords(q_lower)
    if keywords:
        keyword_query = " ".join(keywords)
        if keyword_query not in variants:
            variants.append(keyword_query)

    return variants[:max_variants]


def _expand_abbreviations(text: str) -> str:
    """Expand clinical abbreviations in text."""
    result = text
    for abbr, full in ABBREVIATIONS.items():
        pattern = r"\b" + re.escape(abbr) + r"\b"
        if re.search(pattern, result, re.IGNORECASE):
            result = re.sub(pattern, f"{abbr} ({full})", result, count=1, flags=re.IGNORECASE)
    return result


def extract_clinical_keywords(text: str) -> list[str]:
    """Extract clinically significant keywords from text."""
    keywords = []

    # Drug names
    drugs = [
        "norepinephrine", "epinephrine", "vasopressin", "dopamine", "dobutamine",
        "heparin", "warfarin", "enoxaparin", "apixaban", "rivaroxaban",
        "insulin", "dextrose", "metformin", "glucagon",
        "hydrocortisone", "methylprednisolone", "prednisone",
        "diphenhydramine", "famotidine", "amiodarone", "lidocaine", "atropine",
        "vancomycin", "piperacillin", "tazobactam", "meropenem", "ceftriaxone",
        "morphine", "fentanyl", "hydromorphone", "acetaminophen", "ibuprofen",
        "propofol", "midazolam", "ketamine",
    ]

    # Clinical conditions
    conditions = [
        "sepsis", "septic shock", "hypotension", "hypertension",
        "hypoglycemia", "hyperglycemia", "anaphylaxis", "cardiac arrest",
        "hemorrhage", "coagulopathy", "thrombocytopenia", "renal failure",
        "respiratory failure", "pneumonia", "ards", "pe", "dvt",
        "stroke", "seizure", "diabetic ketoacidosis",
    ]

    # Clinical procedures
    procedures = [
        "intubation", "central line", "transfusion", "dialysis",
        "cardioversion", "defibrillation", "chest compressions",
        "isolation", "medication reconciliation",
    ]

    text_lower = text.lower()
    for term_list in [drugs, conditions, procedures]:
        for term in term_list:
            if term in text_lower:
                keywords.append(term)

    # Extract numbers with units
    numbers = re.findall(r"\d+\.?\d*\s*(?:mg|ml|mmhg|mcg|units?|hours?|minutes?|bpm|mmol|%)", text_lower)
    keywords.extend(numbers[:3])

    return keywords


def get_chunk_type_for_query(query_type: str) -> list[str]:
    """Map query classification to preferred chunk types."""
    mapping = {
        "procedure_steps": ["step_sequence", "step", "section"],
        "threshold": ["threshold", "step", "section"],
        "contraindication": ["contraindication", "section", "step"],
        "monitoring": ["step", "section", "threshold"],
        "role_responsibility": ["section", "step"],
        "medication": ["threshold", "step", "contraindication", "section"],
        "general": ["summary", "section", "step_sequence"],
    }
    return mapping.get(query_type, mapping["general"])
