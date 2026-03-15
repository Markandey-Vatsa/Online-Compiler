const runBtn = document.getElementById("runBtn");
const sampleBtn = document.getElementById("sampleBtn");
const codeEditorEl = document.getElementById("codeEditor");
const stdinInput = document.getElementById("stdinInput");
const resultOutput = document.getElementById("resultOutput");
const statusBadge = document.getElementById("statusBadge");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const tabOutput = document.getElementById("tabOutput");
const tabError = document.getElementById("tabError");
const themeToggle = document.getElementById("themeToggle");

let codeEditor = null;
const THEME_STORAGE_KEY = "uiThemeMode";
const CODE_FONT_SIZE_KEY = "codeFontSize";

const defaultSnippet = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println("Sum: " + (a + b));
    }
}`;

const configuredBase = (window.localStorage.getItem("apiBaseUrl") || "").trim().replace(/\/$/, "");
const DEFAULT_API_BASE = "http://localhost:8080";

function resolveApiBase() {
  if (configuredBase) {
    return configuredBase;
  }

  return DEFAULT_API_BASE;
}

const API_BASE_URL = resolveApiBase();
const EXECUTE_ENDPOINT = `${API_BASE_URL}/api/execute`;
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/health`;
const FALLBACK_EXECUTE_ENDPOINT = `${DEFAULT_API_BASE}/api/execute`;
const FALLBACK_HEALTH_ENDPOINT = `${DEFAULT_API_BASE}/api/health`;
const REQUEST_TIMEOUT_MS = 12000;

let activeTab = "output";
let latestResult = {
  output: "Run your code to see output.",
  error: "No errors yet."
};

function setStatus(text, styleClass) {
  statusBadge.textContent = text;
  statusBadge.className = `status ${styleClass}`;
}

function setActiveTab(tabName) {
  activeTab = tabName;
  const tabs = [tabOutput, tabError];

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  resultOutput.textContent = activeTab === "error" ? latestResult.error : latestResult.output;
}

function applyResult(response) {
  const ok = response.status === "success";
  const hasOutput = typeof response.output === "string" && response.output.trim().length > 0;
  const hasError = typeof response.error === "string" && response.error.trim().length > 0;

  latestResult = {
    output: ok ? (hasOutput ? response.output : "Program executed with no output.") : "Output unavailable because execution failed.",
    error: hasError ? response.error : "No runtime or compilation errors."
  };

  if (ok) {
    setActiveTab("output");
    return;
  }

  setActiveTab("error");
}

function updateRuntimeMeta(_ms) {
}

function applyCodeFontSize(sizePx) {
  const parsed = Number.parseInt(sizePx, 10);
  if (Number.isNaN(parsed) || parsed < 10 || parsed > 28) {
    return;
  }

  if (codeEditor) {
    codeEditor.setFontSize(parsed);
  }

  window.localStorage.setItem(CODE_FONT_SIZE_KEY, String(parsed));
}

function getInitialCodeFontSize() {
  const stored = window.localStorage.getItem(CODE_FONT_SIZE_KEY);
  if (!stored) {
    return "13";
  }

  const parsed = Number.parseInt(stored, 10);
  if (Number.isNaN(parsed) || parsed < 10 || parsed > 28) {
    return "13";
  }

  return String(parsed);
}

function setupCodeEditor() {
  if (!window.ace || !codeEditorEl) {
    return;
  }

  codeEditor = window.ace.edit("codeEditor");
  codeEditor.setTheme("ace/theme/tomorrow_night");
  codeEditor.session.setMode("ace/mode/java");
  codeEditor.session.setTabSize(4);
  codeEditor.session.setUseSoftTabs(true);
  codeEditor.setOptions({
    fontFamily: "JetBrains Mono, Consolas, monospace",
    fontSize: "13px",
    showPrintMargin: false,
    useWorker: false
  });
}

function applyTheme(mode) {
  const isLight = mode === "light";
  document.body.classList.toggle("light-mode", isLight);

  if (themeToggle) {
    themeToggle.textContent = isLight ? "Dark Mode" : "Light Mode";
    themeToggle.setAttribute("aria-pressed", String(isLight));
  }

  if (codeEditor) {
    codeEditor.setTheme(isLight ? "ace/theme/intellij" : "ace/theme/tomorrow_night");
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, isLight ? "light" : "dark");
}

function getInitialThemeMode() {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "dark";
}

