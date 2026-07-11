# Meridian: Thesis Summary

*A plain-language explanation of this research for a non-technical audience.*

---

## The Problem

Hospitals run on Standard Operating Procedures (SOPs). These are detailed documents that tell staff exactly how to perform critical tasks: how to administer medication, how to respond to a cardiac arrest, how to sterilize equipment, and hundreds of other procedures.

The problem is that these documents are long, numerous, and hard to search. A typical hospital may have hundreds of SOPs, each running 10-30 pages. When a nurse needs to quickly confirm a dosage protocol or a resident needs to verify an isolation procedure, they must manually search through PDF files or paper binders. This is slow under normal conditions and dangerously slow during emergencies.

Existing search tools (keyword search, document management systems) are not effective because:

- **Medical language is complex** -- the same concept may be described using different terminology across departments
- **Context matters** -- "hand hygiene protocol" means different things in the operating room versus the general ward
- **Accuracy is critical** -- a wrong or incomplete answer could directly harm patients
- **Staff need answers, not documents** -- finding the right document is only half the problem; staff need specific, actionable answers

## The Solution

Meridian is an AI system that lets hospital staff ask questions in plain language and receive accurate, verified answers drawn directly from their SOPs.

For example, a nurse could ask: *"What PPE do I need before entering a COVID isolation room?"* and receive a direct answer like: *"According to SOP INF-003 Section 4.2: N95 respirator, face shield, isolation gown, and double gloves. Perform hand hygiene before donning and after doffing."*

What makes Meridian different from a simple chatbot is its multi-step verification process:

1. **It understands the question** -- The system classifies what type of question is being asked and which department it relates to
2. **It finds the right sources** -- Using a combination of meaning-based search and keyword matching, it retrieves the most relevant SOP sections
3. **It generates an answer** -- A large language model (like GPT-4) produces a natural-language answer based on the retrieved text
4. **It checks its own work** -- A separate verification step breaks the answer into individual claims and confirms each one is supported by the source documents
5. **It shows its sources** -- Every answer includes citations to specific SOP sections so staff can verify independently

If the system cannot verify a claim, it flags the answer with a warning rather than presenting potentially incorrect information as fact.

## The Research Contribution

This thesis contributes to the field in several ways:

**1. A new architecture for clinical SOP question-answering.** While RAG (Retrieval-Augmented Generation) systems exist, this work specifically addresses the unique requirements of clinical SOPs: high accuracy requirements, the need for source attribution, and the importance of detecting when the AI is uncertain or wrong.

**2. A verification layer for hallucination detection.** Large language models sometimes generate plausible-sounding but incorrect information (called "hallucinations"). This is unacceptable in healthcare. Meridian introduces a dedicated verification agent that cross-checks every claim in the generated answer against the source documents.

**3. A hybrid retrieval approach optimized for medical documents.** The system combines two complementary search strategies -- semantic search (understanding meaning) and keyword matching (finding exact terms) -- to handle the varied terminology found in medical SOPs.

**4. A feedback mechanism for continuous improvement.** Clinicians can rate the quality of answers, creating a dataset that can be used to measure and improve system performance over time.

**5. A practical, deployable prototype.** Unlike many research systems that exist only as scripts and notebooks, Meridian is a complete web application that could be deployed in a hospital setting (after proper clinical validation).

## Evaluation Plan

The system will be evaluated on multiple dimensions:

### Retrieval Quality
- Can the system find the right SOP sections for a given question?
- Measured using Precision@K, Recall@K, Mean Reciprocal Rank (MRR), and normalized Discounted Cumulative Gain (nDCG)
- Tested against a curated set of question-answer pairs with known source sections

### Answer Quality
- Are the generated answers correct and complete?
- Measured using answer faithfulness (are claims supported by sources?), answer relevance (does it address the question?), and completeness
- Compared against gold-standard answers written by domain experts

### Hallucination Detection
- Does the verification layer catch incorrect claims?
- Measured by intentionally introducing errors and checking if the verifier flags them
- Reported as precision and recall of the hallucination detector

### User Experience
- Is the system useful to real clinicians?
- Measured through user satisfaction surveys, task completion time comparisons, and qualitative feedback
- Planned as a small-scale user study (pending ethics approval)

### Baseline Comparisons
- How does Meridian compare to simpler approaches?
- Compared against: keyword search only, semantic search without RAG, RAG without verification, and direct LLM prompting without retrieval

## Who This Research Is For

- **Healthcare informatics researchers** studying AI applications in clinical settings
- **NLP researchers** working on domain-specific RAG and hallucination detection
- **Hospital IT departments** evaluating AI-assisted document retrieval
- **Clinical staff** who want to understand how AI could help with SOP access
- **Thesis committee members** evaluating this work as a Master's research contribution
