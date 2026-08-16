"""
Tier A paraphrase fixture for the Phase U structural-anchoring pilot.

Each entry pairs a real item_id (from corpus.py's parse of the two CDC
documents) with a hand-authored paraphrase - the same content, reworded,
simulating what a real system's structured extraction step would produce
(the same relationship the demo corpus's hand-authored structured_json has
to its own raw_text - see demo_data/demo_sops.py). Author-constructed, not
model-generated: this is Tier A's "held-out generator" requirement satisfied
by a human paraphraser who is not the anchoring method itself, consistent
with the corpus/method separation the Phase U plan requires. Written by
reading each item's real text and rewording it without consulting the
anchoring code's behavior.

38 pairs across five documents (2 CDC, 2 AHRQ, 1 synthetic adversarial
decoy fixture - see corpus.py), chosen to be unambiguous item_ids only -
core_practices.py's 5a-5f duplicate (see corpus.py's docstring finding) are
deliberately excluded here so this fixture measures anchoring accuracy, not
ID-disambiguation, which is a separate, real, and harder problem flagged in
the Phase U plan for the full-scale corpus.

Selected across a real range of structural depth: category-level (core
practices, depth 1) and recommendation-level at every real nesting depth
found in the disinfection/sterilization document (1.a = depth 2, 2.b.i =
depth 3, 5.n.1 = depth 3, 7.aa = depth 2 double-letter), plus the longer
multi-sentence AHRQ items and the adversarial decoy-marker set. Every
number in this docstring should match len(PARAPHRASES) below and
pilot_eval.py's own count assertions - see run_pilot()'s n_pairs field for
the authoritative count at run time, since this comment can drift again.
"""

