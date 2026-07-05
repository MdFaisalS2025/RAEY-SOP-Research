from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, KeepTogether
)

doc = SimpleDocTemplate(
    "SOP-Guard_Research_Proposal.pdf",
    pagesize=letter,
    topMargin=0.75*inch,
    bottomMargin=0.75*inch,
    leftMargin=0.85*inch,
    rightMargin=0.85*inch,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'DocTitle', parent=styles['Title'], fontSize=22, spaceAfter=4,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'Subtitle', parent=styles['Normal'], fontSize=11, alignment=TA_CENTER,
    textColor=HexColor('#4a5568'), spaceAfter=6, fontName='Helvetica-Oblique'
))
styles.add(ParagraphStyle(
    'SectionHead', parent=styles['Heading1'], fontSize=15, spaceBefore=18,
    spaceAfter=8, textColor=HexColor('#1a365d'), fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'SubHead', parent=styles['Heading2'], fontSize=12, spaceBefore=12,
    spaceAfter=6, textColor=HexColor('#2d3748'), fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'Body', parent=styles['Normal'], fontSize=10, leading=14,
    alignment=TA_JUSTIFY, spaceAfter=6
))
styles.add(ParagraphStyle(
    'BulletCustom', parent=styles['Normal'], fontSize=10, leading=14,
    leftIndent=20, bulletIndent=8, spaceAfter=3
))
styles.add(ParagraphStyle(
    'BulletSub', parent=styles['Normal'], fontSize=9.5, leading=13,
    leftIndent=36, bulletIndent=24, spaceAfter=2, textColor=HexColor('#4a5568')
))
styles.add(ParagraphStyle(
    'CodeBlock', parent=styles['Normal'], fontSize=8, leading=10,
    fontName='Courier', leftIndent=20, spaceAfter=8,
    backColor=HexColor('#f7fafc'), borderColor=HexColor('#e2e8f0'),
    borderWidth=0.5, borderPadding=6
))
styles.add(ParagraphStyle(
    'Caption', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
    textColor=HexColor('#718096'), spaceAfter=10, fontName='Helvetica-Oblique'
))

story = []

# ── TITLE PAGE ──
story.append(Spacer(1, 1.5*inch))
story.append(Paragraph("SOP-Guard", styles['DocTitle']))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Agentic RAG for Procedurally-Faithful Clinical Decision Support",
    styles['Subtitle']
))
story.append(Spacer(1, 4))
story.append(HRFlowable(width="60%", thickness=1.5, color=HexColor('#1a365d'),
                         spaceAfter=12, spaceBefore=6))
story.append(Paragraph("Research Proposal &amp; System Design Document", styles['Subtitle']))
story.append(Spacer(1, 0.6*inch))

meta_data = [
    ["Project:", "ClinicalSOP-RAG with Procedural Faithfulness Verification"],
    ["Focus:", "Hospital SOP Question-Answering with Agentic Verification"],
    ["Date:", "June 2026"],
]
meta_table = Table(meta_data, colWidths=[1.2*inch, 4.5*inch])
meta_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#2d3748')),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(meta_table)
story.append(PageBreak())

# ── TABLE OF CONTENTS ──
story.append(Paragraph("Table of Contents", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=12))
toc_items = [
    "1. System Overview",
    "2. Key Advanced Features",
    "3. System Architecture",
    "4. Technology Stack",
    "5. Datasets",
    "6. Voice Interface Analysis",
    "7. Why This System Will Be Used in Hospitals",
    "8. Thesis Summary",
]
for item in toc_items:
    story.append(Paragraph(item, styles['Body']))
story.append(PageBreak())

# ── SECTION 1 ──
story.append(Paragraph("1. System Overview", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))
story.append(Paragraph(
    "SOP-Guard is an AI system that helps doctors and nurses get instant, accurate answers to questions "
    "about hospital Standard Operating Procedures (SOPs). When a clinician asks something like "
    "<i>\"What's the sepsis protocol for a patient with renal impairment?\"</i>, the system retrieves "
    "the relevant SOP sections, generates a grounded answer, and then <b>automatically verifies</b> that "
    "the answer doesn't violate any clinical thresholds, skip required steps, or miss contraindications.",
    styles['Body']
))
story.append(Paragraph(
    "What makes SOP-Guard advanced is its <b>agentic architecture</b>: instead of a single LLM call, "
    "multiple specialized AI agents collaborate — one retrieves evidence, one reasons about the answer, "
    "one verifies procedural correctness, and one explains the reasoning chain to the clinician. The system "
    "learns from clinician feedback over time, flags its own uncertainty, and is designed to run on hospital "
    "infrastructure without sending patient data to external servers.",
    styles['Body']
))

