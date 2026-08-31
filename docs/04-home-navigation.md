# 4. Home Screen & Navigation

## 4.1 Home screen layout
Top-level bottom tab bar (persistent across the app once logged in):

1. **Home** — the two mode entry cards + activity feed
2. **My Posts** — user's own Lost/Found posts and their statuses
3. **Matches** — inbox of match notifications and active relay threads
4. **Profile** — account info, sign out, settings

**Home tab content, top to bottom:**
- Greeting header: "Hi, [First Name]" + small profile avatar (top right)
- Two large mode cards, side by side or stacked depending on screen width:
  - **LOST** card — `mode.lost.primary` background, "I lost something" headline, icon (magnifying glass), tap → Create Lost Post
  - **FOUND** card — `mode.found.primary` background, "I found something" headline, icon (hand holding item), tap → Create Found Post
- Below the cards: "Recent activity on campus" — a light, anonymized feed of recent Lost/Found post titles + category + relative time (e.g., "Found: Black umbrella · Main Gate · 2h ago") so users can browse without a dedicated search flow in v1. Tapping opens the post detail (read-only if not the owner and no match).

## 4.2 Navigation map

```
[Splash / Loading]
       |
       v
[Sign-In Screen] --(reject: non-VIT, future)--> [Rejection Screen] --> back to Sign-In
       |
       v (success, first time)
[Onboarding 1] -> [Onboarding 2] -> [Onboarding 3]
       |
       v
+-------------------- HOME (tab bar) --------------------+
|                                                          |
|  [Home Tab]                                              |
|    -> tap LOST card -> [Create Lost Post] -> [Post Review] -> [Post Published] -> back to Home
|    -> tap FOUND card -> [Create Found Post] -> [Post Review] -> [Post Published] -> back to Home
|    -> tap feed item -> [Post Detail (read-only)]
|                                                          |
|  [My Posts Tab]                                          |
|    -> list of own posts -> tap post -> [Post Detail (owner view)] -> [Edit Post] / [Mark Resolved] / [Delete Post]
|                                                          |
|  [Matches Tab]                                           |
|    -> list of matches (grouped: Pending / Connected / Dismissed)
|    -> tap match -> [Match Detail] -> [Relay Thread] (in-app chat proxy)
|                                                          |
|  [Profile Tab]                                           |
|    -> [Account Info] -> [Settings] -> [Sign Out]
+-----------------------------------------------------------+
```

## 4.3 Web layout (≥1024px)
Same four sections (Home, My Posts, Matches, Profile), presented as a **fixed left sidebar** instead of a bottom tab bar — icons + labels, active item highlighted with the accent color per current mode context. Content area keeps the same screen order and drill-in logic described in §4.2; only the outer chrome changes. See §2.7 for the full breakpoint table.

## 4.4 Transitions
- Tab switches: instant cross-fade (150ms), no slide (keeps bottom nav feeling flat/native).
- Drill-in navigation (list → detail, card → create flow): standard OS push transition (slide from right on iOS, shared-axis on Android/Material).
- Post creation flow (multi-step form) uses a top progress indicator (e.g., "Step 2 of 3") rather than a stack push per field group, so back-swipe returns to the previous step, not out of the flow entirely.
- Modals (confirmation dialogs, "why VIT-only" sheet, report/block sheet) use bottom-sheet presentation with a scrim, dismissible by swipe-down or scrim tap.
