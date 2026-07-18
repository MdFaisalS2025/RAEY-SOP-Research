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

    # ── Code Blue Response Protocol ──
    GoldCase(
        id="codeblue-compression-rate", category="sop",
        query="What is the correct chest compression rate during CPR?",
        expected_sop="Code Blue Response Protocol",
        reference_answer="Maintain a compression rate of 100-120 per minute throughout CPR.",
        must_include=("100-120",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="codeblue-epinephrine-dose", category="sop",
        query="What is the epinephrine dose during a code blue?",
        expected_sop="Code Blue Response Protocol",
        reference_answer="Give epinephrine 1 mg, repeated every 3-5 minutes.",
        must_include=("1 mg",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="codeblue-amiodarone", category="sop",
        query="What is the first dose of amiodarone for refractory VF?",
        expected_sop="Code Blue Response Protocol",
        reference_answer="Amiodarone first dose is 300 mg for refractory VF/pVT.",
        must_include=("300 mg",),
        acceptable_routes=("sop_library",),
    ),

    # ── Contrast Allergy and Reaction Protocol ──
    GoldCase(
        id="contrast-epi-dose", category="sop",
        query="What is the epinephrine dose for a moderate contrast reaction?",
        expected_sop="Contrast Allergy and Reaction Protocol",
        reference_answer="Give epinephrine 0.3 mg IM (1:1000) into the anterolateral thigh for a moderate reaction.",
        must_include=("0.3 mg",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="contrast-egfr-threshold", category="sop",
        query="What eGFR level requires extra caution before contrast administration?",
        expected_sop="Contrast Allergy and Reaction Protocol",
        reference_answer="An eGFR below 30 mL/min/1.73m2 requires the lowest contrast volume and ensured hydration.",
        must_include=("30 ml/min",),
        acceptable_routes=("sop_library",),
    ),

    # ── Fall Prevention Protocol ──
    GoldCase(
        id="fallrisk-high-score", category="sop",
        query="What Morse Fall Scale score indicates high fall risk?",
        expected_sop="Fall Prevention Protocol",
        reference_answer="A Morse Fall Scale score of 51 or higher indicates high risk, requiring interventions including a bed alarm and hourly rounding.",
        must_include=("51",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="fallrisk-post-fall-huddle", category="sop",
        query="How soon must a post-fall huddle occur after a patient fall?",
        expected_sop="Fall Prevention Protocol",
        reference_answer="A team huddle must occur within 1 hour of any fall.",
        must_include=("1 hour",),
        acceptable_routes=("sop_library",),
    ),

    # ── Medication Reconciliation Protocol ──
    GoldCase(
        id="medrec-bpmh-window", category="sop",
        query="How soon after admission must the best possible medication history be completed?",
        expected_sop="Medication Reconciliation Protocol",
        reference_answer="The best possible medication history (BPMH) must be completed within 24 hours of admission, obtained from at least 2 sources.",
        must_include=("24 hours",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="medrec-discrepancy-report", category="sop",
        query="How quickly must unresolved medication discrepancies be reported to the attending?",
        expected_sop="Medication Reconciliation Protocol",
        reference_answer="Unresolved discrepancies must be reported to the attending within 2 hours.",
        must_include=("2 hours",),
        acceptable_routes=("sop_library",),
    ),

    # ── Code Stroke Response Protocol ──
    GoldCase(
        id="stroke-door-to-needle", category="sop",
        query="What is the door-to-needle target for stroke thrombolysis?",
        expected_sop="Code Stroke Response Protocol",
        reference_answer="Door-to-needle should be 60 minutes or less from ED arrival to IV alteplase administration.",
        must_include=("60 minutes",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="stroke-alteplase-dose", category="sop",
        query="What is the alteplase dose for acute ischemic stroke?",
        expected_sop="Code Stroke Response Protocol",
        reference_answer="IV alteplase 0.9 mg/kg, maximum 90 mg, with 10% given as a bolus over 1 minute and the remainder infused over 60 minutes.",
        must_include=("0.9 mg/kg",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="stroke-thrombolysis-window", category="sop",
        query="What is the treatment window for IV thrombolysis in stroke?",
        expected_sop="Code Stroke Response Protocol",
        reference_answer="IV alteplase eligibility is evaluated within 4.5 hours of last known well, provided no hemorrhage is seen on CT.",
        must_include=("4.5 hours",),
        acceptable_routes=("sop_library",),
    ),

    # ── Patient Flow and Bed Management Protocol ──
    GoldCase(
        id="flow-bed-assignment-target", category="sop",
        query="How quickly should a bed be assigned after an admission order?",
        expected_sop="Patient Flow and Bed Management Protocol",
        reference_answer="A bed should be assigned within 60 minutes of the admission order.",
        must_include=("60 minutes",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="flow-red-surge", category="sop",
        query="What occupancy level triggers Red surge status?",
        expected_sop="Patient Flow and Bed Management Protocol",
        reference_answer="Red surge is triggered at 98% or higher occupancy, activating the Capacity Command Center and pausing elective admissions.",
        must_include=("98%",),
        acceptable_routes=("sop_library",),
    ),

    # ── Discharge Planning Protocol ──
    GoldCase(
        id="discharge-edd-window", category="sop",
        query="How soon must the expected date of discharge be set after admission?",
        expected_sop="Discharge Planning Protocol",
        reference_answer="The Expected Date of Discharge (EDD) must be set within 24 hours of admission.",
        must_include=("24 hours",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="discharge-followup-highrisk", category="sop",
        query="How soon must a follow-up appointment be scheduled for a high-risk discharge patient?",
        expected_sop="Discharge Planning Protocol",
        reference_answer="High-risk patients need a follow-up appointment confirmed within 7 days, before the discharge order is written.",
        must_include=("7 days",),
        acceptable_routes=("sop_library",),
    ),

    # ── Clinical Documentation Standards Policy ──
    GoldCase(
        id="docstd-hp-window", category="sop",
        query="How soon must the admission history and physical be completed?",
        expected_sop="Clinical Documentation Standards Policy",
        reference_answer="The admission history and physical must be completed within 24 hours of admission, or before any surgical procedure if sooner.",
        must_include=("24 hours",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="docstd-cosign-window", category="sop",
        query="How quickly must trainee notes be co-signed by the supervising attending?",
        expected_sop="Clinical Documentation Standards Policy",
        reference_answer="Trainee and resident notes must be co-signed within 24 hours.",
        must_include=("24 hours",),
        acceptable_routes=("sop_library",),
    ),

    # ── Internal Compliance Audit Procedure ──
    GoldCase(
        id="audit-sample-size", category="sop",
        query="What is the minimum chart sample size for a compliance audit?",
        expected_sop="Internal Compliance Audit Procedure",
        reference_answer="The sample must be a minimum of 30 charts or 10% of monthly volume, whichever is greater.",
        must_include=("30 charts",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="audit-capa-window", category="sop",
        query="How quickly must a department submit a corrective action plan after a critical audit finding?",
        expected_sop="Internal Compliance Audit Procedure",
        reference_answer="Department leadership must submit a CAPA within 10 business days of receiving a Critical or Major finding.",
        must_include=("10 business days",),
        acceptable_routes=("sop_library",),
    ),

    # ── Staff Onboarding and Credentialing Protocol ──
    GoldCase(
        id="onboard-psv-window", category="sop",
        query="How soon must primary source verification be initiated for a new hire?",
        expected_sop="Staff Onboarding and Credentialing Protocol",
        reference_answer="Primary source verification must be initiated within 5 business days of offer acceptance.",
        must_include=("5 business days",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="onboard-preceptor-period", category="sop",
        query="What is the minimum preceptor period before independent practice?",
        expected_sop="Staff Onboarding and Credentialing Protocol",
        reference_answer="A minimum 4-week supervised preceptor period is required for clinical staff before independent practice.",
        must_include=("4-week",),
        acceptable_routes=("sop_library",),
    ),

    # ── Mandatory Training Compliance Protocol ──
    GoldCase(
        id="training-newhire-deadline", category="sop",
        query="How soon after hire must core competency training be completed?",
        expected_sop="Mandatory Training Compliance Protocol",
        reference_answer="Core competency modules are due within 30 days of hire.",
        must_include=("30 days",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="training-ehr-suspension", category="sop",
        query="When is EHR access suspended for overdue training?",
        expected_sop="Mandatory Training Compliance Protocol",
        reference_answer="EHR access is suspended when core competency training becomes more than 15 days overdue.",
        must_include=("15 days",),
        acceptable_routes=("sop_library",),
    ),

    # ── Patient Safety Incident Reporting Protocol ──
    GoldCase(
        id="incident-sentinel-notify", category="sop",
        query="How quickly must a sentinel event be reported to Risk Management?",
        expected_sop="Patient Safety Incident Reporting Protocol",
        reference_answer="For a Sentinel Event, notify the House Supervisor and Risk Management immediately, within 1 hour, by phone in addition to the electronic report.",
        must_include=("1 hour",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="incident-rca-window", category="sop",
        query="How soon must a root cause analysis be completed after a sentinel event?",
        expected_sop="Patient Safety Incident Reporting Protocol",
        reference_answer="The RCA must be completed and submitted to the Patient Safety Committee within 45 days of the event.",
        must_include=("45 days",),
        acceptable_routes=("sop_library",),
    ),

    # ── Quality Improvement Review Cycle Protocol ──
    GoldCase(
        id="qi-baseline-period", category="sop",
        query="How long must baseline measurement run before a quality improvement intervention?",
        expected_sop="Quality Improvement Review Cycle Protocol",
        reference_answer="Baseline measurement must run for a minimum of 4 weeks before any intervention begins.",
        must_include=("4 weeks",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="qi-sustainment-check", category="sop",
        query="How long after adoption is a quality improvement sustainment check performed?",
        expected_sop="Quality Improvement Review Cycle Protocol",
        reference_answer="A 6-month sustainment check follows successful house-wide adoption.",
        must_include=("6-month",),
        acceptable_routes=("sop_library",),
    ),

    # ── Chemotherapy Administration Safety Protocol ──
    GoldCase(
        id="chemo-anc-threshold", category="sop",
        query="What ANC is required before giving chemotherapy?",
        expected_sop="Chemotherapy Administration Safety Protocol",
        reference_answer="The absolute neutrophil count must be at least 1500/mm3 to proceed, unless there is a documented oncologist-approved exception.",
        must_include=("1500/mm3",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="chemo-double-check", category="sop",
        query="Who must verify a chemotherapy dose before it is given?",
        expected_sop="Chemotherapy Administration Safety Protocol",
        reference_answer="Two chemotherapy-certified clinicians must complete an independent double-check of patient, drug, dose, and route immediately before administration.",
        must_include=("independent double-check",),
        acceptable_routes=("sop_library",),
    ),

    # ── Cardiogenic Shock and Vasopressor Management Protocol ──
    GoldCase(
        id="cardiogenic-ci-threshold", category="sop",
        query="What cardiac index defines cardiogenic shock?",
        expected_sop="Cardiogenic Shock and Vasopressor Management Protocol",
        reference_answer="Cardiogenic shock is defined as a cardiac index below 2.2 L/min/m2 with a pulmonary capillary wedge pressure above 18 mmHg.",
        must_include=("2.2 l/min/m2",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="cardiogenic-first-line-inotrope", category="sop",
        query="What is the first-line inotrope for cardiogenic shock?",
        expected_sop="Cardiogenic Shock and Vasopressor Management Protocol",
        reference_answer="Dobutamine is first-line, started at 2.5 mcg/kg/min and titrated to a maximum of 20 mcg/kg/min.",
        must_include=("2.5 mcg/kg/min",),
        acceptable_routes=("sop_library",),
    ),

    # ── Opioid Analgesia and Overdose Prevention Protocol ──
    GoldCase(
        id="opioid-hold-dose-trigger", category="sop",
        query="When should an opioid dose be held for sedation concerns?",
        expected_sop="Opioid Analgesia and Overdose Prevention Protocol",
        reference_answer="Hold the dose if RASS is -2 or lower, or respiratory rate is below 10 per minute.",
        must_include=("10/min",),
        acceptable_routes=("sop_library",),
    ),
    GoldCase(
        id="opioid-naloxone-dose", category="sop",
        query="What is the naloxone dose for opioid overdose reversal?",
        expected_sop="Opioid Analgesia and Overdose Prevention Protocol",
        reference_answer="Naloxone 0.04-0.4 mg IV, repeated every 2-3 minutes as needed until adequate respiratory rate and responsiveness return.",
        must_include=("0.04-0.4 mg",),
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