PARAPHRASES: list[dict] = [
    # --- cdc_core_practices (category-level, depth 1) ---
    {"doc_id": "cdc_core_practices", "item_id": "1",
     "paraphrase": "Hospital leadership must be held accountable for infection prevention success, and must give the infection prevention program enough staff, resources, and real authority to act."},
    {"doc_id": "cdc_core_practices", "item_id": "2",
     "paraphrase": "All healthcare personnel need infection-prevention training specific to their job duties, required before they start working and refreshed at least yearly, with extra training after any lapse."},
    {"doc_id": "cdc_core_practices", "item_id": "3",
     "paraphrase": "Patients, families, and visitors should be taught how infections spread and what symptoms mean they should contact their provider."},
    {"doc_id": "cdc_core_practices", "item_id": "4",
     "paraphrase": "Facilities should track adherence to infection prevention practices, give staff and leadership regular feedback on it, and monitor infection incidence to catch transmission early."},
    {"doc_id": "cdc_core_practices", "item_id": "6",
     "paraphrase": "Transmission-based precautions should be added on top of standard precautions for patients whose diagnosis poses a real transmission risk, starting as soon as possible after they arrive and adjusted as more information comes in."},
    {"doc_id": "cdc_core_practices", "item_id": "7",
     "paraphrase": "Every invasive device like a catheter or feeding tube should be reassessed at each encounter to find the earliest safe moment to remove it."},
    {"doc_id": "cdc_core_practices", "item_id": "8",
     "paraphrase": "Staff should be immunized against vaccine-preventable diseases, encouraged to stay home when sick, and given a way to report illnesses that could put patients at risk."},

    # --- cdc_disinfection_sterilization, depth 2 (N.letter) ---
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "1.a",
     "paraphrase": "Workers should be told about the health risks of the infectious agents and chemicals they might be exposed to, in line with OSHA requirements."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "1.e",
     "paraphrase": "Staff with weeping skin dermatitis on their hands should not have direct contact with patient-care equipment."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "2.b",
     "paraphrase": "Patient-care items need thorough cleaning with detergent or enzymatic cleaner before they go through high-level disinfection or sterilization."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "3.a",
     "paraphrase": "Any critical device that enters sterile tissue, the bloodstream, or carries a sterile body fluid must be sterilized before each patient use."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "4.b",
     "paraphrase": "Noncritical devices like blood pressure cuffs should be disinfected with an EPA-registered hospital disinfectant following the label's instructions, which usually specify a 10-minute contact time."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "5.g",
     "paraphrase": "When it's unclear whether a surface is contaminated with blood/body fluid or just ordinary dirt, or whether resistant organisms might be present, use a one-step EPA-registered hospital disinfectant."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "5.n",
     "paraphrase": "Cleaning up a blood or infectious-material spill requires appropriate PPE and an EPA-registered tuberculocidal or HIV/HBV-rated disinfectant."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "6.a",
     "paraphrase": "Routine disinfectant fogging of patient-care areas is not recommended."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "7.a",
     "paraphrase": "Every flexible endoscope should be leak-tested at each reprocessing cycle, and any instrument that fails should be pulled from use and repaired."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "7.b",
     "paraphrase": "Right after use, the endoscope needs a thorough clean with a compatible enzymatic cleaner before either automated or manual disinfection can happen."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "7.aa",
     "paraphrase": "The concentration of liquid sterilant or high-level disinfectant should be checked daily with the right chemical indicator, and the solution discarded once it falls below minimum effective strength or its labeled reuse life."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "7.am",
     "paraphrase": "Outbreaks tied to endoscope-related infections need to be reported to the facility's infection control and risk management staff, and to the FDA."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "8.a",
     "paraphrase": "Dental instruments that penetrate bone or soft tissue count as critical and must be sterilized after each use or thrown away."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "9.a",
     "paraphrase": "Ordinary sterilization and disinfection procedures are already sufficient for equipment contaminated with bloodborne or emerging pathogens, except prions."},

    # --- cdc_disinfection_sterilization, depth 3 (N.letter.subletter / N.letter.digit) ---
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "2.b.i",
     "paraphrase": "Cleaning has to remove visible organic material like blood or tissue as well as inorganic salts, using cleaning agents capable of getting both off."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "5.n.1",
     "paraphrase": "For a small blood or OPIM spill under about 10 mL, a 1:100 dilution of sodium hypochlorite is enough to decontaminate a hard surface; larger spills need a stronger 1:10 dilution first, followed by a 1:100 terminal disinfection."},
    {"doc_id": "cdc_disinfection_sterilization", "item_id": "7.am.1",
     "paraphrase": "The local and state health departments, CDC, and the device manufacturer should all be notified."},

    # --- ahrq_cauti_appropriate_indications (depth 1, but 3-6 sentences
    # per item - added specifically to test structural anchoring on longer,
    # more heavily paraphrasable content than CDC's mostly one-line
    # recommendations. See Phase U plan notes on the first (CDC-only)
    # pilot's coverage/IoU results and why this second corpus was added. ---
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "1",
     "paraphrase": "Indwelling catheters are appropriate for acute urinary retention, including retention caused by medications, acute neurogenic bladder, or an exacerbation of BPH (though urology input should be sought for prostatitis or urethral trauma cases), and for managing gross hematuria with clots or chronic retention with bladder outlet obstruction; chronic retention without obstruction is usually better managed with intermittent straight catheterization instead."},
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "2",
     "paraphrase": "In critically ill patients, an indwelling catheter is the only way to get hourly urine output for conditions like hemodynamic instability or close titration of drips such as vasopressors, and it may also be used for daily output measurement when no other method works - but hemodynamically stable ICU patients without a real indication should use alternative output-measurement methods instead of a catheter."},
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "3",
     "paraphrase": "Catheters are appropriate for certain surgeries - long procedures, ones needing large fluid volumes or diuretics, cases requiring intraoperative urine output monitoring, and urologic or nearby genitourinary surgeries - and should be removed in the recovery unit once surgery ends; they should not be routinely used just because a patient is getting epidural anesthesia."},
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "4",
     "paraphrase": "A catheter can be justified to protect severe stage III/IV or unstageable pressure wounds from urinary incontinence when other wound-care measures aren't enough, or when moving the patient risks hemodynamic instability, requires strict immobility such as an unstable spine or pelvic fracture, or when the patient's weight makes turning difficult without enough staff support - but a catheter should not simply replace ordinary skin care and incontinence management."},
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "5",
     "paraphrase": "Using a catheter for comfort at end of life is acceptable when it helps meet the patient's or family's goals, though catheters can still be uncomfortable and not everyone wants one."},
    {"doc_id": "ahrq_cauti_appropriate_indications", "item_id": "6",
     "paraphrase": "A catheter may be used when a patient must remain strictly immobile after certain injuries or operations, such as spinal instability, multiple pelvic fractures, or a hip fracture at risk of displacing before it's surgically repaired."},

    # --- ahrq_cauti_inappropriate_indications (depth 1, 1-3 only - item 4
    # and its nested duplicate-numbered sublist are excluded from the raw
    # file itself, see that file's EXTRACTION NOTE) ---
    {"doc_id": "ahrq_cauti_inappropriate_indications", "item_id": "1",
     "paraphrase": "Catheters shouldn't be used just to track urine output when that output can be measured another way - many patients get one routinely for conditions like heart failure even though urinals, graduated collection containers, or daily weights would work, and involving the patient or family with instructions on tracking output and weight can help; the exception is when hourly or daily measurement is truly needed for treatment and no other method can provide it."},
    {"doc_id": "ahrq_cauti_inappropriate_indications", "item_id": "2",
     "paraphrase": "Incontinence alone, without a sacral or perineal pressure sore, isn't a reason to place a catheter - patients managed their incontinence before admission, and options like barrier creams, absorbent pads, scheduled toileting, prompt linen changes, and condom catheters for cooperative men should be used instead; an exception exists for patients with severe obesity or edema where standard turning isn't feasible."},
    {"doc_id": "ahrq_cauti_inappropriate_indications", "item_id": "3",
     "paraphrase": "Catheters placed for surgery should come out within a day unless there's a specific reason to keep them, such as urethral repair or documented acute retention on a bladder scan."},

    # --- adversarial_decoy_markers (synthetic, see that raw file's header
    # and corpus.py's _parse_adversarial_decoy_markers docstring) - each
    # paraphrase's item_id also matches a decoy citation earlier in
    # raw_text via the SAME marker regex every method uses, so a method
    # that doesn't actually distinguish real content from a coincidental
    # marker match should anchor to the wrong (decoy) block here. ---
    {"doc_id": "adversarial_decoy_markers", "item_id": "1",
     "paraphrase": "Hands should be cleaned right before and right after touching a patient, with alcohol-based rub as the default and soap and water reserved for when hands are visibly dirty."},
    {"doc_id": "adversarial_decoy_markers", "item_id": "2",
     "paraphrase": "Put on fresh gloves before touching a patient's mucous membranes, broken skin, or body fluids, and take them off again right after that task, before touching anything else."},
    {"doc_id": "adversarial_decoy_markers", "item_id": "3",
     "paraphrase": "Every IV line and its tubing and solution should be dated when started, so staff can tell which ones are overdue for a routine change or have gone past the facility's dwell-time limit."},
    {"doc_id": "adversarial_decoy_markers", "item_id": "4",
     "paraphrase": "Keep sterile supplies in a dedicated clean space, away from sinks, trash, or anything else that could splash or spread contamination onto the packaging."},
    {"doc_id": "adversarial_decoy_markers", "item_id": "5",
     "paraphrase": "At every shift handoff, write down the specific reason each indwelling device is still in place, so a device with no current justification gets flagged for removal instead of staying by default."},
]

