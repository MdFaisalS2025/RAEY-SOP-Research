from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle

doc = SimpleDocTemplate(
    "Meridian_Project_Summary.pdf",
    pagesize=letter,
    topMargin=0.55*inch, bottomMargin=0.5*inch,
    leftMargin=0.7*inch, rightMargin=0.7*inch,
)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle('Title2', parent=styles['Title'], fontSize=18,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold', spaceAfter=2))
styles.add(ParagraphStyle('Sub', fontSize=10, alignment=TA_CENTER,
    textColor=HexColor('#4a5568'), fontName='Helvetica-Oblique', spaceAfter=6))
styles.add(ParagraphStyle('SH', fontSize=11, spaceBefore=10, spaceAfter=3,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('B', fontSize=9.5, leading=13, alignment=TA_JUSTIFY, spaceAfter=4))
styles.add(ParagraphStyle('Bul', fontSize=9.5, leading=13, leftIndent=14, bulletIndent=4, spaceAfter=2))
styles.add(ParagraphStyle('QH', fontSize=10, spaceBefore=8, spaceAfter=2,
    textColor=HexColor('#0d6efd'), fontName='Helvetica-BoldOblique'))
styles.add(ParagraphStyle('QA', fontSize=9.5, leading=13, leftIndent=10, spaceAfter=5))

s = []

s.append(Paragraph("Meridian: Project Summary", styles['Title2']))
s.append(Paragraph("AI-Powered Clinical SOP Assistant with Procedural Faithfulness Verification", styles['Sub']))
s.append(HRFlowable(width="100%", thickness=1.5, color=HexColor('#1a365d'), spaceAfter=8))

# ---- WHAT IT IS ----
s.append(Paragraph("What Is This Project?", styles['SH']))
s.append(Paragraph(
    "Meridian is an AI system that helps hospital staff find answers from Standard Operating Procedures. "
    "Instead of searching through long PDF documents, a doctor or nurse types a question in plain language "
    "and gets a direct answer with the exact source highlighted. What makes Meridian different from a "
    "regular chatbot is that it <b>checks its own answer</b> before showing it. A component called the "
    "Procedural Faithfulness Verifier automatically detects if the answer has a wrong dosage, a missing "
    "step, or an omitted contraindication.",
    styles['B']))

# ---- HOW IT WORKS ----
s.append(Paragraph("How Does It Work? (The Pipeline)", styles['SH']))
s.append(Paragraph("Every question goes through a 6-stage agentic pipeline:", styles['B']))
steps = [
    "<b>Query Understanding:</b> Classifies the question (procedure steps, threshold, contraindication, medication, etc.), expands clinical abbreviations (MAP, INR, HIT), and extracts drug names and conditions.",
    "<b>Hybrid Retrieval:</b> Searches the SOP database using TF-IDF scoring combined with clinical synonym expansion (28 synonym groups, 50+ abbreviations) and chunk-type boosting. A threshold question prioritizes threshold chunks, not general text.",
    "<b>Multi-hop Retrieval:</b> If a retrieved chunk references another SOP (e.g., 'see Anticoagulation Protocol'), the system automatically retrieves that linked content too.",
    "<b>Evidence Sufficiency Check:</b> Before generating an answer, the system checks if it actually found enough relevant content. If not, it refuses to answer rather than guessing.",
    "<b>Answer Generation:</b> Produces a structured answer from retrieved chunks. Supports Groq/Ollama/OpenAI LLMs for better synthesis, or works locally without any API key using extractive mock mode.",
    "<b>Procedural Faithfulness Verification:</b> Checks the answer against the source SOP for three types of errors: wrong thresholds, missing/reversed steps, and omitted contraindications.",
]
for step in steps:
    s.append(Paragraph(f"  {step}", styles['Bul']))

# ---- KEY RESULTS ----
s.append(Paragraph("Key Results", styles['SH']))
results = [
    ["Metric", "Value"],
    ["Adversarial violation detection", "100% (17/17 errors caught)"],
    ["Retrieval precision", "87.5%"],
    ["Clinical keyword coverage", "88%"],
    ["Refusal accuracy (unsupported queries)", "100%"],
    ["Pipeline response time", "~160ms (mock) / ~1.5s (LLM)"],
    ["SOPs in demo dataset", "10 synthetic clinical protocols"],
    ["Query types supported", "6 (procedure, threshold, contraindication, monitoring, medication, general)"],
]
rt = Table(results, colWidths=[2.8*inch, 3.5*inch])
rt.setStyle(TableStyle([
    ('BACKGROUND', (0,0),(-1,0), HexColor('#1a365d')),
    ('TEXTCOLOR', (0,0),(-1,0), HexColor('#ffffff')),
    ('FONTNAME', (0,0),(-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0),(-1,-1), 9),
    ('GRID', (0,0),(-1,-1), 0.5, HexColor('#cbd5e0')),
    ('ROWBACKGROUNDS', (0,1),(-1,-1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
    ('TOPPADDING', (0,0),(-1,-1), 4),
    ('BOTTOMPADDING', (0,0),(-1,-1), 4),
    ('LEFTPADDING', (0,0),(-1,-1), 6),
]))
s.append(rt)

# ---- CORE CONTRIBUTION ----
s.append(Paragraph("What Makes This Research Novel?", styles['SH']))
s.append(Paragraph(
    "Existing RAG systems retrieve documents and generate answers, but they have no mechanism to verify "
    "that the answer is <b>procedurally correct</b>. Meridian introduces the Procedural Faithfulness "
    "Verifier, which checks three things: (1) Are numerical thresholds correct? (2) Are procedure steps "
    "in the right order with none missing? (3) Are contraindications properly included? The system also "
    "uses SOP-aware chunking (typed chunks for steps, thresholds, contraindications) instead of generic "
    "fixed-size text blocks, and a query understanding agent that routes different question types to "
    "different retrieval strategies.",
    styles['B']))

# ---- TECH STACK ----
s.append(Paragraph("Technology Stack", styles['SH']))
s.append(Paragraph(
    "<b>Frontend:</b> Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion | "
    "<b>Backend:</b> FastAPI, SQLAlchemy, SQLite (PostgreSQL-ready) | "
    "<b>RAG:</b> Custom hybrid retriever, SOP-aware chunker, heuristic reranker, clinical synonym expansion, "
    "multi-hop retrieval, evidence sufficiency checker | "
    "<b>LLM:</b> Groq (Llama 3.3 70B), Ollama, OpenAI-compatible, or local mock mode | "
    "<b>Verification:</b> Procedural Faithfulness Verifier (threshold, sequence, contraindication checks)",
    styles['B']))

# ---- MEETING Q&A ----
s.append(Paragraph("Questions You May Be Asked (and How to Answer)", styles['SH']))

qa = [
    ("How is this different from just using ChatGPT?",
     "ChatGPT has no access to your hospital's SOPs and cannot verify if its answer matches the official protocol. "
     "Meridian retrieves from actual SOP documents and verifies every answer against the source before showing it. "
     "If the answer has a wrong dosage or a missing step, the verifier catches it."),

    ("What if the AI gives a wrong answer?",
     "The Procedural Faithfulness Verifier checks every answer automatically. In testing, it caught 100% of adversarial "
     "errors including wrong thresholds, reversed step order, and missing contraindications. If the system cannot find "
     "enough evidence, it refuses to answer and directs the user to the source SOP."),

    ("Does this use patient data?",
     "No. The system only works with SOP documents, not patient records. No EHR integration is needed. "
     "This makes it much easier to deploy because it avoids HIPAA and data privacy complications."),

    ("Can this run inside a hospital network?",
     "Yes. The entire system can run locally using Ollama (a free local LLM) with no data leaving the network. "
     "It also supports PostgreSQL for production databases and works without any paid API keys."),

    ("What is SOP-aware chunking and why does it matter?",
     "Instead of splitting documents into random 500-character blocks, we create typed chunks: procedure steps, "
     "thresholds, contraindications, summaries, and sections. This means when someone asks about a dosage, the system "
     "retrieves the threshold chunk specifically, not a random paragraph that happens to mention a number."),

    ("How do you evaluate the system?",
     "We use three evaluation approaches: (1) RAG retrieval metrics (precision, keyword coverage), "
     "(2) Adversarial testing with 17 deliberately wrong answers to measure verifier detection rate, "
     "and (3) Refusal testing to ensure the system says 'I don't know' when it should."),

    ("What would it take to deploy this in a real hospital?",
     "Three main additions: (1) Replace SQLite with PostgreSQL and add proper authentication via hospital SSO, "
     "(2) Install real embedding models (sentence-transformers) for better semantic search, "
     "(3) Partner with a hospital to ingest their actual SOPs. The architecture already supports all of this."),
]

for q, a in qa:
    s.append(Paragraph(f'Q: "{q}"', styles['QH']))
    s.append(Paragraph(a, styles['QA']))

# ---- ONE-LINE PITCH ----
s.append(Spacer(1, 6))
s.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cbd5e0'), spaceAfter=6))
s.append(Paragraph(
    "<b>One-line pitch:</b> Meridian is a verifiable clinical RAG system that converts hospital SOP documents "
    "into searchable knowledge, answers staff questions with source citations, and automatically catches "
    "procedural errors before they reach the clinician.",
    styles['B']))
s.append(Paragraph("Research prototype. Not for clinical use. All demo SOPs are synthetic.", styles['Sub']))

doc.build(s)
print("Generated: Meridian_Project_Summary.pdf")
