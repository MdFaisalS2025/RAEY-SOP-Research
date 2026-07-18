"""
Meridian Gold-Answer Set
------------------------------------
Reference answers for measuring answer *correctness* (does it match reality),
which is distinct from faithfulness (is it grounded in the retrieved chunks)
and from routing (did it pick the right kind of answer). Faithfulness can be
perfect while the answer is still wrong or incomplete; only a reference set
catches that.

Every `must_include` fact and every reference answer here is drawn directly
from the synthetic demo SOP corpus (app/demo_data/demo_sops.py), so a "correct"
answer is defined by what the corpus actually states - not by outside clinical
knowledge the system was never given. test_gold_answers.py asserts that each
must_include fact really does appear in its expected SOP, so this file can
never drift into grading against facts the corpus doesn't support.

Categories:
  "sop"          - answerable from an approved SOP; scored on completeness
                   (must_include facts present) + correct SOP retrieved.
  "external"     - no internal SOP; correct behavior is external/no-evidence.
  "out_of_scope" - non-clinical; correct behavior is abstention.

Research prototype. Not for clinical use.
"""

from dataclasses import dataclass, field


@dataclass
class GoldCase:
    id: str
    query: str
    category: str  # "sop" | "external" | "out_of_scope"
    expected_sop: str = ""          # SOP title (sop cases)
    reference_answer: str = ""      # concise correct answer, for the LLM judge
    must_include: tuple[str, ...] = ()   # facts a correct answer must contain
    acceptable_routes: tuple[str, ...] = ()


