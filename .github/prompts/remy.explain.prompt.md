---
mode: agent
tools:
  - codebase
  - readFile
  - search
  - usages
  - createFile
description: Produce a plain-English explainer for a poker term or system concept, grounded in the actual codebase.
---

## Goal

Translate a poker term or system-level concept into a clear, accurate explainer that works for both poker-naive developers and poker-savvy front-end consumers. Ground every definition in how the concept is actually implemented in the AIA Core codebase.

---

## Context

**Project:** AIA Core — Texas Hold'em poker analytics backend.

**Texas Hold'em primer (for reference when writing explanations):**
- 52-card deck, 4 suits (Spades/Hearts/Diamonds/Clubs), 13 ranks (A, 2–10, J, Q, K)
- Each player receives 2 private "hole cards" dealt face-down
- 5 community cards dealt face-up in stages: flop (3 cards at once), turn (1 card), river (1 card)
- Players build their best 5-card hand from any combination of their 2 hole cards and the 5 board cards
- Betting rounds: pre-flop, post-flop, post-turn, post-river (showdown)

**This system's card notation:** rank + suit string, e.g. `"AH"` = Ace of Hearts, `"10S"` = Ten of Spades.

---

## Instructions

1. **Interpret the concept** — determine if it is:
   - A pure poker term (community cards, hole cards, flop/turn/river, hand ranking, pot, blinds, showdown, etc.)
   - A system concept (game session, card detection, source upload, detection correction, CSV upload, etc.)
   - A hybrid (e.g., "hand" — means a deal of cards in poker AND a database record in this system)

2. **Search the codebase** for all references to the concept: model fields, enum members, endpoint paths, service function names, variable names, comments

3. **Write the explainer** with these sections:
   - What it means in poker (concise, jargon-free, no assumptions about reader's poker knowledge)
   - How AIA Core models it (exact field names, data types, stored representation, table names)
   - Code references (file paths + line numbers)
   - Related concepts (with `@remy explain <concept>` suggestions)
   - Open Questions (if the implementation deviates from standard poker in an unexplained way)

4. **Write the doc** using `remy.concept-explainer.template.md` to `docs/concepts/<concept-slug>.md`

---

## Output Format

`docs/concepts/<concept-slug>.md` following `remy.concept-explainer.template.md`.

---

## Example

**Input:** `@remy explain community cards`

**Output:** `docs/concepts/community-cards.md`

- **Poker definition:** The 5 shared cards dealt face-up in the center of the table — 3 at the flop, 1 at the turn, 1 at the river. All players use them freely to build their best hand.
- **System model:** Stored in the `community` table (`src/app/database/database_models.py`). Separate columns per card: `flop_card_0`, `flop_card_1`, `flop_card_2`, `turn_card`, `river_card` — each a `String` holding a 2–3-char card notation (e.g., `"AH"`, `"10S"`).
- **Code reference:** `database_models.py:11–21`, `Community` class
- **Related:** `@remy explain hand`, `@remy explain game session`, `@remy explain card detection`

**Input:** `@remy explain card detection`

**Output:** `docs/concepts/card-detection.md`
- System concept: The ML-based computer vision pipeline that identifies card values from uploaded images
- Stored in: `card_detections` table — links a detected card to an `upload_id`, `card_string`, and confidence score
- Related endpoints: POST /images/upload, POST /images/confirm, POST /images/correct

---

## Anti-patterns

- Do NOT provide generic poker definitions without tying them to the actual code
- Do NOT skip the codebase search — every explainer must be anchored in real field/function names
- Do NOT write for an expert-only audience — assume the reader knows Python but not poker
- Do NOT omit the Open Questions section if the implementation deviates from standard Texas Hold'em rules
