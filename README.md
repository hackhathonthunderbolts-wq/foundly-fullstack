# Foundly — Full-Stack Implementation

A working, runnable implementation of the Foundly spec across four services in four
languages, per your request:

| Service | Language | Role | Port |
|---|---|---|---|
| `node-api/` | **Node.js** (Express) | Main API gateway: auth (stub), posts, matches, relay chat. Orchestrates the other two services. | 8000 |
| `matching-service/` | **Python** (FastAPI) | Scoring engine — implements the 0–100 confidence model (category + text + image + location + date) from spec §7. | 8001 |
| `reference-service/` | **Java** (plain JDK `HttpServer`, zero dependencies) | Shared lookup data (categories, campus locations) and a moderation-report intake endpoint. | 8002 |
| `web/` | **HTML/CSS/JS** | The website client — vanilla JS, no framework/build step, styled from a single `css/styles.css` token file matching the brand spec. | served statically, e.g. 8080 |

This mirrors the product spec delivered earlier (`foundly-product-spec.zip`) — read
that alongside this code for the "why," not just the "what." **VIT email-domain
enforcement is implemented but disabled by default** (`REQUIRE_VIT_DOMAIN=false`),
exactly as scoped — flip one env var later to turn it on, no code changes required.

## Architecture at a glance

```
   [ web/  — HTML/CSS/JS ]
              |  fetch()
              v
   [ node-api — Node.js/Express ]  :8000
        |                    |
        | POST /score        | GET /categories, /locations
        v                    v
   [ matching-service   ] [ reference-service ]
   [ Python/FastAPI     ] [ Java/HttpServer   ]
        :8001                    :8002
```

- **node-api** is the only service the web/mobile clients talk to. It holds the
  in-memory data store (swap for Postgres using the schema in the spec's
  `09-data-model.md` when moving past prototype stage).
- **matching-service** is stateless — given two posts, it returns a score. node-api
  calls it once per candidate whenever a post is created or edited (spec §7.1).
- **reference-service** is the single source of truth for categories/locations
  (spec §6, "shared source of truth" note) plus report intake (spec §8.4). node-api
  falls back to a local copy of the same lists if this service is unreachable, so
  the app doesn't hard-fail in dev.

## Running everything

### Option A — Docker Compose (recommended, one command)
```bash
docker compose up --build
```
Then open `http://localhost:8080` for the website. node-api is on `:8000`,
matching-service on `:8001`, reference-service on `:8002`.

### Option B — run each service manually (useful while developing)

**1. Python matching-service**
```bash
cd matching-service
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

**2. Java reference-service** (no build tool needed, just a JDK)
```bash
cd reference-service
./run.sh
# or manually:
#   javac -d out src/main/java/com/foundly/reference/ReferenceServiceApp.java
#   java -cp out com.foundly.reference.ReferenceServiceApp
```

**3. Node.js API**
```bash
cd node-api
npm install
npm start
```

**4. Website**
Serve the `web/` folder with any static server (needs to be `http://`, not
`file://`, for `fetch()` to work):
```bash
cd web
python3 -m http.server 8080
```
Open `http://localhost:8080`.

## Trying it out
1. Open the website — the "F" pulses on the splash screen (spec §2.4), then lands
   on a sign-in screen.
2. Click **Sign in with Google** — this is a stubbed prompt (no real OAuth wired
   up yet, per the deferred-auth scope) that creates/loads a user via `node-api`.
3. From Home, post something as **Found** (with the photo checkbox ticked) and
   then something similar as **Lost** — watch the **Matches** tab: if the score
   clears 75 the two posts auto-connect and open a live relay thread you can chat
   in.
4. Check `matching-service`'s response directly if you want to see the raw
   breakdown: `POST http://localhost:8001/score` with two post payloads.

## What's stubbed vs. real
- **Real:** the full scoring algorithm (§7), the post lifecycle, match
  auto-connect at >75, the relay chat data flow, categories/locations as a shared
  service, moderation report intake.
- **Stubbed for this prototype stage:**
  - VIT domain enforcement (`REQUIRE_VIT_DOMAIN=false` — the check itself is
    implemented in `node-api/server.js`, just switched off).
  - Google OAuth is a `prompt()` dialog, not a real OAuth flow.
  - Data is in-memory (resets on restart) rather than Postgres.
  - Image similarity uses a deterministic placeholder embedding rather than a
    real vision model — the scoring math and weighting are real; only the vector
    source is a stand-in (swap the `toyEmbedding` call in `node-api/server.js`
    for a real image-embedding call at upload time).
  - Email-relay delivery (spec §8.3) isn't wired to a real email provider yet —
    messages live in-app only for now.

## Environment variables (node-api)
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | node-api listen port |
| `MATCHING_SERVICE_URL` | `http://localhost:8001` | where to reach the Python service |
| `REFERENCE_SERVICE_URL` | `http://localhost:8002` | where to reach the Java service |
| `REQUIRE_VIT_DOMAIN` | `false` | flip to `true` to enforce VIT-only sign-in |
| `VIT_EMAIL_DOMAIN` | `[VIT_EMAIL_DOMAIN]` | the domain to enforce once the above is `true` |

## Next steps toward production
1. Swap the in-memory store in `node-api` for Postgres using `09-data-model.md`.
2. Wire real Google OAuth (Firebase Auth/Auth0 both support domain restriction,
   see the earlier spec §3/§10).
3. Replace `toyEmbedding` with a real image-embedding call (e.g., CLIP) at photo
   upload time.
4. Wire the relay thread to a real transactional email provider with inbound
   parsing (spec §8.3).
5. Move `web/` behind a real build step (Vite, etc.) once it outgrows a single
   `app.js` — the current vanilla setup is intentionally build-free to keep this
   handoff runnable with zero tooling.