# ── SECTION 2 ──
story.append(Paragraph("2. Key Advanced Features", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

features = [
    ("Agentic Pipeline (LangGraph-based)", [
        "Multi-agent orchestration with conditional routing — not a fixed chain",
        "Agents can loop back (e.g., verifier requests additional retrieval if evidence is insufficient)",
    ]),
    ("Procedural Faithfulness Verifier (Core Research Contribution)", [
        "Checks three violation types: threshold errors, sequence violations, contraindication misses",
        "Uses structured SOP representations (not just raw text) for formal verification",
        "Produces a faithfulness score with specific violation citations",
    ]),
    ("Confidence-Gated Output", [
        "Every response carries a calibrated confidence score",
        "Low-confidence answers trigger automatic escalation with links to source SOP",
        "Abstention is preferred over hallucination",
    ]),
    ("Explainability Layer", [
        "Step-by-step reasoning trace: which SOP sections retrieved → how answer composed → what verifier checked",
        "Highlighted source passages with relevance scores",
        "Counterfactual explanations: \"If the patient had [X], the answer would change because...\"",
    ]),
    ("Clinician Feedback Loop", [
        "Thumbs up/down + optional free-text correction on every response",
        "Corrections used to: flag SOPs needing updates, fine-tune retrieval ranking, add hard-negative examples",
        "Monthly feedback digest for hospital quality teams",
    ]),
    ("Memory System", [
        "Short-term: Conversation context within a session (multi-turn clarification)",
        "Long-term: Per-department query patterns — surfaces FAQs, identifies confusing SOP sections",
    ]),
    ("Structured SOP Knowledge Base", [
        "SOPs parsed into semi-structured format: steps → preconditions → decision points → thresholds → contraindications",
        "Enables formal rule-checking beyond what pure LLM reasoning can do",
    ]),
]

for title, bullets in features:
    story.append(Paragraph(f"<b>{title}</b>", styles['BulletCustom']))
    for b in bullets:
        story.append(Paragraph(f"• {b}", styles['BulletSub']))
    story.append(Spacer(1, 4))

# ── SECTION 3 ──
story.append(PageBreak())
story.append(Paragraph("3. System Architecture", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

stages = [
    ("Stage 1: Query Intake",
     "Clinician submits a question via web/mobile interface. The <b>Query Understanding Agent</b> classifies "
     "the query type (threshold check, sequence question, contraindication lookup, general SOP question) and "
     "extracts key clinical entities (drug names, conditions, patient parameters)."),
    ("Stage 2: Retrieval",
     "The <b>Retrieval Agent</b> performs hybrid search over the SOP knowledge base: dense retrieval "
     "(embedding similarity) for semantic matching, sparse retrieval (BM25) for exact term matching "
     "(drug names, dosage numbers), and metadata filtering by department, SOP category, and recency. "
     "A cross-encoder re-ranks to select top-k passages. If evidence is insufficient, the agent "
     "reformulates the query and retries once."),
    ("Stage 3: Answer Generation",
     "The <b>Reasoning Agent</b> synthesizes an answer grounded strictly in retrieved passages using "
     "structured prompting that forces citation of source passages. For multi-step procedures, it outputs "
     "a numbered step list with decision branch points."),
    ("Stage 4: Procedural Verification",
     "The <b>Verifier Agent</b> checks the generated answer against the structured SOP representation: "
     "<b>Threshold check</b> — Are all numerical values consistent with the SOP? "
     "<b>Sequence check</b> — Are steps in the correct order? Are any mandatory steps omitted? "
     "<b>Contraindication check</b> — Does the answer account for stated contraindications? "
     "On FAIL: the answer is regenerated with the violation flagged as a constraint (max 1 retry, then escalation)."),
    ("Stage 5: Confidence Scoring &amp; Output",
     "Confidence score computed from: retrieval relevance + verifier result + answer-source overlap. "
     "Three output tiers: <b>High confidence</b> (full answer displayed), <b>Medium confidence</b> "
     "(answer with advisory banner + link to source SOP), <b>Low confidence</b> (answer withheld, "
     "clinician directed to source SOP or human expert)."),
    ("Stage 6: Feedback Collection",
     "Response displayed with source highlights, reasoning trace, and feedback buttons. Feedback stored "
     "in a structured log with query, response, clinician role, department, and correction text."),
]

for title, desc in stages:
    story.append(Paragraph(title, styles['SubHead']))
    story.append(Paragraph(desc, styles['Body']))

story.append(Spacer(1, 8))
story.append(Paragraph("<b>LangGraph Orchestration Flow</b>", styles['Body']))
story.append(Paragraph(
    "QueryIntake → Retrieval → [sufficient?] → Reasoning → Verification → "
    "[pass?] → ConfidenceGate → Output → Feedback",
    styles['CodeBlock']
))
story.append(Paragraph(
    "The graph has conditional edges: the verifier can route back to retrieval or reasoning, and the "
    "confidence gate can route to escalation. This is a core advantage of LangGraph over linear chains.",
    styles['Body']
))

# ── SECTION 4 ──
story.append(PageBreak())
story.append(Paragraph("4. Technology Stack", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

tech_data = [
    ["Component", "Technology"],
    ["LLM (Generation)", "Claude Sonnet 4.6 (primary); Llama 3.1 70B (local fallback)"],
    ["LLM (Verification)", "Same LLM with structured JSON output for formal checks"],
    ["Orchestration", "LangGraph (deterministic graph with conditional routing)"],
    ["Embeddings", "text-embedding-3-large or BGE-M3 (open-source)"],
    ["Vector Database", "Qdrant (hybrid search, metadata filtering, on-prem)"],
    ["Sparse Retrieval", "BM25 via Elasticsearch or Qdrant sparse vectors"],
    ["Cross-Encoder", "ms-marco-MiniLM-L12 or Cohere Rerank"],
    ["SOP Parsing", "PyMuPDF + LLM-assisted structuring into JSON"],
    ["Backend", "FastAPI (Python)"],
    ["Frontend", "React + Tailwind CSS (mobile-responsive PWA)"],
    ["Feedback Store", "PostgreSQL (structured logs)"],
    ["Deployment", "Docker / Kubernetes for hospital data center"],
    ["Evaluation", "RAGAS + custom faithfulness metrics"],
]

tech_table = Table(tech_data, colWidths=[1.6*inch, 4.2*inch])
tech_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
]))
story.append(tech_table)

story.append(Spacer(1, 12))
story.append(Paragraph("Why LangGraph Over Alternatives", styles['SubHead']))
why_items = [
    "<b>vs. simple chains:</b> LangGraph supports cycles (verifier → re-retrieval) and conditional branching, essential for the verify-and-retry loop.",
    "<b>vs. CrewAI/AutoGen:</b> Those frameworks are designed for autonomous multi-agent chat, which introduces unpredictability. SOP-Guard needs a deterministic, auditable control flow.",
    "<b>vs. DSPy:</b> DSPy is strong for prompt optimization but doesn't natively support stateful agent orchestration.",
]
for item in why_items:
    story.append(Paragraph(f"• {item}", styles['BulletCustom']))

# ── SECTION 5 ──
story.append(PageBreak())
story.append(Paragraph("5. Datasets", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

story.append(Paragraph("5.1 Public Datasets for Training &amp; Evaluation", styles['SubHead']))

ds_data = [
    ["Dataset", "Use", "Access"],
    ["PubMedQA", "Clinical QA evaluation; 1,000 expert-labeled pairs", "Free (HuggingFace)"],
    ["MedQA (USMLE)", "Clinical reasoning; 12,723 MCQs", "Free (GitHub)"],
    ["MedMCQA", "194K medical MCQs covering clinical procedures", "Free (HuggingFace)"],
    ["MIMIC-IV (Notes)", "Procedure descriptions for entity extraction", "PhysioNet (credentialed)"],
    ["WikiDoc / StatPearls", "Clinical reference articles for retrieval testing", "Free"],
    ["ExpertQA", "2,177 expert-validated QA pairs incl. medicine", "Free (GitHub)"],
    ["MTSamples", "Medical transcription samples for entity extraction", "Free"],
]
ds_table = Table(ds_data, colWidths=[1.3*inch, 2.8*inch, 1.5*inch])
ds_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
]))
story.append(ds_table)

story.append(Spacer(1, 10))
story.append(Paragraph("5.2 Creating the SOP Dataset", styles['SubHead']))
story.append(Paragraph(
    "No public SOP dataset exists. The dataset must be constructed through the following steps:",
    styles['Body']
))
sop_steps = [
    "<b>Collect real SOPs:</b> Partner with 1–2 hospitals. Start with 3–5 high-impact departments "
    "(Emergency, ICU, Pharmacy, Infection Control, Blood Bank). Target 50–100 SOPs.",
    "<b>Augment with public clinical guidelines:</b> WHO clinical guidelines, CDC infection control "
    "guidelines, AHA/ACLS resuscitation protocols, NICE guidelines (UK), Surviving Sepsis Campaign guidelines.",
    "<b>Structure each SOP into JSON schema:</b> Fields include sop_id, title, department, ordered steps "
    "(with preconditions, time constraints, contraindications), thresholds (parameter, operator, value, unit, action).",
    "<b>Generate QA pairs:</b> For each SOP, use an LLM to generate 20–50 question-answer pairs, "
    "then have a clinical expert validate them. Target 2,000+ validated QA pairs.",
    "<b>Create adversarial test cases:</b> Deliberately craft questions designed to trigger each violation "
    "type (wrong threshold, skipped step, missed contraindication). These form the procedural faithfulness evaluation set.",
]
for i, step in enumerate(sop_steps, 1):
    story.append(Paragraph(f"{i}. {step}", styles['BulletCustom']))

story.append(Spacer(1, 10))
story.append(Paragraph("5.3 Evaluation Datasets &amp; Metrics", styles['SubHead']))

eval_data = [
    ["What to Evaluate", "Dataset / Method", "Metric"],
    ["Retrieval quality", "SOP QA pairs with gold passages", "Recall@5, MRR"],
    ["Answer correctness", "Expert-labeled QA set", "Accuracy, F1"],
    ["Procedural faithfulness", "Adversarial violation set (novel)", "Violation detection P/R"],
    ["Hallucination detection", "Answer-source contradiction pairs", "Faithfulness (RAGAS)"],
    ["Clinical safety", "Expert review of 200 random outputs", "Safety pass rate"],
]
eval_table = Table(eval_data, colWidths=[1.5*inch, 2.3*inch, 1.5*inch])
eval_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
]))
story.append(eval_table)

