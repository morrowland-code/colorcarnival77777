// 🎨 Color Carnival — unified frontend controller
// Works with main.py backend for palettes, grid, and pressure

// ===================== CONFIG =====================
const API_BASE = ""; // same-origin for Flask

// =============== THEME HANDLER ===============
// Save the selected theme and apply it across pages
function applySavedTheme() {
  const saved = localStorage.getItem("cc_theme") || "strawberry";
  document.documentElement.setAttribute("data-theme", saved);
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = saved;
}

// When user changes dropdown, update theme live
function initThemeSelector() {
  const sel = document.getElementById("themeSelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    const val = sel.value || "strawberry";
    document.documentElement.setAttribute("data-theme", val);
    localStorage.setItem("cc_theme", val);
  });
}

// Apply theme immediately on page load
document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  initThemeSelector();
});

// ===================== ALERTS & CONFETTI =====================
let alertTimeout = null;

function showAlert(message, isSuccess = true) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("success", "error");
  box.classList.add(isSuccess ? "success" : "error");
  box.style.display = "block";
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => (box.style.display = "none"), 2500);
}

// ===================== FETCH WRAPPER =====================
async function fetchWithAuth(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  return res;
}

// ===================== PALETTE PAGE =====================
async function initPalettePage() {
  // 🚨 Require login to use palette page
  const currentUser = localStorage.getItem("cc_logged_user");
  if (!currentUser) {
    // Disable all inputs and show warning
    document.querySelectorAll("button, input, select").forEach(el => {
      el.disabled = true;
      el.style.opacity = "0.5";
      el.style.cursor = "not-allowed";
    });

    // Create a centered popup overlay
    const warning = document.createElement("div");
    warning.style.position = "fixed";
    warning.style.top = "0";
    warning.style.left = "0";
    warning.style.width = "100vw";
    warning.style.height = "100vh";
    warning.style.display = "flex";
    warning.style.justifyContent = "center";
    warning.style.alignItems = "center";
    warning.style.background = "rgba(0,0,0,0.5)";
    warning.style.zIndex = "9999";
    warning.innerHTML = `
      <div style="
        background: white;
        padding: 30px 40px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        font-family: 'Poppins', sans-serif;
      ">
        <h2 style="color:#ff4f9a;">🍓 Sign in Required</h2>
        <p style="margin:10px 0 20px;">You must be signed in to use the Palette page.</p>
        <button id="goLogin" style="
          background: linear-gradient(135deg,#ff7bb0,#ffb6e1);
          border:none;
          color:white;
          border-radius:12px;
          padding:10px 20px;
          font-weight:600;
          cursor:pointer;
          box-shadow: 0 4px 10px rgba(255,120,170,0.4);
        ">Sign In</button>
      </div>
    `;
    document.body.appendChild(warning);

    // When clicked, open login popup
    document.getElementById("goLogin").addEventListener("click", () => {
      warning.remove();
      document.getElementById("authPopup").style.display = "flex";
    });

    return; // stop rest of palette code
  }
  const paletteSelect = document.getElementById("paletteSelect");
  const paletteInput = document.getElementById("paletteNameInput");
  const createPaletteBtn = document.getElementById("createPaletteBtn");
  const deletePaletteBtn = document.getElementById("deletePaletteBtn");
  const savedColors = document.getElementById("savedColors");

  if (!paletteSelect) return; // only run on palette.html

  // 🎨 Load palettes
  async function loadPalettes(selectId = null) {
    try {
      const res = await fetchWithAuth("/api/palettes");
      const list = await res.json();
      paletteSelect.innerHTML = "";

      if (!Array.isArray(list) || !list.length) {
        const opt = document.createElement("option");
        opt.textContent = "— No palettes yet —";
        opt.value = "";
        paletteSelect.appendChild(opt);
        savedColors.innerHTML = "";
        return;
      }

      list.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        paletteSelect.appendChild(opt);
      });

      // Auto-select a palette if needed
      if (selectId) paletteSelect.value = selectId;
      else if (!paletteSelect.value) paletteSelect.value = list[list.length - 1].id;

      await loadPaletteColors();
    } catch (e) {
      showAlert("Error loading palettes", false);
    }
  }

  // 💾 Create or select palette
  createPaletteBtn?.addEventListener("click", async () => {
    // 🚫 Block saving if not logged in
    const currentUser = localStorage.getItem("cc_logged_user");
    if (!currentUser) {
      showAlert("You must be signed in to save palettes 🍓", false);
      return;
    }
    const name = paletteInput.value.trim();
    if (!name) return showAlert("Enter a palette name 💕", false);

    try {
      const res = await fetchWithAuth("/api/palettes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok && !data.id)
        return showAlert(data.error || "Error saving palette", false);

      showAlert("Palette saved! 🎉", true);
      paletteInput.value = "";
      await loadPalettes(data.id);
    } catch {
      showAlert("Network error 💔", false);
    }
  });

  // 🗑️ Delete palette
  deletePaletteBtn?.addEventListener("click", async () => {
    const currentUser = localStorage.getItem("cc_logged_user");
    if (!currentUser) {
      showAlert("You must be signed in to delete palettes 🍓", false);
      return;
    }
    const id = parseInt(paletteSelect.value || "0");
    if (!id) return showAlert("No palette selected", false);
    if (!confirm("Delete this palette?")) return;
    const res = await fetchWithAuth(`/api/palettes/${id}`, { method: "DELETE" });
    if (!res.ok) return showAlert("Delete failed", false);
    showAlert("Palette deleted 🗑️", true);
    loadPalettes(false);
  });

  // 🎨 Load palette colors
  async function loadPaletteColors() {
    const id = parseInt(paletteSelect.value || "0");
    savedColors.innerHTML = "";
    if (!id) return;
    const res = await fetchWithAuth("/api/palettes");
    const list = await res.json();
    const pal = list.find((p) => p.id === id);
    if (!pal || !pal.colors) return;

    for (const c of pal.colors) {
      const div = document.createElement("div");
      div.className = "saved-color";
      div.innerHTML = `
        <div class="swatch" style="background:${c.hex};"></div>
        <p><b>${c.name}</b></p>
        <p>${c.hex}</p>
        <p>rgb(${c.rgb?.r || "?"}, ${c.rgb?.g || "?"}, ${c.rgb?.b || "?"})</p>
        <button>❌ Delete</button>
      `;
      div.querySelector("button").addEventListener("click", async () => {
        const currentUser = localStorage.getItem("cc_logged_user");
        if (!currentUser) {
          showAlert("You must be signed in to edit colors 🍓", false);
          return;
        }
        await fetchWithAuth(`/api/palettes/${id}/colors/${c.id}`, {
          method: "DELETE",
        });
        showAlert("Color deleted", true);
        loadPaletteColors();
      });
      savedColors.appendChild(div);
    }
  }

  paletteSelect.addEventListener("change", loadPaletteColors);

  // Initialize on load
  loadPalettes(false);
}

