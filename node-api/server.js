/**
 * Foundly API — Node.js / Express
 * --------------------------------
 * Main backend for the mobile apps and website. Owns auth (stubbed, VIT
 * domain check deferred per spec §3), posts, matches and relay chat.
 * Delegates scoring to the Python matching-service and reference data
 * (categories/locations) to the Java reference-service, with local
 * fallbacks so this API keeps working standalone in development.
 *
 * Run:
 *   npm install
 *   npm start
 */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const MATCHING_SERVICE_URL = process.env.MATCHING_SERVICE_URL || "http://localhost:8001";
const REFERENCE_SERVICE_URL = process.env.REFERENCE_SERVICE_URL || "http://localhost:8002";
const REQUIRE_VIT_DOMAIN = process.env.REQUIRE_VIT_DOMAIN === "true"; // stub: default OFF
const VIT_EMAIL_DOMAIN = process.env.VIT_EMAIL_DOMAIN || "[VIT_EMAIL_DOMAIN]";
const AUTO_CONNECT_THRESHOLD = 75;

// ---------------------------------------------------------------------------
// In-memory data store (swap for Postgres per the data-model spec — schema in
// /docs/09-data-model.md — this keeps the demo runnable with zero setup)
// ---------------------------------------------------------------------------

const db = {
  users: new Map(),
  posts: new Map(),
  matches: new Map(),
  relayMessages: new Map(), // matchId -> [messages]
};

const FALLBACK_CATEGORIES = [
  "Electronics", "ID/Cards", "Bag/Backpack", "Clothing", "Books/Stationery",
  "Accessories/Jewelry", "Keys", "Wallet/Purse", "Sports Equipment", "Other",
];

const FALLBACK_LOCATIONS = [
  "Men's Hostel Block A", "Ladies Hostel Block C", "Academic Block 1",
  "Academic Block 2", "Central Library", "Food Court", "Sports Complex",
  "Main Gate", "Parking Lot", "Auditorium",
];

function id() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Auth (stub) — see spec §3. Domain enforcement wired but disabled by default
// via REQUIRE_VIT_DOMAIN, so this can be switched on later with no rework.
// ---------------------------------------------------------------------------

app.post("/api/auth/google", (req, res) => {
  const { email, name } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Missing email from Google profile." });
  }

  if (REQUIRE_VIT_DOMAIN && !email.toLowerCase().endsWith("@" + VIT_EMAIL_DOMAIN.toLowerCase())) {
    return res.status(403).json({
      error: "not_vit_account",
      message: `Foundly is only for VIT students. Please sign in with your @${VIT_EMAIL_DOMAIN} account.`,
    });
  }

  let user = [...db.users.values()].find((u) => u.email === email);
  if (!user) {
    user = {
      id: id(),
      email,
      name: name || email.split("@")[0],
      emailDomainVerified: REQUIRE_VIT_DOMAIN,
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
    };
    db.users.set(user.id, user);
  }

  // Demo-only token: in production issue a signed JWT
  const token = Buffer.from(user.id).toString("base64");
  res.json({ token, user });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  const userId = token ? Buffer.from(token, "base64").toString("utf8") : null;
  const user = db.users.get(userId);
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  req.user = user;
  next();
}

app.get("/api/me", requireAuth, (req, res) => res.json(req.user));

app.post("/api/me/onboarding-complete", requireAuth, (req, res) => {
  req.user.hasCompletedOnboarding = true;
  res.json(req.user);
});

// ---------------------------------------------------------------------------
// Reference data — proxied from the Java service, with local fallback
// ---------------------------------------------------------------------------

