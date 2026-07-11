"""
DISCLAIMER: SYNTHETIC / FICTIONAL STANDARD OPERATING PROCEDURES
================================================================
These SOPs are entirely SYNTHETIC and created solely for RESEARCH and
DEMONSTRATION purposes as part of the Meridian prototype.  They must
NOT be used for real clinical decisions, patient care, or medical practice.
No guarantee of medical accuracy is made.  Always follow your institution's
approved, peer-reviewed clinical protocols.
================================================================
"""

DEMO_SOPS = [
    # ------------------------------------------------------------------ 1
    {
        "sop_id": "SOP-ICU-001",
        "title": "Sepsis Management Protocol",
        "department": "ICU",
        "version": "3.1",
        "effective_date": "2025-01-15",
        "review_date": "2026-06-01",
        "raw_text": (
            "SEPSIS MANAGEMENT PROTOCOL - ICU\n"
            "Version 3.1 | Effective 2025-01-15\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol establishes a standardized approach to the early identification "
            "and management of sepsis and septic shock in the intensive care unit.\n\n"
            "2. SCOPE\n"
            "Applies to all adult patients (>=18 years) admitted to the ICU with suspected "
            "or confirmed sepsis.\n\n"
            "3. DEFINITIONS\n"
            "Sepsis: life-threatening organ dysfunction caused by a dysregulated host "
            "response to infection (Sepsis-3 criteria, SOFA score >=2).\n"
            "Septic Shock: sepsis with persistent hypotension requiring vasopressors to "
            "maintain MAP >=65 mmHg AND serum lactate >2 mmol/L despite adequate fluid "
            "resuscitation.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Screen for sepsis using qSOFA (altered mentation, systolic BP <=100 mmHg, "
            "respiratory rate >=22/min). If qSOFA >=2, proceed to full SOFA assessment.\n"
            "Step 2: Obtain TWO sets of blood cultures (aerobic and anaerobic) from two "
            "separate venipuncture sites BEFORE initiating antimicrobial therapy.\n"
            "Step 3: Measure serum lactate level. If lactate >2 mmol/L, repeat within 2-4 hours.\n"
            "Step 4: Administer broad-spectrum intravenous antibiotics within ONE hour of "
            "sepsis recognition. Do NOT delay antibiotics beyond 1 hour.\n"
            "Step 5: Begin rapid intravenous fluid resuscitation with 30 mL/kg of balanced "
            "crystalloid solution (e.g., lactated Ringer's) within the first 3 hours.\n"
            "Step 6: Reassess hemodynamic status after initial fluid bolus. Assess skin "
            "perfusion, capillary refill, heart rate, blood pressure, urine output "
            "(target >=0.5 mL/kg/hr), and lactate clearance.\n"
            "Step 7: If MAP remains <65 mmHg despite adequate fluid resuscitation, initiate "
            "vasopressor therapy. Norepinephrine is the FIRST-LINE vasopressor. Start at "
            "0.05 mcg/kg/min and titrate to maintain MAP >=65 mmHg.\n"
            "Step 8: If norepinephrine dose exceeds 0.5 mcg/kg/min, add vasopressin "
            "0.03 units/min as a second agent.\n"
            "Step 9: Consider hydrocortisone 200 mg IV daily (50 mg q6h) if hemodynamic "
            "instability persists despite adequate vasopressor and fluid therapy.\n"
            "Step 10: Obtain source control (e.g., drain abscess, remove infected device) "
            "as soon as medically feasible, ideally within 6-12 hours.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- MAP target: >=65 mmHg (initiate vasopressor if MAP <65 mmHg)\n"
            "- Lactate: >2 mmol/L triggers repeat measurement and aggressive resuscitation\n"
            "- Fluid resuscitation: 30 mL/kg crystalloid within 3 hours\n"
            "- Antibiotics: within 1 hour of recognition\n"
            "- Urine output target: >=0.5 mL/kg/hr\n\n"
            "6. CONTRAINDICATIONS AND CAUTIONS\n"
            "- Do NOT administer antibiotics before obtaining blood cultures unless patient "
            "is in extremis.\n"
            "- Use caution with aggressive fluid resuscitation in patients with known "
            "congestive heart failure or end-stage renal disease.\n"
            "- Vasopressin should NOT be used as a sole first-line vasopressor.\n"
            "- Dopamine is NOT recommended as first-line vasopressor except in patients "
            "with significant bradycardia.\n\n"
            "7. DOCUMENTATION\n"
            "Document time of sepsis recognition, time of blood culture collection, "
            "time of first antibiotic dose, fluid volumes administered, and vasopressor "
            "initiation in the electronic medical record.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Screen with qSOFA (altered mentation, SBP <=100, RR >=22). If qSOFA >=2, perform full SOFA assessment."},
                {"step": 2, "action": "Obtain TWO sets of blood cultures (aerobic and anaerobic) from two separate sites BEFORE starting antibiotics."},
                {"step": 3, "action": "Measure serum lactate. If >2 mmol/L, repeat within 2-4 hours."},
                {"step": 4, "action": "Administer broad-spectrum IV antibiotics within 1 hour of sepsis recognition."},
                {"step": 5, "action": "Begin IV fluid resuscitation with 30 mL/kg balanced crystalloid within 3 hours."},
                {"step": 6, "action": "Reassess hemodynamic status: perfusion, capillary refill, HR, BP, urine output (>=0.5 mL/kg/hr), lactate clearance."},
                {"step": 7, "action": "If MAP <65 mmHg after fluids, start norepinephrine (first-line) at 0.05 mcg/kg/min, titrate to MAP >=65."},
                {"step": 8, "action": "If norepinephrine >0.5 mcg/kg/min, add vasopressin 0.03 units/min."},
                {"step": 9, "action": "Consider hydrocortisone 200 mg IV daily if instability persists despite vasopressors and fluids."},
                {"step": 10, "action": "Obtain source control within 6-12 hours."},
            ],
            "thresholds": [
                {"parameter": "MAP", "value": ">=65 mmHg", "action": "Initiate vasopressor if MAP <65 mmHg"},
                {"parameter": "Lactate", "value": ">2 mmol/L", "action": "Repeat within 2-4 hours, aggressive resuscitation"},
                {"parameter": "Fluid resuscitation", "value": "30 mL/kg", "action": "Administer crystalloid within 3 hours"},
                {"parameter": "Antibiotic timing", "value": "<=1 hour", "action": "Administer within 1 hour of recognition"},
                {"parameter": "Urine output", "value": ">=0.5 mL/kg/hr", "action": "Target during resuscitation"},
            ],
            "contraindications": [
                "Do NOT give antibiotics before obtaining blood cultures unless patient is in extremis.",
                "Use caution with aggressive fluids in patients with CHF or ESRD.",
                "Vasopressin must NOT be used as sole first-line vasopressor.",
                "Dopamine is NOT recommended as first-line vasopressor except with significant bradycardia.",
            ],
        },
    },
    # ------------------------------------------------------------------ 2
    {
        "sop_id": "SOP-GEN-002",
        "title": "Blood Transfusion Protocol",
        "department": "General",
        "version": "2.4",
        "effective_date": "2025-02-01",
        "review_date": "2026-07-20",
        "raw_text": (
            "BLOOD TRANSFUSION PROTOCOL - GENERAL\n"
            "Version 2.4 | Effective 2025-02-01\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To ensure safe administration of blood products and timely recognition of "
            "transfusion reactions.\n\n"
            "2. SCOPE\n"
            "All clinical staff administering blood products to adult patients.\n\n"
            "3. PRE-TRANSFUSION REQUIREMENTS\n"
            "Step 1: Verify physician order for blood product transfusion, including "
            "product type, quantity, and rate of infusion.\n"
            "Step 2: Obtain informed consent from the patient or authorized representative. "
            "Document consent in the medical record.\n"
            "Step 3: Collect a blood sample for type and crossmatch. Label the sample at "
            "the bedside with two patient identifiers (name and MRN). Crossmatch must be "
            "completed and verified before any non-emergency transfusion.\n"
            "Step 4: Review the patient's transfusion history and any prior reactions.\n"
            "Step 5: Obtain baseline vital signs: temperature, heart rate, blood pressure, "
            "respiratory rate, and SpO2.\n\n"
            "4. ADMINISTRATION\n"
            "Step 6: Two qualified staff members must independently verify at the bedside: "
            "patient identity (two identifiers), blood product unit number, ABO/Rh "
            "compatibility, expiration date, and visual inspection of the unit.\n"
            "Step 7: Begin transfusion slowly at 2 mL/min for the first 15 minutes.\n"
            "Step 8: Monitor vital signs at the following intervals: 15 minutes after start, "
            "then every 15 minutes for the first hour, then every 30 minutes until completion.\n"
            "Step 9: Each unit of packed red blood cells must be infused within 4 hours of "
            "removal from controlled storage. Do NOT exceed 4 hours.\n"
            "Step 10: Administer through a standard blood administration set with a "
            "170-260 micron filter.\n\n"
            "5. MONITORING FOR TRANSFUSION REACTIONS\n"
            "Step 11: STOP the transfusion immediately if any of the following occur:\n"
            "  - Temperature rise >1.5 degrees C (or >2.7 degrees F) above baseline\n"
            "  - Fever (temperature >=38.5 degrees C) with rigors\n"
            "  - Urticaria, hives, or anaphylactic symptoms\n"
            "  - Hypotension (SBP drop >=30 mmHg from baseline)\n"
            "  - Tachycardia (HR increase >=20 bpm from baseline)\n"
            "  - Dyspnea, wheezing, or oxygen desaturation\n"
            "  - Hemoglobinuria (dark or red urine)\n"
            "Step 12: If reaction suspected: maintain IV access, notify physician, send "
            "blood unit and fresh blood sample to blood bank, document reaction.\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Transfusion is contraindicated when patient has a documented refusal "
            "(e.g., religious objection) without a court order override.\n"
            "- Do NOT transfuse ABO-incompatible blood products.\n"
            "- Avoid transfusion through the same IV line as calcium-containing solutions "
            "(e.g., lactated Ringer's) as this may cause clotting.\n"
            "- Do NOT use blood products that have been out of controlled storage for "
            ">30 minutes without verification.\n\n"
            "7. DOCUMENTATION\n"
            "Document: consent, pre-transfusion vitals, two-person verification, "
            "start/end times, volume infused, all vital sign checks, and any reactions.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Verify physician order for blood product type, quantity, and rate."},
                {"step": 2, "action": "Obtain and document informed consent."},
                {"step": 3, "action": "Collect sample for type and crossmatch; label at bedside with two identifiers."},
                {"step": 4, "action": "Review transfusion history and prior reactions."},
                {"step": 5, "action": "Obtain baseline vitals: temp, HR, BP, RR, SpO2."},
                {"step": 6, "action": "Two staff independently verify: patient ID, unit number, ABO/Rh, expiration, visual inspection."},
                {"step": 7, "action": "Begin transfusion slowly at 2 mL/min for first 15 minutes."},
                {"step": 8, "action": "Monitor vitals q15min for first hour, then q30min until complete."},
                {"step": 9, "action": "Infuse each pRBC unit within 4 hours of leaving storage."},
                {"step": 10, "action": "Use blood administration set with 170-260 micron filter."},
                {"step": 11, "action": "STOP transfusion if: temp rise >1.5 degrees C, fever >=38.5 degrees C with rigors, urticaria/anaphylaxis, SBP drop >=30 mmHg, HR increase >=20 bpm, dyspnea/desaturation, hemoglobinuria."},
                {"step": 12, "action": "If reaction: maintain IV, notify physician, send unit and sample to blood bank, document."},
            ],
            "thresholds": [
                {"parameter": "Temperature rise", "value": ">1.5 degrees C above baseline", "action": "Stop transfusion immediately"},
                {"parameter": "SBP drop", "value": ">=30 mmHg from baseline", "action": "Stop transfusion immediately"},
                {"parameter": "HR increase", "value": ">=20 bpm from baseline", "action": "Stop transfusion immediately"},
                {"parameter": "Infusion time", "value": "<=4 hours per unit", "action": "Must complete within 4 hours of leaving storage"},
                {"parameter": "Vital sign monitoring", "value": "q15min first hour, q30min after", "action": "Continuous monitoring"},
            ],
            "contraindications": [
                "Documented patient refusal without court order override.",
                "ABO-incompatible blood products.",
                "Do NOT infuse through same line as calcium-containing solutions (e.g., lactated Ringer's).",
                "Do NOT use blood out of controlled storage >30 minutes without verification.",
            ],
        },
    },
    # ------------------------------------------------------------------ 3
    {
        "sop_id": "SOP-ICU-003",
        "title": "Central Line Insertion Protocol",
        "department": "ICU",
        "version": "4.0",
        "effective_date": "2025-03-01",
        "review_date": "2026-08-01",
        "raw_text": (
            "CENTRAL LINE INSERTION PROTOCOL - ICU\n"
            "Version 4.0 | Effective 2025-03-01\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To standardize central venous catheter (CVC) insertion to minimize "
            "central line-associated bloodstream infections (CLABSI) and mechanical "
            "complications.\n\n"
            "2. SCOPE\n"
            "All physicians, advanced practice providers, and trainees inserting "
            "central venous catheters in the ICU.\n\n"
            "3. INDICATIONS\n"
            "- Vasopressor administration\n"
            "- Hemodynamic monitoring (CVP)\n"
            "- Inadequate peripheral access\n"
            "- Administration of hypertonic solutions or total parenteral nutrition\n"
            "- Hemodialysis access\n\n"
            "4. PRE-PROCEDURE\n"
            "Step 1: Verify indication and obtain informed consent. Document in chart.\n"
            "Step 2: Perform a procedural time-out confirming patient identity, procedure, "
            "site, and laterality.\n"
            "Step 3: Position the patient appropriately. For subclavian or internal jugular "
            "access, place patient in Trendelenburg position (15-30 degrees).\n\n"
            "5. INSERTION PROCEDURE (Maximal Sterile Barrier)\n"
            "Step 4: Perform hand hygiene with antiseptic soap or alcohol-based hand rub.\n"
            "Step 5: Don full sterile personal protective equipment: cap, mask, sterile "
            "gown, and sterile gloves.\n"
            "Step 6: Prepare the insertion site with chlorhexidine gluconate (>=2% "
            "chlorhexidine in 70% isopropyl alcohol). Apply with back-and-forth friction "
            "for at least 30 seconds. Allow to dry completely (approximately 2 minutes). "
            "Do NOT blot or fan dry.\n"
            "Step 7: Apply a large sterile drape covering the patient from head to toe.\n"
            "Step 8: Use real-time ultrasound guidance for internal jugular and femoral "
            "vein cannulation. Ultrasound guidance is MANDATORY for internal jugular "
            "access and STRONGLY RECOMMENDED for all other sites.\n"
            "Step 9: Cannulate the vein using the Seldinger technique. Confirm venous "
            "placement by aspiration of dark, non-pulsatile blood, manometry, or "
            "ultrasound visualization of the guidewire in the vein.\n"
            "Step 10: Advance the catheter over the guidewire. Remove the guidewire "
            "completely. Aspirate and flush all ports with sterile saline.\n"
            "Step 11: Secure the catheter with a sutureless securement device or sutures. "
            "Apply a sterile transparent dressing.\n\n"
            "6. POST-PROCEDURE\n"
            "Step 12: Order a post-procedure chest X-ray to confirm catheter tip position. "
            "The tip should be at the cavoatrial junction (junction of SVC and right "
            "atrium). Rule out pneumothorax.\n"
            "Step 13: Do NOT use the central line for infusions or blood draws until "
            "chest X-ray confirmation of correct placement (except in emergencies).\n"
            "Step 14: Document procedure details: site, number of attempts, complications, "
            "and chest X-ray result.\n\n"
            "7. CONTRAINDICATIONS\n"
            "- Infection or cellulitis at the insertion site.\n"
            "- Coagulopathy (INR >3.0 or platelets <20,000/uL) - correct before "
            "elective insertion; subclavian site is contraindicated when coagulopathic.\n"
            "- Known thrombosis of the target vessel.\n"
            "- Distorted anatomy at insertion site (e.g., prior surgery, trauma).\n\n"
            "8. BUNDLE COMPLIANCE\n"
            "All five elements of the central line insertion bundle must be documented:\n"
            "hand hygiene, maximal sterile barriers, chlorhexidine skin prep, optimal "
            "site selection, and daily review of line necessity.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Verify indication and obtain informed consent."},
                {"step": 2, "action": "Perform procedural time-out: patient ID, procedure, site, laterality."},
                {"step": 3, "action": "Position patient in Trendelenburg (15-30 degrees) for subclavian/IJ access."},
                {"step": 4, "action": "Perform hand hygiene with antiseptic soap or alcohol-based rub."},
                {"step": 5, "action": "Don full sterile PPE: cap, mask, sterile gown, sterile gloves."},
                {"step": 6, "action": "Prep site with >=2% chlorhexidine in 70% isopropyl alcohol, friction >=30 seconds, allow to dry ~2 minutes."},
                {"step": 7, "action": "Apply large sterile drape covering patient head to toe."},
                {"step": 8, "action": "Use real-time ultrasound guidance (MANDATORY for IJ, strongly recommended for all sites)."},
                {"step": 9, "action": "Cannulate vein using Seldinger technique; confirm venous placement."},
                {"step": 10, "action": "Advance catheter over guidewire, remove guidewire, aspirate and flush all ports."},
                {"step": 11, "action": "Secure catheter; apply sterile transparent dressing."},
                {"step": 12, "action": "Order post-procedure chest X-ray to confirm tip position and rule out pneumothorax."},
                {"step": 13, "action": "Do NOT use line until chest X-ray confirms correct placement (except emergencies)."},
                {"step": 14, "action": "Document: site, attempts, complications, CXR result."},
            ],
            "thresholds": [
                {"parameter": "Chlorhexidine application", "value": ">=30 seconds friction", "action": "Allow to dry ~2 minutes"},
                {"parameter": "Trendelenburg angle", "value": "15-30 degrees", "action": "For subclavian/IJ access"},
                {"parameter": "INR (coagulopathy)", "value": ">3.0", "action": "Correct before elective insertion"},
                {"parameter": "Platelets (coagulopathy)", "value": "<20,000/uL", "action": "Correct before elective insertion"},
            ],
            "contraindications": [
                "Infection or cellulitis at insertion site.",
                "Coagulopathy (INR >3.0 or platelets <20,000/uL)  - subclavian contraindicated when coagulopathic.",
                "Known thrombosis of target vessel.",
                "Distorted anatomy at insertion site.",
            ],
        },
    },
    # ------------------------------------------------------------------ 4
    {
        "sop_id": "SOP-ENDO-004",
        "title": "Insulin and Hypoglycemia Management Protocol",
        "department": "Endocrine",
        "version": "2.2",
        "effective_date": "2025-01-20",
        "review_date": "2026-05-01",
        "raw_text": (
            "INSULIN AND HYPOGLYCEMIA MANAGEMENT PROTOCOL  - ENDOCRINE\n"
            "Version 2.2 | Effective 2025-01-20\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To provide a standardized approach for managing insulin therapy and "
            "treating hypoglycemia in hospitalized adult patients.\n\n"
            "2. SCOPE\n"
            "All nursing and medical staff caring for patients receiving insulin or "
            "at risk for hypoglycemia.\n\n"
            "3. DEFINITIONS\n"
            "Level 1 Hypoglycemia: blood glucose <70 mg/dL (3.9 mmol/L) but >=54 mg/dL.\n"
            "Level 2 Hypoglycemia (Clinically Significant): blood glucose <54 mg/dL "
            "(3.0 mmol/L).\n"
            "Level 3 Hypoglycemia (Severe): any hypoglycemia requiring third-party "
            "assistance, with or without altered mental status or seizure.\n\n"
            "4. HYPOGLYCEMIA TREATMENT\n"
            "Step 1: Confirm blood glucose with point-of-care (POC) glucometer.\n"
            "Step 2: If glucose <70 mg/dL but >=54 mg/dL (Level 1) AND patient is "
            "conscious and able to swallow:\n"
            "  a. Administer 15-20 grams of fast-acting oral glucose (e.g., 4 oz juice, "
            "glucose tablets).\n"
            "  b. Recheck blood glucose in 15 minutes.\n"
            "  c. If glucose remains <70 mg/dL, repeat oral glucose and recheck in 15 minutes.\n"
            "  d. Once glucose >=70 mg/dL, provide a snack or meal if next meal is >1 hour away.\n"
            "Step 3: If glucose <54 mg/dL (Level 2) OR patient is unable to take oral intake:\n"
            "  a. Administer dextrose 50% (D50) 25 mL IV push (12.5 g dextrose).\n"
            "  b. If no IV access, administer glucagon 1 mg IM or subcutaneously.\n"
            "  c. Recheck glucose in 15 minutes.\n"
            "  d. Repeat D50 if glucose remains <70 mg/dL.\n"
            "Step 4: If glucose <54 mg/dL with altered mental status or seizure (Level 3):\n"
            "  a. Call a rapid response / code if not already activated.\n"
            "  b. Administer D50 25 mL IV push immediately.\n"
            "  c. If no IV access, glucagon 1 mg IM.\n"
            "  d. Continuous glucose monitoring until stable >=100 mg/dL for 2 hours.\n"
            "  e. Notify endocrinology for insulin regimen adjustment.\n\n"
            "5. INSULIN MANAGEMENT\n"
            "Step 5: Hold scheduled insulin if pre-meal glucose is <100 mg/dL and "
            "re-evaluate.\n"
            "Step 6: Reduce basal insulin by 20% if patient had any hypoglycemic episode "
            "in the prior 24 hours.\n"
            "Step 7: For patients on IV insulin drip: check glucose every 1 hour. "
            "Target glucose range: 140-180 mg/dL.\n"
            "Step 8: Transition from IV to subcutaneous insulin: administer subcutaneous "
            "basal insulin 2 hours BEFORE discontinuing the drip.\n\n"
            "6. THRESHOLDS\n"
            "- Level 1: glucose <70 mg/dL  - oral treatment\n"
            "- Level 2: glucose <54 mg/dL  - IV dextrose or IM glucagon\n"
            "- Level 3: glucose <54 mg/dL with AMS/seizure  - emergent treatment\n"
            "- IV insulin target range: 140-180 mg/dL\n"
            "- Hold insulin threshold: pre-meal glucose <100 mg/dL\n\n"
            "7. CONTRAINDICATIONS\n"
            "- Do NOT administer oral glucose to patients who are unconscious, unable to "
            "protect their airway, or have NPO status.\n"
            "- Do NOT give D50 through a peripheral IV if extravasation risk is high; "
            "use D10 infusion instead.\n"
            "- Glucagon may be ineffective in patients with depleted glycogen stores "
            "(e.g., chronic liver disease, prolonged fasting, alcohol use).\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Confirm blood glucose with POC glucometer."},
                {"step": 2, "action": "Level 1 (<70, >=54 mg/dL), conscious: give 15-20g oral glucose, recheck in 15 min, repeat if <70, give snack once >=70."},
                {"step": 3, "action": "Level 2 (<54 mg/dL) or unable to swallow: D50 25 mL IV push or glucagon 1 mg IM; recheck in 15 min."},
                {"step": 4, "action": "Level 3 (<54 + AMS/seizure): activate rapid response, D50 IV or glucagon IM, continuous monitoring until >=100 for 2 hrs, notify endocrine."},
                {"step": 5, "action": "Hold scheduled insulin if pre-meal glucose <100 mg/dL."},
                {"step": 6, "action": "Reduce basal insulin by 20% after any hypo episode in prior 24 hours."},
                {"step": 7, "action": "IV insulin drip: check glucose every 1 hour; target 140-180 mg/dL."},
                {"step": 8, "action": "IV to subQ transition: give subQ basal 2 hours BEFORE stopping drip."},
            ],
            "thresholds": [
                {"parameter": "Level 1 hypoglycemia", "value": "<70 mg/dL", "action": "Oral glucose treatment"},
                {"parameter": "Level 2 hypoglycemia", "value": "<54 mg/dL", "action": "IV dextrose or IM glucagon"},
                {"parameter": "IV insulin target", "value": "140-180 mg/dL", "action": "Hourly glucose checks"},
                {"parameter": "Hold insulin", "value": "<100 mg/dL pre-meal", "action": "Hold and re-evaluate"},
                {"parameter": "Recheck interval", "value": "15 minutes", "action": "Recheck after treatment"},
            ],
            "contraindications": [
                "Do NOT give oral glucose to unconscious patients or those unable to protect airway.",
                "Do NOT give D50 peripherally if high extravasation risk  - use D10 instead.",
                "Glucagon may be ineffective with depleted glycogen (liver disease, prolonged fasting, alcohol).",
            ],
        },
    },
    # ------------------------------------------------------------------ 5
    {
        "sop_id": "SOP-PHARM-005",
        "title": "Anticoagulation Safety Protocol",
        "department": "Pharmacy",
        "version": "3.0",
        "effective_date": "2025-02-15",
        "review_date": "2026-09-15",
        "raw_text": (
            "ANTICOAGULATION SAFETY PROTOCOL  - PHARMACY\n"
            "Version 3.0 | Effective 2025-02-15\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To standardize prescribing, monitoring, and reversal of anticoagulation "
            "therapy to prevent thromboembolic events while minimizing bleeding risk.\n\n"
            "2. SCOPE\n"
            "All prescribers and pharmacists managing anticoagulation in hospitalized patients.\n\n"
            "3. WARFARIN MANAGEMENT\n"
            "Step 1: Initiate warfarin with an estimated maintenance dose of 5 mg daily "
            "(2-3 mg for elderly, low body weight, or liver disease).\n"
            "Step 2: Obtain baseline INR before first dose. Check INR daily for the first "
            "5 days, then at least twice weekly until stable.\n"
            "Step 3: Target INR ranges:\n"
            "  - DVT/PE: INR 2.0-3.0\n"
            "  - Mechanical heart valve (aortic): INR 2.0-3.0\n"
            "  - Mechanical heart valve (mitral): INR 2.5-3.5\n"
            "  - Atrial fibrillation: INR 2.0-3.0\n"
            "Step 4: Dose adjustment algorithm:\n"
            "  - INR <2.0: increase weekly dose by 10-20%\n"
            "  - INR 2.0-3.0 (target): maintain current dose\n"
            "  - INR 3.1-3.5: reduce dose by 10-15%\n"
            "  - INR 3.6-4.0: hold one dose, reduce by 10-15%\n"
            "  - INR 4.1-5.0: hold warfarin, recheck INR in 24 hours\n"
            "  - INR >5.0 without bleeding: hold warfarin, consider vitamin K 2.5 mg PO\n"
            "  - INR >9.0 without bleeding: hold warfarin, give vitamin K 5 mg PO\n\n"
            "4. HEPARIN MANAGEMENT\n"
            "Step 5: Unfractionated heparin: weight-based dosing per institution protocol. "
            "Check aPTT 6 hours after initiation or dose change. Target aPTT 60-80 seconds.\n"
            "Step 6: LMWH (enoxaparin): standard prophylactic dose 40 mg subQ daily. "
            "Therapeutic dose: 1 mg/kg subQ q12h. Adjust for renal function (CrCl <30 mL/min).\n\n"
            "5. DOAC MANAGEMENT\n"
            "Step 7: Assess renal function (CrCl) before initiating any DOAC. Recheck "
            "CrCl at least every 6 months.\n"
            "Step 8: Do NOT use DOACs in patients with mechanical heart valves.\n\n"
            "6. REVERSAL AGENTS\n"
            "Step 9: Warfarin reversal for life-threatening bleeding:\n"
            "  - Administer 4-factor prothrombin complex concentrate (4F-PCC) AND "
            "vitamin K 10 mg IV.\n"
            "  - Recheck INR 15-30 minutes after PCC administration.\n"
            "Step 10: Heparin reversal: protamine sulfate 1 mg per 100 units of heparin "
            "given in the last 2-3 hours (max 50 mg).\n"
            "Step 11: Dabigatran reversal: idarucizumab 5 g IV.\n"
            "Step 12: Rivaroxaban/Apixaban reversal: andexanet alfa per dosing protocol.\n\n"
            "7. CONTRAINDICATIONS TO ANTICOAGULATION\n"
            "- Active major bleeding (GI, intracranial, retroperitoneal).\n"
            "- Platelet count <50,000/uL (for therapeutic anticoagulation).\n"
            "- Recent (within 14 days) major surgery with high bleeding risk.\n"
            "- History of heparin-induced thrombocytopenia (HIT)  - do NOT use heparin "
            "products; use argatroban or bivalirudin.\n"
            "- Severe uncontrolled hypertension (SBP >200 mmHg or DBP >120 mmHg).\n\n"
            "8. DOCUMENTATION\n"
            "Document indication, target INR/aPTT, dose changes, monitoring results, "
            "and patient education on bleeding precautions.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Initiate warfarin 5 mg daily (2-3 mg for elderly/low weight/liver disease)."},
                {"step": 2, "action": "Baseline INR before first dose; daily INR for first 5 days, then twice weekly."},
                {"step": 3, "action": "Target INR: DVT/PE 2.0-3.0; mechanical aortic valve 2.0-3.0; mechanical mitral valve 2.5-3.5; AFib 2.0-3.0."},
                {"step": 4, "action": "Dose adjust per INR: <2.0 increase 10-20%; 3.1-3.5 reduce 10-15%; 3.6-4.0 hold one dose; 4.1-5.0 hold and recheck 24h; >5.0 consider vitamin K 2.5mg PO; >9.0 give vitamin K 5mg PO."},
                {"step": 5, "action": "UFH: weight-based dosing, aPTT 6h after initiation, target 60-80 seconds."},
                {"step": 6, "action": "Enoxaparin: prophylactic 40 mg subQ daily; therapeutic 1 mg/kg q12h; adjust for CrCl <30."},
                {"step": 7, "action": "Assess CrCl before DOACs; recheck every 6 months."},
                {"step": 8, "action": "Do NOT use DOACs in mechanical heart valves."},
                {"step": 9, "action": "Warfarin reversal for life-threatening bleeding: 4F-PCC + vitamin K 10 mg IV; recheck INR in 15-30 min."},
                {"step": 10, "action": "Heparin reversal: protamine 1 mg per 100 units heparin (max 50 mg)."},
                {"step": 11, "action": "Dabigatran reversal: idarucizumab 5 g IV."},
                {"step": 12, "action": "Rivaroxaban/apixaban reversal: andexanet alfa."},
            ],
            "thresholds": [
                {"parameter": "INR target (DVT/PE/AFib)", "value": "2.0-3.0", "action": "Maintain dose"},
                {"parameter": "INR target (mitral valve)", "value": "2.5-3.5", "action": "Maintain dose"},
                {"parameter": "INR >5.0", "value": ">5.0", "action": "Hold warfarin, consider vitamin K 2.5 mg PO"},
                {"parameter": "INR >9.0", "value": ">9.0", "action": "Hold warfarin, give vitamin K 5 mg PO"},
                {"parameter": "aPTT target (UFH)", "value": "60-80 seconds", "action": "Adjust heparin drip"},
                {"parameter": "Platelet count", "value": "<50,000/uL", "action": "Contraindicated for therapeutic anticoagulation"},
            ],
            "contraindications": [
                "Active major bleeding (GI, intracranial, retroperitoneal).",
                "Platelet count <50,000/uL for therapeutic anticoagulation.",
                "Recent major surgery within 14 days with high bleeding risk.",
                "HIT history  - do NOT use heparin; use argatroban or bivalirudin.",
                "Severe uncontrolled hypertension (SBP >200 or DBP >120 mmHg).",
                "DOACs contraindicated in mechanical heart valves.",
            ],
        },
    },
    # ------------------------------------------------------------------ 6
    {
        "sop_id": "SOP-PHARM-006",
        "title": "Medication Reconciliation Protocol",
        "department": "Pharmacy",
        "version": "2.1",
        "effective_date": "2025-03-10",
        "review_date": "2027-01-15",
        "raw_text": (
            "MEDICATION RECONCILIATION PROTOCOL  - PHARMACY\n"
            "Version 2.1 | Effective 2025-03-10\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To ensure accurate and complete medication information is communicated "
            "across all transitions of care (admission, transfer, discharge) to prevent "
            "medication errors.\n\n"
            "2. SCOPE\n"
            "All pharmacists, physicians, nursing staff, and advanced practice providers.\n\n"
            "3. ADMISSION RECONCILIATION\n"
            "Step 1: Obtain a Best Possible Medication History (BPMH) within 24 hours "
            "of admission using at least two sources: patient/family interview AND one "
            "of the following  - pharmacy records, primary care provider records, or "
            "medication bottles/list brought from home.\n"
            "Step 2: Document ALL home medications including prescription medications, "
            "over-the-counter drugs, herbal supplements, and vitamins with dose, route, "
            "frequency, and last dose taken.\n"
            "Step 3: Compare home medication list against admission orders. Identify and "
            "resolve discrepancies: omissions, duplications, dose changes, drug "
            "interactions, and therapeutic substitutions.\n"
            "Step 4: Flag HIGH-ALERT medications (insulin, anticoagulants, opioids, "
            "chemotherapy, concentrated electrolytes) for pharmacist verification within "
            "4 hours of admission.\n\n"
            "4. TRANSFER RECONCILIATION\n"
            "Step 5: At each intra-hospital transfer (e.g., ICU to floor, OR to PACU), "
            "reconcile medications within 4 hours of transfer.\n"
            "Step 6: Review and adjust medications appropriate to the new level of care "
            "(e.g., discontinue ICU-specific drips, convert IV to PO, resume held "
            "home medications).\n\n"
            "5. DISCHARGE RECONCILIATION\n"
            "Step 7: Compare discharge medications to admission medication list AND "
            "active inpatient orders.\n"
            "Step 8: Clearly document which medications are NEW, CHANGED, or "
            "DISCONTINUED at discharge, with clinical rationale.\n"
            "Step 9: Provide the patient with a printed, patient-friendly medication "
            "list that includes drug name, dose, frequency, purpose, and important "
            "side effects.\n"
            "Step 10: Perform teach-back with the patient or caregiver to confirm "
            "understanding of the discharge medication regimen.\n"
            "Step 11: Send the discharge medication list to the patient's primary care "
            "provider and/or community pharmacy within 24 hours.\n\n"
            "6. HIGH-ALERT MEDICATION VERIFICATION\n"
            "Step 12: All high-alert medications require independent double-check by "
            "a second qualified clinician before dispensing or administration changes.\n"
            "Step 13: High-alert medications include: insulin, anticoagulants (warfarin, "
            "heparin, DOACs), opioids, neuromuscular blocking agents, chemotherapy, "
            "concentrated potassium chloride, and hypertonic saline (>0.9%).\n\n"
            "7. CONTRAINDICATIONS / CAUTIONS\n"
            "- Do NOT discontinue chronic medications (especially beta-blockers, "
            "antiepileptics, or antidepressants) without explicit clinical justification.\n"
            "- Do NOT rely solely on the patient's verbal report; verify with at least "
            "one additional source.\n"
            "- Report unresolved discrepancies to the attending physician within 2 hours.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Obtain BPMH within 24 hours using >=2 sources (patient interview + pharmacy/PCP records/home meds)."},
                {"step": 2, "action": "Document ALL home meds including OTC, herbals, vitamins with dose, route, frequency, last dose."},
                {"step": 3, "action": "Compare home meds to admission orders; resolve discrepancies."},
                {"step": 4, "action": "Flag high-alert meds for pharmacist verification within 4 hours of admission."},
                {"step": 5, "action": "Reconcile medications within 4 hours of intra-hospital transfer."},
                {"step": 6, "action": "Adjust medications for new level of care (stop drips, IV-to-PO, resume home meds)."},
                {"step": 7, "action": "At discharge: compare discharge meds to admission list AND active inpatient orders."},
                {"step": 8, "action": "Document which meds are NEW, CHANGED, or DISCONTINUED with rationale."},
                {"step": 9, "action": "Provide patient-friendly printed medication list."},
                {"step": 10, "action": "Perform teach-back with patient/caregiver."},
                {"step": 11, "action": "Send discharge med list to PCP/pharmacy within 24 hours."},
                {"step": 12, "action": "High-alert meds require independent double-check by second clinician."},
                {"step": 13, "action": "High-alert meds: insulin, anticoagulants, opioids, NMBAs, chemo, concentrated KCl, hypertonic saline (>0.9%)."},
            ],
            "thresholds": [
                {"parameter": "BPMH completion", "value": "within 24 hours of admission", "action": "Obtain from >=2 sources"},
                {"parameter": "High-alert verification", "value": "within 4 hours of admission", "action": "Pharmacist verification"},
                {"parameter": "Transfer reconciliation", "value": "within 4 hours of transfer", "action": "Reconcile meds"},
                {"parameter": "Discharge med list to PCP", "value": "within 24 hours", "action": "Send to PCP/pharmacy"},
                {"parameter": "Unresolved discrepancies", "value": "within 2 hours", "action": "Report to attending"},
            ],
            "contraindications": [
                "Do NOT discontinue chronic meds (beta-blockers, antiepileptics, antidepressants) without clinical justification.",
                "Do NOT rely solely on verbal patient report; verify with additional source.",
                "Unresolved discrepancies must be reported to attending within 2 hours.",
            ],
        },
    },
    # ------------------------------------------------------------------ 7
    {
        "sop_id": "SOP-NURS-007",
        "title": "Fall Prevention Protocol",
        "department": "Nursing",
        "version": "2.5",
        "effective_date": "2025-04-01",
        "review_date": "2027-03-01",
        "raw_text": (
            "FALL PREVENTION PROTOCOL  - NURSING\n"
            "Version 2.5 | Effective 2025-04-01\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To reduce the incidence and severity of patient falls through systematic "
            "risk assessment and evidence-based interventions.\n\n"
            "2. SCOPE\n"
            "All nursing staff, patient care technicians, and allied health "
            "professionals on inpatient units.\n\n"
            "3. RISK ASSESSMENT\n"
            "Step 1: Assess every patient for fall risk using the Morse Fall Scale (MFS) "
            "upon admission, every shift, after any fall, and after any change in "
            "condition.\n"
            "Step 2: Morse Fall Scale scoring:\n"
            "  - History of falling (last 3 months): No = 0, Yes = 25\n"
            "  - Secondary diagnosis: No = 0, Yes = 15\n"
            "  - Ambulatory aid: None/bedrest/nurse assist = 0, Crutches/cane/walker = 15, "
            "Furniture = 30\n"
            "  - IV therapy / heparin lock: No = 0, Yes = 20\n"
            "  - Gait: Normal/bedrest/immobile = 0, Weak = 10, Impaired = 20\n"
            "  - Mental status: Oriented to own ability = 0, Overestimates/forgets "
            "limitations = 15\n"
            "Step 3: Risk stratification:\n"
            "  - Low risk: MFS score 0-24\n"
            "  - Moderate risk: MFS score 25-50\n"
            "  - High risk: MFS score >=51\n\n"
            "4. UNIVERSAL PRECAUTIONS (ALL PATIENTS)\n"
            "Step 4: Implement for ALL patients regardless of risk score:\n"
            "  a. Orientation to room, bed controls, call light, and bathroom.\n"
            "  b. Non-skid footwear when ambulating.\n"
            "  c. Bed in lowest position with brakes locked.\n"
            "  d. Call light within reach at all times.\n"
            "  e. Adequate lighting.\n"
            "  f. Clear pathway from bed to bathroom.\n\n"
            "5. MODERATE RISK INTERVENTIONS (MFS 25-50)\n"
            "Step 5: All universal precautions PLUS:\n"
            "  a. Yellow fall-risk armband.\n"
            "  b. Yellow non-skid socks.\n"
            "  c. Fall risk sign on door.\n"
            "  d. Toileting schedule every 2 hours.\n"
            "  e. Assist with ambulation.\n\n"
            "6. HIGH RISK INTERVENTIONS (MFS >=51)\n"
            "Step 6: All moderate-risk interventions PLUS:\n"
            "  a. Bed alarm activated at all times.\n"
            "  b. Hourly rounding with documented safety checks (4 Ps: pain, position, "
            "personal needs, possessions within reach).\n"
            "  c. Room close to nursing station when possible.\n"
            "  d. Consider 1:1 sitter for patients with delirium, agitation, or "
            "repeated fall attempts.\n"
            "  e. Physical therapy consultation within 24 hours.\n"
            "  f. Review medications for fall-risk contributors (sedatives, opioids, "
            "antihypertensives, diuretics).\n\n"
            "7. POST-FALL PROTOCOL\n"
            "Step 7: If a fall occurs:\n"
            "  a. Assess for injury; do NOT move patient if spinal injury is suspected.\n"
            "  b. Notify physician immediately.\n"
            "  c. Obtain vital signs and neurological assessment.\n"
            "  d. Order imaging as clinically indicated.\n"
            "  e. Complete incident report within 24 hours.\n"
            "  f. Reassess MFS score and upgrade interventions.\n"
            "  g. Conduct a post-fall huddle with the care team within 1 hour.\n\n"
            "8. CONTRAINDICATIONS\n"
            "- Do NOT use physical restraints as a first-line fall prevention measure.\n"
            "- Bed alarms should NOT replace direct nursing observation in high-risk patients.\n"
            "- Do NOT remove mobility aids from ambulatory patients to 'prevent falls.'\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Assess fall risk with Morse Fall Scale on admission, every shift, after falls, and after condition changes."},
                {"step": 2, "action": "Score MFS: fall history (25), secondary dx (15), ambulatory aid (0-30), IV/heplock (20), gait (0-20), mental status (0-15)."},
                {"step": 3, "action": "Stratify: low 0-24, moderate 25-50, high >=51."},
                {"step": 4, "action": "Universal precautions: orient to room, non-skid footwear, bed low/locked, call light in reach, lighting, clear path."},
                {"step": 5, "action": "Moderate risk (25-50): add yellow armband, yellow socks, door sign, toileting q2h, assisted ambulation."},
                {"step": 6, "action": "High risk (>=51): add bed alarm, hourly rounding (4 Ps), near nursing station, consider sitter, PT consult within 24h, medication review."},
                {"step": 7, "action": "Post-fall: assess injury, notify MD, vitals+neuro check, imaging PRN, incident report within 24h, reassess MFS, post-fall huddle within 1h."},
            ],
            "thresholds": [
                {"parameter": "MFS Low risk", "value": "0-24", "action": "Universal precautions only"},
                {"parameter": "MFS Moderate risk", "value": "25-50", "action": "Add moderate interventions"},
                {"parameter": "MFS High risk", "value": ">=51", "action": "Add high-risk interventions including bed alarm and hourly rounding"},
                {"parameter": "Hourly rounding", "value": "every 1 hour", "action": "4 Ps check for high-risk patients"},
                {"parameter": "Post-fall huddle", "value": "within 1 hour", "action": "Team huddle after any fall"},
            ],
            "contraindications": [
                "Do NOT use physical restraints as first-line fall prevention.",
                "Bed alarms should NOT replace direct nursing observation.",
                "Do NOT remove mobility aids to 'prevent falls.'",
            ],
        },
    },
    # ------------------------------------------------------------------ 8
    {
        "sop_id": "SOP-IC-008",
        "title": "Infection Control Isolation Protocol",
        "department": "Infection Control",
        "version": "3.2",
        "effective_date": "2025-01-30",
        "review_date": "2026-10-01",
        "raw_text": (
            "INFECTION CONTROL ISOLATION PROTOCOL  - INFECTION CONTROL\n"
            "Version 3.2 | Effective 2025-01-30\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To prevent healthcare-associated transmission of infectious agents through "
            "appropriate isolation precautions and PPE use.\n\n"
            "2. SCOPE\n"
            "All healthcare workers, visitors, and ancillary staff entering isolation rooms.\n\n"
            "3. TYPES OF ISOLATION PRECAUTIONS\n\n"
            "3A. CONTACT PRECAUTIONS\n"
            "Indicated for: MRSA, VRE, C. difficile, resistant gram-negative organisms, "
            "scabies, impetigo, draining wounds.\n"
            "Step 1: Place patient in a private room or cohort with same organism.\n"
            "Step 2: Don gloves and gown BEFORE entering the room.\n"
            "Step 3: Remove and discard gloves and gown BEFORE leaving the room.\n"
            "Step 4: Perform hand hygiene immediately after removing PPE. For C. difficile, "
            "use soap and water (alcohol-based rub is NOT effective against C. diff spores).\n"
            "Step 5: Use dedicated patient-care equipment (stethoscope, BP cuff, thermometer). "
            "If shared equipment is unavoidable, clean and disinfect between patients.\n"
            "Step 6: Daily and terminal cleaning with EPA-registered disinfectant. For "
            "C. difficile, use sporicidal agent (e.g., bleach-based, >=5000 ppm chlorine).\n\n"
            "3B. DROPLET PRECAUTIONS\n"
            "Indicated for: Influenza, pertussis, bacterial meningitis (N. meningitidis), "
            "mumps, rubella, rhinovirus.\n"
            "Step 7: Place patient in a private room. Door may remain open.\n"
            "Step 8: Don a surgical/procedure mask when within 6 feet (2 meters) of the patient.\n"
            "Step 9: Patient must wear a surgical mask during transport outside the room.\n"
            "Step 10: Eye protection (face shield or goggles) is required when performing "
            "procedures likely to generate splashes.\n\n"
            "3C. AIRBORNE PRECAUTIONS\n"
            "Indicated for: Tuberculosis (pulmonary or laryngeal), measles, varicella "
            "(chickenpox), disseminated herpes zoster, COVID-19 (per institutional policy).\n"
            "Step 11: Place patient in an Airborne Infection Isolation Room (AIIR)  - "
            "negative pressure, >=12 air changes per hour, air exhausted outdoors or "
            "HEPA-filtered. Verify negative pressure daily.\n"
            "Step 12: All persons entering must wear a fitted N95 respirator (or PAPR). "
            "Annual fit testing is required.\n"
            "Step 13: Door must remain CLOSED at all times.\n"
            "Step 14: Patient wears a surgical mask during transport. Limit transport "
            "to medically essential trips only.\n"
            "Step 15: If AIIR is not available, place surgical mask on patient and transfer "
            "to a facility with AIIR capability as soon as possible.\n\n"
            "4. DURATION OF ISOLATION\n"
            "Step 16: Continue isolation until:\n"
            "  - Contact: per organism clearance criteria (e.g., C. diff: symptom-free >=48h)\n"
            "  - Droplet: per disease-specific guidelines (e.g., influenza: 5 days from "
            "symptom onset or until afebrile 24h)\n"
            "  - Airborne: TB  - until 3 consecutive negative AFB smears collected 8-24h "
            "apart; measles/varicella  - until lesions are crusted.\n\n"
            "5. CONTRAINDICATIONS / CAUTIONS\n"
            "- Do NOT use alcohol-based hand rub for C. difficile (use soap and water).\n"
            "- N95 respirators must NOT be used if not fit-tested.\n"
            "- Do NOT downgrade isolation precautions without infectious disease consultation.\n"
            "- Visitors must follow the same PPE requirements as staff.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Contact: private room or cohort with same organism."},
                {"step": 2, "action": "Contact: don gloves and gown BEFORE entering room."},
                {"step": 3, "action": "Contact: remove gloves and gown BEFORE leaving room."},
                {"step": 4, "action": "Contact: hand hygiene after PPE removal; soap and water for C. diff."},
                {"step": 5, "action": "Contact: dedicated equipment or clean/disinfect shared items between patients."},
                {"step": 6, "action": "Contact: daily and terminal clean with EPA disinfectant; sporicidal agent for C. diff (>=5000 ppm chlorine)."},
                {"step": 7, "action": "Droplet: private room, door may remain open."},
                {"step": 8, "action": "Droplet: surgical mask within 6 feet of patient."},
                {"step": 9, "action": "Droplet: patient wears surgical mask during transport."},
                {"step": 10, "action": "Droplet: eye protection for splash-generating procedures."},
                {"step": 11, "action": "Airborne: AIIR with negative pressure, >=12 air changes/hr, HEPA-filtered exhaust. Verify daily."},
                {"step": 12, "action": "Airborne: fitted N95 or PAPR required; annual fit testing."},
                {"step": 13, "action": "Airborne: door must remain CLOSED at all times."},
                {"step": 14, "action": "Airborne: patient wears surgical mask during transport; limit transport to essential only."},
                {"step": 15, "action": "If no AIIR: mask patient, transfer to AIIR-capable facility ASAP."},
                {"step": 16, "action": "Duration: contact per clearance criteria; droplet per disease guidelines; airborne TB 3 negative AFB smears 8-24h apart."},
            ],
            "thresholds": [
                {"parameter": "AIIR air changes", "value": ">=12 per hour", "action": "Required for airborne isolation"},
                {"parameter": "C. diff clearance", "value": "symptom-free >=48 hours", "action": "May discontinue contact precautions"},
                {"parameter": "TB clearance", "value": "3 negative AFB smears 8-24h apart", "action": "May discontinue airborne precautions"},
                {"parameter": "Droplet distance", "value": "6 feet (2 meters)", "action": "Mask required within this distance"},
                {"parameter": "C. diff disinfectant", "value": ">=5000 ppm chlorine", "action": "Sporicidal agent required"},
            ],
            "contraindications": [
                "Do NOT use alcohol-based hand rub for C. difficile  - use soap and water.",
                "N95 must NOT be used without fit testing.",
                "Do NOT downgrade isolation without infectious disease consultation.",
                "Visitors must follow same PPE requirements as staff.",
            ],
        },
    },
    # ------------------------------------------------------------------ 9
    {
        "sop_id": "SOP-EM-009",
        "title": "Code Blue Response Protocol",
        "department": "Emergency",
        "version": "5.0",
        "effective_date": "2025-02-20",
        "review_date": "2026-12-01",
        "raw_text": (
            "CODE BLUE RESPONSE PROTOCOL  - EMERGENCY\n"
            "Version 5.0 | Effective 2025-02-20\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To provide a systematic response to cardiopulmonary arrest to maximize "
            "survival with good neurological outcome.\n\n"
            "2. SCOPE\n"
            "All hospital personnel; applies to all in-hospital cardiac arrest events.\n\n"
            "3. ACTIVATION\n"
            "Step 1: Upon finding an unresponsive patient  - check responsiveness, "
            "breathing, and pulse simultaneously (no more than 10 seconds). If no "
            "pulse detected, activate Code Blue immediately.\n"
            "Step 2: Call the Code Blue number (dial institution emergency number). "
            "State location, patient status, and need for crash cart/defibrillator.\n\n"
            "4. BLS SEQUENCE (Begin Immediately)\n"
            "Step 3: Begin high-quality chest compressions immediately:\n"
            "  - Rate: 100-120 compressions per minute\n"
            "  - Depth: at least 2 inches (5 cm) but no more than 2.4 inches (6 cm)\n"
            "  - Allow full chest recoil between compressions\n"
            "  - Minimize interruptions (<=10 seconds for any pause)\n"
            "Step 4: Apply defibrillator/AED pads as soon as available.\n"
            "Step 5: If shockable rhythm (VF or pulseless VT):\n"
            "  a. Deliver 1 shock at maximum device energy (biphasic 120-200 J, "
            "monophasic 360 J).\n"
            "  b. Resume CPR immediately for 2 minutes.\n"
            "  c. Recheck rhythm after 2 minutes.\n"
            "Step 6: If non-shockable rhythm (asystole or PEA):\n"
            "  a. Continue CPR.\n"
            "  b. Identify and treat reversible causes (H's and T's).\n\n"
            "5. ACLS MEDICATIONS\n"
            "Step 7: Establish IV/IO access.\n"
            "Step 8: Epinephrine 1 mg IV/IO:\n"
            "  - For non-shockable rhythms: give as soon as IV/IO available.\n"
            "  - For shockable rhythms: give after the second shock.\n"
            "  - Repeat every 3-5 minutes throughout resuscitation.\n"
            "Step 9: Amiodarone for refractory VF/pulseless VT:\n"
            "  - First dose: 300 mg IV/IO bolus.\n"
            "  - Second dose: 150 mg IV/IO if VF/pVT persists.\n"
            "Step 10: Consider sodium bicarbonate 1 mEq/kg for known hyperkalemia or "
            "tricyclic antidepressant overdose.\n\n"
            "6. AIRWAY MANAGEMENT\n"
            "Step 11: Insert advanced airway (endotracheal tube or supraglottic device) "
            "when trained personnel available. Do NOT interrupt compressions for airway "
            "placement.\n"
            "Step 12: Once advanced airway placed: continuous compressions at 100-120/min "
            "and ventilations every 6 seconds (10 breaths/min). Confirm placement with "
            "continuous waveform capnography (target ETCO2 >=10 mmHg).\n\n"
            "7. ROLE ASSIGNMENTS\n"
            "Step 13: Team leader assigns roles upon arrival:\n"
            "  - Compressor (rotate every 2 minutes)\n"
            "  - Airway manager\n"
            "  - IV/IO access and medications\n"
            "  - Defibrillator operator\n"
            "  - Recorder/timekeeper\n"
            "  - Runner for supplies/labs\n\n"
            "8. POST-ROSC CARE\n"
            "Step 14: After return of spontaneous circulation (ROSC):\n"
            "  a. 12-lead ECG within 10 minutes.\n"
            "  b. Targeted temperature management (32-36 degrees C for 24 hours) if patient "
            "remains comatose.\n"
            "  c. Maintain SpO2 92-98%, avoid hyperoxia.\n"
            "  d. Maintain MAP >=65 mmHg.\n"
            "  e. Transfer to ICU.\n\n"
            "9. TERMINATION OF RESUSCITATION\n"
            "Step 15: Consider termination after >=20 minutes of ACLS without ROSC, "
            "with consensus of team leader and attending physician. Document time of "
            "death and total resuscitation duration.\n\n"
            "10. CONTRAINDICATIONS\n"
            "- Do NOT perform CPR if a valid DNAR/DNR order is confirmed and documented.\n"
            "- Do NOT delay defibrillation for intubation or IV access.\n"
            "- Do NOT interrupt compressions for >10 seconds except for defibrillation.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Check responsiveness, breathing, pulse (<=10 seconds). If no pulse, activate Code Blue."},
                {"step": 2, "action": "Call Code Blue: state location, patient status, request crash cart."},
                {"step": 3, "action": "Begin compressions: 100-120/min, depth 2-2.4 inches (5-6 cm), full recoil, interruptions <=10 sec."},
                {"step": 4, "action": "Apply defibrillator pads as soon as available."},
                {"step": 5, "action": "Shockable rhythm (VF/pVT): shock at max energy, resume CPR 2 min, recheck rhythm."},
                {"step": 6, "action": "Non-shockable (asystole/PEA): continue CPR, identify reversible causes (H's and T's)."},
                {"step": 7, "action": "Establish IV/IO access."},
                {"step": 8, "action": "Epinephrine 1 mg IV/IO: non-shockable  - give immediately; shockable  - after 2nd shock; repeat q3-5min."},
                {"step": 9, "action": "Amiodarone for refractory VF/pVT: first dose 300 mg, second dose 150 mg."},
                {"step": 10, "action": "Consider bicarb 1 mEq/kg for hyperkalemia or TCA overdose."},
                {"step": 11, "action": "Advanced airway when trained personnel available; do NOT interrupt compressions."},
                {"step": 12, "action": "Post-airway: continuous compressions 100-120/min, ventilate q6 sec, confirm with capnography (ETCO2 >=10)."},
                {"step": 13, "action": "Team leader assigns: compressor (rotate q2min), airway, meds/access, defib, recorder, runner."},
                {"step": 14, "action": "Post-ROSC: 12-lead ECG in 10 min, TTM 32-36 degrees C x 24h if comatose, SpO2 92-98%, MAP >=65, ICU transfer."},
                {"step": 15, "action": "Consider termination after >=20 min ACLS without ROSC, with team leader and attending consensus."},
            ],
            "thresholds": [
                {"parameter": "Compression rate", "value": "100-120/min", "action": "Maintain throughout CPR"},
                {"parameter": "Compression depth", "value": "2-2.4 inches (5-6 cm)", "action": "Monitor quality"},
                {"parameter": "Epinephrine dose", "value": "1 mg", "action": "Repeat every 3-5 minutes"},
                {"parameter": "Amiodarone first dose", "value": "300 mg", "action": "For refractory VF/pVT"},
                {"parameter": "Amiodarone second dose", "value": "150 mg", "action": "If VF/pVT persists"},
                {"parameter": "ETCO2 target", "value": ">=10 mmHg", "action": "Indicator of CPR quality"},
                {"parameter": "Compression interruption", "value": "<=10 seconds", "action": "Minimize pauses"},
                {"parameter": "Post-ROSC SpO2", "value": "92-98%", "action": "Avoid hyperoxia"},
            ],
            "contraindications": [
                "Do NOT perform CPR if valid DNAR/DNR order is confirmed.",
                "Do NOT delay defibrillation for intubation or IV access.",
                "Do NOT interrupt compressions for >10 seconds except for defibrillation.",
            ],
        },
    },
    # ------------------------------------------------------------------ 10
    {
        "sop_id": "SOP-RAD-010",
        "title": "Contrast Allergy and Reaction Protocol",
        "department": "Radiology",
        "version": "2.8",
        "effective_date": "2025-03-15",
        "review_date": "2027-06-01",
        "raw_text": (
            "CONTRAST ALLERGY AND REACTION PROTOCOL  - RADIOLOGY\n"
            "Version 2.8 | Effective 2025-03-15\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "To identify patients at risk for contrast media reactions, implement "
            "appropriate premedication, and manage acute contrast reactions.\n\n"
            "2. SCOPE\n"
            "All radiologists, radiology technologists, and nursing staff involved "
            "in contrast-enhanced imaging studies.\n\n"
            "3. RISK STRATIFICATION\n"
            "Step 1: Screen ALL patients for contrast allergy risk before any "
            "contrast-enhanced study. Ask about:\n"
            "  - Prior contrast reaction (type and severity)\n"
            "  - Asthma (especially poorly controlled)\n"
            "  - Multiple severe allergies or history of anaphylaxis to any agent\n"
            "Step 2: Risk classification:\n"
            "  - LOW risk: no prior reaction, no asthma, no severe allergies\n"
            "  - MODERATE risk: prior mild reaction (urticaria, nausea) OR asthma "
            "(well-controlled)\n"
            "  - HIGH risk: prior moderate-to-severe reaction (bronchospasm, "
            "laryngeal edema, hypotension, anaphylaxis) OR poorly controlled asthma\n\n"
            "4. PREMEDICATION PROTOCOL\n"
            "Step 3: LOW risk  - no premedication required. Proceed with standard contrast.\n"
            "Step 4: MODERATE risk  - premedicate with:\n"
            "  - Prednisone 50 mg PO at 13 hours, 7 hours, and 1 hour before contrast.\n"
            "  - Diphenhydramine 50 mg PO or IV 1 hour before contrast.\n"
            "Step 5: HIGH risk  - premedicate with the same regimen as moderate risk PLUS:\n"
            "  - Use non-ionic, iso-osmolar contrast agent (e.g., iodixanol).\n"
            "  - Consider alternative imaging without contrast (MRI without gadolinium, "
            "ultrasound, non-contrast CT).\n"
            "  - Have emergency equipment and medications at bedside.\n"
            "  - Attending radiologist must be present during injection.\n"
            "Step 6: For EMERGENCY studies when 13-hour prep is not feasible:\n"
            "  - Methylprednisolone 40 mg IV every 4 hours until contrast, minimum "
            "2 doses.\n"
            "  - Diphenhydramine 50 mg IV 1 hour before.\n"
            "  - Use non-ionic, iso-osmolar contrast.\n\n"
            "5. CONTRAST ALTERNATIVES\n"
            "Step 7: Consider the following when contrast is high-risk:\n"
            "  - MRI without gadolinium\n"
            "  - Ultrasound\n"
            "  - Non-contrast CT\n"
            "  - CO2 angiography (for vascular studies)\n"
            "  - Gadolinium-based contrast for CT (in select cases with radiologist approval)\n\n"
            "6. ACUTE REACTION MANAGEMENT\n"
            "Step 8: MILD reactions (urticaria, pruritus, nausea, limited vomiting):\n"
            "  - Observe for 30 minutes.\n"
            "  - Diphenhydramine 25-50 mg IV/IM.\n"
            "  - Most mild reactions are self-limiting.\n"
            "Step 9: MODERATE reactions (diffuse urticaria, facial edema, bronchospasm "
            "with mild wheezing, tachycardia):\n"
            "  - Epinephrine 0.3 mg IM (1:1000) in anterolateral thigh.\n"
            "  - Diphenhydramine 50 mg IV.\n"
            "  - Albuterol inhaler for bronchospasm.\n"
            "  - Monitor for 4 hours.\n"
            "Step 10: SEVERE reactions (anaphylaxis, severe bronchospasm, laryngeal edema, "
            "hypotension, cardiovascular collapse):\n"
            "  - Activate emergency response / Code Blue.\n"
            "  - Epinephrine 0.3 mg IM (1:1000); may repeat every 5-15 minutes.\n"
            "  - IV normal saline 1-2 L bolus for hypotension.\n"
            "  - Supplemental oxygen.\n"
            "  - Consider epinephrine drip for refractory hypotension.\n"
            "  - Transfer to ICU.\n\n"
            "7. CONTRAINDICATIONS\n"
            "- Iodinated contrast is CONTRAINDICATED in patients with a prior severe "
            "anaphylactic reaction to the same contrast agent, unless benefit clearly "
            "outweighs risk AND full premedication is administered.\n"
            "- Do NOT administer iodinated contrast to patients with thyroid storm "
            "or untreated hyperthyroidism (Graves' disease) without endocrinology "
            "consultation.\n"
            "- Use caution in renal insufficiency (eGFR <30 mL/min/1.73m2); use "
            "lowest possible contrast volume and ensure adequate hydration.\n"
            "- Do NOT use gadolinium-based contrast in patients with eGFR <30 without "
            "nephrology consultation (risk of nephrogenic systemic fibrosis with "
            "certain agents).\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Screen ALL patients: prior contrast reaction, asthma, severe allergies/anaphylaxis history."},
                {"step": 2, "action": "Classify risk: LOW (none), MODERATE (prior mild reaction or controlled asthma), HIGH (prior moderate-severe reaction or uncontrolled asthma)."},
                {"step": 3, "action": "LOW risk: no premedication, proceed with standard contrast."},
                {"step": 4, "action": "MODERATE risk: prednisone 50 mg PO at 13h, 7h, 1h before; diphenhydramine 50 mg PO/IV 1h before."},
                {"step": 5, "action": "HIGH risk: same premed + non-ionic iso-osmolar contrast, consider alternative imaging, emergency equipment at bedside, attending present."},
                {"step": 6, "action": "Emergency prep: methylprednisolone 40 mg IV q4h (min 2 doses) + diphenhydramine 50 mg IV 1h before + iso-osmolar contrast."},
                {"step": 7, "action": "Alternatives: MRI without gadolinium, ultrasound, non-contrast CT, CO2 angiography."},
                {"step": 8, "action": "Mild reaction: observe 30 min, diphenhydramine 25-50 mg IV/IM."},
                {"step": 9, "action": "Moderate reaction: epinephrine 0.3 mg IM, diphenhydramine 50 mg IV, albuterol PRN, monitor 4 hours."},
                {"step": 10, "action": "Severe reaction: activate Code Blue, epi 0.3 mg IM q5-15min, NS 1-2 L bolus, O2, consider epi drip, ICU transfer."},
            ],
            "thresholds": [
                {"parameter": "Prednisone premedication", "value": "50 mg PO at 13h, 7h, 1h before", "action": "Moderate and high risk"},
                {"parameter": "Epinephrine (moderate reaction)", "value": "0.3 mg IM (1:1000)", "action": "Anterolateral thigh"},
                {"parameter": "Observation after mild reaction", "value": "30 minutes", "action": "Monitor before discharge"},
                {"parameter": "Monitoring after moderate reaction", "value": "4 hours", "action": "Continued observation"},
                {"parameter": "eGFR concern", "value": "<30 mL/min/1.73m2", "action": "Use lowest contrast volume, ensure hydration"},
            ],
            "contraindications": [
                "Prior severe anaphylaxis to same contrast agent (unless benefit outweighs risk with full premedication).",
                "Thyroid storm or untreated hyperthyroidism without endocrinology consult.",
                "Renal insufficiency eGFR <30  - use caution, lowest volume, hydrate.",
                "Gadolinium in eGFR <30 without nephrology consultation (NSF risk).",
            ],
        },
    },
    # ------------------------------------------------------------------ 11
    {
        "sop_id": "SOP-NEURO-011",
        "title": "Code Stroke Response Protocol",
        "department": "Neurology",
        "version": "1.4",
        "effective_date": "2025-03-01",
        "review_date": "2026-08-01",
        "raw_text": (
            "CODE STROKE RESPONSE PROTOCOL - NEUROLOGY\n"
            "Version 1.4 | Effective 2025-03-01\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol standardizes the rapid identification, imaging, and treatment "
            "of suspected acute ischemic stroke to minimize time-to-treatment.\n\n"
            "2. SCOPE\n"
            "Applies to any patient presenting with acute focal neurological deficit "
            "within 24 hours of last-known-well time, in the Emergency Department or "
            "as an inpatient.\n\n"
            "3. DEFINITIONS\n"
            "Last Known Well (LKW): the most recent time the patient was witnessed to be "
            "at their neurological baseline.\n"
            "Door-to-Needle: time from ED arrival to IV thrombolytic administration.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Activate Code Stroke immediately on recognition of FAST-positive "
            "deficit (Face drooping, Arm weakness, Speech difficulty, Time last known well).\n"
            "Step 2: Obtain point-of-care glucose immediately - hypoglycemia is a stroke "
            "mimic and must be excluded before proceeding.\n"
            "Step 3: Perform NIH Stroke Scale (NIHSS) assessment within 10 minutes of arrival.\n"
            "Step 4: Obtain non-contrast head CT within 20 minutes of arrival to rule out "
            "hemorrhage.\n"
            "Step 5: If no hemorrhage and within 4.5 hours of LKW, evaluate IV alteplase "
            "eligibility against inclusion/exclusion criteria.\n"
            "Step 6: Administer IV alteplase 0.9 mg/kg (max 90 mg), 10% as bolus over 1 "
            "minute, remainder infused over 60 minutes. Target door-to-needle <=60 minutes.\n"
            "Step 7: For large-vessel occlusion within 24 hours of LKW (per CT angiography), "
            "evaluate for mechanical thrombectomy and activate interventional neuroradiology.\n"
            "Step 8: After thrombolysis, admit to a stroke unit or ICU for neuro checks "
            "every 15 minutes for 2 hours, then every 30 minutes for 6 hours.\n"
            "Step 9: Hold antiplatelet and anticoagulant therapy for 24 hours after "
            "alteplase administration; repeat head CT at 24 hours before resuming.\n"
            "Step 10: Maintain blood pressure <=185/110 mmHg before thrombolysis and "
            "<=180/105 mmHg for 24 hours after.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- Door-to-CT: <=20 minutes\n"
            "- Door-to-needle: <=60 minutes\n"
            "- Thrombolysis window: within 4.5 hours of last known well\n"
            "- Thrombectomy window: within 24 hours of last known well (LVO on imaging)\n"
            "- Pre-thrombolysis BP ceiling: 185/110 mmHg\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Active internal bleeding or known bleeding diathesis.\n"
            "- Recent (<3 months) intracranial or intraspinal surgery, serious head trauma, "
            "or prior stroke.\n"
            "- Systolic BP >185 mmHg or diastolic BP >110 mmHg despite treatment.\n"
            "- Current anticoagulant use with INR >1.7 or elevated PT/PTT.\n"
            "- Platelet count <100,000/mm3.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Activate Code Stroke on FAST-positive deficit."},
                {"step": 2, "action": "Point-of-care glucose immediately to exclude hypoglycemia."},
                {"step": 3, "action": "NIHSS assessment within 10 minutes of arrival."},
                {"step": 4, "action": "Non-contrast head CT within 20 minutes of arrival."},
                {"step": 5, "action": "Evaluate IV alteplase eligibility if within 4.5 hours of LKW and no hemorrhage."},
                {"step": 6, "action": "Administer alteplase 0.9 mg/kg (max 90 mg); target door-to-needle <=60 min."},
                {"step": 7, "action": "Evaluate thrombectomy for LVO within 24 hours of LKW."},
                {"step": 8, "action": "Post-thrombolysis: neuro checks q15min x2h, then q30min x6h."},
                {"step": 9, "action": "Hold antiplatelets/anticoagulants 24h post-alteplase; repeat CT before resuming."},
                {"step": 10, "action": "Maintain BP <=185/110 pre-thrombolysis, <=180/105 for 24h after."},
            ],
            "thresholds": [
                {"parameter": "Door-to-CT", "value": "<=20 minutes", "action": "From ED arrival"},
                {"parameter": "Door-to-needle", "value": "<=60 minutes", "action": "From ED arrival to alteplase"},
                {"parameter": "Thrombolysis window", "value": "4.5 hours from LKW", "action": "IV alteplase eligibility"},
                {"parameter": "Thrombectomy window", "value": "24 hours from LKW", "action": "For confirmed LVO"},
                {"parameter": "Pre-thrombolysis BP ceiling", "value": "185/110 mmHg", "action": "Must treat before administering alteplase"},
            ],
            "contraindications": [
                "Active internal bleeding or known bleeding diathesis.",
                "Recent (<3 months) intracranial/intraspinal surgery, serious head trauma, or prior stroke.",
                "Systolic BP >185 or diastolic BP >110 mmHg despite treatment.",
                "Current anticoagulant use with INR >1.7.",
                "Platelet count <100,000/mm3.",
            ],
        },
    },
    # ------------------------------------------------------------------ 12
    {
        "sop_id": "SOP-OPS-012",
        "title": "Patient Flow and Bed Management Protocol",
        "department": "Operations",
        "version": "2.0",
        "effective_date": "2025-02-10",
        "review_date": "2026-07-15",
        "raw_text": (
            "PATIENT FLOW AND BED MANAGEMENT PROTOCOL - OPERATIONS\n"
            "Version 2.0 | Effective 2025-02-10\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol governs bed assignment, capacity escalation, and interdepartmental "
            "transfer coordination to minimize ED boarding and elective-case delays.\n\n"
            "2. SCOPE\n"
            "Applies to the Bed Management Center, Admitting, ED, and all inpatient units.\n\n"
            "3. DEFINITIONS\n"
            "Boarding: time an admitted patient spends in the ED awaiting an inpatient bed.\n"
            "Surge Level: hospital-wide capacity status (Green/Yellow/Red) based on occupancy.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Bed Management Center reviews real-time occupancy dashboard every "
            "30 minutes during business hours, hourly overnight.\n"
            "Step 2: On admission order, assign a bed within 60 minutes based on acuity, "
            "isolation needs, and unit specialty match.\n"
            "Step 3: If no appropriate bed is available within 90 minutes, escalate to the "
            "House Supervisor for surge-level review.\n"
            "Step 4: At Yellow surge (>=90% occupancy), activate early-discharge rounds on "
            "all units by 10:00 AM to identify dischargeable patients.\n"
            "Step 5: At Red surge (>=98% occupancy), activate the Capacity Command Center, "
            "pause elective admissions, and consider diversion per regional protocol.\n"
            "Step 6: Prioritize ED-boarding patients over scheduled elective admissions when "
            "boarding time exceeds 4 hours.\n"
            "Step 7: For interdepartmental transfers, the receiving unit must confirm bed "
            "readiness before the sending unit initiates patient transport.\n"
            "Step 8: Document all bed-assignment delays exceeding 2 hours with reason code "
            "for weekly flow-committee review.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- Bed assignment target: within 60 minutes of admission order\n"
            "- Escalation trigger: no bed available within 90 minutes\n"
            "- Yellow surge threshold: >=90% occupancy\n"
            "- Red surge threshold: >=98% occupancy\n"
            "- ED boarding escalation: >4 hours\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT transfer a hemodynamically unstable patient without physician-to-"
            "physician handoff.\n"
            "- Do NOT place patients requiring airborne isolation in a non-negative-pressure "
            "room, regardless of surge level.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Review occupancy dashboard every 30 min business hours, hourly overnight."},
                {"step": 2, "action": "Assign bed within 60 minutes of admission order."},
                {"step": 3, "action": "Escalate to House Supervisor if no bed within 90 minutes."},
                {"step": 4, "action": "Yellow surge (>=90%): early-discharge rounds by 10:00 AM."},
                {"step": 5, "action": "Red surge (>=98%): activate Capacity Command Center, pause elective admissions."},
                {"step": 6, "action": "Prioritize ED-boarding patients over elective admissions after 4h boarding."},
                {"step": 7, "action": "Receiving unit confirms bed readiness before transport begins."},
                {"step": 8, "action": "Document bed-assignment delays >2 hours with reason code."},
            ],
            "thresholds": [
                {"parameter": "Bed assignment target", "value": "60 minutes", "action": "From admission order"},
                {"parameter": "Escalation trigger", "value": "90 minutes", "action": "No bed available, escalate to House Supervisor"},
                {"parameter": "Yellow surge", "value": ">=90% occupancy", "action": "Activate early-discharge rounds"},
                {"parameter": "Red surge", "value": ">=98% occupancy", "action": "Activate Capacity Command Center"},
                {"parameter": "ED boarding escalation", "value": ">4 hours", "action": "Prioritize over elective admissions"},
            ],
            "contraindications": [
                "Transferring a hemodynamically unstable patient without physician-to-physician handoff.",
                "Placing airborne-isolation patients in non-negative-pressure rooms regardless of surge level.",
            ],
        },
    },
    # ------------------------------------------------------------------ 13
    {
        "sop_id": "SOP-OPS-013",
        "title": "Discharge Planning Protocol",
        "department": "Operations",
        "version": "2.3",
        "effective_date": "2025-01-25",
        "review_date": "2026-06-20",
        "raw_text": (
            "DISCHARGE PLANNING PROTOCOL - OPERATIONS\n"
            "Version 2.3 | Effective 2025-01-25\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol standardizes discharge planning to reduce length of stay and "
            "30-day readmission risk while ensuring safe transitions of care.\n\n"
            "2. SCOPE\n"
            "Applies to all inpatient admissions across medical, surgical, and observation "
            "units.\n\n"
            "3. DEFINITIONS\n"
            "Expected Date of Discharge (EDD): the anticipated discharge date set within "
            "24 hours of admission and updated daily on multidisciplinary rounds.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Set an Expected Date of Discharge (EDD) within 24 hours of admission "
            "and post it visibly on the unit whiteboard and in the EHR.\n"
            "Step 2: Complete a discharge-risk screen (LACE index or equivalent) within "
            "24 hours of admission to flag high-readmission-risk patients.\n"
            "Step 3: For high-risk patients, initiate case management and social work "
            "consult within 24 hours of the risk flag.\n"
            "Step 4: Conduct multidisciplinary rounds daily to update EDD and identify "
            "discharge barriers (placement, equipment, transportation, caregiver readiness).\n"
            "Step 5: Begin medication reconciliation and discharge education at least 24 "
            "hours before anticipated discharge, not on the day of discharge.\n"
            "Step 6: Confirm follow-up appointment scheduled within 7 days for high-risk "
            "patients, 14 days for standard-risk, before discharge order is written.\n"
            "Step 7: Provide written discharge instructions at a 6th-grade reading level, "
            "including red-flag symptoms warranting return to care.\n"
            "Step 8: Complete a warm handoff phone call to outpatient primary care or "
            "skilled nursing facility within 24 hours of discharge for high-risk patients.\n"
            "Step 9: Conduct a follow-up phone call within 48-72 hours post-discharge for "
            "all high-risk patients to confirm medication adherence and identify concerns.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- EDD set: within 24 hours of admission\n"
            "- Discharge-risk screen: within 24 hours of admission\n"
            "- Follow-up appointment: within 7 days (high risk) / 14 days (standard risk)\n"
            "- Post-discharge call: within 48-72 hours for high-risk patients\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT discharge a patient flagged high-risk without a confirmed post-"
            "discharge care plan and named caregiver or facility contact.\n"
            "- Do NOT finalize discharge medication list without pharmacist reconciliation "
            "for patients on 5 or more chronic medications.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Set Expected Date of Discharge within 24 hours of admission."},
                {"step": 2, "action": "Complete discharge-risk screen (LACE or equivalent) within 24 hours."},
                {"step": 3, "action": "High-risk: initiate case management/social work within 24 hours of flag."},
                {"step": 4, "action": "Daily multidisciplinary rounds to update EDD and resolve barriers."},
                {"step": 5, "action": "Begin med reconciliation/education >=24h before anticipated discharge."},
                {"step": 6, "action": "Confirm follow-up appointment (7d high-risk / 14d standard) before discharge order."},
                {"step": 7, "action": "Provide written instructions at 6th-grade reading level with red-flag symptoms."},
                {"step": 8, "action": "Warm handoff call to outpatient/SNF within 24 hours for high-risk patients."},
                {"step": 9, "action": "Follow-up call within 48-72 hours post-discharge for high-risk patients."},
            ],
            "thresholds": [
                {"parameter": "EDD set", "value": "24 hours", "action": "From admission"},
                {"parameter": "Discharge-risk screen", "value": "24 hours", "action": "From admission"},
                {"parameter": "Follow-up appointment (high risk)", "value": "7 days", "action": "Before discharge order"},
                {"parameter": "Follow-up appointment (standard risk)", "value": "14 days", "action": "Before discharge order"},
                {"parameter": "Post-discharge call", "value": "48-72 hours", "action": "High-risk patients"},
            ],
            "contraindications": [
                "Discharging a high-risk patient without a confirmed post-discharge care plan and named contact.",
                "Finalizing discharge medications without pharmacist reconciliation for 5+ chronic medications.",
            ],
        },
    },
    # ------------------------------------------------------------------ 14
    {
        "sop_id": "SOP-COMP-014",
        "title": "Clinical Documentation Standards Policy",
        "department": "Compliance",
        "version": "1.6",
        "effective_date": "2025-02-01",
        "review_date": "2026-08-01",
        "raw_text": (
            "CLINICAL DOCUMENTATION STANDARDS POLICY - COMPLIANCE\n"
            "Version 1.6 | Effective 2025-02-01\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This policy establishes minimum documentation standards for the medical "
            "record to support continuity of care, billing integrity, and regulatory "
            "compliance.\n\n"
            "2. SCOPE\n"
            "Applies to all clinical staff who create or amend entries in the electronic "
            "health record.\n\n"
            "3. DEFINITIONS\n"
            "Late Entry: a documentation entry made after the encounter it describes, "
            "clearly labeled with the actual date/time of entry and the event date/time.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Complete an admission history and physical within 24 hours of "
            "admission, or before any surgical procedure, whichever is sooner.\n"
            "Step 2: Document all progress notes within the same shift as the encounter; "
            "late entries must be labeled 'Late Entry' with both event and entry timestamps.\n"
            "Step 3: Co-sign all trainee/resident notes within 24 hours per supervising "
            "attending requirements.\n"
            "Step 4: Never use copy-forward ('copy-paste') documentation without reviewing "
            "and updating the content to reflect the current encounter.\n"
            "Step 5: Document informed consent discussions verbatim-adjacent (key risks, "
            "benefits, alternatives discussed) before any invasive procedure.\n"
            "Step 6: Complete discharge summaries within 48 hours of discharge for standard "
            "cases, within 24 hours if the patient has a follow-up appointment scheduled "
            "sooner than 48 hours.\n"
            "Step 7: Correct documentation errors using the EHR's formal amendment "
            "function only - never delete or overwrite an existing entry.\n"
            "Step 8: Flag any chart for compliance review if more than 10% of a note's "
            "content matches a prior note verbatim (auto-detected copy-forward flag).\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- History and physical: within 24 hours of admission\n"
            "- Co-signature of trainee notes: within 24 hours\n"
            "- Discharge summary: within 48 hours (24 hours if early follow-up scheduled)\n"
            "- Copy-forward flag threshold: >10% verbatim match to prior note\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT delete or overwrite an existing EHR entry; use the formal amendment "
            "workflow only.\n"
            "- Do NOT sign a note on behalf of another provider under any circumstance.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Complete H&P within 24 hours of admission or before surgery."},
                {"step": 2, "action": "Document progress notes same shift; label late entries with both timestamps."},
                {"step": 3, "action": "Co-sign trainee/resident notes within 24 hours."},
                {"step": 4, "action": "Never copy-forward without reviewing and updating content."},
                {"step": 5, "action": "Document informed consent discussion before invasive procedures."},
                {"step": 6, "action": "Complete discharge summary within 48 hours (24h if early follow-up)."},
                {"step": 7, "action": "Correct errors via formal EHR amendment function only."},
                {"step": 8, "action": "Flag charts with >10% verbatim copy-forward match for compliance review."},
            ],
            "thresholds": [
                {"parameter": "History and physical", "value": "24 hours", "action": "From admission"},
                {"parameter": "Trainee note co-signature", "value": "24 hours", "action": "From note creation"},
                {"parameter": "Discharge summary", "value": "48 hours (24h if early follow-up)", "action": "From discharge"},
                {"parameter": "Copy-forward flag threshold", "value": ">10% verbatim match", "action": "Auto-flag for compliance review"},
            ],
            "contraindications": [
                "Deleting or overwriting an existing EHR entry instead of using formal amendment.",
                "Signing a note on behalf of another provider under any circumstance.",
            ],
        },
    },
    # ------------------------------------------------------------------ 15
    {
        "sop_id": "SOP-COMP-015",
        "title": "Internal Compliance Audit Procedure",
        "department": "Compliance",
        "version": "1.2",
        "effective_date": "2025-03-10",
        "review_date": "2026-09-10",
        "raw_text": (
            "INTERNAL COMPLIANCE AUDIT PROCEDURE - COMPLIANCE\n"
            "Version 1.2 | Effective 2025-03-10\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This procedure defines how internal compliance audits are scoped, conducted, "
            "and remediated across clinical and administrative departments.\n\n"
            "2. SCOPE\n"
            "Applies to the Compliance Office and any department selected for scheduled "
            "or for-cause audit.\n\n"
            "3. DEFINITIONS\n"
            "For-Cause Audit: an unscheduled audit triggered by a complaint, incident, or "
            "regulatory inquiry rather than the annual audit calendar.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Publish an annual audit calendar by December 1st covering all "
            "high-risk departments (those with prior findings or high regulatory exposure).\n"
            "Step 2: Notify the audited department in writing at least 10 business days "
            "before a scheduled audit; for-cause audits may proceed without advance notice.\n"
            "Step 3: Pull a statistically representative sample of records - minimum 30 "
            "charts or 10% of monthly volume, whichever is greater.\n"
            "Step 4: Score each sampled record against the applicable standard checklist "
            "(documentation, consent, billing, or safety, depending on audit scope).\n"
            "Step 5: Classify findings as Critical (immediate patient safety or legal risk), "
            "Major (systemic pattern), or Minor (isolated deviation).\n"
            "Step 6: Issue a preliminary findings report to department leadership within "
            "5 business days of audit completion.\n"
            "Step 7: Department leadership must submit a corrective action plan (CAPA) "
            "within 10 business days of receiving Critical or Major findings.\n"
            "Step 8: Conduct a follow-up audit within 90 days of CAPA submission to verify "
            "remediation effectiveness.\n"
            "Step 9: Escalate unresolved Critical findings to the Compliance Committee and "
            "Chief Medical Officer immediately, not on the standard reporting cycle.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- Advance notice for scheduled audits: 10 business days\n"
            "- Sample size: minimum 30 charts or 10% of monthly volume\n"
            "- Preliminary findings report: within 5 business days of audit completion\n"
            "- CAPA submission: within 10 business days of Critical/Major findings\n"
            "- Follow-up audit: within 90 days of CAPA submission\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT allow the audited department to select its own record sample.\n"
            "- Do NOT delay escalation of a Critical finding to await the standard "
            "reporting cycle.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Publish annual audit calendar by December 1st for high-risk departments."},
                {"step": 2, "action": "Notify department 10 business days before scheduled audit (for-cause exempt)."},
                {"step": 3, "action": "Sample minimum 30 charts or 10% of monthly volume."},
                {"step": 4, "action": "Score records against applicable standard checklist."},
                {"step": 5, "action": "Classify findings: Critical, Major, or Minor."},
                {"step": 6, "action": "Issue preliminary findings report within 5 business days."},
                {"step": 7, "action": "Department submits CAPA within 10 business days of Critical/Major findings."},
                {"step": 8, "action": "Follow-up audit within 90 days of CAPA submission."},
                {"step": 9, "action": "Escalate unresolved Critical findings to Compliance Committee/CMO immediately."},
            ],
            "thresholds": [
                {"parameter": "Advance notice (scheduled audit)", "value": "10 business days", "action": "Before audit"},
                {"parameter": "Sample size", "value": ">=30 charts or 10% of volume", "action": "Whichever is greater"},
                {"parameter": "Preliminary findings report", "value": "5 business days", "action": "From audit completion"},
                {"parameter": "CAPA submission", "value": "10 business days", "action": "From Critical/Major finding"},
                {"parameter": "Follow-up audit", "value": "90 days", "action": "From CAPA submission"},
            ],
            "contraindications": [
                "Allowing the audited department to select its own record sample.",
                "Delaying escalation of a Critical finding to the standard reporting cycle.",
            ],
        },
    },
    # ------------------------------------------------------------------ 16
    {
        "sop_id": "SOP-HR-016",
        "title": "Staff Onboarding and Credentialing Protocol",
        "department": "Human Resources",
        "version": "2.1",
        "effective_date": "2025-01-05",
        "review_date": "2026-07-01",
        "raw_text": (
            "STAFF ONBOARDING AND CREDENTIALING PROTOCOL - HUMAN RESOURCES\n"
            "Version 2.1 | Effective 2025-01-05\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol governs the onboarding and credentialing of new clinical staff "
            "to ensure verified qualifications before granting patient-care privileges.\n\n"
            "2. SCOPE\n"
            "Applies to all new physicians, advanced practice providers, and nursing staff.\n\n"
            "3. DEFINITIONS\n"
            "Primary Source Verification (PSV): confirming credentials directly with the "
            "issuing institution or licensing body, not from applicant-provided copies.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Initiate primary source verification of license, board certification, "
            "and education within 5 business days of offer acceptance.\n"
            "Step 2: Complete a background check and OIG/SAM exclusion list screening "
            "before the candidate's first clinical shift.\n"
            "Step 3: Verify current BLS/ACLS certification (and PALS where applicable) "
            "before granting any patient-care privileges.\n"
            "Step 4: Complete facility orientation, including EHR training and safety "
            "systems overview, within the first 3 business days of employment.\n"
            "Step 5: Assign a preceptor for clinical staff for a minimum 4-week supervised "
            "period before independent practice.\n"
            "Step 6: Present new privileging requests to the Credentials Committee at its "
            "next scheduled meeting; temporary privileges may be granted for urgent need "
            "pending full review, not to exceed 120 days.\n"
            "Step 7: Re-verify credentials at each 2-year reappointment cycle, including "
            "malpractice history and any new disciplinary actions.\n"
            "Step 8: Immediately suspend clinical privileges if a license lapse, exclusion "
            "list match, or unresolved malpractice claim is identified at any point.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- PSV initiation: within 5 business days of offer acceptance\n"
            "- Facility orientation: within 3 business days of employment start\n"
            "- Preceptor period: minimum 4 weeks for clinical staff\n"
            "- Temporary privileges cap: 120 days pending full Credentials Committee review\n"
            "- Reappointment cycle: every 2 years\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT grant any patient-care privileges before BLS/ACLS verification is "
            "on file.\n"
            "- Do NOT allow independent practice before the minimum preceptor period is "
            "completed and signed off.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Initiate primary source verification within 5 business days of offer acceptance."},
                {"step": 2, "action": "Complete background check and OIG/SAM exclusion screening before first shift."},
                {"step": 3, "action": "Verify BLS/ACLS/PALS before granting patient-care privileges."},
                {"step": 4, "action": "Complete facility orientation within 3 business days of employment."},
                {"step": 5, "action": "Assign preceptor for minimum 4-week supervised period."},
                {"step": 6, "action": "Present privileging request to Credentials Committee; temp privileges capped at 120 days."},
                {"step": 7, "action": "Re-verify credentials at each 2-year reappointment cycle."},
                {"step": 8, "action": "Immediately suspend privileges on license lapse or exclusion list match."},
            ],
            "thresholds": [
                {"parameter": "PSV initiation", "value": "5 business days", "action": "From offer acceptance"},
                {"parameter": "Facility orientation", "value": "3 business days", "action": "From employment start"},
                {"parameter": "Preceptor period", "value": "4 weeks minimum", "action": "Before independent practice"},
                {"parameter": "Temporary privileges cap", "value": "120 days", "action": "Pending Credentials Committee review"},
                {"parameter": "Reappointment cycle", "value": "2 years", "action": "Full credential re-verification"},
            ],
            "contraindications": [
                "Granting patient-care privileges before BLS/ACLS verification is on file.",
                "Allowing independent practice before the preceptor period is completed and signed off.",
            ],
        },
    },
    # ------------------------------------------------------------------ 17
    {
        "sop_id": "SOP-HR-017",
        "title": "Mandatory Training Compliance Protocol",
        "department": "Human Resources",
        "version": "1.5",
        "effective_date": "2025-01-10",
        "review_date": "2026-07-10",
        "raw_text": (
            "MANDATORY TRAINING COMPLIANCE PROTOCOL - HUMAN RESOURCES\n"
            "Version 1.5 | Effective 2025-01-10\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol ensures all staff complete and maintain required competency "
            "and compliance training on schedule.\n\n"
            "2. SCOPE\n"
            "Applies to all employees, contractors, and credentialed medical staff.\n\n"
            "3. DEFINITIONS\n"
            "Core Competencies: annual mandatory modules (HIPAA privacy, infection "
            "control, fire/life safety, workplace violence prevention).\n\n"
            "4. PROCEDURE\n"
            "Step 1: Assign core competency modules on the employee's hire date, due for "
            "completion within 30 days of hire.\n"
            "Step 2: Assign annual refresher modules 60 days before each employee's "
            "training-anniversary date.\n"
            "Step 3: Send an automated reminder at 30 days, 14 days, and 3 days before "
            "the due date for any incomplete module.\n"
            "Step 4: Suspend EHR access for any employee whose core competency training "
            "becomes more than 15 days overdue.\n"
            "Step 5: Department managers review a monthly compliance report and follow "
            "up directly with any staff member below 100% completion.\n"
            "Step 6: Role-specific training (e.g., restraint use, moderate sedation) "
            "must be completed before the employee performs that task independently.\n"
            "Step 7: Maintain training records for a minimum of 6 years for regulatory "
            "and accreditation survey purposes.\n"
            "Step 8: Report house-wide training compliance rate to the Quality Committee "
            "quarterly; flag any department below 90% for corrective action planning.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- New-hire core competency deadline: 30 days from hire\n"
            "- EHR access suspension trigger: training >15 days overdue\n"
            "- Training record retention: minimum 6 years\n"
            "- Department compliance flag threshold: below 90%\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT allow an employee to perform a role-specific task requiring "
            "specialized training before that module is marked complete.\n"
            "- Do NOT restore EHR access after a suspension without confirmed training "
            "completion.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Assign core competency modules on hire date, due within 30 days."},
                {"step": 2, "action": "Assign annual refresher modules 60 days before training-anniversary date."},
                {"step": 3, "action": "Automated reminders at 30, 14, and 3 days before due date."},
                {"step": 4, "action": "Suspend EHR access if core training >15 days overdue."},
                {"step": 5, "action": "Managers review monthly compliance report, follow up below 100%."},
                {"step": 6, "action": "Role-specific training completed before independent performance of that task."},
                {"step": 7, "action": "Maintain training records for minimum 6 years."},
                {"step": 8, "action": "Report compliance rate to Quality Committee quarterly; flag departments <90%."},
            ],
            "thresholds": [
                {"parameter": "New-hire core competency deadline", "value": "30 days", "action": "From hire date"},
                {"parameter": "EHR access suspension trigger", "value": ">15 days overdue", "action": "Core competency training"},
                {"parameter": "Training record retention", "value": "6 years minimum", "action": "Regulatory/accreditation"},
                {"parameter": "Department compliance flag", "value": "<90%", "action": "Corrective action planning"},
            ],
            "contraindications": [
                "Allowing a role-specific task before the required specialized training module is complete.",
                "Restoring EHR access after suspension without confirmed training completion.",
            ],
        },
    },
    # ------------------------------------------------------------------ 18
    {
        "sop_id": "SOP-QI-018",
        "title": "Patient Safety Incident Reporting Protocol",
        "department": "Quality",
        "version": "2.4",
        "effective_date": "2025-02-15",
        "review_date": "2026-08-15",
        "raw_text": (
            "PATIENT SAFETY INCIDENT REPORTING PROTOCOL - QUALITY\n"
            "Version 2.4 | Effective 2025-02-15\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol defines how patient safety events are reported, triaged, and "
            "investigated to drive systemic improvement rather than individual blame.\n\n"
            "2. SCOPE\n"
            "Applies to all staff who witness, discover, or are involved in a patient "
            "safety event, near-miss, or unsafe condition.\n\n"
            "3. DEFINITIONS\n"
            "Sentinel Event: a patient safety event resulting in death, permanent harm, "
            "or severe temporary harm requiring intervention to sustain life.\n"
            "Near Miss: an event that did not reach the patient or caused no harm.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Report any safety event or near-miss in the electronic event-"
            "reporting system within 24 hours of discovery, regardless of harm level.\n"
            "Step 2: For a Sentinel Event, notify the House Supervisor and Risk Management "
            "immediately (within 1 hour) by phone in addition to the electronic report.\n"
            "Step 3: Preserve all physical evidence (equipment, medication vials, devices) "
            "involved in the event; do not discard or return to service.\n"
            "Step 4: Risk Management triages every report within 1 business day and "
            "assigns a harm-severity score (None, Mild, Moderate, Severe, Sentinel).\n"
            "Step 5: Convene a Root Cause Analysis (RCA) team within 5 business days for "
            "any Severe or Sentinel event, with clinical and non-clinical representation.\n"
            "Step 6: Complete the RCA and submit findings to the Patient Safety Committee "
            "within 45 days of the event, per accreditation timelines.\n"
            "Step 7: Maintain event-reporting confidentiality under the peer-review "
            "privilege; reports must never be used for individual disciplinary action "
            "based on reporting alone.\n"
            "Step 8: Track corrective actions from every RCA to closure and verify "
            "effectiveness at 90 days post-implementation.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- Standard event report: within 24 hours of discovery\n"
            "- Sentinel event notification: within 1 hour (phone, in addition to report)\n"
            "- Risk Management triage: within 1 business day\n"
            "- RCA team convened: within 5 business days for Severe/Sentinel events\n"
            "- RCA completion: within 45 days of the event\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT discard or return to service any equipment/medication involved in "
            "a reported event before Risk Management review.\n"
            "- Do NOT use a good-faith safety report as the sole basis for disciplinary "
            "action.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Report event/near-miss in electronic system within 24 hours of discovery."},
                {"step": 2, "action": "Sentinel event: notify House Supervisor and Risk Management within 1 hour by phone."},
                {"step": 3, "action": "Preserve all physical evidence involved in the event."},
                {"step": 4, "action": "Risk Management triages report within 1 business day, assigns severity score."},
                {"step": 5, "action": "Convene RCA team within 5 business days for Severe/Sentinel events."},
                {"step": 6, "action": "Complete RCA and submit to Patient Safety Committee within 45 days."},
                {"step": 7, "action": "Maintain peer-review confidentiality; never sole basis for discipline."},
                {"step": 8, "action": "Track corrective actions to closure; verify effectiveness at 90 days."},
            ],
            "thresholds": [
                {"parameter": "Standard event report", "value": "24 hours", "action": "From discovery"},
                {"parameter": "Sentinel event notification", "value": "1 hour", "action": "Phone, in addition to electronic report"},
                {"parameter": "Risk Management triage", "value": "1 business day", "action": "Assign severity score"},
                {"parameter": "RCA team convened", "value": "5 business days", "action": "Severe/Sentinel events"},
                {"parameter": "RCA completion", "value": "45 days", "action": "From event date"},
            ],
            "contraindications": [
                "Discarding or returning to service equipment/medication involved in a reported event before review.",
                "Using a good-faith safety report as the sole basis for disciplinary action.",
            ],
        },
    },
    # ------------------------------------------------------------------ 19
    {
        "sop_id": "SOP-QI-019",
        "title": "Quality Improvement Review Cycle Protocol",
        "department": "Quality",
        "version": "1.3",
        "effective_date": "2025-03-05",
        "review_date": "2026-09-05",
        "raw_text": (
            "QUALITY IMPROVEMENT REVIEW CYCLE PROTOCOL - QUALITY\n"
            "Version 1.3 | Effective 2025-03-05\n"
            "DISCLAIMER: This is a SYNTHETIC SOP for research demonstration only.\n\n"
            "1. PURPOSE\n"
            "This protocol defines the standard Plan-Do-Study-Act (PDSA) cycle used to "
            "drive continuous quality improvement across clinical departments.\n\n"
            "2. SCOPE\n"
            "Applies to all department-level quality improvement initiatives sponsored "
            "by the Quality Committee.\n\n"
            "3. DEFINITIONS\n"
            "PDSA Cycle: Plan-Do-Study-Act - a structured, iterative improvement "
            "methodology run in short test cycles before house-wide rollout.\n\n"
            "4. PROCEDURE\n"
            "Step 1: Identify improvement opportunities from incident reports, quality "
            "metrics dashboards, patient satisfaction data, or staff safety reports.\n"
            "Step 2: Charter a QI project with a defined aim statement, measurable target, "
            "and timeline; present to the Quality Committee for sponsorship approval.\n"
            "Step 3: Establish baseline measurement for the target metric over a minimum "
            "of 4 weeks before any intervention begins.\n"
            "Step 4: Run a small-scale PDSA test cycle (single unit or shift) for 2-4 "
            "weeks before considering broader rollout.\n"
            "Step 5: Study results against the baseline; a successful cycle requires "
            "statistically or clinically meaningful improvement, not anecdotal impression.\n"
            "Step 6: Act - either adapt the intervention and re-test, adopt and expand "
            "scope, or abandon if no improvement is demonstrated after two test cycles.\n"
            "Step 7: Report active QI project status to the Quality Committee monthly, "
            "including current PDSA cycle stage and metric trend.\n"
            "Step 8: Upon successful house-wide adoption, transition the metric to "
            "standard dashboard monitoring with a 6-month sustainment check.\n\n"
            "5. THRESHOLDS AND TARGETS\n"
            "- Baseline measurement period: minimum 4 weeks\n"
            "- PDSA test cycle length: 2-4 weeks\n"
            "- Project status reporting: monthly to Quality Committee\n"
            "- Post-adoption sustainment check: 6 months\n\n"
            "6. CONTRAINDICATIONS\n"
            "- Do NOT roll out an intervention house-wide without at least one completed "
            "small-scale PDSA test cycle.\n"
            "- Do NOT close out a QI project as 'successful' without a documented "
            "sustainment check.\n"
        ),
        "structured_json": {
            "steps": [
                {"step": 1, "action": "Identify improvement opportunities from incident reports/quality data."},
                {"step": 2, "action": "Charter QI project with aim statement, target, timeline; get Committee sponsorship."},
                {"step": 3, "action": "Establish baseline measurement over minimum 4 weeks before intervention."},
                {"step": 4, "action": "Run small-scale PDSA test cycle for 2-4 weeks."},
                {"step": 5, "action": "Study results against baseline for meaningful improvement."},
                {"step": 6, "action": "Act: adapt and re-test, adopt and expand, or abandon after two cycles."},
                {"step": 7, "action": "Report project status to Quality Committee monthly."},
                {"step": 8, "action": "After adoption, transition to dashboard monitoring with 6-month sustainment check."},
            ],
            "thresholds": [
                {"parameter": "Baseline measurement period", "value": "4 weeks minimum", "action": "Before intervention"},
                {"parameter": "PDSA test cycle length", "value": "2-4 weeks", "action": "Small-scale test"},
                {"parameter": "Project status reporting", "value": "Monthly", "action": "To Quality Committee"},
                {"parameter": "Sustainment check", "value": "6 months", "action": "Post house-wide adoption"},
            ],
            "contraindications": [
                "Rolling out an intervention house-wide without a completed small-scale PDSA test cycle.",
                "Closing a QI project as successful without a documented sustainment check.",
            ],
        },
    },
]
