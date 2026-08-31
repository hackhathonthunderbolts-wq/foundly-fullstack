# 6. Found Mode — Post Creation Spec

Screen: **Create Found Post** — same 3-step structure as Lost, themed with `mode.found.primary`/`mode.found.accent` (light blue) so the two flows feel like siblings, not clones.

## Step 1 — What did you find?

| Field | Type | Required | Constraints |
|---|---|---|---|
| Item title | Short text | Yes | 3–60 chars |
| Category | Single-select dropdown | Yes | Same category list as Lost Mode (must match exactly — this is a matching input) |
| Description | Multi-line text | Yes | 10–500 chars; placeholder: "Color, brand, condition, any distinguishing marks…" |
| Photo(s) | Image upload | **Required for Found posts** | Up to 3 images; Found posts require at least 1 photo since it's the finder's item in hand — this materially improves match quality and gives the true owner a way to visually confirm |

## Step 2 — Where & when found

| Field | Type | Required | Constraints |
|---|---|---|---|
| Found location | Same campus-location select as Lost | Yes | |
| Date found | Date picker | Yes | Cannot be future |
| Approximate time (optional) | Same as Lost | No | |
| Current holding location | Single-select | Yes | "With me — will hand over directly" / "Handed to [Block] security/warden desk" / "Handed to Student Affairs office" — sets expectations for how a match gets resolved |

## Step 3 — Contact & review
Same fields/pattern as Lost Mode (contact preference, review summary). No reward field on Found posts.

**Primary CTA:** "Post as Found"

## Post-submit behavior
- Confirmation: "Thanks for helping a fellow VIT student!" with a note that matching runs automatically.
- Post enters status `open`, immediately matched against all open Lost posts (§7).
- Appears in **My Posts** with status `Awaiting owner` until matched/resolved.
- Same edit/expire/resolve lifecycle as Lost posts (`resolved_matched`, `resolved_handed_to_desk`, `expired` at 60 days).

## Cross-mode consistency note
Because matching depends on comparable fields, **category and location option lists are a single shared source of truth** (one config/table), not duplicated per mode — see data model (§9).
