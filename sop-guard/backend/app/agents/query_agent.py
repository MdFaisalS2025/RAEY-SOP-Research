"""
Meridian Query Understanding Agent
Classifies queries, extracts entities, and determines retrieval strategy.
Research prototype. Not for clinical use.
"""

import re
from typing import Any


# Clinical abbreviations and their expansions
ABBREVIATIONS = {
    "bp": "blood pressure",
    "hr": "heart rate",
    "rr": "respiratory rate",
    "spo2": "oxygen saturation",
    "map": "mean arterial pressure",
    "cvp": "central venous pressure",
    "abg": "arterial blood gas",
    "cbc": "complete blood count",
    "bmp": "basic metabolic panel",
    "inr": "international normalized ratio",
    "ptt": "partial thromboplastin time",
    "gcs": "glasgow coma scale",
    "egfr": "estimated glomerular filtration rate",
    "crcl": "creatinine clearance",
    "bun": "blood urea nitrogen",
    "hit": "heparin-induced thrombocytopenia",
    "dvt": "deep vein thrombosis",
    "pe": "pulmonary embolism",
    "ams": "altered mental status",
    "acls": "advanced cardiac life support",
    "bls": "basic life support",
    "cpr": "cardiopulmonary resuscitation",
    "ppe": "personal protective equipment",
    "aiir": "airborne infection isolation room",
    "afb": "acid-fast bacillus",
    "npo": "nothing by mouth",
    "prn": "as needed",
    "iv": "intravenous",
    "im": "intramuscular",
    "sq": "subcutaneous",
    "po": "by mouth",
    "bid": "twice daily",
    "tid": "three times daily",
    "qid": "four times daily",
}

# Query type classification keywords
QUERY_PATTERNS = {
    "procedure_steps": {
        "keywords": ["steps", "procedure", "process", "how to", "protocol", "sequence",
                     "what do i do", "walk me through", "guide", "order of"],
        "weight": 1.0,
    },
    "threshold": {
        "keywords": ["dose", "dosage", "maximum", "minimum", "threshold", "limit",
                     "how much", "how many", "target", "range", "value", "level",
                     "rate", "mmhg", "mg", "ml", "units", "mmol", "bpm", "mcg",
                     # Delta-threshold phrasing ("what temperature RISE
                     # requires stopping a transfusion?", "SBP DROP",
                     # "HR INCREASE") - the same vocabulary entity_graph.py
                     # uses to recognize a delta reading vs. an absolute one.
                     # Real bug this fixes: without these, a query like the
                     # one above scored 0 for "threshold" (no other keyword
                     # matched) but 1.0 for "contraindication" purely because
                     # "stop" is a substring of "stopping" - so a question
                     # asking for a specific numeric value got routed to
                     # retrieve the wrong section (Contraindications instead
                     # of Thresholds), starving the chunk that actually has
                     # the answer and causing a false abstention.
                     "rise", "drop", "increase", "decrease", "fall", "change",
                     "how high", "how low", "at what point", "what point"],
        "weight": 1.0,
    },
    "contraindication": {
        "keywords": ["contraindication", "avoid", "should not", "cannot", "must not",
                     "warning", "danger", "risk", "allergy", "when not to",
                     "do not", "never", "hold", "stop", "discontinue"],
        "weight": 1.0,
    },
    "monitoring": {
        "keywords": ["monitor", "assess", "check", "observe", "watch for",
                     "vital signs", "reassess", "frequency", "how often"],
        "weight": 0.8,
    },
    "role_responsibility": {
        "keywords": ["nurse", "physician", "doctor", "pharmacist", "who should",
                     "whose responsibility", "who performs", "who administers"],
        "weight": 0.8,
    },
    "medication": {
        "keywords": ["medication", "drug", "administer", "prescribe", "dose",
                     "norepinephrine", "epinephrine", "heparin", "warfarin",
                     "insulin", "vasopressor", "antibiotic", "dextrose"],
        "weight": 0.9,
    },
}

# Role detection
ROLE_KEYWORDS = {
    "nurse": ["nurse", "nursing", "rn", "lpn"],
    "physician": ["physician", "doctor", "md", "attending", "resident", "prescriber"],
    "pharmacist": ["pharmacist", "pharmacy", "pharm"],
    "respiratory": ["respiratory", "rt", "ventilator"],
}

# Urgency detection
URGENCY_KEYWORDS = {
    "emergency": ["emergency", "code blue", "cardiac arrest", "anaphylaxis",
                  "stat", "immediately", "life-threatening", "crisis"],
    "urgent": ["urgent", "sepsis", "septic shock", "hypotension", "hemorrhage",
               "rapidly", "acute", "critical"],
}


