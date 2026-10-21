(() => {
  "use strict";
  /*
   * Page configuration.
   * Set API_BASE_URL to the backend URL (empty = offline demo mode).
   * Full API contract and shared notes are in the project README.
   */
  const CFG = {
    API_BASE_URL: "http://localhost:3000",
    ENDPOINTS: {
      accountLookup:  "/accounts/lookup",     // GET  ?phone=...
      accountLogin:   "/auth/login",          // POST { phone, password }
      recoverRequest: "/auth/recover",        // POST { phone }
      recoverVerify:  "/auth/recover/verify", // POST { phone, code, newPassword }
      supportMessage: "/support/messages"     // POST { phone, message }
    },
    // Demo data used when the API is unavailable.
    DEMO_ACCOUNT: { phone: "(555) 382-9104", memberSince: "October 2023", verified: true },
    // Navigation: recover/ -> welcome page after a successful login
    POST_LOGIN_URL: "../welcome_page_three/welcome_page_three.html"
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let account = { ...CFG.DEMO_ACCOUNT };

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3400);
  }

  /* Generic API helper (uses the local CFG object above) */
  async function api(key, { method = "GET", body, query } = {}) {
    if (!CFG.API_BASE_URL) throw new Error("API_BASE_URL is not configured (see CFG above)");
    const qs = query ? "?" + new URLSearchParams(query) : "";
    const res = await fetch(CFG.API_BASE_URL.replace(/\/$/, "") + CFG.ENDPOINTS[key] + qs, {
      method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error("Request failed (" + res.status + ")");
    return res.status === 204 ? {} : res.json();
  }

  function showAccount() {
    $("phone").textContent = account.phone;
    $("leadPhone").textContent = account.phone.replace("-", "–");
    $("since").textContent = account.memberSince;
    const v = $("verified"); v.style.display = account.verified ? "" : "none";
  }

  /* ---- modal ---- */
  const open = (title, html) => { $("mTitle").textContent = title; $("mBody").innerHTML = html; $("modal").hidden = false; const f = $("mBody").querySelector("input,textarea,button"); f && f.focus(); };
  const close = () => { $("modal").hidden = true; };
  $("mClose").onclick = close;
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  function formSubmit(form, handler) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".btn"), err = form.querySelector(".err");
      btn.disabled = true; err.textContent = "";
      try { await handler(new FormData(form)); }
      catch (ex) {
        if (!CFG.API_BASE_URL) { console.info("[MindRise] Demo mode –", ex.message); toast("Demo mode: API not configured."); await handler.demo?.(); }
        else err.textContent = ex.message;
      }
      btn.disabled = false;
    });
  }

  /* ---- Log in ---- */
  function loginModal() {
    open("Log in", `<p>Enter the password for <b>${esc(account.phone)}</b>.</p>
      <form id="f" novalidate><label>Password<span class="pw"><input name="password" type="password" autocomplete="current-password" required><button type="button" id="tg">Show</button></span></label>
      <div class="err" role="alert"></div><button class="btn primary" type="submit">Log In</button></form>`);
    const f = $("f"), pw = f.password;
    $("tg").onclick = () => { const s = pw.type === "password"; pw.type = s ? "text" : "password"; $("tg").textContent = s ? "Hide" : "Show"; };
    const h = async (d) => {
      if (!d.get("password")) throw Object.assign(new Error("Enter your password."), { validation: true });
      const r = await api("accountLogin", { method: "POST", body: { phone: account.phone, password: d.get("password") } });
      close(); toast("Logged in.");
      if (CFG.POST_LOGIN_URL) location.href = CFG.POST_LOGIN_URL; else console.info("login token:", r.token);
    };
    h.demo = () => { if (pw.value) { close(); toast("Demo: logged in (no server)."); } else f.querySelector(".err").textContent = "Enter your password."; };
    f.addEventListener("submit", (e) => { if (!pw.value) { e.stopImmediatePropagation(); e.preventDefault(); f.querySelector(".err").textContent = "Enter your password."; } }, true);
    formSubmit(f, h);
  }

  /* ---- Recover ---- */
  function recoverModal() {
    open("Recover account", `<p>We’ll send a verification code to <b>${esc(account.phone)}</b>.</p>
      <form id="f"><div class="err" role="alert"></div><button class="btn primary" type="submit">Send code</button></form>`);
    const toVerify = () => {
      $("mTitle").textContent = "Enter your code";
      $("mBody").innerHTML = `<p>Enter the code we sent and choose a new password.</p>
        <form id="g"><label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" required></label>
        <label>New password<input name="pw" type="password" minlength="8" autocomplete="new-password" required></label>
        <div class="err" role="alert"></div><button class="btn primary" type="submit">Reset password</button></form>`;
      const g = $("g");
      const h = async (d) => {
        if (d.get("pw").length < 8) throw new Error("Password must be at least 8 characters.");
        await api("recoverVerify", { method: "POST", body: { phone: account.phone, code: d.get("code"), newPassword: d.get("pw") } });
        close(); toast("Password updated. You can log in now.");
      };
      h.demo = () => { close(); toast("Demo: password reset (no server)."); };
      formSubmit(g, h);
    };
    const h = async () => { await api("recoverRequest", { method: "POST", body: { phone: account.phone } }); toVerify(); };
    h.demo = toVerify;
    formSubmit($("f"), h);
  }

  /* ---- Support ---- */
  function supportModal() {
    open("Contact MindRise Support", `<p>Confidential care · response time under 10 mins.</p>
      <form id="f"><label>How can we help?<textarea name="m" required maxlength="1000"></textarea></label>
      <div class="err" role="alert"></div><button class="btn primary" type="submit">Send message</button></form>`);
    const h = async (d) => {
      if (!d.get("m").trim()) throw new Error("Please write a message.");
      await api("supportMessage", { method: "POST", body: { phone: account.phone, message: d.get("m") } });
      close(); toast("Message sent. We’ll reply soon.");
    };
    h.demo = () => { if ($("f").m.value.trim()) { close(); toast("Demo: message not sent (no server)."); } };
    formSubmit($("f"), h);
  }

  $("loginBtn").onclick = loginModal;
  $("recoverBtn").onclick = recoverModal;
  $("supportBtn").onclick = supportModal;
  $("backBtn").onclick = () => (history.length > 1 ? history.back() : toast("No previous screen."));
  $("profileBtn").onclick = () => { open("Profile", `<p>Sign in to view your profile.</p><form onsubmit="return false"><button class="btn primary" id="pc">Close</button></form>`); $("pc").onclick = close; };

  /* Look up the account (phone can be passed as ?phone=...) */
  const phone = new URLSearchParams(location.search).get("phone");
  if (phone) account.phone = phone;
  showAccount();
  api("accountLookup", { query: { phone: account.phone } }).then((a) => { account = { ...account, ...a }; showAccount(); }).catch(() => {});
})();