// ===================== GRID PAGE =====================
async function initGridPage() {
  const uploadInput = document.getElementById("gridImageUpload");
  const analyzeBtn = document.getElementById("analyzeGridBtn");
  const gridOutput = document.getElementById("gridOutput");

  if (!uploadInput) return; // only run on grid.html

  analyzeBtn?.addEventListener("click", async () => {
    const file = uploadInput.files[0];
    if (!file) return showAlert("Upload an image first 🖼️", false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      showAlert("Analyzing image... ⏳", true);
      const res = await fetchWithAuth("/api/grid/analyze", {
        method: "POST",
        body: JSON.stringify({ image: base64, grid_size: 40 }),
      });
      const data = await res.json();
      if (!res.ok) return showAlert("Analysis failed 💔", false);
      showAlert(`Analyzed ${data.count} squares 🎨`, true);

      gridOutput.innerHTML = "";
      for (const c of data.cells.slice(0, 300)) {
        const div = document.createElement("div");
        div.style.width = "10px";
        div.style.height = "10px";
        div.style.background = c.hex;
        div.style.display = "inline-block";
        gridOutput.appendChild(div);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ===================== PRESSURE PAGE =====================
async function initPressurePage() {
  const computeBtn = document.getElementById("computePressure");
  const satDiff = document.getElementById("satDiff");
  const pressureVal = document.getElementById("pressureVal");
  const pressureBar = document.getElementById("pressureBarInner");

  if (!computeBtn) return;

  computeBtn.addEventListener("click", async () => {
    const targetHex = document.getElementById("targetHex").value;
    const actualHex = document.getElementById("actualHex").value;

    const hexToRgb = (h) => {
      const c = h.replace("#", "");
      return {
        r: parseInt(c.substr(0, 2), 16),
        g: parseInt(c.substr(2, 2), 16),
        b: parseInt(c.substr(4, 2), 16),
      };
    };

    const res = await fetchWithAuth("/api/pressure", {
      method: "POST",
      body: JSON.stringify({
        target: hexToRgb(targetHex),
        actual: hexToRgb(actualHex),
      }),
    });
    const data = await res.json();
    if (!res.ok) return showAlert("Error computing pressure 💔", false);
    satDiff.textContent = `${data.saturation_difference}%`;
    pressureVal.textContent = `${data.pressure_value}%`;
    pressureBar.style.width = `${data.pressure_value}%`;
    pressureBar.style.background =
      data.pressure_value > 70 ? "#ff4fa1" : "#89f8a5";
    showAlert("Pressure calculated ✅", true);
  });
}

// ===================== INIT PAGE ROUTING =====================
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.includes("palette")) initPalettePage();
  else if (path.includes("grid")) initGridPage();
  else if (path.includes("pressure")) initPressurePage();
});
// 🧁 Strawbebby Login/Register Popup System
document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginStatusButton");
  const popup = document.getElementById("authPopup");
  const authTitle = document.getElementById("authTitle");
  const usernameInput = document.getElementById("authUsername");
  const passwordInput = document.getElementById("authPassword");
  const authAction = document.getElementById("authAction");
  const toggleAuth = document.getElementById("toggleAuthMode");
  const logoutButton = document.getElementById("authLogout");

  let mode = "login"; // or "register"

  // Helper: update UI mode
  function updateAuthUI() {
    if (mode === "login") {
      authTitle.textContent = "🎀 Sign In";
      authAction.textContent = "Sign In";
      toggleAuth.textContent = "No account? Register here!";
    } else {
      authTitle.textContent = "🌈 Create Account";
      authAction.textContent = "Register";
      toggleAuth.textContent = "Already have an account? Sign in!";
    }
  }

  // Show popup when clicking "Not signed in"
  loginButton.addEventListener("click", () => {
    popup.style.display = "flex";
  });

  // Switch between login/register
  toggleAuth.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    updateAuthUI();
  });

  // Submit login/register
  authAction.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) return alert("Please fill both fields!");

    const endpoint = mode === "login" ? "/api/login" : "/api/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Something went wrong!");
        return;
      }

      if (mode === "login") {
        localStorage.setItem("cc_logged_user", data.username);
        loginButton.textContent = `Signed in as ${data.username}`;
        logoutButton.style.display = "inline-block";
        alert(`Welcome, ${data.username}! 🍓`);
      } else {
        alert("Account created successfully! You can sign in now 🎉");
        mode = "login";
        updateAuthUI();
      }

      popup.style.display = "none";
      usernameInput.value = "";
      passwordInput.value = "";
    } catch (err) {
      alert("Network error: " + err.message);
    }
  });

  // Logout button inside popup
  logoutButton.addEventListener("click", async () => {
    const res = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      localStorage.removeItem("cc_logged_user");
      loginButton.textContent = "Not signed in";
      logoutButton.style.display = "none";
      popup.style.display = "none";
      alert("Logged out successfully 🎈");
    } else {
      alert("Logout failed.");
    }
  });

  // Close popup when clicking background
  popup.addEventListener("click", (e) => {
    if (e.target === popup) popup.style.display = "none";
  });

  // Keep user logged in on reload
  const savedUser = localStorage.getItem("cc_logged_user");
  if (savedUser) {
    loginButton.textContent = `Signed in as ${savedUser}`;
    logoutButton.style.display = "inline-block";
  } else {
    loginButton.textContent = "Not signed in";
  }

  updateAuthUI();
});