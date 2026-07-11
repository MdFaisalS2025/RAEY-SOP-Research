# Dataset Plan

> Meridian evaluation and training data strategy.

---

## 1. Public Datasets

### PubMedQA
- **Source**: https://pubmedqa.github.io/
- **Size**: ~273K QA pairs (1K expert-annotated, 61K unlabeled, 211K artificial)
- **Use**: Baseline medical QA evaluation; test whether retrieval and generation generalize to biomedical questions
- **Relevance**: Questions derived from PubMed abstracts; tests the system's ability to reason over medical text

### MedQA (USMLE)
- **Source**: https://github.com/jnez71/MedQA
- **Size**: ~12K multiple-choice questions from US Medical Licensing Exams
- **Use**: Benchmark medical knowledge accuracy; compare Meridian's answer quality against established baselines
- **Relevance**: Gold-standard medical knowledge questions with verified correct answers

### MedMCQA
- **Source**: https://medmcqa.github.io/
- **Size**: ~194K multiple-choice questions from Indian medical entrance exams (AIIMS, NEET)
- **Use**: Large-scale medical QA evaluation with diverse question types
- **Relevance**: Covers clinical, procedural, and diagnostic questions

### MIMIC-IV (Clinical Notes)
- **Source**: https://physionet.org/content/mimiciv/
- **Access**: Requires PhysioNet credentialed access and CITI training
- **Size**: De-identified clinical records from Beth Israel Deaconess Medical Center
- **Use**: Source material for constructing realistic clinical scenarios and context-aware queries
- **Relevance**: Real clinical language patterns and terminology

### MTSamples (Medical Transcriptions)
- **Source**: https://mtsamples.com/
- **Size**: ~5K medical transcription samples across 40 specialties
- **Use**: Source material for generating realistic clinical queries and understanding department-specific language
- **Relevance**: Covers diverse medical specialties with real clinical language

### ExpertQA
- **Source**: https://github.com/chkla/ExpertQA
- **Size**: ~2K expert-written QA pairs across multiple domains including medicine
- **Use**: High-quality evaluation set with expert-verified answers and attribution requirements
- **Relevance**: Tests answer quality and source attribution, closely matches Meridian's use case

## 2. Synthetic SOP Construction

Since real hospital SOPs are proprietary, we construct a synthetic SOP corpus for development and evaluation.

### Construction Process

1. **Template Design** -- Create SOP templates based on publicly available hospital policy frameworks (Joint Commission standards, WHO guidelines, CDC protocols)

2. **Department Coverage** -- Generate SOPs for key departments:
   - Emergency Department (triage, resuscitation, trauma)
   - Infection Control (hand hygiene, isolation, PPE)
   - Pharmacy (medication administration, storage, disposal)
   - ICU (ventilator management, sedation, monitoring)
   - Surgery (pre-op checklist, sterile technique, post-op care)
   - General Nursing (patient assessment, fall prevention, discharge)
   - Laboratory (specimen handling, reporting, quality control)
   - Radiology (contrast protocols, patient preparation, safety)

3. **Content Sources** -- Derive SOP content from:
   - WHO patient safety guidelines (publicly available)
   - CDC infection control guidelines
   - Published clinical practice guidelines (open access)
   - Medical textbook procedures (paraphrased)
   - Joint Commission standards summaries

4. **Structure** -- Each synthetic SOP includes:
   - SOP ID and title
   - Purpose and scope
   - Definitions and abbreviations
   - Responsibilities (by role)
   - Step-by-step procedure
   - Safety precautions
   - Documentation requirements
   - References
   - Revision history

5. **Scale Target** -- 50-100 synthetic SOPs, each 5-20 pages, totaling ~500K tokens of content

### QA Pair Generation

For each synthetic SOP, generate evaluation QA pairs:

- **Factual questions** -- "What temperature should vaccines be stored at?"
- **Procedural questions** -- "What are the steps for central line insertion?"
- **Policy questions** -- "Who is authorized to administer controlled substances?"
- **Cross-SOP questions** -- "What PPE is required for both TB and COVID isolation?"
- **Edge cases** -- Questions where the SOP is ambiguous or silent

Target: 500-1000 QA pairs with gold-standard answers and source citations.

## 3. Real Hospital SOP Access Plan

### Short-Term (Thesis Timeline)
- Use synthetic SOPs for all development and evaluation
- Approach 1-2 local hospitals for anonymized SOP samples (non-binding, exploratory)
- Work with thesis advisor to identify hospital contacts

### Medium-Term (Post-Thesis)
- Formal data sharing agreement with a partner hospital
- IRB approval for handling institutional documents
- Anonymization pipeline: strip hospital names, staff names, location-specific details
- Pilot deployment with a single department (e.g., Infection Control)

### Requirements for Real SOPs
- All patient-identifying information must be absent (SOPs should not contain PHI, but verify)
- Hospital name and specific location references anonymized
- Data sharing agreement covering usage scope, retention, and destruction
- Compliance with local data protection regulations

## 4. Evaluation Data Plan

### Retrieval Evaluation Set
- 200+ queries mapped to known relevant SOP chunks
- Binary relevance judgments (relevant / not relevant) per chunk
- Graded relevance (0-3) for nDCG computation
- Stratified by department and question type

### Generation Evaluation Set
- 100+ queries with gold-standard reference answers
- Each reference answer includes:
  - The correct answer text
  - Source SOP and section citations
  - Key claims that must be present
  - Common errors to check for (hallucination probes)

### Hallucination Test Set
- 50+ answer pairs: one correct, one with injected hallucinations
- Types of hallucination:
  - Fabricated dosages or measurements
  - Incorrect procedure ordering
  - Attribution to wrong SOP
  - Plausible but unsupported claims
- Used to evaluate verification agent precision and recall

### User Study Data (Planned)
- Task-based evaluation: 10-20 clinical scenarios
- Metrics: time to answer, correctness, confidence, satisfaction
- Participants: medical students or junior clinicians (pending ethics approval)
- Comparison: Meridian vs. manual PDF search vs. keyword search