async function fetchReference(path, fallback) {
  try {
    const r = await fetch(`${REFERENCE_SERVICE_URL}${path}`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return await r.json();
  } catch (err) {
    console.warn(`[reference-service unavailable, using fallback] ${path}: ${err.message}`);
    return fallback;
  }
}

app.get("/api/categories", async (req, res) => {
  res.json(await fetchReference("/categories", FALLBACK_CATEGORIES));
});

app.get("/api/locations", async (req, res) => {
  res.json(await fetchReference("/locations", FALLBACK_LOCATIONS));
});

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

function serializePost(p) {
  const { imageEmbedding, ...rest } = p;
  return rest;
}

app.post("/api/posts", requireAuth, async (req, res) => {
  const { type, title, category, description, location, eventDate, holdingLocation, contactPreference, rewardNote, hasPhoto } = req.body || {};

  if (!["lost", "found"].includes(type)) return res.status(400).json({ error: "type must be 'lost' or 'found'" });
  if (!title || title.trim().length < 3) return res.status(400).json({ error: "title must be at least 3 characters" });
  if (!category) return res.status(400).json({ error: "category is required" });
  if (!description || description.trim().length < 10) return res.status(400).json({ error: "description must be at least 10 characters" });
  if (!location) return res.status(400).json({ error: "location is required" });
  if (!eventDate) return res.status(400).json({ error: "eventDate is required" });
  if (type === "found" && !hasPhoto) return res.status(400).json({ error: "Found posts require at least one photo" });

  const post = {
    id: id(),
    ownerId: req.user.id,
    type,
    title: title.trim(),
    category,
    description: description.trim(),
    location,
    eventDate,
    holdingLocation: holdingLocation || null,
    contactPreference: contactPreference || "relay",
    rewardNote: rewardNote || null,
    status: "open",
    // Toy embedding placeholder for image similarity demo (random-ish but
    // deterministic per post id so repeated calls are stable); swap for a
    // real CLIP-style embedding computed at upload time per spec §7.2/§9.3.
    imageEmbedding: hasPhoto ? toyEmbedding(title + category) : null,
    createdAt: new Date().toISOString(),
  };
  db.posts.set(post.id, post);

  const newMatches = await runMatching(post);
  res.status(201).json({ post: serializePost(post), matches: newMatches });
});

function toyEmbedding(seedStr) {
  // Deterministic 8-dim pseudo-embedding from a string seed — stand-in only,
  // so the /score/batch call has something to compare when demoing image
  // similarity without a real vision model wired up yet.
  const hash = crypto.createHash("sha256").update(seedStr).digest();
  const vec = [];
  for (let i = 0; i < 8; i++) vec.push((hash[i] - 128) / 128);
  return vec;
}

app.get("/api/posts", (req, res) => {
  const { type } = req.query;
  let posts = [...db.posts.values()].filter((p) => p.status === "open");
  if (type) posts = posts.filter((p) => p.type === type);
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts.map(serializePost));
});

