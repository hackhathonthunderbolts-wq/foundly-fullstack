# 3. Authentication

**Status: VIT-domain enforcement is deferred per request.** This section specifies the target design so it can be switched on later with a single config flag, but the v1 build ships with domain-checking OFF (any Google account can sign in) so development isn't blocked.

## 3.1 Approach
- **Method:** Google Sign-In (OAuth) only — no separate password system to build/maintain.
- **Enforcement point:** after Google returns the user's profile, check `email.endsWith('@' + REQUIRED_DOMAIN)`.
  - Config: `REQUIRE_VIT_DOMAIN: boolean`, `VIT_EMAIL_DOMAIN: string` (placeholder `[VIT_EMAIL_DOMAIN]`, e.g. `vitstudent.ac.in`).
  - When `REQUIRE_VIT_DOMAIN = false` (current default): skip the check, log the domain seen for later analysis, proceed to onboarding.
  - When `true` (future): reject at this point, before any session/token is persisted.
- **Fallback path (if Google Workspace restriction is preferred over app-side checking later):** VIT's Google Workspace admin can restrict OAuth client access to only `@[VIT_EMAIL_DOMAIN]` accounts at the Google Cloud Console level — this is the more robust long-term approach since it can't be bypassed client-side. App-side checking should remain as defense-in-depth even if that's enabled.

## 3.2 Rejection UX (for when enforcement is live)
Screen: **"This isn't a VIT account"**
- Icon: simple outline "account-off" glyph in `error` red.
- Headline (H1): "Use your VIT Gmail"
- Body: "Foundly is only for VIT students. Please sign in with your `@[VIT_EMAIL_DOMAIN]` account."
- Primary button: "Try a different account" → re-opens Google account chooser.
- Secondary link: "Why VIT-only?" → short explainer sheet (keeps the lost & found circle trusted to campus).
- No session/token is stored; the rejected attempt is discarded immediately.

## 3.3 Edge cases

| Case | Behavior |
|---|---|
| User picks a personal Gmail | Blocked at the domain-check step (§3.2) once enforcement is live; today (`REQUIRE_VIT_DOMAIN=false`) it's allowed through, tagged internally as `unverified_domain` for future migration/audit. |
| Session expires (token refresh fails) | Silent background refresh attempt first; on failure, show a lightweight "Session expired — sign in again" screen that preserves any in-progress draft post locally so nothing is lost. |
| User manually signs out | Clear local session + cached tokens; local drafts are kept (device storage) but any not-yet-submitted post shows a "sign in to publish" prompt. |
| Google account has multiple linked emails | Use the primary account email returned by Google OAuth for domain checking, not any secondary alias. |
| Token revoked externally (e.g., password reset on Google side) | Next app open triggers a forced re-auth; user lands back on the sign-in screen with a neutral "Please sign in again" message (not an error state, to avoid alarming users for a routine event). |

## 3.4 First-time onboarding (post sign-in, before home screen)
3 lightweight screens, skippable after the first:
1. **Welcome** — Foundly logomark, one-line value prop: "Lost something on campus? Found something? Foundly connects VIT students, fast."
2. **How matching works** — plain-language explainer: "When you post a Found item, we automatically compare it to open Lost posts using text and photos. High-confidence matches connect you both automatically."
3. **Privacy note** — "Your email stays private until you both agree to connect." Primary CTA: "Get started" → home screen.

Onboarding state is stored per-user (`hasCompletedOnboarding: bool`) so it's shown once.