# Every entry above is project-authored (Tier A) per this module's own
# docstring - tagged uniformly here rather than on all 38 individual dict
# literals, both to avoid 38 near-identical edits and so a future Tier B
# entry (authored by someone other than this project - see the docstring's
# "held-out generator" note) has an obvious, single place its tier value
# would actually differ from this default.
for _pair in PARAPHRASES:
    _pair.setdefault("tier", "A")
del _pair


def split_dev_test(test_doc_ids: set[str] | None = None) -> tuple[list[dict], list[dict]]:
    """Document-disjoint dev/test split: every pair from a given doc_id
    goes entirely into one split, never divided within a document - chunks
    from one guideline leak structure (shared vocabulary, shared numbering
    conventions), so splitting within a document isn't a real held-out test.

    Every threshold in pilot_eval.py (_MARKER_MIN_CONTAINMENT and the two
    inline floors in method_fuzzy/method_embed_span) must be calibrated
    using ONLY the dev split; the test split's numbers get reported exactly
    once, at the end - this is the single most reviewer-visible weakness
    FINDINGS.md's own §9 names ("every number in this log is a pilot
    number, calibrated and tested on the same data"), and this function is
    the fix for it going forward, not yet exercised by pilot_eval.py's
    current run_pilot() (which still evaluates everything as one set - see
    Phase X plan item 14 for wiring this in as thresholds get frozen).

    Defaults to holding out `adversarial_decoy_markers` as test - the one
    document built as a deliberate adversarial stress-test rather than an
    organic draw from the corpus, so it's a meaningful held-out check now
    even before the corpus scales past 5 documents. At only 5 documents
    total, a document-level split is necessarily coarse (a handful of
    possible partitions, not a statistically meaningful random draw) -
    stated honestly rather than presented as more rigorous than it is.
    Revisit the default once the corpus reaches the 30-60 document target
    in Phase X3, where a genuine random per-source split becomes possible.
    """
    if test_doc_ids is None:
        test_doc_ids = {"adversarial_decoy_markers"}
    dev = [p for p in PARAPHRASES if p["doc_id"] not in test_doc_ids]
    test = [p for p in PARAPHRASES if p["doc_id"] in test_doc_ids]
    return dev, test


def assert_document_disjoint(dev: list[dict], test: list[dict]) -> None:
    """Raise if any doc_id appears in both splits - the one invariant this
    whole scheme exists to guarantee. Call this in a test, not just here,
    so a future edit to split_dev_test can't silently violate it."""
    dev_docs = {p["doc_id"] for p in dev}
    test_docs = {p["doc_id"] for p in test}
    overlap = dev_docs & test_docs
    if overlap:
        raise AssertionError(f"dev/test split is not document-disjoint - shared doc_id(s): {sorted(overlap)}")
