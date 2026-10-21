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
      onboardingComplete: "/onboarding/complete", // POST { consent, mode }
      guestSession:       "/auth/guest",          // POST { consent, mode }
      peerCircles:        "/peer-circles",        // GET  -> [{ id, name, members }]
      crisisHelplines:    "/helplines",           // GET  -> [{ name, phone }]
      onlineCount:        "/stats/online"         // GET  -> { count }
    },
    // Shown when the API is unavailable. REPLACE with verified local numbers.
    FALLBACK_HELPLINES: [
      { name: "Helpline 1 (placeholder)", phone: "" },
      { name: "Helpline 2 (placeholder)", phone: "" }
    ],
    // Navigation: welcome_page_three/ -> profile setup
    WELCOME_NEXT_URL: "../profile_setup/profile_setup.html"
  };
  const $ = (id) => document.getElementById(id);

  const slides = [
    { title: "Welcome to MindRise", text: "A calm, private space built for young people in Ethiopia to talk about mental health.", cta: "Next" },
    { title: "Talk freely, stay anonymous", text: "Share what's on your mind without your name or photo. Trained moderators keep every conversation respectful.", cta: "Next" },
    { title: "You're not alone in this", text: "Join moderated, judgment-free peer discussions and access 24/7 crisis support lines anytime you need them.", cta: "Get Started" }
  ];
  let step = slides.length - 1; // opens on "3 of 3" like the screenshot

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* Generic API helper – uses the local CFG object above */
  async function api(key, options = {}) {
    if (!CFG.API_BASE_URL) throw new Error("API_BASE_URL is not configured (see CFG above)");
    const res = await fetch(CFG.API_BASE_URL.replace(/\/$/, "") + CFG.ENDPOINTS[key], {
      headers: { "Content-Type": "application/json" }, ...options
    });
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  function render() {
    const s = slides[step];
    $("slideTitle").textContent = s.title;
    $("slideText").textContent = s.text;
    $("ctaLabel").textContent = s.cta;
    $("stepChip").textContent = `${step + 1} of ${slides.length}`;
    $("features").style.display = step === slides.length - 1 ? "" : "none";
    $("backBtn").style.visibility = step === 0 ? "hidden" : "visible";
    const dots = $("dots"); dots.innerHTML = "";
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.setAttribute("role", "tab"); b.setAttribute("aria-label", `Step ${i + 1}`);
      b.setAttribute("aria-selected", String(i === step));
      if (i === step) b.className = "active";
      b.onclick = () => go(i);
      dots.appendChild(b);
    });
  }
  const go = (i) => { step = Math.min(Math.max(i, 0), slides.length - 1); render(); };

  function openModal(title, html) {
    $("modalTitle").textContent = title; $("modalBody").innerHTML = html;
    $("modal").hidden = false; $("modalClose").focus();
  }
  const closeModal = () => { $("modal").hidden = true; };

  async function showCircles() {
    openModal("Anonymous Peer Circles", "<p>Loading…</p>");
    try {
      const items = await api("peerCircles");
      $("modalBody").innerHTML = "<ul>" + items.map(c => `<li><span>${esc(c.name)}</span><small>${esc(c.members ?? "")}</small></li>`).join("") + "</ul>";
    } catch (e) {
      $("modalBody").innerHTML = `<p>Peer circles will appear here once the API is connected.<br><small>${esc(e.message)}</small></p><button class="btn" id="mClose">Got it</button>`;
      $("mClose").onclick = closeModal;
    }
  }
  async function showHelplines() {
    openModal("24/7 Crisis Helplines", "<p>Loading…</p>");
    let items;
    try { items = await api("crisisHelplines"); } catch { items = CFG.FALLBACK_HELPLINES; }
    $("modalBody").innerHTML =
      "<p>If you are in immediate danger, contact your local emergency services.</p><ul>" +
      items.map(h => `<li><span>${esc(h.name)}</span>${h.phone ? `<a href="tel:${esc(h.phone)}">${esc(h.phone)}</a>` : "<small>number not set</small>"}</li>`).join("") + "</ul>";
  }

  async function finish(mode) {
    const consent = $("consent");
    if (mode === "consented" && !consent.checked) {
      consent.parentElement.classList.add("error");
      toast("Please confirm you understand before continuing.");
      return;
    }
    consent.parentElement.classList.remove("error");
    const btn = $("ctaBtn"); btn.disabled = true;
    try {
      await api(mode === "guest" ? "guestSession" : "onboardingComplete",
        { method: "POST", body: JSON.stringify({ consent: consent.checked, mode }) });
      toast("You're all set!");
    } catch (e) {
      console.info("[MindRise] Demo mode –", e.message);
      toast("Demo mode: API not configured. Continuing offline.");
    }
    localStorage.setItem("mr_onboarded", JSON.stringify({ mode, at: Date.now() }));
    btn.disabled = false;
    if (CFG.WELCOME_NEXT_URL) window.location.href = CFG.WELCOME_NEXT_URL;
  }

  $("ctaBtn").onclick = () => (step < slides.length - 1 ? go(step + 1) : finish("consented"));
  $("backBtn").onclick = () => (step > 0 ? go(step - 1) : toast("This is the first screen."));
  $("skipTop").onclick = () => finish("guest");
  $("guestLink").onclick = (e) => { e.preventDefault(); finish("guest"); };
  $("profileBtn").onclick = () => {
    openModal("Your profile", `<p>You're browsing anonymously. Sign-in will be available once an authentication API is connected.</p><button class="btn" id="mClose">Close</button>`);
    $("mClose").onclick = closeModal;
  };
  $("features").addEventListener("click", (e) => {
    const b = e.target.closest("[data-feature]"); if (!b) return;
    b.dataset.feature === "circles" ? showCircles() : showHelplines();
  });
  $("consent").addEventListener("change", () => $("consent").parentElement.classList.remove("error"));
  $("modalClose").onclick = closeModal;
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (e.target.closest("input,button,a") || !$("modal").hidden) return;
    if (e.key === "ArrowRight") go(step + 1);
    if (e.key === "ArrowLeft") go(step - 1);
  });
  let x0 = null; // swipe between steps
  $("app").addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  $("app").addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) go(step + (dx < 0 ? 1 : -1));
  });

  render();
  api("onlineCount").then(d => { if (d && d.count) $("onlineText").textContent = `${Number(d.count).toLocaleString()}+ Ethiopian youth online`; }).catch(() => {});
})();