app.get("/api/posts/:postId", (req, res) => {
  const post = db.posts.get(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(serializePost(post));
});

app.get("/api/my-posts", requireAuth, (req, res) => {
  const posts = [...db.posts.values()].filter((p) => p.ownerId === req.user.id);
  res.json(posts.map(serializePost));
});

app.patch("/api/posts/:postId", requireAuth, async (req, res) => {
  const post = db.posts.get(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.ownerId !== req.user.id) return res.status(403).json({ error: "Not your post" });

  const editable = ["title", "category", "description", "location", "eventDate", "holdingLocation", "contactPreference", "rewardNote"];
  for (const key of editable) {
    if (req.body[key] !== undefined) post[key] = req.body[key];
  }
  post.updatedAt = new Date().toISOString();

  const newMatches = await runMatching(post);
  res.json({ post: serializePost(post), matches: newMatches });
});

app.post("/api/posts/:postId/resolve", requireAuth, (req, res) => {
  const post = db.posts.get(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.ownerId !== req.user.id) return res.status(403).json({ error: "Not your post" });
  post.status = req.body.status || "resolved_self";
  res.json(serializePost(post));
});

// ---------------------------------------------------------------------------
// Matching — calls the Python matching-service (spec §7)
// ---------------------------------------------------------------------------

async function runMatching(triggeringPost) {
  const oppositeType = triggeringPost.type === "lost" ? "found" : "lost";
  const candidates = [...db.posts.values()].filter(
    (p) => p.type === oppositeType && p.status === "open"
  );
  if (candidates.length === 0) return [];

  const lostPost = triggeringPost.type === "lost" ? triggeringPost : null;
  const results = [];

  try {
    for (const candidate of candidates) {
      const lost = triggeringPost.type === "lost" ? triggeringPost : candidate;
      const found = triggeringPost.type === "found" ? triggeringPost : candidate;

      const r = await fetch(`${MATCHING_SERVICE_URL}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          lost_post: toScoreInput(lost),
          found_post: toScoreInput(found),
        }),
      });
      if (!r.ok) continue;
      const scoreResult = await r.json();
      if (scoreResult.total < 40) continue; // spec §7.3: floor before surfacing

      const match = upsertMatch(lost, found, scoreResult);
      results.push(match);
    }
  } catch (err) {
    console.warn(`[matching-service unavailable] ${err.message}`);
  }

  return results;
}

function toScoreInput(post) {
  return {
    id: post.id,
    category: post.category,
    title: post.title,
    description: post.description,
    location: post.location,
    event_date: post.eventDate,
    image_embedding: post.imageEmbedding || null,
  };
}

function upsertMatch(lostPost, foundPost, scoreResult) {
  let match = [...db.matches.values()].find(
    (m) => m.lostPostId === lostPost.id && m.foundPostId === foundPost.id
  );
  if (!match) {
    match = { id: id(), lostPostId: lostPost.id, foundPostId: foundPost.id, createdAt: new Date().toISOString() };
    db.matches.set(match.id, match);
  }
  match.total = scoreResult.total;
  match.label = scoreResult.label;
  match.breakdown = scoreResult.breakdown;
  match.status = scoreResult.total > AUTO_CONNECT_THRESHOLD ? "auto_connected" : "surfaced_possible";
  match.updatedAt = new Date().toISOString();

  if (match.status === "auto_connected") {
    lostPost.status = "matched_pending";
    foundPost.status = "matched_pending";
    if (!db.relayMessages.has(match.id)) {
      db.relayMessages.set(match.id, [
        { from: "system", text: `Post matched automatically — ${scoreResult.total}% confidence`, at: new Date().toISOString() },
      ]);
    }
  }
  return match;
}

// ---------------------------------------------------------------------------
// Matches + relay chat
// ---------------------------------------------------------------------------

app.get("/api/matches", requireAuth, (req, res) => {
  const myPostIds = new Set([...db.posts.values()].filter((p) => p.ownerId === req.user.id).map((p) => p.id));
  const matches = [...db.matches.values()].filter((m) => myPostIds.has(m.lostPostId) || myPostIds.has(m.foundPostId));
  matches.sort((a, b) => b.total - a.total);
  res.json(matches);
});

app.post("/api/matches/:matchId/confirm", requireAuth, (req, res) => {
  const match = db.matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  match.status = "confirmed";
  const lost = db.posts.get(match.lostPostId);
  const found = db.posts.get(match.foundPostId);
  if (lost) lost.status = "resolved_matched";
  if (found) found.status = "resolved_matched";
  res.json(match);
});

app.post("/api/matches/:matchId/reject", requireAuth, (req, res) => {
  const match = db.matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  match.status = "rejected";
  const lost = db.posts.get(match.lostPostId);
  const found = db.posts.get(match.foundPostId);
  if (lost) lost.status = "open";
  if (found) found.status = "open";
  res.json(match);
});

app.get("/api/matches/:matchId/messages", requireAuth, (req, res) => {
  res.json(db.relayMessages.get(req.params.matchId) || []);
});

app.post("/api/matches/:matchId/messages", requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  const messages = db.relayMessages.get(req.params.matchId) || [];
  const message = { from: req.user.id, senderName: req.user.name, text: text.trim(), at: new Date().toISOString() };
  messages.push(message);
  db.relayMessages.set(req.params.matchId, messages);
  // In production: also relay this out via the email provider per spec §8.3
  res.status(201).json(message);
});

app.get("/health", (req, res) => res.json({ status: "ok", service: "node-api" }));

app.listen(PORT, () => {
  console.log(`Foundly API listening on http://localhost:${PORT}`);
  console.log(`  matching-service:  ${MATCHING_SERVICE_URL}`);
  console.log(`  reference-service: ${REFERENCE_SERVICE_URL}`);
  console.log(`  REQUIRE_VIT_DOMAIN: ${REQUIRE_VIT_DOMAIN} (VIT_EMAIL_DOMAIN=${VIT_EMAIL_DOMAIN})`);
});

module.exports = app;
