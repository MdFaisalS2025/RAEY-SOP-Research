# Annotation packet

Source: C:/Users/Faisal/AppData/Local/Temp/claude/C--Users-Faisal-Desktop-research-paper/1642f160-3dba-4100-baa8-850fde74b388/scratchpad/protocols/pa_2021_als.pdf -> C:/Users/Faisal/AppData/Local/Temp/claude/C--Users-Faisal-Desktop-research-paper/1642f160-3dba-4100-baa8-850fde74b388/scratchpad/protocols/pa_2023_als.pdf
Sample size: 60 items (seed 20261017, see PREREGISTRATION.md section 5.1)

## Task (PREREGISTRATION.md section 5.2)

For each row in annotation_packet.csv, look up the sample_id in
annotation_context.json to see the full old item and the WHOLE
corresponding new-edition guideline. Decide:

1. **annotator_correspondence**: the new item_id that is the same
   recommendation as the old item, or `NONE` if it was genuinely deleted,
   or `CANNOT_DETERMINE` if you cannot tell from the documents alone.
2. **annotator_relation**: one of `unchanged`, `reworded`, `substantive`,
   `merged`, `split`, `moved`.
3. **annotator_notes**: anything worth recording, especially for
   CANNOT_DETERMINE.

Do NOT look at method_predicted_item_id before deciding - it is the
method's own guess, and seeing it first defeats the point of an independent
judgement. Cover it if annotating on paper; if annotating in a spreadsheet,
hide that column until after your first pass.

Two annotators complete this independently. Do not compare notes until
both are done - PREREGISTRATION.md section 5.3 reports agreement on the
UNINFLUENCED judgements.
