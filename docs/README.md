# Foundly — Implementation-Ready Product Spec

A Lost & Found platform for VIT students, spanning **mobile apps (iOS/Android) and a companion website**, sharing one design system and backend. This package contains the full UX, UI, data, and matching-logic spec, ready to hand to a developer.

**Note:** VIT-email domain enforcement is specified in `03-authentication.md` but shipped as a **deferred, config-flag-controlled stub** per your request — the rest of the app is fully specified and buildable now.

## Contents
1. `01-overview.md` — App goals, primary flow, non-goals, success metrics
2. `02-branding-ui.md` — Colors, typography, the blinking-"F" loading animation, mode theming, components, accessibility
3. `03-authentication.md` — VIT-only login approach (deferred/stubbed), edge cases, onboarding
4. `04-home-navigation.md` — Home screen layout + full navigation map
5. `05-lost-mode-post-creation.md` — Create Lost Post: fields, constraints, lifecycle
6. `06-found-mode-post-creation.md` — Create Found Post: fields, constraints, lifecycle
7. `07-matching-logic.md` — 0–100 confidence scoring model (text + image + category + location + date), auto-connect threshold
8. `08-relay-chat.md` — Email-based relay/connection system, privacy-preserving contact sharing
9. `09-data-model.md` — Full schema: users, posts, photos, categories, locations, matches, relay threads/messages, reports
10. `10-tech-notes.md` — Suggested stack, build order, open questions

Read in order for a full walkthrough, or jump to any file — each is self-contained enough to hand to a specific team member (e.g., give `02` to a designer, `07`+`09` to a backend engineer).