GOLD_CASES: list[GoldCase] = [
    # ── Sepsis Management Protocol ──
    GoldCase(
        id="sepsis-norepi-start", category="sop",
        query="What is the starting dose of norepinephrine in sepsis?",
        expected_sop="Sepsis Management Protocol",
        reference_answer="Norepinephrine is first-line and started at 0.05 mcg/kg/min, titrated to maintain MAP >=65 mmHg.",
        must_include=("0.05 mcg/kg/min",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="sepsis-map-target", category="sop",
        query="What is the target mean arterial pressure in septic shock?",
        expected_sop="Sepsis Management Protocol",
        reference_answer="The MAP target is at least 65 mmHg; vasopressors are started if MAP stays below 65 mmHg after fluids.",
        must_include=("65 mmhg",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="sepsis-fluids", category="sop",
        query="What is the initial fluid resuscitation for sepsis?",
        expected_sop="Sepsis Management Protocol",
        reference_answer="Give 30 mL/kg of balanced crystalloid within the first 3 hours.",
        must_include=("30 ml/kg", "3 hour"),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="sepsis-antibiotics", category="sop",
        query="How quickly must antibiotics be given after sepsis is recognized?",
        expected_sop="Sepsis Management Protocol",
        reference_answer="Broad-spectrum IV antibiotics must be given within 1 hour of sepsis recognition.",
        must_include=("1 hour",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="sepsis-escalate", category="sop",
        query="When should sepsis care be escalated to the attending?",
        expected_sop="Sepsis Management Protocol",
        reference_answer="Escalate when MAP stays below 65 mmHg after fluids and first-line norepinephrine, when norepinephrine exceeds 0.5 mcg/kg/min, or when lactate does not clear by 50%.",
        must_include=("escalat",),
        acceptable_routes=("sop_library",),
    ),

    # ── Blood Transfusion Protocol ──
    GoldCase(
        id="transfusion-temp-stop", category="sop",
        query="What temperature rise requires stopping a transfusion?",
        expected_sop="Blood Transfusion Protocol",
        reference_answer="Stop the transfusion for a temperature rise greater than 1.5 degrees C above baseline.",
        must_include=("1.5",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="transfusion-monitoring", category="sop",
        query="How often should vital signs be monitored during a blood transfusion?",
        expected_sop="Blood Transfusion Protocol",
        reference_answer="Monitor vital signs every 15 minutes during the first hour, then every 30 minutes.",
        must_include=("15", "30"),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="transfusion-time", category="sop",
        query="What is the maximum infusion time for a unit of blood?",
        expected_sop="Blood Transfusion Protocol",
        reference_answer="A unit must be completed within 4 hours of leaving storage.",
        must_include=("4 hour",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="transfusion-contra", category="sop",
        query="What are contraindications before a blood transfusion?",
        expected_sop="Blood Transfusion Protocol",
        reference_answer="Do not transfuse ABO-incompatible products, do not proceed with documented patient refusal, and do not infuse through the same line as calcium-containing solutions.",
        must_include=("abo",),
        acceptable_routes=("sop_library",),
    ),

    # ── Insulin & Hypoglycemia ──
    GoldCase(
        id="hypo-level1", category="sop",
        query="What blood glucose defines level 1 hypoglycemia?",
        expected_sop="Insulin and Hypoglycemia Management Protocol",
        reference_answer="Level 1 hypoglycemia is a blood glucose below 70 mg/dL, treated with oral glucose if the patient can swallow.",
        must_include=("70 mg/dl",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="hypo-hold-insulin", category="sop",
        query="When should insulin be held for hypoglycemia?",
        expected_sop="Insulin and Hypoglycemia Management Protocol",
        reference_answer="Hold insulin when pre-meal glucose is below 100 mg/dL and re-evaluate.",
        must_include=("100 mg/dl",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="hypo-severe", category="sop",
        query="How is severe hypoglycemia below 54 treated if the patient cannot swallow?",
        expected_sop="Insulin and Hypoglycemia Management Protocol",
        reference_answer="Give D50 25 mL IV push or glucagon 1 mg IM, and recheck glucose in 15 minutes.",
        must_include=("glucagon", "15"),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="hypo-recheck", category="sop",
        query="How soon do you recheck glucose after treating hypoglycemia?",
        expected_sop="Insulin and Hypoglycemia Management Protocol",
        reference_answer="Recheck glucose 15 minutes after treatment.",
        must_include=("15 minute",),
        acceptable_routes=("sop_library",),
    ),

    # ── Central Line Insertion ──
    GoldCase(
        id="cvc-coagulopathy", category="sop",
        query="What INR requires correction before elective central line insertion?",
        expected_sop="Central Line Insertion Protocol",
        reference_answer="Correct coagulopathy before elective insertion if INR is above 3.0 or platelets are below 20,000/uL.",
        must_include=("3.0",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="cvc-contra", category="sop",
        query="What are contraindications to central line insertion?",
        expected_sop="Central Line Insertion Protocol",
        reference_answer="Contraindications include infection or cellulitis at the site, coagulopathy (INR >3.0 or platelets <20,000/uL), and known thrombosis of the target vessel.",
        must_include=("infection",),
        acceptable_routes=("sop_library",),
    ),

    # ── Anticoagulation ──
    GoldCase(
        id="warfarin-inr-target", category="sop",
        query="What is the target INR for DVT or atrial fibrillation on warfarin?",
        expected_sop="Anticoagulation Safety Protocol",
        reference_answer="The target INR for DVT/PE/AFib is 2.0 to 3.0.",
        must_include=("2.0", "3.0"),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="warfarin-inr-high", category="sop",
        query="What should be done if the INR is above 9?",
        expected_sop="Anticoagulation Safety Protocol",
        reference_answer="Hold warfarin and give vitamin K 5 mg PO when INR is above 9.0.",
        must_include=("vitamin k", "hold"),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="heparin-aptt", category="sop",
        query="What is the target aPTT for a heparin drip?",
        expected_sop="Anticoagulation Safety Protocol",
        reference_answer="The target aPTT for unfractionated heparin is 60 to 80 seconds.",
        must_include=("60", "80"),
        acceptable_routes=("sop_library",),
    ),

    # ── Infection Control / Isolation ──
    GoldCase(
        id="isolation-cdiff-hygiene", category="sop",
        query="What hand hygiene is required for C. diff isolation?",
        expected_sop="Infection Control Isolation Protocol",
        reference_answer="Use soap and water for C. difficile; do not rely on alcohol-based hand rub.",
        must_include=("soap and water",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="isolation-aiir", category="sop",
        query="How many air changes per hour are required for airborne isolation?",
        expected_sop="Infection Control Isolation Protocol",
        reference_answer="An airborne infection isolation room requires at least 12 air changes per hour.",
        must_include=("12",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="isolation-n95", category="sop",
        query="What PPE is required for airborne respiratory isolation?",
        expected_sop="Infection Control Isolation Protocol",
        reference_answer="A fit-tested N95 respirator is required for airborne isolation; N95s must not be used without fit testing.",
        must_include=("n95",),
        acceptable_routes=("sop_library",),
    ),

    # ── External-fallback (no internal SOP) ──
    GoldCase(
        id="ext-jellyfish", category="external",
        query="What is the protocol for jellyfish sting treatment?",
        reference_answer="No approved internal SOP covers jellyfish stings; the correct behavior is to fall back to external evidence or state no SOP was found.",
        acceptable_routes=("external_evidence", "no_evidence"),
    ),
    GoldCase(
        id="ext-heatstroke", category="external",
        query="What is the protocol for heat stroke management?",
        reference_answer="No approved internal SOP covers heat stroke; must not match the Code Stroke SOP - fall back to external evidence or no-evidence.",
        acceptable_routes=("external_evidence", "no_evidence"),
    ),
    GoldCase(
        id="ext-scorpion", category="external",
        query="What is the protocol for scorpion envenomation?",
        reference_answer="No approved internal SOP covers scorpion envenomation; fall back to external evidence or no-evidence.",
        acceptable_routes=("external_evidence", "no_evidence"),
    ),

    # ── Out-of-scope (non-clinical) ──
    GoldCase(
        id="oos-faucet", category="out_of_scope",
        query="How do I fix a leaking kitchen faucet?",
        reference_answer="Non-clinical; the system should decline as out of SOP scope and not match any SOP.",
        acceptable_routes=("no_evidence", "clarification"),
    ),
    GoldCase(
        id="oos-password", category="out_of_scope",
        query="How do I reset my laptop password?",
        reference_answer="Non-clinical; the system should decline as out of SOP scope and not match any SOP.",
        acceptable_routes=("no_evidence", "clarification"),
    ),
    GoldCase(
        id="oos-cafeteria", category="out_of_scope",
        query="What is the cafeteria menu today?",
        reference_answer="Non-clinical; the system should decline as out of SOP scope and not match any SOP.",
        acceptable_routes=("no_evidence", "clarification"),
    ),
]
