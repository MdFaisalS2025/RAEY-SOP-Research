"""
DISCLAIMER: SYNTHETIC / FICTIONAL DATA FOR RESEARCH ONLY
=========================================================
These queries and answers reference SYNTHETIC SOPs created for the
SOP-Guard research prototype.  They must NOT be used for real clinical
decisions or patient care.  Always follow your institution's approved
clinical protocols.
=========================================================
"""

DEMO_QUERIES = [
    # ---------- Sepsis (SOP-ICU-001) ----------
    {
        "query": "What is the MAP threshold for starting vasopressors in sepsis?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "threshold",
        "gold_answer": "Initiate vasopressor therapy if MAP remains <65 mmHg despite adequate fluid resuscitation.",
    },
    {
        "query": "Should blood cultures be drawn before or after starting antibiotics in sepsis?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "sequence",
        "gold_answer": "Obtain two sets of blood cultures BEFORE initiating antibiotics.",
    },
    {
        "query": "What is the first-line vasopressor for septic shock?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "general",
        "gold_answer": "Norepinephrine is the first-line vasopressor.",
    },
    {
        "query": "How much IV fluid should be given for sepsis and within what time frame?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "threshold",
        "gold_answer": "30 mL/kg of balanced crystalloid within the first 3 hours.",
    },
    {
        "query": "At what lactate level should you repeat measurement in sepsis?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "threshold",
        "gold_answer": "If lactate >2 mmol/L, repeat within 2-4 hours.",
    },
    {
        "query": "Is dopamine recommended as first-line vasopressor in sepsis?",
        "expected_sop": "SOP-ICU-001",
        "query_type": "contraindication",
        "gold_answer": "No. Dopamine is NOT recommended as first-line vasopressor except in patients with significant bradycardia.",
    },
    # ---------- Blood Transfusion (SOP-GEN-002) ----------
    {
        "query": "How often should vital signs be monitored during a blood transfusion?",
        "expected_sop": "SOP-GEN-002",
        "query_type": "threshold",
        "gold_answer": "Every 15 minutes for the first hour, then every 30 minutes until completion.",
    },
    {
        "query": "At what temperature rise should a transfusion be stopped?",
        "expected_sop": "SOP-GEN-002",
        "query_type": "threshold",
        "gold_answer": "Stop the transfusion if temperature rises >1.5 degrees C above baseline.",
    },
    {
        "query": "Can blood be transfused through the same line as lactated Ringer's?",
        "expected_sop": "SOP-GEN-002",
        "query_type": "contraindication",
        "gold_answer": "No. Avoid transfusion through the same IV line as calcium-containing solutions like lactated Ringer's.",
    },
    # ---------- Central Line (SOP-ICU-003) ----------
    {
        "query": "What skin prep solution should be used for central line insertion?",
        "expected_sop": "SOP-ICU-003",
        "query_type": "general",
        "gold_answer": "Chlorhexidine gluconate (>=2% chlorhexidine in 70% isopropyl alcohol), applied with friction for >=30 seconds, allowed to dry ~2 minutes.",
    },
    {
        "query": "Is ultrasound guidance required for internal jugular central line placement?",
        "expected_sop": "SOP-ICU-003",
        "query_type": "general",
        "gold_answer": "Yes. Ultrasound guidance is MANDATORY for internal jugular access.",
    },
    {
        "query": "When can you use a central line after insertion?",
        "expected_sop": "SOP-ICU-003",
        "query_type": "sequence",
        "gold_answer": "Do NOT use the line until chest X-ray confirms correct placement (except in emergencies).",
    },
    {
        "query": "Is central line insertion contraindicated with coagulopathy?",
        "expected_sop": "SOP-ICU-003",
        "query_type": "contraindication",
        "gold_answer": "Yes, with INR >3.0 or platelets <20,000/uL. Correct before elective insertion. Subclavian site is contraindicated when coagulopathic.",
    },
    # ---------- Hypoglycemia (SOP-ENDO-004) ----------
    {
        "query": "What is the glucose threshold for Level 1 hypoglycemia?",
        "expected_sop": "SOP-ENDO-004",
        "query_type": "threshold",
        "gold_answer": "Blood glucose <70 mg/dL (but >=54 mg/dL).",
    },
    {
        "query": "How should Level 2 hypoglycemia be treated?",
        "expected_sop": "SOP-ENDO-004",
        "query_type": "general",
        "gold_answer": "Administer D50 25 mL IV push (or glucagon 1 mg IM if no IV access). Recheck glucose in 15 minutes.",
    },
    {
        "query": "When should you recheck glucose after treating hypoglycemia?",
        "expected_sop": "SOP-ENDO-004",
        "query_type": "threshold",
        "gold_answer": "Recheck blood glucose in 15 minutes after treatment.",
    },
    {
        "query": "Can oral glucose be given to an unconscious hypoglycemic patient?",
        "expected_sop": "SOP-ENDO-004",
        "query_type": "contraindication",
        "gold_answer": "No. Do NOT give oral glucose to unconscious patients or those unable to protect their airway.",
    },
    # ---------- Anticoagulation (SOP-PHARM-005) ----------
    {
        "query": "What is the target INR for a patient with a mechanical mitral valve?",
        "expected_sop": "SOP-PHARM-005",
        "query_type": "threshold",
        "gold_answer": "INR 2.5-3.5 for mechanical mitral valve.",
    },
    {
        "query": "What should be done if INR is greater than 9 with no bleeding?",
        "expected_sop": "SOP-PHARM-005",
        "query_type": "threshold",
        "gold_answer": "Hold warfarin and give vitamin K 5 mg PO.",
    },
    {
        "query": "Is anticoagulation contraindicated in active bleeding?",
        "expected_sop": "SOP-PHARM-005",
        "query_type": "contraindication",
        "gold_answer": "Yes. Active major bleeding (GI, intracranial, retroperitoneal) is a contraindication to anticoagulation.",
    },
    {
        "query": "What is the reversal agent for dabigatran?",
        "expected_sop": "SOP-PHARM-005",
        "query_type": "general",
        "gold_answer": "Idarucizumab 5 g IV.",
    },
    # ---------- Medication Reconciliation (SOP-PHARM-006) ----------
    {
        "query": "Within what time frame should medication history be obtained on admission?",
        "expected_sop": "SOP-PHARM-006",
        "query_type": "threshold",
        "gold_answer": "Within 24 hours of admission, using at least two sources.",
    },
    {
        "query": "What medications are considered high-alert for reconciliation purposes?",
        "expected_sop": "SOP-PHARM-006",
        "query_type": "general",
        "gold_answer": "Insulin, anticoagulants, opioids, neuromuscular blocking agents, chemotherapy, concentrated KCl, and hypertonic saline (>0.9%).",
    },
    # ---------- Fall Prevention (SOP-NURS-007) ----------
    {
        "query": "What Morse Fall Scale score indicates high fall risk?",
        "expected_sop": "SOP-NURS-007",
        "query_type": "threshold",
        "gold_answer": "MFS score >=51 is high risk.",
    },
    {
        "query": "What interventions are required for high fall risk patients?",
        "expected_sop": "SOP-NURS-007",
        "query_type": "general",
        "gold_answer": "Bed alarm activated, hourly rounding (4 Ps), room near nursing station, consider 1:1 sitter, PT consult within 24h, medication review, plus all moderate-risk interventions.",
    },
    {
        "query": "Should physical restraints be used for fall prevention?",
        "expected_sop": "SOP-NURS-007",
        "query_type": "contraindication",
        "gold_answer": "No. Do NOT use physical restraints as a first-line fall prevention measure.",
    },
    # ---------- Infection Control (SOP-IC-008) ----------
    {
        "query": "What PPE is required for airborne isolation?",
        "expected_sop": "SOP-IC-008",
        "query_type": "general",
        "gold_answer": "A fitted N95 respirator (or PAPR) is required. Annual fit testing is required.",
    },
    {
        "query": "Can alcohol-based hand rub be used for C. difficile patients?",
        "expected_sop": "SOP-IC-008",
        "query_type": "contraindication",
        "gold_answer": "No. Alcohol-based rub is NOT effective against C. diff spores. Use soap and water.",
    },
    {
        "query": "How many air changes per hour are required for airborne isolation rooms?",
        "expected_sop": "SOP-IC-008",
        "query_type": "threshold",
        "gold_answer": ">=12 air changes per hour with negative pressure.",
    },
    # ---------- Code Blue (SOP-EM-009) ----------
    {
        "query": "What dose of epinephrine is given during a code and how often?",
        "expected_sop": "SOP-EM-009",
        "query_type": "threshold",
        "gold_answer": "Epinephrine 1 mg IV/IO, repeated every 3-5 minutes.",
    },
    {
        "query": "What is the correct chest compression rate during CPR?",
        "expected_sop": "SOP-EM-009",
        "query_type": "threshold",
        "gold_answer": "100-120 compressions per minute.",
    },
    {
        "query": "What is the first dose of amiodarone for refractory VF?",
        "expected_sop": "SOP-EM-009",
        "query_type": "threshold",
        "gold_answer": "300 mg IV/IO bolus (second dose 150 mg).",
    },
    {
        "query": "Should CPR be performed on a patient with a valid DNR order?",
        "expected_sop": "SOP-EM-009",
        "query_type": "contraindication",
        "gold_answer": "No. Do NOT perform CPR if a valid DNAR/DNR order is confirmed and documented.",
    },
    # ---------- Contrast Allergy (SOP-RAD-010) ----------
    {
        "query": "What is the premedication regimen for moderate contrast allergy risk?",
        "expected_sop": "SOP-RAD-010",
        "query_type": "general",
        "gold_answer": "Prednisone 50 mg PO at 13 hours, 7 hours, and 1 hour before contrast, plus diphenhydramine 50 mg PO/IV 1 hour before.",
    },
    {
        "query": "What is the epinephrine dose for a moderate contrast reaction?",
        "expected_sop": "SOP-RAD-010",
        "query_type": "threshold",
        "gold_answer": "Epinephrine 0.3 mg IM (1:1000) in the anterolateral thigh.",
    },
    {
        "query": "Is iodinated contrast safe in patients with thyroid storm?",
        "expected_sop": "SOP-RAD-010",
        "query_type": "contraindication",
        "gold_answer": "No. Do NOT administer iodinated contrast in thyroid storm or untreated hyperthyroidism without endocrinology consultation.",
    },
]