class QueryUnderstandingAgent:
    """Analyzes user queries to guide retrieval strategy."""

    def analyze(self, query: str) -> dict[str, Any]:
        """
        Analyze a query and return classification, entities, and strategy.
        """
        q_lower = query.lower()
        tokens = set(re.findall(r"[a-z0-9]+", q_lower))

        # 1. Classify query type
        query_type = self._classify_type(q_lower, tokens)

        # 2. Detect urgency
        urgency = self._detect_urgency(q_lower)

        # 3. Detect target role
        target_role = self._detect_role(q_lower)

        # 4. Extract clinical entities
        entities = self._extract_entities(query, q_lower, tokens)

        # 5. Expand abbreviations
        expanded = self._expand_abbreviations(q_lower)

        # 6. Determine retrieval strategy
        strategy = self._plan_retrieval(query_type, entities)

        return {
            "query_type": query_type,
            "urgency": urgency,
            "target_role": target_role,
            "entities": entities,
            "expanded_query": expanded if expanded != q_lower else None,
            "retrieval_strategy": strategy,
            "trace": [
                f"Query classified as: {query_type}",
                f"Urgency: {urgency}",
                f"Target role: {target_role}",
                f"Entities found: {', '.join(entities.get('drugs', []) + entities.get('conditions', []))}",
                f"Strategy: {strategy['primary_chunk_types']}",
            ],
        }

    def _classify_type(self, q_lower: str, tokens: set) -> str:
        scores: dict[str, float] = {}
        for qtype, config in QUERY_PATTERNS.items():
            score = sum(config["weight"] for kw in config["keywords"]
                       if kw in q_lower or kw in tokens)
            scores[qtype] = score

        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "general"

    def _detect_urgency(self, q_lower: str) -> str:
        for level in ["emergency", "urgent"]:
            if any(kw in q_lower for kw in URGENCY_KEYWORDS[level]):
                return level
        return "routine"

    def _detect_role(self, q_lower: str) -> str:
        for role, keywords in ROLE_KEYWORDS.items():
            if any(kw in q_lower for kw in keywords):
                return role
        return "unknown"

    def _extract_entities(self, query: str, q_lower: str, tokens: set) -> dict:
        entities: dict[str, list] = {
            "drugs": [],
            "conditions": [],
            "numbers": [],
            "departments": [],
        }

        # Extract drug names
        drug_patterns = [
            "norepinephrine", "epinephrine", "vasopressin", "dopamine",
            "heparin", "warfarin", "enoxaparin", "insulin", "dextrose",
            "metformin", "glucagon", "hydrocortisone", "methylprednisolone",
            "diphenhydramine", "amiodarone", "lidocaine", "atropine",
        ]
        for drug in drug_patterns:
            # Word-boundary match - a plain substring check matched
            # "epinephrine" inside "norepinephrine", polluting downstream
            # consumers (e.g. the PubMed evidence search term) with an
            # unrelated second drug on every norepinephrine query.
            if re.search(r"\b" + re.escape(drug) + r"\b", q_lower):
                entities["drugs"].append(drug)

        # Extract conditions
        condition_patterns = [
            "sepsis", "septic shock", "hypotension", "hypertension",
            "hypoglycemia", "hyperglycemia", "anaphylaxis", "cardiac arrest",
            "hemorrhage", "coagulopathy", "thrombocytopenia", "renal failure",
        ]
        for cond in condition_patterns:
            if re.search(r"\b" + re.escape(cond) + r"\b", q_lower):
                entities["conditions"].append(cond)

        # Extract numbers
        numbers = re.findall(r"\d+\.?\d*", query)
        entities["numbers"] = numbers

        # Extract departments
        dept_patterns = ["icu", "emergency", "pharmacy", "nursing", "radiology",
                        "infection control", "endocrine"]
        for dept in dept_patterns:
            if dept in q_lower:
                entities["departments"].append(dept)

        return entities

    def _expand_abbreviations(self, q_lower: str) -> str:
        expanded = q_lower
        for abbr, full in ABBREVIATIONS.items():
            pattern = r"\b" + re.escape(abbr) + r"\b"
            if re.search(pattern, expanded):
                expanded = re.sub(pattern, f"{abbr} ({full})", expanded, count=1)
        return expanded

    def _plan_retrieval(self, query_type: str, entities: dict) -> dict:
        type_to_chunks = {
            "procedure_steps": ["step_sequence", "step", "section"],
            "threshold": ["threshold", "step", "section"],
            "contraindication": ["contraindication", "section", "step"],
            "monitoring": ["step", "section", "threshold"],
            "role_responsibility": ["section", "step"],
            "medication": ["threshold", "step", "contraindication"],
            "general": ["summary", "section", "step_sequence"],
        }

        return {
            "primary_chunk_types": type_to_chunks.get(query_type, type_to_chunks["general"]),
            "expand_synonyms": True,
            "boost_exact_match": bool(entities.get("drugs") or entities.get("numbers")),
            "include_contraindications": query_type in ("contraindication", "medication"),
        }
