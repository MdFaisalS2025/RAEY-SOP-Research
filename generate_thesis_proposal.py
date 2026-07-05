from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, ListFlowable, ListItem
)

doc = SimpleDocTemplate(
    "SOP-Guard_Thesis_Proposal.pdf",
    pagesize=letter,
    topMargin=0.7*inch,
    bottomMargin=0.7*inch,
    leftMargin=0.9*inch,
    rightMargin=0.9*inch,
)

styles = getSampleStyleSheet()

# Styles
styles.add(ParagraphStyle('DocTitle', parent=styles['Title'], fontSize=20,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold', spaceAfter=4, leading=24))
styles.add(ParagraphStyle('SubTitle', fontSize=12, alignment=TA_CENTER,
    textColor=HexColor('#2d3748'), fontName='Helvetica-Oblique', spaceAfter=4))
styles.add(ParagraphStyle('Meta', fontSize=10, alignment=TA_CENTER,
    textColor=HexColor('#4a5568'), fontName='Helvetica', spaceAfter=2))
styles.add(ParagraphStyle('SH', fontSize=14, spaceBefore=16, spaceAfter=8,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('SH2', fontSize=12, spaceBefore=12, spaceAfter=6,
    textColor=HexColor('#2d3748'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('SH3', fontSize=11, spaceBefore=8, spaceAfter=4,
    textColor=HexColor('#2d3748'), fontName='Helvetica-BoldOblique'))
styles.add(ParagraphStyle('B', fontSize=10.5, leading=15, alignment=TA_JUSTIFY, spaceAfter=6))
styles.add(ParagraphStyle('Bul', fontSize=10.5, leading=15, leftIndent=20, bulletIndent=8, spaceAfter=3))
styles.add(ParagraphStyle('BulSub', fontSize=10, leading=14, leftIndent=36, bulletIndent=24, spaceAfter=2,
    textColor=HexColor('#4a5568')))
styles.add(ParagraphStyle('RQ', fontSize=10.5, leading=15, leftIndent=30, rightIndent=20,
    fontName='Helvetica-Oblique', spaceAfter=4, textColor=HexColor('#2d3748')))

story = []

# ═══════════════════════════════════════════
# TITLE PAGE
# ═══════════════════════════════════════════
story.append(Spacer(1, 1.2*inch))
story.append(Paragraph("Thesis Proposal", styles['Meta']))
story.append(Spacer(1, 0.3*inch))
story.append(HRFlowable(width="40%", thickness=1, color=HexColor('#1a365d'), spaceAfter=14))
story.append(Paragraph("SOP-Guard", styles['DocTitle']))
story.append(Paragraph(
    "An Agentic RAG System with Procedural Faithfulness Verification<br/>"
    "for Clinical Standard Operating Procedures",
    styles['SubTitle']))
story.append(Spacer(1, 0.3*inch))
story.append(HRFlowable(width="40%", thickness=1, color=HexColor('#1a365d'), spaceAfter=20))
story.append(Spacer(1, 0.6*inch))

meta = [
    ["Submitted by:", "[Your Name]"],
    ["Supervisor:", "[Professor Name]"],
    ["Department:", "[Department Name]"],
    ["University:", "[University Name]"],
    ["Date:", "June 2026"],
]
mt = Table(meta, colWidths=[1.5*inch, 3.5*inch])
mt.setStyle(TableStyle([
    ('FONTNAME', (0,0),(0,-1), 'Helvetica-Bold'),
    ('FONTNAME', (1,0),(1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0),(-1,-1), 11),
    ('TEXTCOLOR', (0,0),(-1,-1), HexColor('#2d3748')),
    ('ALIGN', (0,0),(-1,-1), 'LEFT'),
    ('BOTTOMPADDING', (0,0),(-1,-1), 8),
]))
story.append(mt)
story.append(PageBreak())

# ═══════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════
story.append(Paragraph("Table of Contents", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=10))
toc = [
    "1. Introduction",
    "2. Problem Statement",
    "3. Research Questions",
    "4. Research Objectives",
    "5. Literature Review",
    "6. Proposed System — SOP-Guard",
    "    6.1 System Overview",
    "    6.2 System Architecture",
    "    6.3 Agentic Pipeline Design",
    "    6.4 Procedural Faithfulness Verifier",
    "    6.5 Voice Input Interface",
    "    6.6 Clinician-Driven SOP Update Portal",
    "    6.7 Feedback & Continuous Learning Loop",
    "    6.8 Explainability & Trust Mechanisms",
    "7. Technology Stack",
    "8. Datasets & Evaluation Plan",
    "9. Expected Contributions",
    "10. Timeline",
    "11. Conclusion",
    "12. References",
]
for t in toc:
    indent = 20 if t.startswith("    ") else 0
    story.append(Paragraph(t.strip(), ParagraphStyle('toc', parent=styles['B'],
        leftIndent=indent, spaceAfter=2, fontSize=10)))
story.append(PageBreak())

# ═══════════════════════════════════════════
# 1. INTRODUCTION
# ═══════════════════════════════════════════
story.append(Paragraph("1. Introduction", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
story.append(Paragraph(
    "Hospitals operate on the basis of Standard Operating Procedures (SOPs) — detailed, step-by-step "
    "documents that govern clinical workflows ranging from sepsis management and blood transfusion "
    "protocols to medication administration and infection control. These documents are the backbone of "
    "patient safety and clinical quality assurance. A typical tertiary hospital maintains hundreds of "
    "SOPs across dozens of departments, each subject to periodic revision as medical knowledge evolves.",
    styles['B']))
story.append(Paragraph(
    "Despite their critical importance, accessing information within SOPs remains a manual, time-consuming "
    "process. Clinicians — particularly during emergencies, night shifts, or high-acuity situations — "
    "must search through lengthy PDF documents to locate a specific dosage threshold, verify a step "
    "sequence, or check a contraindication. This information retrieval bottleneck introduces delays in "
    "clinical decision-making and creates opportunities for error.",
    styles['B']))
story.append(Paragraph(
    "Recent advances in Large Language Models (LLMs) and Retrieval-Augmented Generation (RAG) have "
    "demonstrated the potential to transform how humans interact with document repositories. However, "
    "deploying such systems in clinical settings presents unique challenges. A standard RAG system can "
    "retrieve relevant passages and generate fluent responses, but it cannot guarantee that its output "
    "is <b>procedurally faithful</b> — that dosage values are accurate, that steps are presented in "
    "the correct sequence, and that critical contraindications are not omitted. In healthcare, such "
    "errors are not merely inconvenient; they are potentially life-threatening.",
    styles['B']))
story.append(Paragraph(
    "This thesis proposes <b>SOP-Guard</b>, an agentic RAG system specifically designed for clinical "
    "SOP question-answering that incorporates a novel <b>Procedural Faithfulness Verification</b> layer. "
    "The system employs multiple specialized AI agents orchestrated through a deterministic graph-based "
    "pipeline, supports voice input for hands-free clinical use, enables clinician-driven SOP updates "
    "with full version tracking, and provides transparent reasoning traces for every response. The goal "
    "is to build a system that is not only academically rigorous but practically deployable in real "
    "hospital environments.",
    styles['B']))

# ═══════════════════════════════════════════
# 2. PROBLEM STATEMENT
# ═══════════════════════════════════════════
story.append(Paragraph("2. Problem Statement", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
story.append(Paragraph(
    "Current approaches to clinical SOP access suffer from three fundamental limitations:",
    styles['B']))
problems = [
    "<b>Inefficient Information Retrieval:</b> Clinicians spend significant time manually searching "
    "through PDF-based SOP documents. Studies indicate that healthcare workers spend up to 25% of their "
    "time on information retrieval tasks, directly reducing time available for patient care.",

    "<b>No Procedural Verification in AI Systems:</b> Existing clinical QA systems and general-purpose "
    "LLMs can generate answers from medical text, but they lack mechanisms to verify that the generated "
    "answer is procedurally correct. An LLM might confidently state a dosage that is slightly off, "
    "present steps out of order, or omit a critical contraindication — errors that are difficult for "
    "busy clinicians to catch and potentially dangerous for patients.",

    "<b>Static, Disconnected Knowledge Bases:</b> Hospital SOPs are living documents that should evolve "
    "with clinical experience and new evidence. However, the feedback loop between frontline clinical "
    "knowledge and SOP documentation is slow and fragmented. Clinicians who discover better practices "
    "or identify outdated protocols have no streamlined way to contribute updates back to the knowledge base.",
]
for p in problems:
    story.append(Paragraph(f"• {p}", styles['Bul']))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "This thesis addresses all three limitations through a unified system that combines intelligent "
    "retrieval, automated procedural verification, and a structured clinician feedback and update mechanism.",
    styles['B']))

# ═══════════════════════════════════════════
# 3. RESEARCH QUESTIONS
# ═══════════════════════════════════════════
story.append(Paragraph("3. Research Questions", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
story.append(Paragraph(
    "This research seeks to answer the following questions:", styles['B']))
rqs = [
    "<b>RQ1:</b> How effectively can a Procedural Faithfulness Verifier detect threshold errors, "
    "sequence violations, and contraindication omissions in LLM-generated clinical SOP responses?",

    "<b>RQ2:</b> Does an agentic, multi-agent architecture with verification feedback loops produce "
    "more accurate and safer clinical SOP answers compared to standard single-pass RAG systems?",

    "<b>RQ3:</b> How does clinician feedback integration and structured SOP version management "
    "impact the quality and currency of the system's knowledge base over time?",

    "<b>RQ4:</b> What is the effect of voice-based input on the usability and adoption of clinical "
    "decision support systems in real hospital workflow conditions?",
]
for rq in rqs:
    story.append(Paragraph(rq, styles['RQ']))

# ═══════════════════════════════════════════
# 4. RESEARCH OBJECTIVES
# ═══════════════════════════════════════════
story.append(Paragraph("4. Research Objectives", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
objs = [
    "Design and implement SOP-Guard, an agentic RAG system with procedural faithfulness verification "
    "for clinical SOP question-answering.",

    "Develop a structured SOP representation schema that enables automated verification of thresholds, "
    "step sequences, and contraindications.",

    "Build and evaluate a Procedural Faithfulness Verifier capable of detecting three categories of "
    "clinical errors: threshold violations, sequence violations, and contraindication omissions.",

    "Implement a voice input interface using speech-to-text technology optimized for medical terminology, "
    "enabling hands-free clinical queries.",

    "Design a clinician-driven SOP update portal with version tracking, approval workflows, and "
    "automatic knowledge base re-indexing.",

    "Create an adversarial evaluation dataset of procedurally incorrect clinical responses for "
    "benchmarking verification systems.",

    "Evaluate the complete system against baseline RAG approaches using both automated metrics and "
    "expert clinical review.",
]
for i, obj in enumerate(objs, 1):
    story.append(Paragraph(f"<b>O{i}.</b> {obj}", styles['Bul']))

# ═══════════════════════════════════════════
# 5. LITERATURE REVIEW
# ═══════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("5. Literature Review", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

story.append(Paragraph("5.1 LLMs in Clinical Decision Support", styles['SH2']))
story.append(Paragraph(
    "Large Language Models have shown remarkable capability in medical question-answering, with models "
    "like Med-PaLM 2 achieving expert-level performance on USMLE-style questions (Singhal et al., 2023). "
    "GPT-4 and Claude have demonstrated strong clinical reasoning across a range of medical benchmarks. "
    "However, these models are general-purpose and lack domain-specific safeguards for procedural "
    "accuracy. Studies have shown that even high-performing medical LLMs can hallucinate dosages, invent "
    "contraindications, or present clinical steps in incorrect order (Ji et al., 2023). The gap between "
    "fluent generation and procedurally safe generation remains a significant barrier to clinical deployment.",
    styles['B']))

story.append(Paragraph("5.2 Retrieval-Augmented Generation (RAG)", styles['SH2']))
story.append(Paragraph(
    "RAG systems address the hallucination problem by grounding LLM responses in retrieved documents "
    "(Lewis et al., 2020). In clinical settings, RAG has been applied to medical literature QA and "
    "drug information retrieval. Hybrid retrieval approaches combining dense embeddings with sparse "
    "methods (BM25) have shown improved performance for technical medical queries where exact term "
    "matching (drug names, dosages) is critical (Ma et al., 2023). However, standard RAG provides "
    "no mechanism to verify that the generated response correctly reflects the retrieved evidence — "
    "the model can still misinterpret, selectively omit, or incorrectly combine information from "
    "source passages.",
    styles['B']))

story.append(Paragraph("5.3 Agentic AI Systems", styles['SH2']))
story.append(Paragraph(
    "Recent work on agentic AI architectures has demonstrated the value of decomposing complex tasks "
    "into specialized sub-agents. Frameworks like LangGraph (LangChain, 2024) enable deterministic, "
    "graph-based orchestration of multiple LLM agents with conditional routing, retry loops, and "
    "state management. This approach is particularly valuable for safety-critical applications where "
    "predictable control flow and auditability are essential. Unlike autonomous multi-agent frameworks "
    "(AutoGen, CrewAI), graph-based orchestration provides the determinism required for clinical systems.",
    styles['B']))

story.append(Paragraph("5.4 Faithfulness and Hallucination Detection", styles['SH2']))
story.append(Paragraph(
    "Faithfulness evaluation in NLG systems has been studied extensively (Maynez et al., 2020). Metrics "
    "like RAGAS (Es et al., 2023) provide automated faithfulness scoring for RAG systems. However, "
    "existing approaches evaluate faithfulness at the semantic level — whether the answer is generally "
    "consistent with the source. They do not evaluate <b>procedural faithfulness</b>: whether specific "
    "numerical thresholds are preserved, whether step sequences are maintained, and whether conditional "
    "logic (contraindications, exceptions) is correctly represented. This gap is precisely what our "
    "Procedural Faithfulness Verifier addresses.",
    styles['B']))

story.append(Paragraph("5.5 Voice Interfaces in Healthcare", styles['SH2']))
story.append(Paragraph(
    "Voice-based clinical tools have gained attention with the maturation of speech-to-text systems. "
    "OpenAI's Whisper model achieves near-human accuracy in general transcription and can be fine-tuned "
    "for medical vocabulary (Radford et al., 2023). Voice interfaces offer significant ergonomic "
    "benefits in clinical settings where hands are occupied. However, challenges remain: hospital "
    "environments are noisy, medical terminology has high phonetic similarity between critical terms "
    "(e.g., \"heparin\" vs. \"Hespan\"), and privacy concerns exist when queries are spoken aloud "
    "near patients. Our design mitigates these risks through transcription confirmation before processing.",
    styles['B']))

story.append(Paragraph("5.6 Research Gap", styles['SH2']))
story.append(Paragraph(
    "To our knowledge, no existing system combines (a) RAG-based clinical SOP question-answering with "
    "(b) automated procedural faithfulness verification, (c) agentic multi-agent orchestration with "
    "verification feedback loops, (d) voice input for hands-free use, and (e) a clinician-driven SOP "
    "update mechanism with version tracking. SOP-Guard addresses this gap as an integrated system.",
    styles['B']))

# ═══════════════════════════════════════════
# 6. PROPOSED SYSTEM
# ═══════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("6. Proposed System — SOP-Guard", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

story.append(Paragraph("6.1 System Overview", styles['SH2']))
story.append(Paragraph(
    "SOP-Guard is an AI-powered clinical decision support system that enables healthcare professionals "
    "to query hospital SOPs using natural language (typed or spoken) and receive verified, sourced, "
    "and confidence-scored answers. The system is distinguished by its <b>verify-then-respond</b> "
    "architecture: every generated answer passes through a Procedural Faithfulness Verifier before "
    "being presented to the clinician. If the verifier detects errors, the system either corrects "
    "itself or escalates transparently.",
    styles['B']))

story.append(Paragraph("6.2 System Architecture", styles['SH2']))
story.append(Paragraph(
    "The system processes each query through six sequential stages, orchestrated by a LangGraph "
    "state machine with conditional routing:", styles['B']))

stages = [
    ("<b>Stage 1 — Query Intake:</b> The clinician submits a query via text or voice. Voice input is "
     "transcribed using Whisper and displayed for confirmation. The Query Understanding Agent classifies "
     "the query type (threshold check, sequence question, contraindication lookup, general) and extracts "
     "clinical entities (drug names, conditions, parameters)."),

    ("<b>Stage 2 — Hybrid Retrieval:</b> The Retrieval Agent performs combined dense retrieval "
     "(embedding similarity) and sparse retrieval (BM25) over the structured SOP knowledge base, "
     "with metadata filtering by department and SOP category. A cross-encoder reranker selects the "
     "top-k most relevant passages. If retrieval confidence is below threshold, the agent reformulates "
     "the query and retries once."),

    ("<b>Stage 3 — Answer Generation:</b> The Reasoning Agent synthesizes an answer strictly grounded "
     "in retrieved passages. Structured prompting enforces citation of source sections. For multi-step "
     "procedures, the output follows a numbered step format with decision branch points."),

    ("<b>Stage 4 — Procedural Verification:</b> The Verifier Agent checks the answer against the "
     "structured SOP representation for three violation types: (a) threshold errors — are all numerical "
     "values correct? (b) sequence errors — are steps in the right order with none omitted? "
     "(c) contraindication errors — are stated exceptions properly accounted for? On failure, the "
     "answer is regenerated with the violation flagged as a constraint (maximum one retry, then escalation)."),

    ("<b>Stage 5 — Confidence Scoring:</b> A composite confidence score is computed from retrieval "
     "relevance scores, verifier results, and answer-source textual overlap. Three output tiers: "
     "high confidence (full answer), medium confidence (answer with advisory + SOP link), low confidence "
     "(answer withheld, clinician directed to source document or human expert)."),

    ("<b>Stage 6 — Response &amp; Feedback:</b> The verified answer is presented with highlighted "
     "source passages, a step-by-step reasoning trace, and the confidence score. Clinicians can provide "
     "feedback (thumbs up/down + free-text correction) which feeds into the continuous learning loop."),
]
for stage in stages:
    story.append(Paragraph(f"• {stage}", styles['Bul']))

story.append(Spacer(1, 6))
story.append(Paragraph("LangGraph Orchestration Flow:", styles['SH3']))
story.append(Paragraph(
    "QueryIntake → Retrieval → [sufficient?] → Reasoning → Verification → "
    "[pass?] → ConfidenceGate → Output → Feedback",
    ParagraphStyle('code', parent=styles['B'], fontName='Courier', fontSize=9,
        leftIndent=16, backColor=HexColor('#f7fafc'), borderPadding=6,
        borderColor=HexColor('#e2e8f0'), borderWidth=0.5)))
story.append(Paragraph(
    "Conditional edges allow the verifier to route back to retrieval or reasoning, and the confidence "
    "gate to route to escalation — enabling self-correcting behavior within an auditable control flow.",
    styles['B']))

# 6.4
story.append(Paragraph("6.3 Procedural Faithfulness Verifier (Core Contribution)", styles['SH2']))
story.append(Paragraph(
    "The Procedural Faithfulness Verifier (PFV) is the central research contribution of this thesis. "
    "Unlike general faithfulness metrics that assess semantic consistency, the PFV performs structured "
    "verification against a formal SOP representation.", styles['B']))
story.append(Paragraph("The PFV checks three violation categories:", styles['B']))

viol = [
    "<b>Threshold Violations:</b> All numerical values in the answer (dosages, time windows, lab ranges, "
    "vital sign thresholds) are extracted and compared against the structured SOP. Example: the SOP states "
    "\"administer heparin 80 units/kg\" but the answer states \"60 units/kg\" — this is flagged as a "
    "threshold violation with the specific discrepancy cited.",

    "<b>Sequence Violations:</b> For multi-step procedures, the PFV verifies that (a) all mandatory "
    "steps are present, (b) steps are in the correct order, and (c) no steps are incorrectly merged "
    "or split. Example: the SOP requires blood cultures before antibiotics, but the answer reverses this order.",

    "<b>Contraindication Violations:</b> The PFV checks whether the answer accounts for all stated "
    "contraindications and conditional exceptions. Example: the SOP states \"do not administer "
    "metformin in patients with eGFR < 30\" but the answer provides a general dosage without this caveat.",
]
for v in viol:
    story.append(Paragraph(f"• {v}", styles['Bul']))

story.append(Spacer(1, 4))
story.append(Paragraph(
    "To enable this verification, each SOP is parsed into a semi-structured JSON schema containing "
    "ordered steps (with preconditions and time constraints), numerical thresholds (with parameter, "
    "operator, value, and unit), and contraindication rules. This structured representation is created "
    "through a combination of PDF parsing (PyMuPDF) and LLM-assisted structuring, with human expert "
    "validation.",
    styles['B']))

# 6.5
story.append(Paragraph("6.4 Voice Input Interface", styles['SH2']))
story.append(Paragraph(
    "SOP-Guard supports audio-based queries for hands-free use during clinical procedures. Clinicians "
    "tap a microphone button on the interface, speak their question, and the audio is transcribed "
    "using OpenAI Whisper, fine-tuned on medical terminology. The transcribed text is displayed for "
    "confirmation before submission — this confirmation step is critical for safety, as it allows "
    "clinicians to catch transcription errors in drug names or dosage terms before the query is processed. "
    "The voice interface is designed for non-bedside use (nursing stations, break rooms) to mitigate "
    "patient privacy concerns.",
    styles['B']))

# 6.6
story.append(Paragraph("6.5 Clinician-Driven SOP Update Portal", styles['SH2']))
story.append(Paragraph(
    "A key practical innovation of SOP-Guard is its structured mechanism for clinicians to contribute "
    "updates back to the SOP knowledge base. The system includes an update portal where authorized "
    "users (department heads, quality officers, senior clinicians) can:", styles['B']))
updates = [
    "Propose modifications to specific SOP sections with a reason for the change.",
    "Each update is tagged with the clinician's identity, department, date, and a free-text justification.",
    "Proposed updates enter an approval workflow — reviewed by designated approvers before going live.",
    "The system maintains a complete version history, allowing anyone to see what changed, when, and why.",
    "Upon approval, the AI knowledge base (vector store and structured SOP representation) is "
    "automatically re-indexed, ensuring that subsequent queries reflect the latest protocols.",
]
for u in updates:
    story.append(Paragraph(f"• {u}", styles['Bul']))
story.append(Paragraph(
    "This creates a <b>living knowledge base</b> that evolves with clinical practice rather than "
    "becoming stale between periodic manual reviews.",
    styles['B']))

# 6.7
story.append(Paragraph("6.6 Feedback &amp; Continuous Learning Loop", styles['SH2']))
story.append(Paragraph(
    "Every response includes feedback controls. Clinician feedback is structured and logged with the "
    "query, response, clinician role, department, and correction text. This data serves three purposes:",
    styles['B']))
fb = [
    "<b>SOP quality signal:</b> Recurring corrections on the same SOP section flag it for review.",
    "<b>Retrieval improvement:</b> Feedback is used to fine-tune retrieval ranking, adding hard-negative "
    "examples and adjusting relevance weights.",
    "<b>Institutional analytics:</b> Monthly digests show which SOPs cause the most confusion, which "
    "departments query most frequently, and where the system's accuracy is weakest — providing actionable "
    "intelligence for hospital quality improvement teams.",
]
for f in fb:
    story.append(Paragraph(f"• {f}", styles['Bul']))

# 6.8
story.append(Paragraph("6.7 Explainability &amp; Trust Mechanisms", styles['SH2']))
story.append(Paragraph(
    "Clinical adoption requires transparency. SOP-Guard provides multiple layers of explainability:",
    styles['B']))
expl = [
    "<b>Source highlighting:</b> Every claim in the answer is linked to the specific SOP passage it came from.",
    "<b>Reasoning trace:</b> A step-by-step breakdown showing: which passages were retrieved → how the "
    "answer was composed → what the verifier checked and the result.",
    "<b>Confidence score:</b> A calibrated numerical score indicating the system's certainty, with clear "
    "communication when confidence is low.",
    "<b>Counterfactual explanations:</b> Where applicable, the system explains how the answer would "
    "differ under alternative conditions (e.g., \"If the patient had hepatic impairment, the dose "
    "would be reduced to...\").",
    "<b>Explicit abstention:</b> The system is designed to say \"I am not confident enough to answer "
    "this — please consult the source SOP\" rather than generate a potentially unsafe response.",
]
for e in expl:
    story.append(Paragraph(f"• {e}", styles['Bul']))

# ═══════════════════════════════════════════
# 7. TECHNOLOGY STACK
# ═══════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("7. Technology Stack", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

tech = [
    ["Component", "Technology", "Rationale"],
    ["LLM (Primary)", "Claude Sonnet 4.6", "Strong reasoning, structured output support"],
    ["LLM (Local/Fallback)", "Llama 3.1 70B", "On-premise deployment, no data leaves network"],
    ["Voice Transcription", "OpenAI Whisper", "High accuracy, fine-tunable for medical terms"],
    ["Agent Orchestration", "LangGraph", "Deterministic graph, conditional routing, auditable"],
    ["Embeddings", "text-embedding-3-large / BGE-M3", "Semantic retrieval; BGE-M3 for on-prem"],
    ["Vector Database", "Qdrant", "Hybrid search, metadata filtering, on-premise capable"],
    ["Sparse Retrieval", "BM25 (Elasticsearch)", "Exact term matching for drug names, dosages"],
    ["Reranker", "ms-marco-MiniLM-L12", "Cross-encoder reranking for precision"],
    ["SOP Parsing", "PyMuPDF + LLM structuring", "PDF to structured JSON with expert validation"],
    ["Backend API", "FastAPI (Python)", "Async support, OpenAPI docs, production-ready"],
    ["Frontend", "React + Tailwind CSS", "Mobile-responsive PWA for clinical use"],
    ["Database", "PostgreSQL", "Feedback logs, SOP versions, user management"],
    ["Deployment", "Docker + Kubernetes", "Hospital data center deployment"],
    ["Evaluation", "RAGAS + custom metrics", "Faithfulness, retrieval quality, safety scoring"],
]
tt = Table(tech, colWidths=[1.3*inch, 1.8*inch, 2.7*inch])
tt.setStyle(TableStyle([
    ('BACKGROUND', (0,0),(-1,0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0,0),(-1,0), HexColor('#ffffff')),
    ('FONTNAME', (0,0),(-1,0), 'Helvetica-Bold'),
    ('FONTNAME', (0,1),(-1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0),(-1,-1), 8.5),
    ('ALIGN', (0,0),(-1,-1), 'LEFT'),
    ('VALIGN', (0,0),(-1,-1), 'TOP'),
    ('GRID', (0,0),(-1,-1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0,1),(-1,-1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0,0),(-1,-1), 4),
    ('BOTTOMPADDING', (0,0),(-1,-1), 4),
    ('LEFTPADDING', (0,0),(-1,-1), 5),
]))
story.append(tt)

# ═══════════════════════════════════════════
# 8. DATASETS & EVALUATION
# ═══════════════════════════════════════════
story.append(Spacer(1, 8))
story.append(Paragraph("8. Datasets &amp; Evaluation Plan", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

story.append(Paragraph("8.1 Public Datasets", styles['SH2']))
ds = [
    ["Dataset", "Description", "Use in This Work"],
    ["PubMedQA", "1,000 expert-labeled clinical QA pairs", "QA evaluation benchmark"],
    ["MedQA (USMLE)", "12,723 clinical reasoning MCQs", "Reasoning capability evaluation"],
    ["MedMCQA", "194K medical MCQs", "Large-scale clinical knowledge testing"],
    ["MIMIC-IV Notes", "Discharge summaries (credentialed access)", "Entity extraction validation"],
    ["ExpertQA", "2,177 expert-validated QA pairs", "Answer quality benchmarking"],
    ["MTSamples", "Medical transcription samples", "Voice transcription testing"],
]
dst = Table(ds, colWidths=[1.2*inch, 2.3*inch, 2.3*inch])
dst.setStyle(TableStyle([
    ('BACKGROUND', (0,0),(-1,0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0,0),(-1,0), HexColor('#ffffff')),
    ('FONTNAME', (0,0),(-1,0), 'Helvetica-Bold'),
    ('FONTNAME', (0,1),(-1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0),(-1,-1), 9),
    ('ALIGN', (0,0),(-1,-1), 'LEFT'),
    ('VALIGN', (0,0),(-1,-1), 'TOP'),
    ('GRID', (0,0),(-1,-1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0,1),(-1,-1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0,0),(-1,-1), 4),
    ('BOTTOMPADDING', (0,0),(-1,-1), 4),
    ('LEFTPADDING', (0,0),(-1,-1), 5),
]))
story.append(dst)

story.append(Paragraph("8.2 SOP Dataset Construction", styles['SH2']))
story.append(Paragraph(
    "No public SOP dataset exists. We will construct one through the following process:", styles['B']))
sop_const = [
    "Partner with 1–2 hospitals to collect 50–100 real SOPs from high-impact departments (Emergency, "
    "ICU, Pharmacy, Infection Control, Blood Bank).",
    "Augment with publicly available clinical guidelines: WHO, CDC, AHA/ACLS, NICE, and Surviving "
    "Sepsis Campaign protocols.",
    "Parse and structure each SOP into a JSON schema containing ordered steps, preconditions, time "
    "constraints, numerical thresholds, and contraindication rules.",
    "Generate 20–50 QA pairs per SOP using LLM-assisted generation, validated by clinical experts. "
    "Target: 2,000+ validated QA pairs.",
    "Create an adversarial evaluation set with deliberately incorrect responses for each violation "
    "type (threshold, sequence, contraindication) to benchmark the Procedural Faithfulness Verifier.",
]
for i, sc in enumerate(sop_const, 1):
    story.append(Paragraph(f"{i}. {sc}", styles['Bul']))

story.append(Paragraph("8.3 Evaluation Metrics", styles['SH2']))
ev = [
    ["Dimension", "Metric", "Method"],
    ["Retrieval Quality", "Recall@5, MRR", "Gold passage matching"],
    ["Answer Correctness", "Accuracy, F1", "Expert-labeled QA set"],
    ["Procedural Faithfulness", "Violation Detection P/R/F1", "Adversarial violation set"],
    ["Hallucination Rate", "Faithfulness Score", "RAGAS framework"],
    ["Clinical Safety", "Safety Pass Rate", "Expert review (n=200)"],
    ["Voice Accuracy", "WER on Medical Terms", "Medical transcription test set"],
    ["Usability", "SUS Score, Task Time", "Clinician user study"],
]
evt = Table(ev, colWidths=[1.5*inch, 2*inch, 2.3*inch])
evt.setStyle(TableStyle([
    ('BACKGROUND', (0,0),(-1,0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0,0),(-1,0), HexColor('#ffffff')),
    ('FONTNAME', (0,0),(-1,0), 'Helvetica-Bold'),
    ('FONTNAME', (0,1),(-1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0),(-1,-1), 9),
    ('ALIGN', (0,0),(-1,-1), 'LEFT'),
    ('VALIGN', (0,0),(-1,-1), 'TOP'),
    ('GRID', (0,0),(-1,-1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0,1),(-1,-1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0,0),(-1,-1), 4),
    ('BOTTOMPADDING', (0,0),(-1,-1), 4),
    ('LEFTPADDING', (0,0),(-1,-1), 5),
]))
story.append(evt)

# ═══════════════════════════════════════════
# 9. EXPECTED CONTRIBUTIONS
# ═══════════════════════════════════════════
story.append(Paragraph("9. Expected Contributions", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
contribs = [
    "<b>Procedural Faithfulness Verification Framework:</b> A novel verification approach that checks "
    "LLM-generated clinical responses for threshold accuracy, step sequence correctness, and "
    "contraindication completeness — going beyond existing semantic faithfulness metrics.",

    "<b>Agentic Clinical RAG Architecture:</b> A reusable multi-agent design pattern for safety-critical "
    "QA systems with built-in verification feedback loops and confidence-gated output.",

    "<b>Structured SOP Schema:</b> A JSON-based representation format for clinical SOPs that enables "
    "both AI-powered retrieval and automated procedural verification.",

    "<b>Adversarial Procedural Violation Dataset:</b> A benchmark dataset of clinically incorrect "
    "responses annotated with specific violation types, publishable as an open resource.",

    "<b>Clinician-in-the-Loop SOP Management:</b> A practical framework for structured SOP updates "
    "with version tracking and automatic knowledge base synchronization.",

    "<b>Deployable System:</b> A complete, open-source system designed for real hospital deployment "
    "without EHR integration — reducing the primary barrier to clinical AI adoption.",
]
for c in contribs:
    story.append(Paragraph(f"• {c}", styles['Bul']))

# ═══════════════════════════════════════════
# 10. TIMELINE
# ═══════════════════════════════════════════
story.append(Paragraph("10. Proposed Timeline", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

timeline = [
    ["Phase", "Duration", "Activities"],
    ["Phase 1", "Months 1–2", "Literature review, SOP collection, dataset construction, JSON schema design"],
    ["Phase 2", "Months 3–4", "Core RAG pipeline, hybrid retrieval, structured SOP parsing"],
    ["Phase 3", "Months 5–6", "Procedural Faithfulness Verifier, agentic pipeline (LangGraph), adversarial test set"],
    ["Phase 4", "Month 7", "Voice input integration (Whisper), SOP update portal with version tracking"],
    ["Phase 5", "Month 8", "Frontend development, feedback loop, confidence scoring, explainability layer"],
    ["Phase 6", "Months 9–10", "Evaluation: automated metrics, expert clinical review, usability study"],
    ["Phase 7", "Months 11–12", "Thesis writing, revisions, submission"],
]
tlt = Table(timeline, colWidths=[0.9*inch, 1.1*inch, 3.8*inch])
tlt.setStyle(TableStyle([
    ('BACKGROUND', (0,0),(-1,0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0,0),(-1,0), HexColor('#ffffff')),
    ('FONTNAME', (0,0),(-1,0), 'Helvetica-Bold'),
    ('FONTNAME', (0,1),(-1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0),(-1,-1), 9),
    ('ALIGN', (0,0),(-1,-1), 'LEFT'),
    ('VALIGN', (0,0),(-1,-1), 'TOP'),
    ('GRID', (0,0),(-1,-1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0,1),(-1,-1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0,0),(-1,-1), 4),
    ('BOTTOMPADDING', (0,0),(-1,-1), 4),
    ('LEFTPADDING', (0,0),(-1,-1), 5),
]))
story.append(tlt)

# ═══════════════════════════════════════════
# 11. CONCLUSION
# ═══════════════════════════════════════════
story.append(Paragraph("11. Conclusion", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))
story.append(Paragraph(
    "This thesis proposes SOP-Guard, an agentic RAG system that addresses a critical gap in clinical "
    "AI: the absence of procedural faithfulness verification in LLM-generated responses to clinical "
    "protocol queries. By combining hybrid retrieval, multi-agent orchestration, automated verification "
    "of thresholds, sequences, and contraindications, voice-based input, and a clinician-driven SOP "
    "update mechanism, SOP-Guard is designed to be both a meaningful research contribution and a "
    "practically deployable tool.",
    styles['B']))
story.append(Paragraph(
    "The system's deliberate avoidance of EHR integration, support for on-premise deployment, and "
    "incremental adoption model address the most common barriers to hospital AI deployment. Its "
    "verify-then-respond architecture establishes a design principle that we argue should be standard "
    "for any AI system operating in safety-critical domains.",
    styles['B']))
story.append(Paragraph(
    "We anticipate that the Procedural Faithfulness Verifier will detect 85–95% of procedural errors "
    "that standard RAG systems would miss, with total response times under 5 seconds. The structured "
    "SOP schema, adversarial evaluation dataset, and verification framework will be published as open "
    "resources to advance the field of safe clinical AI.",
    styles['B']))

# ═══════════════════════════════════════════
# 12. REFERENCES
# ═══════════════════════════════════════════
story.append(Paragraph("12. References", styles['SH']))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=8))

refs = [
    "Es, S., James, J., Espinosa-Anke, L., & Schockaert, S. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation. arXiv:2309.15217.",
    "Ji, Z., et al. (2023). Survey of Hallucination in Natural Language Generation. ACM Computing Surveys, 55(12).",
    "LangChain. (2024). LangGraph: A Library for Building Stateful, Multi-Actor Applications with LLMs. https://github.com/langchain-ai/langgraph.",
    "Lewis, P., et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS 2020.",
    "Ma, X., et al. (2023). Fine-Tuning LLaMA for Medical Question Answering. arXiv:2305.13160.",
    "Maynez, J., Narayan, S., Bohnet, B., & McDonald, R. (2020). On Faithfulness and Factuality in Abstractive Summarization. ACL 2020.",
    "Radford, A., et al. (2023). Robust Speech Recognition via Large-Scale Weak Supervision (Whisper). ICML 2023.",
    "Singhal, K., et al. (2023). Towards Expert-Level Medical Question Answering with Large Language Models (Med-PaLM 2). arXiv:2305.09617.",
]

ref_style = ParagraphStyle('ref', parent=styles['B'], fontSize=9, leading=12,
    leftIndent=24, firstLineIndent=-24, spaceAfter=4)
for i, ref in enumerate(refs, 1):
    story.append(Paragraph(f"[{i}] {ref}", ref_style))

# BUILD
doc.build(story)
print("Done: SOP-Guard_Thesis_Proposal.pdf")
