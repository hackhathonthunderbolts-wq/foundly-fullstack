# 5. Lost Mode — Post Creation Spec

Screen: **Create Lost Post** (3-step form, top progress bar "Step X of 3", Lost Mode theme throughout — `mode.lost.primary`/`mode.lost.accent`).

## Step 1 — What did you lose?

| Field | Type | Required | Constraints |
|---|---|---|---|
| Item title | Short text | Yes | 3–60 chars, e.g. "Blue Hydro Flask water bottle" |
| Category | Single-select dropdown | Yes | Electronics, ID/Cards, Bag/Backpack, Clothing, Books/Stationery, Accessories/Jewelry, Keys, Wallet/Purse, Sports Equipment, Other |
| Description | Multi-line text | Yes | 10–500 chars; placeholder prompts "Color, brand, any marks or stickers, contents…" |
| Photo(s) | Image upload | Optional but strongly encouraged | Up to 3 images, 5MB each, JPEG/PNG/HEIC auto-converted; if user has no photo, a "no photo — matching will rely on text only" notice is shown, since image similarity meaningfully boosts match confidence |

## Step 2 — Where & when

| Field | Type | Required | Constraints |
|---|---|---|---|
| Last seen location | Single-select from campus location list + "Other (type manually)" | Yes | Preset list: hostel blocks, academic blocks, library, food court, sports complex, main gate, parking, auditorium, etc. — sourced from a maintained campus-location table (see data model) |
| Date lost | Date picker | Yes | Cannot be a future date; defaults to today |
| Approximate time (optional) | Time picker or range (Morning/Afternoon/Evening/Night) | No | Helps narrow matches when several similar items are found on the same day |
| Additional location notes | Short text | No | e.g. "Near the vending machine on 2nd floor" |

## Step 3 — Contact & review

| Field | Type | Required | Constraints |
|---|---|---|---|
| Contact preference | Single-select | Yes | "In-app relay only" (default, recommended) / "Allow direct email after match" |
| Reward note (optional, text only, no payment handling) | Short text | No | e.g. "Happy to treat you to coffee!" — purely social, app never processes money |
| Review summary | Read-only card | — | Shows title, category, description, photos, location, date exactly as the post will appear; Edit links jump back to the relevant step |

**Primary CTA:** "Post as Lost" → validates required fields, shows inline errors (per §2.6 error state) if any are missing, then submits.

## Post-submit behavior
- Confirmation screen: "Your lost item is live" with a share/copy-link-free note ("We'll notify you the moment a matching Found post appears — no need to keep checking.").
- The post enters status `open` and is immediately queued for matching against all existing open Found posts (§7), and will continue to be matched against new Found posts as they arrive.
- Post appears in **My Posts** with status badge `Searching…` (Lost Mode accent color) until either matched or manually resolved.

## Editing / lifecycle
- Owner can edit any field at any time while status is `open`; an edit re-triggers matching.
- Owner can mark **Found it myself** (closes post, status `resolved_self`, removed from matching pool) or **Delete post**.
- Posts auto-expire after 60 days of inactivity → status `expired`, hidden from active feed/matching but retained for the owner's records; a reminder notification is sent at day 50 ("Still looking for this? Tap to keep it active").
