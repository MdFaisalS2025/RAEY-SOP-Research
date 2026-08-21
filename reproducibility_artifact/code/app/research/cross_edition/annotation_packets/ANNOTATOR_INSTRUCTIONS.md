# Annotation instructions

You are helping validate a research pipeline that tracks individual clinical
recommendations across two editions of an EMS (emergency medical services)
protocol document. For each of 4 document pairs, 60 specific recommendations
("items") from the older edition were sampled. Your job: for each one,
find out what happened to it in the newer edition.

No clinical judgment is required. This is a document-matching task: "is this
the same recommendation, reworded or not, somewhere in the new edition — or
was it genuinely dropped?"

## What you have

For each of the 4 pairs (Tennessee, Pennsylvania, Connecticut #1,
Connecticut #2), in your own `annotator_A/` or `annotator_B/` folder:

- **`annotation_packet_BLIND.csv`** — the 60 items to label. This is the
  file you fill in.
- One level up, shared: **`annotation_context.json`** — look up each
  item's `sample_id` here to see the *entire* new-edition guideline the old
  item might now belong to (not just a snippet — the whole thing).

## What to do, per row

1. Open `annotation_packet_BLIND.csv`. Each row has: the old item's ID,
   which guideline/section it came from, and its full text.
2. Look up that row's `sample_id` in `annotation_context.json`. Read the
   `old_item_full` block (same item, for confirmation) and then read
   `new_guideline_full_text` — every item in the new edition's
   corresponding guideline, in order.
3. Decide: does one of those new items say the same thing as the old item
   (possibly reworded, renumbered, or merged with something else)? Fill in:
   - **`annotator_correspondence`** — the matching new item's `item_id`
     (copy it exactly from the JSON), or `NONE` if you're confident it was
     genuinely dropped, or `CANNOT_DETERMINE` if you truly can't tell from
     the documents alone. `CANNOT_DETERMINE` is a legitimate, expected
     answer sometimes — do not force a guess.
   - **`annotator_relation`** — one of: `unchanged`, `reworded`,
     `substantive` (same topic, meaningfully different content),
     `merged` (old item folded into a bigger new item), `split` (old item
     became multiple new items — list all matching IDs in
     `annotator_notes` if so), `moved` (same content, different
     section/guideline).
   - **`annotator_notes`** — optional, but please explain any
     `CANNOT_DETERMINE` or anything you're unsure about.

## Rules

- **Work independently.** Don't discuss items with the other annotator or
  compare answers until you're both completely done with all 4 packets.
  The whole point is measuring how often two people agree *without*
  coordinating.
- **You will not see the pipeline's own guess.** That's deliberate — the
  file you have has it stripped out. Just judge each item on its own
  merits from the documents.
- **Don't use the source PDFs to "look ahead."** Everything you need is in
  `annotation_context.json`. If it's genuinely not enough to decide, that's
  what `CANNOT_DETERMINE` is for.
- Take breaks between packets if useful — there's no time limit, but please
  don't split a single 60-row packet's judgments across days if you can
  help it (consistency matters more than speed).

## When you're done

Send back your 4 completed `annotation_packet_BLIND.csv` files (don't rename
them — file path/folder already tells us which annotator and which pair).
That's it — nothing else needs to change.