# ── SECTION 6 ──
story.append(PageBreak())
story.append(Paragraph("6. Voice Interface Analysis", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))
story.append(Paragraph("<b>Decision: Exclude from v1</b>", styles['Body']))

story.append(Paragraph("<b>Arguments Against (for v1):</b>", styles['Body']))
against = [
    "Hospital environments are noisy (alarms, conversations, PA systems) — ASR error rates in ICUs are 15–30% higher than quiet settings.",
    "Clinical terminology misrecognition is dangerous (\"heparin\" vs \"Hespan\").",
    "Privacy concerns with speaking patient-adjacent queries aloud.",
    "Regulatory complexity.",
]
for a in against:
    story.append(Paragraph(f"• {a}", styles['BulletCustom']))

story.append(Paragraph("<b>Arguments For:</b>", styles['Body']))
for_items = ["Hands-free use during procedures.", "Faster than typing during emergencies."]
for f in for_items:
    story.append(Paragraph(f"• {f}", styles['BulletCustom']))

story.append(Paragraph(
    "<b>Recommendation:</b> Design the API to be voice-ready (text-in, text-out with structured responses), "
    "but ship v1 as text-only. Voice can be added as a v2 feature after the core system is validated, "
    "and only for non-bedside use cases (e.g., nursing station queries).",
    styles['Body']
))