function toggleTheme() {
  const nextMode = document.body.classList.contains("light-mode") ? "dark" : "light";
  applyTheme(nextMode);
}

function getCodeValue() {
  return codeEditor ? codeEditor.getValue() : "";
}

function setCodeValue(value) {
  if (!codeEditor) {
    return;
  }

  codeEditor.setValue(value, -1);
  codeEditor.clearSelection();
}

async function fetchWithTimeout(endpoint, payload, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} on ${endpoint}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeBackend() {
  async function ping(endpoint) {
    const response = await fetch(endpoint, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} on ${endpoint}`);
    }
  }

  try {
    await ping(HEALTH_ENDPOINT);
    setStatus("Ready", "success");
  } catch (_) {
    if (HEALTH_ENDPOINT !== FALLBACK_HEALTH_ENDPOINT) {
      try {
        await ping(FALLBACK_HEALTH_ENDPOINT);
        setStatus("Ready", "success");
        return;
      } catch (__ ) {
        // Keep handling with the status below.
      }
    }

    setStatus("Backend Off", "error");
  }
}

async function runCode(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const code = getCodeValue().trim();
  const originalLabel = runBtn.textContent;

  if (!code) {
    applyResult({ status: "error", output: "", error: "Please enter Java code before running." });
    setStatus("Invalid", "error");
    updateRuntimeMeta();
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = "Running...";
  setStatus("Running", "running");
  latestResult.output = "Executing...";
  latestResult.error = "Waiting for backend response...";
  setActiveTab("output");

  const payload = { language: "java", code, inputs: stdinInput.value };

  try {
    const result = await fetchWithTimeout(EXECUTE_ENDPOINT, payload);
    applyResult(result);
    setStatus((result.status || "unknown").replace(/_/g, " "), result.status || "error");
    updateRuntimeMeta(result.executionTime);
  } catch (error) {
    if (EXECUTE_ENDPOINT !== FALLBACK_EXECUTE_ENDPOINT) {
      try {
        const fallbackResult = await fetchWithTimeout(FALLBACK_EXECUTE_ENDPOINT, payload);
        applyResult(fallbackResult);
        setStatus((fallbackResult.status || "unknown").replace(/_/g, " "), fallbackResult.status || "error");
        updateRuntimeMeta(fallbackResult.executionTime);
        return;
      } catch (_) {
        // Keep handling with the original failure message below.
      }
    }

    applyResult({
      status: "error",
      output: "",
      error: `Cannot reach backend. ${error.name === "AbortError" ? "Request timed out." : (error.message || "Unknown error")}`,
      executionTime: 0
    });
    setStatus("Error", "error");
    updateRuntimeMeta();
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = originalLabel;
  }
}

function loadSample(event) {
  if (event) {
    event.preventDefault();
  }

  setCodeValue(defaultSnippet);
  stdinInput.value = "4 9";
  setStatus("Idle", "idle");
}

async function copyCurrentResult() {
  try {
    await navigator.clipboard.writeText(resultOutput.textContent || "");
    const previous = copyBtn.textContent;
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.textContent = previous;
    }, 900);
  } catch (_) {
    const previous = copyBtn.textContent;
    copyBtn.textContent = "Failed";
    setTimeout(() => {
      copyBtn.textContent = previous;
    }, 900);
  }
}

function saveResultToFile() {
  const blob = new Blob([resultOutput.textContent || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `run-${activeTab}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("submit", (event) => {
  event.preventDefault();
}, true);

sampleBtn.addEventListener("click", loadSample);
runBtn.addEventListener("click", runCode);
copyBtn.addEventListener("click", copyCurrentResult);
downloadBtn.addEventListener("click", saveResultToFile);
tabOutput.addEventListener("click", () => setActiveTab("output"));
tabError.addEventListener("click", () => setActiveTab("error"));
themeToggle.addEventListener("click", toggleTheme);
fontSizeSelect.addEventListener("change", (event) => {
  applyCodeFontSize(event.target.value);
});

setupCodeEditor();
applyTheme(getInitialThemeMode());
fontSizeSelect.value = getInitialCodeFontSize();
applyCodeFontSize(fontSizeSelect.value);
if (codeEditor) {
  codeEditor.commands.addCommand({
    name: "runCode",
    bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
    exec: () => runCode()
  });
}

setActiveTab("output");
loadSample();
probeBackend();
