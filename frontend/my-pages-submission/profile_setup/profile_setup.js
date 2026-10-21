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
      usersMe: "/api/users/me" // GET profile / PATCH profile
    },
    // Navigation: profile_setup/ -> account recovery
    POST_PROFILE_URL: "../recover/recover.html"
  };
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "mr_anonymous_profile";
  const MAX_HANDLE = 20;
  const AVATAR_IDS = ["leaf", "stones", "ripples", "mountain", "moon", "spiral"];

  const handlePrefixes = [
    "QuietRiver", "GentleBreeze", "StillPebble", "CalmMeadow", "EchoPine",
    "SoftWillow", "SilentCloud", "BlueLotus", "MorningDew", "PeaceStone"
  ];

  const handleInput = $("handle-input");
  const handleCount = $("handle-count");
  const handleError = $("handle-error");
  const handleErrorText = $("handle-error-text");
  const inputRow = document.querySelector(".handle-input-row");
  const mainAvatar = document.querySelector(".avatar-halo-inner");
  const avatarButtons = document.querySelectorAll(".icon-picker-row .icon-btn");
  const continueBtn = $("home-btn");

  let selectedAvatar = "leaf";
  let saving = false;

  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 3400);
  }

  /* Generic API helper – uses the local CFG object above. */
  async function api(key, { method = "GET", body } = {}) {
    if (!CFG.API_BASE_URL) throw new Error("API_BASE_URL is not configured (see CFG above)");
    const url = CFG.API_BASE_URL.replace(/\/$/, "") + CFG.ENDPOINTS[key];
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = new Error("Request failed (" + res.status + ")");
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return {};
    return res.json().catch(() => ({}));
  }

  /* ---------- Handle ---------- */

  function updateCount() {
    if (handleInput && handleCount) handleCount.textContent = `${handleInput.value.length}/${MAX_HANDLE}`;
  }

  function getRandomHandle() {
    const name = handlePrefixes[Math.floor(Math.random() * handlePrefixes.length)];
    return name + (Math.floor(Math.random() * 9900) + 100);
  }

  function changeHandle() {
    if (!handleInput) return;
    handleInput.value = getRandomHandle();
    updateCount();
    clearError();
  }

  function showError(msg) {
    if (!handleError || !handleErrorText) return;
    handleErrorText.textContent = msg;
    handleError.classList.add("show");
    inputRow?.classList.add("invalid");
  }

  function clearError() {
    handleError?.classList.remove("show");
    inputRow?.classList.remove("invalid");
  }

  function validateHandle() {
    const value = handleInput ? handleInput.value.trim() : "";
    if (!value) {
      showError("Choose an anonymous handle.");
      return null;
    }
    if (value.length < 3) {
      showError("Handle must be at least 3 characters.");
      return null;
    }
    if (value.length > MAX_HANDLE) {
      showError(`Handle must be ${MAX_HANDLE} characters or fewer.`);
      return null;
    }
    if (!/^[A-Za-z0-9_.]+$/.test(value)) {
      showError("Use letters, numbers, dots or underscores only.");
      return null;
    }
    clearError();
    return value;
  }

  /* ---------- Avatar ---------- */

  function selectAvatar(button) {
    if (!button) return;
    avatarButtons.forEach((btn) => {
      btn.classList.remove("selected");
      btn.closest(".icon-item")?.querySelector(".icon-check-mini")?.remove();
    });

    button.classList.add("selected");
    selectedAvatar = button.dataset.avatar || "leaf";

    const iconItem = button.closest(".icon-item");
    if (iconItem && !iconItem.querySelector(".icon-check-mini")) {
      const check = document.createElement("div");
      check.className = "icon-check-mini";
      check.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4.5 12.75l6 6 9-13.5"
                stroke-linecap="round"
                stroke-linejoin="round"></path>
        </svg>`;
      iconItem.appendChild(check);
    }

    const clickedIcon = button.querySelector("svg");
    if (clickedIcon && mainAvatar) mainAvatar.innerHTML = clickedIcon.outerHTML;
  }

  function selectAvatarById(id) {
    if (!AVATAR_IDS.includes(id)) return;
    selectAvatar(document.querySelector(`.icon-btn[data-avatar="${id}"]`));
  }

  function surpriseMe() {
    changeHandle();
    if (avatarButtons.length) {
      selectAvatar(avatarButtons[Math.floor(Math.random() * avatarButtons.length)]);
    }
  }

  /* ---------- Save / load ---------- */

  function readLocalProfile() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveLocalProfile(handle) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      handle,
      avatar: selectedAvatar,
      at: Date.now()
    }));
  }

  function finish(handle) {
    if (CFG.POST_PROFILE_URL) {
      window.location.href = CFG.POST_PROFILE_URL;
      return;
    }
    console.info("[MindRise] Anonymous profile ready:", { handle, avatar: selectedAvatar });
  }

  async function saveProfile() {
    if (saving) return;

    const handle = validateHandle();
    if (!handle) {
      toast("Please check your handle.");
      return;
    }

    const label = continueBtn?.querySelector("span");
    const originalLabel = label ? label.textContent : "";
    saving = true;
    if (continueBtn) continueBtn.disabled = true;
    if (label) label.textContent = "Saving…";

    try {
      // Proposed PATCH body – backend must confirm the field names.
      await api("usersMe", { method: "PATCH", body: { handle, avatar: selectedAvatar } });
      saveLocalProfile(handle);
      toast("Profile saved.");
      finish(handle);
    } catch (err) {
      if (err.status === 401) {
        showError("Your session expired. Please log in again.");
        toast("Please log in again.");
      } else if (err.status === 409) {
        showError("This handle is already taken. Try another or tap refresh.");
        toast("That handle is already taken.");
      } else if (err.status) {
        showError("Could not save your profile. Please try again.");
        toast("Could not save your profile (" + err.status + ").");
      } else {
        // Backend not reachable yet – keep the flow usable in offline demo mode.
        saveLocalProfile(handle);
        console.info("[MindRise] API unreachable –", err.message);
        toast("Backend not reachable – profile saved locally.");
        finish(handle);
      }
    } finally {
      saving = false;
      if (continueBtn) continueBtn.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  }

  async function loadProfile() {
    try {
      const data = await api("usersMe");
      const user = data && data.user ? data.user : data;
      if (!user) return;

      const handle = user.handle ?? user.anonymousHandle;
      if (typeof handle === "string" && handle && handleInput) {
        handleInput.value = handle;
        updateCount();
      }
      const avatar = user.avatar ?? user.avatarId;
      if (typeof avatar === "string") selectAvatarById(avatar);
    } catch (err) {
      const local = readLocalProfile();
      if (local) {
        if (handleInput && typeof local.handle === "string") {
          handleInput.value = local.handle;
          updateCount();
        }
        if (typeof local.avatar === "string") selectAvatarById(local.avatar);
      }
      console.info("[MindRise] Profile lookup skipped –", err.message);
    }
  }

  /* ---------- Wiring ---------- */

  avatarButtons.forEach((button) => {
    button.addEventListener("click", () => selectAvatar(button));
  });

  $("handle-refresh-btn")?.addEventListener("click", changeHandle);
  $("surprise-btn")?.addEventListener("click", surpriseMe);

  handleInput?.addEventListener("input", () => {
    updateCount();
    clearError();
  });

  handleInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveProfile();
    }
  });

  continueBtn?.addEventListener("click", saveProfile);

  $("back-btn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else toast("No previous screen.");
  });

  updateCount();
  loadProfile();
})();