# ── SECTION 7 ──
story.append(Paragraph("7. Why This System Will Actually Be Used in Hospitals", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

reasons = [
    ("<b>It solves a real, daily problem.</b>", "Nurses and junior doctors look up SOPs multiple times per shift. "
     "Current method: dig through a PDF repository, Ctrl+F, read 20 pages. SOP-Guard reduces this to a 10-second interaction."),
    ("<b>It doesn't require EHR integration.</b>", "This is the single biggest barrier to hospital AI adoption. "
     "By working only with SOP documents (not patient data), SOP-Guard avoids HIPAA/data-sharing complications "
     "and can be deployed in weeks, not years."),
    ("<b>It can run on-prem.</b>", "Using an open-source LLM (Llama 3.1), the entire system runs inside the "
     "hospital network. No patient data, no SOP content leaves the building."),
    ("<b>It builds trust through transparency.</b>", "Every answer shows its sources, its reasoning, and its "
     "confidence level. Clinicians can verify in seconds. The system explicitly says \"I'm not sure\" rather than guessing."),
    ("<b>It improves over time.</b>", "Clinician feedback identifies which SOPs are confusing, which questions "
     "recur, and where the system fails. This creates value for hospital quality improvement teams."),
    ("<b>Incremental deployment path:</b>", "Start as a read-only reference tool in one department. Expand "
     "based on usage data and feedback. No workflow disruption — it's additive, not replacement."),
]
for title, desc in reasons:
    story.append(Paragraph(f"{title} {desc}", styles['Body']))

# ── SECTION 8 ──
story.append(PageBreak())
story.append(Paragraph("8. Thesis Summary", styles['SectionHead']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))

story.append(Paragraph("What Problem Are We Solving?", styles['SubHead']))
story.append(Paragraph(
    "Hospitals run on Standard Operating Procedures — step-by-step instructions for everything from "
    "managing a sepsis patient to handling a blood transfusion reaction. There are hundreds of these documents, "
    "they're long, and they get updated frequently. When a nurse needs to check a dosage threshold at 3 AM, "
    "they're searching through PDF files under time pressure. Mistakes happen — not because clinicians "
    "are careless, but because the information access system is poor.",
    styles['Body']
))

story.append(Paragraph("What Are We Building?", styles['SubHead']))
story.append(Paragraph(
    "We're building an AI assistant specifically designed to answer questions about hospital SOPs. You ask it "
    "a question in plain language — <i>\"What's the maximum heparin dose for a patient with renal "
    "impairment?\"</i> — and it gives you a direct answer with the exact source highlighted.",
    styles['Body']
))
story.append(Paragraph(
    "But here's what makes this system different from just putting ChatGPT in a hospital: <b>it checks its "
    "own work.</b> After generating an answer, a separate AI component verifies that the answer doesn't "
    "contain the three most dangerous types of errors in clinical procedures: wrong numbers (dosage thresholds, "
    "time windows), skipped steps (missing a required action in a sequence), and missed contraindications "
    "(failing to account for conditions that change the protocol).",
    styles['Body']
))

story.append(Paragraph("Why Is This Research, Not Just Engineering?", styles['SubHead']))
story.append(Paragraph(
    "The core research contribution is the <b>Procedural Faithfulness Verifier</b>. Current AI systems can "
    "retrieve relevant documents and generate fluent answers, but they have no mechanism to check whether "
    "the answer is <i>procedurally correct</i> — whether the steps are in the right order, whether the "
    "thresholds are accurate, whether exceptions are properly handled. We formalize this as a verification "
    "problem, build a structured representation of SOPs that enables automated checking, and evaluate how "
    "well the system detects violations compared to human experts.",
    styles['Body']
))
story.append(Paragraph(
    "We also contribute an <b>agentic architecture</b> where multiple AI components collaborate with explicit "
    "control flow — the system can recognize when it doesn't have enough evidence, go back and search "
    "again, and ultimately refuse to answer rather than risk giving wrong information. This \"verify-then-respond\" "
    "pattern is a design principle we argue should be standard for any AI system used in safety-critical settings.",
    styles['Body']
))

story.append(Paragraph("What's the Expected Outcome?", styles['SubHead']))
story.append(Paragraph(
    "We expect to demonstrate that the verification layer catches 85–95% of procedural errors that a "
    "standard RAG system would miss, with minimal impact on response time (under 5 seconds total). We'll "
    "publish the verification framework, the structured SOP schema, and the adversarial evaluation dataset "
    "as open resources for the clinical AI community.",
    styles['Body']
))
story.append(Paragraph(
    "The system is designed to be deployed in a real hospital setting — we deliberately avoided requiring "
    "EHR integration, chose technologies that run on local servers, and built the interface for the reality "
    "of clinical work (time pressure, mobile devices, interruptions). The goal is a system that a hospital "
    "IT team can install in a week and clinicians will actually use.",
    styles['Body']
))

# Build
doc.build(story)
print("PDF generated: SOP-Guard_Research_Proposal.pdf")
