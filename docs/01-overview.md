# Foundly — Product Spec
## 1. App Overview & Goals

**App name:** Foundly
**Purpose:** Enable VIT students to post Lost and Found items and connect the right people quickly and safely, without exposing personal contact info until a match is confirmed.
**Platform:** Mobile (iOS + Android) **and** a companion responsive Website, sharing one design language and one backend/API. Recommended approach: build the mobile apps in a cross-platform framework (React Native or Flutter — see §10 Tech Notes) and the website as a responsive web app (React/Next.js) reusing the same component tokens (colors, type, spacing) defined in §2, so the two never visually drift apart. The website is scoped to the same core flows as mobile (sign in, post Lost/Found, view matches, relay chat) — it is not a marketing site, it's the same product on a larger screen. See §2.8 and §4.4 for web-specific layout notes.
**Access control:** Sign-in restricted to VIT Gmail addresses (placeholder domain: `[VIT_EMAIL_DOMAIN]`, e.g. `@vitstudent.ac.in`). Domain enforcement logic is specified in §3 but marked **deferred / stubbed** per your request — the app ships with a mock "any Google account" login for now, with the domain check as a single toggleable config flag (`REQUIRE_VIT_DOMAIN = true/false`) so it can be switched on later with no rework.

### Primary flow
1. User signs in with Google (VIT Gmail, once enforcement is live).
2. User picks **Lost Mode** or **Found Mode** from the home screen.
3. User submits a post with required fields (title, category, description, location, date, optional photo, contact preference).
4. Every new **Found** post is run against all open **Lost** posts (and vice versa) through a matching pipeline combining text similarity + image similarity, producing a **0–100 confidence score** per pair.
5. Pairs scoring **> 75** trigger an automated, privacy-preserving connection: both users get a notification + an in-app relay thread that forwards messages via email without exposing raw email addresses to each other until both opt in to reveal contact info.

### Non-goals (v1)
- No item hand-off logistics (no courier/delivery) — the app only connects people; meetup is arranged by the users themselves, ideally on campus.
- No payments, no rewards/bounties.
- No public browsing without login — every screen past onboarding requires an authenticated VIT session.

### Success metrics to design for
- Time-to-first-post after signup.
- % of Found posts that produce at least one match ≥ 75.
- % of matches that result in a completed connection (both sides respond).
- False-positive match rate (users marking a suggested match "not mine").
