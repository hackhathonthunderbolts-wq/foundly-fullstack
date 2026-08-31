/**
 * Foundly web app — vanilla JS view router wired to the live Node API.
 * No framework/build step: open web/index.html (served over http, not
 * file://, so fetch works) once node-api is running.
 */

const CAT_ICON = {
  "Electronics": "💻", "ID/Cards": "🪪", "Bag/Backpack": "🎒", "Clothing": "🧥",
  "Books/Stationery": "📚", "Accessories/Jewelry": "💍", "Keys": "🔑",
  "Wallet/Purse": "👛", "Sports Equipment": "🏸", "Other": "📦",
};

const state = {
  user: null,
  tab: "home",
  categories: [],
  locations: [],
};

const mainEl = document.getElementById("main-content");

function toast(message, isError = false) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* -------------------------------------------------------------------- */
/* Boot sequence: splash -> sign-in (if no session) -> app               */
/* -------------------------------------------------------------------- */

async function boot() {
  await new Promise((r) => setTimeout(r, 1600)); // let the "F" pulse play

  document.getElementById("splash").classList.add("hidden");

  if (!Api.token) {
    document.getElementById("signin").classList.remove("hidden");
    return;
  }

  try {
    state.user = await Api.me();
    startApp();
  } catch (err) {
    Api.signOut();
    document.getElementById("signin").classList.remove("hidden");
  }
}

document.getElementById("google-signin-btn").addEventListener("click", async () => {
  // Demo stand-in for the real Google OAuth popup — the backend performs the
  // actual domain check (currently disabled via REQUIRE_VIT_DOMAIN, spec §3).
  const email = prompt("Demo Google sign-in — enter an email:", "aarav.k2023@vitstudent.ac.in");
  if (!email) return;
  const name = email.split("@")[0].replace(/[^a-zA-Z]/g, "") || "Student";
  try {
    state.user = await Api.signIn(email, name.charAt(0).toUpperCase() + name.slice(1));
    document.getElementById("signin").classList.add("hidden");
    startApp();
  } catch (err) {
    toast(err.message, true);
  }
});

async function startApp() {
  document.getElementById("app").classList.remove("hidden");
  [state.categories, state.locations] = await Promise.all([Api.categories(), Api.locations()]);

  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => setTab(el.dataset.tab));
  });

  setTab("home");
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  render();
}

function render() {
  if (state.tab === "home") return renderHome();
  if (state.tab === "myposts") return renderMyPosts();
  if (state.tab === "matches") return renderMatches();
  if (state.tab === "profile") return renderProfile();
}

/* -------------------------------------------------------------------- */
/* Home                                                                   */
/* -------------------------------------------------------------------- */

