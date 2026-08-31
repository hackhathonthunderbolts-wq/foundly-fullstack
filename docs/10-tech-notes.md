# 10. Technical Notes for the Build Team

## 10.1 Suggested stack
- **Mobile client:** React Native (Expo) or Flutter — either gives one codebase for iOS + Android; React Native suggested if the team already knows JS/TS, Flutter if they prefer strict typing + one rendering engine.
- **Website client:** Next.js (React) sharing a component/token library with the mobile app where possible (if mobile is React Native, a tool like `react-native-web` or a shared design-tokens package keeps colors/type/spacing in one source of truth rather than duplicated CSS). The website consumes the same backend API as mobile — no separate backend.
- **Backend:** Node.js (NestJS/Express) or Python (FastAPI) — FastAPI is a natural fit if the matching pipeline (embeddings) is also Python.
- **Database:** PostgreSQL with `pgvector` extension for storing/querying the text and image embeddings used in matching (§7, §9).
- **Auth:** Google OAuth via Firebase Auth or Auth0 — both support the "restrict to domain" toggle described in §3 out of the box, which is convenient for switching `REQUIRE_VIT_DOMAIN` on later.
- **Media storage:** S3-compatible object storage (S3, Cloudflare R2, or Firebase Storage) for post photos.
- **Matching/embeddings:** a background worker (queue: Redis + BullMQ, or Celery if Python) computes embeddings on submit and runs candidate scoring on trigger (§7.1).
- **Notifications:** Firebase Cloud Messaging for push; a transactional email provider (e.g., Postmark/SendGrid) for the relay email mechanics (§8.3), since it needs inbound email parsing (reply-to routing) as well as outbound sends.

## 10.2 Build order recommendation
1. Auth stub (any Google account) + onboarding + home shell.
2. Post creation (Lost + Found) writing straight to Postgres, no matching yet.
3. My Posts + Post Detail + edit/resolve/delete lifecycle.
4. Matching pipeline (text-only first, ship image similarity as a fast-follow — text alone gets you a usable v1).
5. Matches tab + relay thread (in-app only first; add email-relay parsing as a fast-follow once in-app works end to end).
6. Turn on `REQUIRE_VIT_DOMAIN` once VIT's actual domain and Workspace restrictions are confirmed.

## 10.3 Open questions for stakeholders before full build
- Confirm the exact VIT student email domain(s) — some institutions have multiple valid domains (e.g., a legacy one and a current one).
- Confirm whether campus security/Student Affairs desks should get an admin view (e.g., to post Found items they're physically holding) — not specified in this version.
- Confirm data retention policy for resolved/expired posts and photos (privacy/compliance).
