# 7. Matching Logic (0–100 confidence score)

## 7.1 When matching runs
- **Trigger:** any time a Lost or Found post is created or edited while `status = open`.
- **Scope:** the triggering post is scored against every *opposite-type* `open` post (Lost↔Found), not same-type posts.
- **Execution:** async background job (queue-based, not blocking the submit flow) — the user sees "Post published," matching happens within seconds, results arrive via notification.

## 7.2 Scoring components
Final score is a weighted blend of independent signals, each normalized to 0–100 before weighting:

| Signal | Weight | Method |
|---|---|---|
| Category match | 15% | Exact match = 100; different category = 0 (hard-ish filter — see §7.3) |
| Text similarity (title + description) | 35% | Embed both texts with a sentence-embedding model (e.g., a small transformer embedding API); cosine similarity scaled to 0–100. Keyword/brand overlap (e.g., "Hydro Flask", "iPhone 13") gets a small bonus boost since brand/model names are high-signal. |
| Image similarity | 30% | If both posts have ≥1 photo: run an image embedding model (e.g., CLIP-style) on each photo, take the best pairwise cosine similarity across all photo combinations, scale to 0–100. If either post has no photo, this component is excluded and its weight is redistributed proportionally across the remaining signals (so a text-only post can still score well). |
| Location proximity | 12% | Exact same location = 100; same building/different floor = 70; same zone (e.g., both "academic block" area) = 40; unrelated = 0 — driven by a simple location-adjacency table, not free-text guessing. |
| Date proximity | 8% | Found date on/after lost date, within a decaying window: 0 days = 100, 7 days = ~70, 30 days = ~30, beyond 30 days = 0 (linear or exponential decay — implementation choice). Found date *before* lost date scores 0 for this component (logically impossible match). |

**Final score = Σ(normalized signal × weight)**, rounded to nearest integer, clamped 0–100.

## 7.3 Guardrails
- **Category hard filter:** if categories differ entirely (e.g., "Electronics" vs "Clothing"), cap the final score at 30 regardless of other signals, to avoid a coincidentally similar photo/description producing a false high-confidence match across unrelated item types.
- **Minimum floor to surface at all:** scores below 40 are not shown to users or counted as a "match" in the Matches tab — they're computed but discarded, to keep noise low.
- **40–75 band → "Possible match":** shown in the Matches tab under a lower-confidence section; user can manually confirm or dismiss. Dismissing trains nothing automatically in v1 (no online learning) but is logged for future model tuning.
- **>75 → auto-connect** (see §7.4).
- **Duplicate protection:** a single post is only auto-connected to its single highest-scoring match above 75; if multiple candidates exceed 75, all are surfaced but only the top one auto-triggers the relay — others appear as "Other possible matches" so the user isn't double-committed.

## 7.4 What happens at score > 75
1. Both posts' statuses change to `matched_pending`.
2. Both users receive a push notification: "We found a likely match for your [Lost/Found] item!" with the match score shown as a friendly label, not a raw number, to avoid over-indexing on precision:
   - 90–100 → "Very likely match"
   - 76–89 → "Likely match"
3. A **Relay Thread** is created (§8) — no raw email is exchanged yet; users chat in-app.
4. Either user can tap **"This isn't my item"** to reject the match — this reopens both posts to `open` status and resumes normal matching against other candidates, and logs the rejection as negative signal for future tuning.
5. When both users confirm the item is correctly matched (via an explicit "Confirm match" action on each side), status becomes `resolved_matched` for both posts, and the app prompts them to optionally share direct contact/email to arrange handoff.

## 7.5 Practical implementation notes
- Store the raw per-signal scores alongside the final blended score (not just the final number) — useful for debugging bad matches and for future re-weighting without recomputing from scratch.
- Recompute matching for a post whenever it's edited (title/description/category/location/date/photos changed); no need to recompute on contact-preference-only edits.
- Keep the embedding calls cheap by caching each post's text/image embedding at submit time rather than re-embedding on every comparison.
