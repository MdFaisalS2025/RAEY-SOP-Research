from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

doc = SimpleDocTemplate(
    "SOP-Guard_Summary.pdf",
    pagesize=letter,
    topMargin=0.6*inch,
    bottomMargin=0.5*inch,
    leftMargin=0.75*inch,
    rightMargin=0.75*inch,
)

styles = getSampleStyleSheet()

styles.add(ParagraphStyle('Title2', parent=styles['Title'], fontSize=16,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold', spaceAfter=1))
styles.add(ParagraphStyle('Sub', fontSize=9.5, alignment=TA_CENTER,
    textColor=HexColor('#4a5568'), fontName='Helvetica-Oblique', spaceAfter=6))
styles.add(ParagraphStyle('SH', fontSize=10.5, spaceBefore=7, spaceAfter=3,
    textColor=HexColor('#1a365d'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('B', fontSize=9, leading=12, alignment=TA_JUSTIFY, spaceAfter=3))
styles.add(ParagraphStyle('Bul', fontSize=9, leading=12, leftIndent=14, bulletIndent=4, spaceAfter=1.5))

s = []

s.append(Paragraph("SOP-Guard", styles['Title2']))
s.append(Paragraph("AI-Powered Clinical SOP Assistant with Built-in Safety Verification", styles['Sub']))
s.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1a365d'), spaceAfter=8))

# What
s.append(Paragraph("What Is This Project?", styles['SH']))
s.append(Paragraph(
    "SOP-Guard is an AI assistant that helps doctors and nurses quickly find answers from hospital "
    "Standard Operating Procedures (SOPs). Instead of searching through long PDF documents under time "
    "pressure, a clinician simply asks a question in plain language and gets a direct, sourced answer. "
    "The key innovation is that the system <b>checks its own answer</b> before showing it — verifying "
    "that dosages, step sequences, and contraindications are correct according to the official SOP.",
    styles['B']))

# Problem
s.append(Paragraph("What Problem Does It Solve?", styles['SH']))
s.append(Paragraph(
    "Hospitals have hundreds of SOPs that are long, frequently updated, and hard to search. Clinicians — "
    "especially during night shifts or emergencies — often need a specific detail (a dosage limit, a required "
    "step) but must manually dig through documents to find it. This wastes time and increases the risk of "
    "errors. SOP-Guard makes this information instantly accessible and verifiably accurate.",
    styles['B']))

# How
s.append(Paragraph("How Does It Work?", styles['SH']))
items = [
    "The clinician types a question or <b>records a voice message</b> (e.g., \"What is the sepsis protocol for patients with renal impairment?\"). Audio is transcribed using Whisper and processed like text.",
    "The system searches the SOP database using AI-powered retrieval (RAG) to find relevant sections.",
    "A reasoning agent generates an answer grounded in those sections, with citations.",
    "A <b>Procedural Faithfulness Verifier</b> automatically checks the answer for three error types: "
    "wrong thresholds, skipped steps, and missed contraindications.",
    "The answer is shown with a confidence score, source highlights, and reasoning trace. If confidence "
    "is low, the system says so instead of guessing.",
]
for item in items:
    s.append(Paragraph(f"• {item}", styles['Bul']))

# Tech
s.append(Paragraph("Technology Used", styles['SH']))
s.append(Paragraph(
    "<b>LLM:</b> Claude / Llama 3.1 (can run locally inside hospital network) &nbsp;|&nbsp; "
    "<b>Voice Input:</b> OpenAI Whisper (speech-to-text) &nbsp;|&nbsp; "
    "<b>Orchestration:</b> LangGraph (multi-agent pipeline) &nbsp;|&nbsp; "
    "<b>Retrieval:</b> Qdrant vector database + BM25 hybrid search &nbsp;|&nbsp; "
    "<b>Backend:</b> FastAPI &nbsp;|&nbsp; "
    "<b>Frontend:</b> React (mobile-friendly) &nbsp;|&nbsp; "
    "<b>Evaluation:</b> RAGAS + custom procedural faithfulness metrics",
    styles['B']))

# Voice
s.append(Paragraph("Voice Input for Hands-Free Use", styles['SH']))
s.append(Paragraph(
    "Doctors and nurses often have their hands occupied — during procedures, while wearing gloves, or at "
    "the bedside. SOP-Guard supports <b>audio input</b>: clinicians tap a microphone button, speak their "
    "question, and the system transcribes it using OpenAI Whisper (fine-tuned for medical terminology) and "
    "processes it like any typed query. The transcribed text is shown for confirmation before submitting, "
    "reducing the risk of misheard medical terms.",
    styles['B']))

# SOP Update
s.append(Paragraph("Clinician-Driven SOP Updates (Living Knowledge Base)", styles['SH']))
s.append(Paragraph(
    "SOPs go stale — new research emerges, protocols change, and frontline staff learn things that never "
    "make it back into the documents. SOP-Guard includes a <b>structured update portal</b> where authorized "
    "clinicians (department heads, quality officers) can propose updates to specific SOP sections. Each "
    "update is tagged with the date, the clinician's name, and a brief reason for the change. Updates go "
    "through an approval workflow before going live. The system maintains a <b>version history</b> — so "
    "anyone can see what changed, when, and why. The AI knowledge base is automatically re-indexed after "
    "each approved update, ensuring answers always reflect the latest protocols.",
    styles['B']))

# Why novel
s.append(Paragraph("What Makes It Novel?", styles['SH']))
s.append(Paragraph(
    "Existing clinical QA systems retrieve and generate answers but have no way to verify procedural "
    "correctness. SOP-Guard introduces a <b>Procedural Faithfulness Verifier</b> — a dedicated component "
    "that checks whether the AI's answer follows the exact rules in the SOP (correct numbers, correct order, "
    "no missed exceptions). This verify-then-respond pattern is our core research contribution.",
    styles['B']))

# Practical
s.append(Paragraph("Why Is It Practical?", styles['SH']))
prac = [
    "<b>No EHR integration needed</b> — works only with SOP documents, avoiding data privacy barriers.",
    "<b>Runs on-premise</b> — nothing leaves the hospital network.",
    "<b>Deployable in weeks</b> — not years. Start with one department, expand based on feedback.",
    "<b>Clinician feedback loop</b> — doctors can flag incorrect answers, improving the system over time.",
]
for p in prac:
    s.append(Paragraph(f"• {p}", styles['Bul']))

doc.build(s)
print("Done: SOP-Guard_Summary.pdf")
