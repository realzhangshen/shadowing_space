import { normalizeImportEndpoint } from "./lib/endpoint.js";

const form = document.getElementById("options-form");
const customUrlInput = document.getElementById("custom-url");
const statusEl = document.getElementById("status");

function setCustomEnabled(enabled) {
  customUrlInput.disabled = !enabled;
  if (enabled) {
    customUrlInput.focus();
  }
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.classList.remove("ok", "error");
  if (kind === "ok") statusEl.classList.add("ok");
  if (kind === "error") statusEl.classList.add("error");
}

async function load() {
  const stored = await chrome.storage.sync.get(["mode", "customUrl"]);
  const mode = stored.mode ?? "prod";
  const modeInput = form.querySelector(`input[name="mode"][value="${mode}"]`);
  if (modeInput) modeInput.checked = true;
  customUrlInput.value = stored.customUrl ?? "";
  setCustomEnabled(mode === "custom");
}

form.addEventListener("change", (event) => {
  if (event.target?.name === "mode") {
    setCustomEnabled(event.target.value === "custom");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = new FormData(form).get("mode");

  if (mode === "custom") {
    const normalized = normalizeImportEndpoint(customUrlInput.value);
    if (!normalized) {
      setStatus("Please enter a valid http(s) URL.", "error");
      return;
    }

    const parsed = new URL(normalized);
    try {
      const granted = await chrome.permissions.request({
        origins: [`${parsed.origin}/*`],
      });
      if (!granted) {
        setStatus("Permission denied for that origin.", "error");
        return;
      }
    } catch (permissionError) {
      // Some browsers (Firefox) don't support permissions.request from options_ui
      // with all host patterns — fail open and let the delivery fall back if needed.
      console.warn("Shadowing Space: permission request failed:", permissionError);
    }

    await chrome.storage.sync.set({ mode: "custom", customUrl: normalized });
  } else {
    await chrome.storage.sync.set({ mode, customUrl: customUrlInput.value.trim() });
  }

  setStatus("Saved.", "ok");
});

load().catch((error) => {
  console.error("Shadowing Space options failed to load:", error);
  setStatus("Failed to load settings.", "error");
});