async function renderHome() {
  mainEl.innerHTML = `
    <div class="row between mb-24">
      <div>
        <div class="caption">Hi, ${state.user.name} 👋</div>
        <h2 class="h1">Find your way back</h2>
      </div>
      <div class="avatar">${state.user.name[0]}</div>
    </div>
    <div class="mode-cards">
      <div class="mode-card lost" id="mode-lost">
        <div><span class="pill lost">LOST</span><div style="font-size:28px; margin-top:10px;">🔍</div></div>
        <div><div style="font-weight:700; font-size:15px;">I lost something</div><div class="caption">Post it, we'll search for it</div></div>
      </div>
      <div class="mode-card found" id="mode-found">
        <div><span class="pill found">FOUND</span><div style="font-size:28px; margin-top:10px;">🤲</div></div>
        <div><div style="font-weight:700; font-size:15px;">I found something</div><div class="caption">Help it get home</div></div>
      </div>
    </div>
    <h3 class="caption" style="text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">Recent activity on campus</h3>
    <div id="feed-list"><p class="body-secondary" style="padding:16px 0;">Loading feed…</p></div>
  `;

  document.getElementById("mode-lost").addEventListener("click", () => renderCreatePost("lost"));
  document.getElementById("mode-found").addEventListener("click", () => renderCreatePost("found"));

  try {
    const posts = await Api.feed();
    const feedList = document.getElementById("feed-list");
    if (posts.length === 0) {
      feedList.innerHTML = `<p class="body-secondary" style="padding:16px 0;">No posts yet — be the first to post a Lost or Found item.</p>`;
      return;
    }
    feedList.innerHTML = posts.slice(0, 10).map((p) => `
      <div class="feed-item" data-post-id="${p.id}">
        <div class="feed-thumb" style="background:${p.type === "lost" ? "var(--lost-primary)" : "var(--found-primary)"};">${CAT_ICON[p.category] || "📦"}</div>
        <div style="flex:1;">
          <div class="row gap-8 mb-8" style="margin-bottom:3px;">
            <span class="badge ${p.type}">${p.type}</span>
            <span class="caption">${timeAgo(p.createdAt)}</span>
          </div>
          <div style="font-size:14px; font-weight:600;">${escapeHtml(p.title)}</div>
          <div class="caption">${p.location}</div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    toast("Couldn't load the feed — is node-api running?", true);
  }
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* -------------------------------------------------------------------- */
/* Create Post (Lost / Found) — 3-step form per spec §5/§6                */
/* -------------------------------------------------------------------- */

function renderCreatePost(mode) {
  const form = { title: "", category: "", description: "", location: "", eventDate: "", hasPhoto: false, holdingLocation: "", contactPreference: "relay" };
  let step = 1;

  function stepBar() {
    return `<div class="row gap-8 mb-24">${[1, 2, 3].map((s) => `<div style="flex:1; height:4px; border-radius:4px; background:${s <= step ? "var(--brand-core)" : "var(--divider)"};"></div>`).join("")}</div>`;
  }

  function draw() {
    let inner = "";

    if (step === 1) {
      inner = `
        <div class="field">
          <label>Item title <span class="req">*</span></label>
          <input class="input" id="f-title" placeholder="${mode === "lost" ? "e.g. Blue Hydro Flask bottle" : "e.g. Black umbrella"}" value="${escapeHtml(form.title)}" />
        </div>
        <div class="field">
          <label>Category <span class="req">*</span></label>
          <div class="chip-row" id="f-category">
            ${state.categories.map((c) => `<div class="chip ${form.category === c ? "selected " + mode : ""}" data-val="${c}">${c}</div>`).join("")}
          </div>
        </div>
        <div class="field">
          <label>Description <span class="req">*</span></label>
          <textarea class="textarea" id="f-description" placeholder="Color, brand, any marks or distinguishing details…">${escapeHtml(form.description)}</textarea>
        </div>
        <div class="field">
          <label>Photo ${mode === "found" ? '<span class="req">*</span>' : ""}</label>
          <label class="row gap-8" style="cursor:pointer;">
            <input type="checkbox" id="f-hasphoto" ${form.hasPhoto ? "checked" : ""} />
            <span class="caption">${mode === "found" ? "I've attached at least one photo (required for Found posts)" : "I've attached a photo (optional, recommended)"}</span>
          </label>
        </div>
      `;
    }

    if (step === 2) {
      inner = `
        <div class="field">
          <label>${mode === "lost" ? "Last seen location" : "Found location"} <span class="req">*</span></label>
          <div class="chip-row" id="f-location">
            ${state.locations.map((l) => `<div class="chip ${form.location === l.label ? "selected " + mode : ""}" data-val="${l.label}">${l.label}</div>`).join("")}
          </div>
        </div>
        <div class="field">
          <label>${mode === "lost" ? "Date lost" : "Date found"} <span class="req">*</span></label>
          <input type="date" class="input" id="f-date" value="${form.eventDate}" max="${new Date().toISOString().slice(0, 10)}" />
        </div>
        ${mode === "found" ? `
        <div class="field">
          <label>Current holding location <span class="req">*</span></label>
          <div class="chip-row" id="f-holding">
            ${["With me", "Handed to security desk", "Handed to Student Affairs"].map((o) => `<div class="chip ${form.holdingLocation === o ? "selected found" : ""}" data-val="${o}">${o}</div>`).join("")}
          </div>
        </div>` : ""}
      `;
    }

    if (step === 3) {
      inner = `
        <div class="field">
          <label>Contact preference <span class="req">*</span></label>
          <div class="chip-row" id="f-contact">
            <div class="chip ${form.contactPreference === "relay" ? "selected " + mode : ""}" data-val="relay">In-app relay only</div>
            <div class="chip ${form.contactPreference === "direct" ? "selected " + mode : ""}" data-val="direct">Allow direct email after match</div>
          </div>
        </div>
        <div class="card mb-16">
          <div class="caption mb-8">REVIEW</div>
          <div class="row gap-12 mb-16">
            <div class="feed-thumb" style="background:${mode === "lost" ? "var(--lost-primary)" : "var(--found-primary)"};">${CAT_ICON[form.category] || "📦"}</div>
            <div>
              <div style="font-weight:700; font-size:14px;">${escapeHtml(form.title) || "Untitled item"}</div>
              <div class="caption">${form.category || "No category"}</div>
            </div>
          </div>
          <p class="body-secondary mb-16">${escapeHtml(form.description) || "No description yet."}</p>
          <div class="row between"><span class="caption">${form.location || "No location"}</span><span class="caption">${form.eventDate || "No date"}</span></div>
        </div>
      `;
    }

    mainEl.innerHTML = `
      <div class="row between mb-24">
        <button class="btn-inline btn-secondary" id="back-btn" style="width:auto;">← Back</button>
        <h2 class="h2">${mode === "lost" ? "Create Lost Post" : "Create Found Post"}</h2>
        <div style="width:60px;"></div>
      </div>
      ${stepBar()}
      <div id="step-error" class="field-error hidden mb-16"></div>
      ${inner}
      <button class="btn btn-primary ${mode}" id="next-btn">${step < 3 ? "Continue" : mode === "lost" ? "Post as Lost" : "Post as Found"}</button>
    `;

    document.getElementById("back-btn").addEventListener("click", () => {
      if (step === 1) return renderHome();
      step -= 1; draw();
    });

    mainEl.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const groupId = chip.parentElement.id;
        if (groupId === "f-category") form.category = chip.dataset.val;
        if (groupId === "f-location") form.location = chip.dataset.val;
        if (groupId === "f-holding") form.holdingLocation = chip.dataset.val;
        if (groupId === "f-contact") form.contactPreference = chip.dataset.val;
        draw();
      });
    });

    document.getElementById("next-btn").addEventListener("click", async () => {
      if (step === 1) {
        form.title = document.getElementById("f-title").value;
        form.description = document.getElementById("f-description").value;
        form.hasPhoto = document.getElementById("f-hasphoto").checked;
        if (form.title.trim().length < 3) return showError("Title needs at least 3 characters");
        if (!form.category) return showError("Pick a category");
        if (form.description.trim().length < 10) return showError("Add a bit more detail (10+ characters)");
        if (mode === "found" && !form.hasPhoto) return showError("Found posts require at least one photo");
        step = 2; return draw();
      }
      if (step === 2) {
        form.eventDate = document.getElementById("f-date").value;
        if (!form.location) return showError("Select a location");
        if (!form.eventDate) return showError("Select a date");
        if (mode === "found" && !form.holdingLocation) return showError("Select where the item is being held");
        step = 3; return draw();
      }
      // step 3: submit
      try {
        const result = await Api.createPost({ type: mode, ...form });
        renderPublished(mode, result.matches || []);
      } catch (err) {
        showError(err.message);
      }
    });
  }

  function showError(msg) {
    const el = document.getElementById("step-error");
    el.textContent = "⚠ " + msg;
    el.classList.remove("hidden");
  }

  draw();
}

function renderPublished(mode, matches) {
  const autoConnected = matches.filter((m) => m.status === "auto_connected");
  mainEl.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:16px; padding:60px 20px;">
      <div style="width:74px; height:74px; border-radius:50%; background:${mode === "lost" ? "var(--lost-primary)" : "var(--found-primary)"}; display:flex; align-items:center; justify-content:center; font-size:34px; border:2px solid ${mode === "lost" ? "var(--lost-accent)" : "var(--found-accent)"};">✓</div>
      <div>
        <h2 class="h1 mb-8">${mode === "lost" ? "Your lost item is live" : "Thanks for helping a fellow VIT student!"}</h2>
        <p class="body-secondary" style="max-width:320px; margin:0 auto;">
          ${autoConnected.length > 0
            ? `Great news — we found a ${autoConnected[0].total}% confidence match already. Check your Matches tab!`
            : matches.length > 0
              ? `We found ${matches.length} possible match(es) — check your Matches tab.`
              : "We'll keep comparing this against new posts and notify you of any strong matches."}
        </p>
      </div>
      <button class="btn btn-primary ${mode}" style="max-width:220px;" id="done-btn">Back to Home</button>
    </div>
  `;
  document.getElementById("done-btn").addEventListener("click", () => setTab("home"));
}

/* -------------------------------------------------------------------- */
/* My Posts                                                               */
/* -------------------------------------------------------------------- */

async function renderMyPosts() {
  mainEl.innerHTML = `<h2 class="h1 mb-24">My Posts</h2><div id="my-posts-list"><p class="body-secondary">Loading…</p></div>`;
  try {
    const posts = await Api.myPosts();
    const list = document.getElementById("my-posts-list");
    if (posts.length === 0) {
      list.innerHTML = `<p class="body-secondary">You haven't posted anything yet. Head to Home to post a Lost or Found item.</p>`;
      return;
    }
    list.innerHTML = posts.map((p) => `
      <div class="card mb-16 row between">
        <div>
          <span class="badge ${p.type}">${p.type}</span>
          <div style="font-weight:600; font-size:14px; margin-top:8px;">${escapeHtml(p.title)}</div>
        </div>
        <span class="badge ${p.status === "matched_pending" || p.status.startsWith("resolved") ? "status-matched" : "status-open"}">${statusLabel(p.status)}</span>
      </div>
    `).join("");
  } catch (err) {
    toast("Couldn't load your posts", true);
  }
}

function statusLabel(status) {
  const map = {
    open: "Searching…", matched_pending: "Awaiting confirmation",
    resolved_matched: "Resolved", resolved_self: "Found it myself",
    expired: "Expired",
  };
  return map[status] || status;
}

/* -------------------------------------------------------------------- */
/* Matches + relay thread                                                 */
/* -------------------------------------------------------------------- */

async function renderMatches() {
  mainEl.innerHTML = `<h2 class="h1 mb-24">Matches</h2><div id="matches-list"><p class="body-secondary">Loading…</p></div>`;
  try {
    const matches = await Api.matches();
    const list = document.getElementById("matches-list");
    if (matches.length === 0) {
      list.innerHTML = `<p class="body-secondary">No matches yet. Once you post, Foundly compares it automatically against open posts.</p>`;
      return;
    }
    const connected = matches.filter((m) => m.status === "auto_connected" || m.status === "confirmed");
    const possible = matches.filter((m) => m.status === "surfaced_possible");

    list.innerHTML = `
      ${connected.length ? `<h3 class="caption mb-8" style="text-transform:uppercase;">Connected</h3>` : ""}
      ${connected.map(matchCard).join("")}
      ${possible.length ? `<h3 class="caption mb-8" style="text-transform:uppercase; margin-top:20px;">Possible matches</h3>` : ""}
      ${possible.map(matchCard).join("")}
    `;

    list.querySelectorAll("[data-match-id]").forEach((el) => {
      el.addEventListener("click", () => renderRelayThread(el.dataset.matchId, matches.find((m) => m.id === el.dataset.matchId)));
    });
  } catch (err) {
    toast("Couldn't load matches", true);
  }
}

function matchCard(m) {
  const color = m.total >= 76 ? "var(--success)" : "var(--warning)";
  return `
    <div class="card row gap-12 mb-16" data-match-id="${m.id}" style="cursor:pointer; align-items:center;">
      <div class="score-ring" style="background:${color}22; color:${color}; border:2px solid ${color};">${m.total}%</div>
      <div style="flex:1;">
        <div style="font-weight:700; font-size:14px;">${m.label}</div>
        <div class="caption">Category ${m.breakdown.category} · Text ${m.breakdown.text} · Location ${m.breakdown.location}</div>
      </div>
      <div style="color:var(--text-secondary);">›</div>
    </div>
  `;
}

async function renderRelayThread(matchId, match) {
  mainEl.innerHTML = `
    <div class="row between mb-16">
      <button class="btn-inline btn-secondary" id="back-btn" style="width:auto;">← Back</button>
      <div style="text-align:center;">
        <div style="font-weight:700; font-size:14px;">${match.label}</div>
        <div class="caption">${match.total}% confidence</div>
      </div>
      <div style="width:60px;"></div>
    </div>
    <div class="chat-thread" id="chat-thread"></div>
    <div class="row gap-8 mb-16">
      <button class="btn btn-secondary btn-inline" id="confirm-btn">✓ Confirm match</button>
      <button class="btn btn-ghost btn-inline" id="reject-btn" style="border:1px solid var(--divider); border-radius:10px;">Not mine</button>
    </div>
    <div class="row gap-8">
      <input class="input" id="chat-input" placeholder="Type a message…" />
      <button class="btn btn-primary" id="send-btn" style="width:48px; flex-shrink:0;">↑</button>
    </div>
  `;

  document.getElementById("back-btn").addEventListener("click", () => setTab("matches"));
  document.getElementById("confirm-btn").addEventListener("click", async () => {
    await Api.confirmMatch(matchId);
    toast("Match confirmed!");
    setTab("matches");
  });
  document.getElementById("reject-btn").addEventListener("click", async () => {
    await Api.rejectMatch(matchId);
    toast("Match dismissed — posts reopened for matching.");
    setTab("matches");
  });

  async function loadMessages() {
    const messages = await Api.messages(matchId);
    const thread = document.getElementById("chat-thread");
    thread.innerHTML = messages.map((m) => {
      if (m.from === "system") return `<div class="chat-sys">${escapeHtml(m.text)}</div>`;
      const mine = m.from === state.user.id;
      return `<div class="chat-bubble ${mine ? "me" : "them"}">${escapeHtml(m.text)}</div>`;
    }).join("");
    thread.scrollTop = thread.scrollHeight;
  }

  document.getElementById("send-btn").addEventListener("click", async () => {
    const input = document.getElementById("chat-input");
    if (!input.value.trim()) return;
    await Api.sendMessage(matchId, input.value.trim());
    input.value = "";
    loadMessages();
  });
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("send-btn").click();
  });

  loadMessages();
}

/* -------------------------------------------------------------------- */
/* Profile                                                                 */
/* -------------------------------------------------------------------- */

function renderProfile() {
  mainEl.innerHTML = `
    <h2 class="h1 mb-24">Profile</h2>
    <div style="text-align:center; margin-bottom:24px;">
      <div class="avatar" style="width:64px; height:64px; font-size:24px; margin:0 auto 10px;">${state.user.name[0]}</div>
      <div style="font-weight:700; font-size:16px;">${state.user.name}</div>
      <div class="caption">${state.user.email}</div>
    </div>
    ${["Account info", "Notification settings", "Privacy & contact sharing", "Report a problem", "Why VIT-only?"].map((item) => `
      <div class="card row between mb-16" style="cursor:pointer;"><span class="body">${item}</span><span style="color:var(--text-secondary);">›</span></div>
    `).join("")}
    <button class="btn btn-secondary" id="signout-btn" style="border-color:var(--error); color:var(--error); margin-top:8px;">Sign out</button>
  `;
  document.getElementById("signout-btn").addEventListener("click", () => {
    Api.signOut();
    document.getElementById("app").classList.add("hidden");
    document.getElementById("signin").classList.remove("hidden");
  });
}

boot();
