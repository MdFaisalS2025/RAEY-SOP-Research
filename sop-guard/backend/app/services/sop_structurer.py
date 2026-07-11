"""
Meridian SOP Structurer
------------------------
Regex-based extraction of steps, thresholds, and contraindications
from raw SOP text.
Research prototype  - NOT for clinical use.
"""

import re
from typing import Any


def structure_sop(raw_text: str, title: str = "") -> dict[str, Any]:
    """
    Extract structured information from raw SOP text using regex patterns.

    Returns dict with keys: title, steps, thresholds, contraindications, sections.
    """
    return {
        "title": title,
        "steps": _extract_steps(raw_text),
        "thresholds": _extract_thresholds(raw_text),
        "contraindications": _extract_contraindications(raw_text),
        "sections": _extract_sections(raw_text),
    }


def _extract_steps(text: str) -> list[dict]:
    """Extract numbered/ordered steps from text."""
    steps = []
    # Match patterns like: "Step 1:", "1.", "1)", "a.", "a)"
    patterns = [
        r"(?:Step\s+(\d+))[:\.\)]\s*(.+?)(?=(?:Step\s+\d+)|$)",
        r"(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.\s|\n\n|$)",
        r"(?:^|\n)\s*(\d+)\)\s+(.+?)(?=\n\s*\d+\)\s|\n\n|$)",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
        if matches:
            for num, content in matches:
                steps.append({
                    "step_number": int(num),
                    "text": content.strip()[:500],
                })
            break  # Use first matching pattern

    # Deduplicate by step number
    seen = set()
    unique_steps = []
    for s in steps:
        if s["step_number"] not in seen:
            seen.add(s["step_number"])
            unique_steps.append(s)

    return sorted(unique_steps, key=lambda x: x["step_number"])


def _extract_thresholds(text: str) -> list[dict]:
    """Extract numeric thresholds and clinical limits."""
    thresholds = []
    # Match patterns like: "> 90%", "< 30 mL", "within 1 hour", "between 36.5 and 37.5"
    patterns = [
        (r"([><≥≤])\s*(\d+\.?\d*)\s*(%|mL|mg|mmHg|°[CF]|hours?|minutes?|seconds?|bpm|mmol|units?)?",
         "comparison"),
        (r"within\s+(\d+\.?\d*)\s*(hours?|minutes?|seconds?|days?|mL|mg)",
         "within"),
        (r"between\s+(\d+\.?\d*)\s*(?:and|[-–])\s*(\d+\.?\d*)\s*(%|mL|mg|mmHg|°[CF]|bpm|mmol)?",
         "range"),
        (r"(?:maximum|minimum|max|min|at\s+least|no\s+more\s+than|not\s+exceed)\s+(\d+\.?\d*)\s*(%|mL|mg|mmHg|°[CF]|hours?|minutes?|bpm|mmol|units?)?",
         "limit"),
    ]

    for pattern, ptype in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            # Get surrounding context (up to 80 chars before and after)
            start = max(0, match.start() - 80)
            end = min(len(text), match.end() + 80)
            context = text[start:end].strip()
            thresholds.append({
                "type": ptype,
                "value": match.group(0).strip(),
                "context": context,
                "position": match.start(),
            })

    return thresholds


def _extract_contraindications(text: str) -> list[dict]:
    """Extract contraindications, warnings, and prohibitions."""
    contraindications = []
    patterns = [
        r"(?:do\s+not|don'?t|never|avoid|contraindicated|prohibited|must\s+not|should\s+not|shall\s+not)\s+(.{10,120}?)(?:\.|;|\n)",
        r"(?:WARNING|CAUTION|ALERT)[:\s]+(.{10,200}?)(?:\.|;|\n)",
        r"(?:if\s+(?:patient|the\s+patient)\s+(?:has|is|shows?|presents?)\s+)(.{10,120}?)(?:,\s*(?:do\s+not|avoid|stop|discontinue))",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            contraindications.append({
                "text": match.group(0).strip(),
                "detail": match.group(1).strip() if match.lastindex else match.group(0).strip(),
                "position": match.start(),
            })

    return contraindications


def _extract_sections(text: str) -> list[dict]:
    """Extract document sections/headings."""
    sections = []
    # Match heading-like patterns
    patterns = [
        r"(?:^|\n)(#{1,3}\s+.+)",
        r"(?:^|\n)([A-Z][A-Z\s]{4,60})(?:\n)",
        r"(?:^|\n)((?:Section|SECTION)\s+\d+[:\.\s].+)",
        r"(?:^|\n)(\d+\.\d*\s+[A-Z].{5,80})",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            title = match.group(1).strip()
            if len(title) > 3:
                sections.append({
                    "title": title,
                    "position": match.start(),
                })

    return sections
