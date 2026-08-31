/**
 * Foundly API client — thin fetch wrapper around the Node backend.
 * Set window.FOUNDLY_API_BASE before this script loads to point at a
 * non-default backend (defaults to http://localhost:8000).
 */
const API_BASE = window.FOUNDLY_API_BASE || "http://localhost:8000";

const Api = {
  token: localStorage.getItem("foundly_token") || null,

  async _request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  },

  async signIn(email, name) {
    const data = await this._request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });
    this.token = data.token;
    localStorage.setItem("foundly_token", data.token);
    return data.user;
  },

  signOut() {
    this.token = null;
    localStorage.removeItem("foundly_token");
  },

  me() { return this._request("/api/me"); },
  categories() { return this._request("/api/categories"); },
  locations() { return this._request("/api/locations"); },

  feed(type) { return this._request(`/api/posts${type ? `?type=${type}` : ""}`); },
  post(id) { return this._request(`/api/posts/${id}`); },
  myPosts() { return this._request("/api/my-posts"); },

  createPost(payload) {
    return this._request("/api/posts", { method: "POST", body: JSON.stringify(payload) });
  },

  matches() { return this._request("/api/matches"); },
  confirmMatch(id) { return this._request(`/api/matches/${id}/confirm`, { method: "POST" }); },
  rejectMatch(id) { return this._request(`/api/matches/${id}/reject`, { method: "POST" }); },
  messages(matchId) { return this._request(`/api/matches/${matchId}/messages`); },
  sendMessage(matchId, text) {
    return this._request(`/api/matches/${matchId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
};
