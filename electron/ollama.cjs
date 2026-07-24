'use strict';

/**
 * CHATR AI Bootstrap Engine — electron/ollama.cjs
 *
 * Zero-user-intervention local AI setup.
 * Handles: detection -> install -> model pull -> serve -> IPC -> local-only responses
 *
 * Non-technical user guarantee:
 *   - No terminal, no commands, no popups
 *   - Progress visible inside CHATR UI (not OS dialogs)
 *   - Fails closed when local AI is unavailable
 *   - Survives restarts, partial downloads, network drops
 */

const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const https = require('https');
const os = require('os');

// ─── Configuration ────────────────────────────────────────────────────────────

const OLLAMA_PREFERRED_PORT = 3717;
const OLLAMA_FALLBACK_PORT = 11434;
let OLLAMA_PORT = OLLAMA_PREFERRED_PORT;
let OLLAMA_BASE = `http://127.0.0.1:${OLLAMA_PORT}`;

// Models in priority order — smallest first for fastest first-boot
const MODELS = [
  {
    name: 'phi3:mini',
    sizeGB: 2.3,
    description: 'Lightweight reasoning',
    priority: 1,
    useCases: ['routing', 'classification']
  },
  {
    name: 'llama3.2:3b',
    sizeGB: 2.0,
    description: 'Fast general AI',
    priority: 2,
    useCases: ['smart_reply', 'summarize', 'intent']
  }
];

// Platform-specific Ollama binary info
const OLLAMA_RELEASES = {
  win32: {
    url: 'https://github.com/ollama/ollama/releases/download/v0.3.14/ollama-windows-amd64.zip',
    extractedExe: 'ollama.exe',
    installScript: 'powershell'
  },
  darwin: {
    url: 'https://github.com/ollama/ollama/releases/download/v0.3.14/ollama-darwin',
    extractedExe: 'ollama',
    installScript: 'curl'
  },
  linux: {
    url: 'https://github.com/ollama/ollama/releases/download/v0.3.14/ollama-linux-amd64',
    extractedExe: 'ollama',
    installScript: 'curl'
  }
};

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  ollamaProcess: null,
  mainWindow: null,
  phase: 'idle',        // idle | checking | downloading | installing | starting | pulling | ready | error
  readyModels: [],
  downloadProgress: 0,  // 0–100
  pullProgress: 0,      // 0–100
  error: null,
  retryCount: 0,
  MAX_RETRIES: 3
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

function aiDir() {
  return path.join(app.getPath('userData'), 'ai-core');
}

function ollamaExePath() {
  const platform = process.platform;
  const exe = OLLAMA_RELEASES[platform]?.extractedExe || 'ollama';
  return path.join(aiDir(), exe);
}

function ensureAiDir() {
  const dir = aiDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Send status event to renderer — always includes full state snapshot */
function broadcast(event, payload = {}) {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
  state.mainWindow.webContents.send('ai:status', {
    phase: state.phase,
    readyModels: state.readyModels,
    downloadProgress: state.downloadProgress,
    pullProgress: state.pullProgress,
    error: state.error,
    ...payload
  });
}

function setPhase(phase, extra = {}) {
  state.phase = phase;
  state.error = extra.error || null;
  log.info(`[Ollama] Phase → ${phase}`, extra);
  broadcast('ai:status', extra);
}

/** Fetch with automatic timeout and clean error */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Wait for Ollama HTTP API to be reachable */
async function waitForOllama(maxAttempts = 30, intervalMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`, {}, 1500);
      if (res.ok) {
        const data = await res.json();
        state.readyModels = (data.models || []).map(m => m.name);
        return true;
      }
    } catch {}
  }
  return false;
}

// ─── Step 1: Check if Ollama is already running ───────────────────────────────

async function checkOllamaRunning() {
  // Try preferred port first, then fall back to standard Ollama port 11434
  for (const port of [OLLAMA_PREFERRED_PORT, OLLAMA_FALLBACK_PORT]) {
    try {
      const base = `http://127.0.0.1:${port}`;
      const res = await fetchWithTimeout(`${base}/api/tags`, {}, 2000);
      if (!res.ok) continue;
      const data = await res.json();
      state.readyModels = (data.models || []).map(m => m.name);
      // Lock onto this port for all future requests
      OLLAMA_PORT = port;
      OLLAMA_BASE = base;
      log.info(`[Ollama] Found running on port ${port}`);
      return true;
    } catch {}
  }
  return false;
}

// ─── Step 2: Check if binary exists on PATH or in our dir ────────────────────

async function checkOllamaBinaryExists() {
  // Check our managed copy first
  if (fs.existsSync(ollamaExePath())) return 'managed';
  
  // Check system PATH
  return new Promise(resolve => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, ['ollama'], (err, stdout) => {
      if (!err && stdout.trim()) {
        resolve('system');
      } else {
        resolve(null);
      }
    });
  });
}

// ─── Step 3: Download Ollama binary ──────────────────────────────────────────

async function downloadOllama() {
  const platform = process.platform;
  const release = OLLAMA_RELEASES[platform];
  if (!release) throw new Error(`Unsupported platform: ${platform}`);

  ensureAiDir();
  const dir = aiDir();

  setPhase('downloading', { downloadProgress: 0 });
  log.info(`[Ollama] Downloading from ${release.url}`);

  if (platform === 'win32') {
    await downloadOllamaWindows(release, dir);
  } else {
    await downloadOllamaUnix(release, dir);
  }
}

function downloadOllamaWindows(release, dir) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(dir, 'ollama.zip');

    // Use PowerShell Invoke-WebRequest (built into all Windows 7+)
    const ps = `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  Invoke-WebRequest -Uri "${release.url}" -OutFile "${zipPath}" -UseBasicParsing
  Expand-Archive -Path "${zipPath}" -DestinationPath "${dir}" -Force
  Remove-Item "${zipPath}" -Force
  Write-Output "SUCCESS"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}`;

    execFile('powershell.exe', [
      '-WindowStyle', 'Hidden',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', ps
    ], { timeout: 5 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      if (err || (stderr && stderr.includes('Error'))) {
        reject(new Error(`Download failed: ${stderr || err?.message}`));
      } else {
        log.info('[Ollama] Download complete (Windows)');
        resolve();
      }
    });
  });
}

function downloadOllamaUnix(release, dir) {
  return new Promise((resolve, reject) => {
    const exePath = ollamaExePath();
    const curl = spawn('curl', ['-fsSL', release.url, '-o', exePath]);

    curl.on('close', code => {
      if (code !== 0) {
        reject(new Error(`curl exited with code ${code}`));
        return;
      }
      // Make executable
      fs.chmodSync(exePath, 0o755);
      log.info('[Ollama] Download complete (Unix)');
      resolve();
    });

    curl.on('error', err => reject(err));
  });
}

// ─── Step 4: Start Ollama serve ───────────────────────────────────────────────

async function startOllama(binarySource) {
  setPhase('starting');

  const exePath = binarySource === 'system' ? 'ollama' : ollamaExePath();

  log.info(`[Ollama] Spawning: ${exePath} serve`);

  const proc = spawn(exePath, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${OLLAMA_PORT}`,
      OLLAMA_ORIGINS: '*',
      // Reduce RAM usage for small machines
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_MAX_LOADED_MODELS: '1'
    },
    windowsHide: true,
    detached: true,
    stdio: 'ignore'
  });

  proc.unref();
  state.ollamaProcess = proc;

  proc.on('error', err => {
    log.error('[Ollama] Serve error:', err.message);
  });

  // Wait for API to come up
  const ready = await waitForOllama(30, 1000);
  if (!ready) {
    throw new Error('Ollama started but API never became reachable.');
  }

  log.info('[Ollama] Server ready');
}

// ─── Step 5: Pull required models ────────────────────────────────────────────

async function pullModel(modelName) {
  log.info(`[Ollama] Pulling model: ${modelName}`);
  setPhase('pulling', { currentModel: modelName, pullProgress: 0 });

  const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true })
  }, 30 * 60 * 1000);  // 30 min timeout for large models

  if (!res.ok || !res.body) throw new Error(`Pull request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let layerProgress = {};
  let lastBroadcast = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        if (data.status === 'success') {
          state.readyModels = [...new Set([...state.readyModels, modelName])];
          state.pullProgress = 100;
          broadcast('ai:status', { pullProgress: 100, currentModel: modelName });
          log.info(`[Ollama] Model ${modelName} ready`);
          return;
        }

        if (data.error) throw new Error(data.error);

        // Layer-by-layer download progress
        if (data.digest && data.total) {
          layerProgress[data.digest] = {
            completed: data.completed || 0,
            total: data.total
          };

          const totalBytes = Object.values(layerProgress).reduce((s, l) => s + l.total, 0);
          const doneBytes  = Object.values(layerProgress).reduce((s, l) => s + l.completed, 0);
          const pct = totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 0;

          // Rate-limit renderer messages — max 5/sec
          const now = Date.now();
          if (pct !== state.pullProgress && now - lastBroadcast > 200) {
            state.pullProgress = pct;
            lastBroadcast = now;
            broadcast('ai:status', { pullProgress: pct, currentModel: modelName });
          }
        }
      } catch (e) {
        if (e.message !== 'Unexpected end of JSON input') {
          log.warn('[Ollama] Pull parse warn:', e.message);
        }
      }
    }
  }
}

async function ensureModels() {
  for (const model of MODELS) {
    const alreadyHave = state.readyModels.some(m => m.startsWith(model.name.split(':')[0]));
    if (!alreadyHave) {
      try {
        await pullModel(model.name);
      } catch (err) {
        log.error(`[Ollama] Failed to pull ${model.name}:`, err.message);
        // Non-fatal: continue to next model, then fail closed if none are ready.
        broadcast('ai:status', {
          warning: `Could not download ${model.name}. Local AI will stay unavailable until a model is ready.`
        });
      }
    } else {
      log.info(`[Ollama] Model ${model.name} already present`);
    }
    // Only need one model to be functional — break after first success
    if (state.readyModels.length > 0) break;
  }
}

// ─── Main Bootstrap Orchestrator ─────────────────────────────────────────────

async function bootstrap(mainWindow) {
  state.mainWindow = mainWindow;

  try {
    setPhase('checking');

    // ── Check 1: Is Ollama already serving? ──────────────────────────────────
    const isRunning = await checkOllamaRunning();
    if (isRunning) {
      log.info('[Ollama] Already running externally');
      await ensureModels();
      setPhase('ready');
      return;
    }

    // ── Check 2: Does binary exist? ─────────────────────────────────────────
    const binarySource = await checkOllamaBinaryExists();

    if (!binarySource) {
      // Need to download — check connectivity first
      try {
        await fetchWithTimeout('https://github.com', {}, 5000);
      } catch {
        log.warn('[Ollama] No internet - local setup cannot continue');
        setPhase('error', {
          message: 'No internet connection. Local AI setup will retry when Ollama/model files are available.'
        });
        return;
      }

      await downloadOllama();
    }

    // ── Start server ─────────────────────────────────────────────────────────
    await startOllama(binarySource || 'managed');

    // ── Pull models ──────────────────────────────────────────────────────────
    await ensureModels();

    if (state.readyModels.length === 0) {
      setPhase('error', {
        message: 'Local AI models unavailable. Cloud AI is disabled for privacy.'
      });
      return;
    }

    setPhase('ready');
    log.info('[Ollama] Bootstrap complete. Ready models:', state.readyModels);

  } catch (err) {
    log.error('[Ollama] Bootstrap failed:', err.message);

    if (state.retryCount < state.MAX_RETRIES) {
      state.retryCount++;
      const delay = state.retryCount * 10000; // 10s, 20s, 30s backoff
      log.info(`[Ollama] Retry ${state.retryCount}/${state.MAX_RETRIES} in ${delay}ms`);
      setTimeout(() => bootstrap(mainWindow), delay);
    } else {
      setPhase('error', {
        error: err.message,
        message: 'Local AI could not start. Cloud AI is disabled for privacy.'
      });
    }
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
let currentAskController = null;

function registerIpcHandlers() {

  /** Check if local AI is ready */
  ipcMain.handle('ai:status', async () => ({
    phase: state.phase,
    readyModels: state.readyModels,
    downloadProgress: state.downloadProgress,
    pullProgress: state.pullProgress,
    error: state.error
  }));

  /** Stream a prompt through local Ollama */
  ipcMain.handle('ai:ask', async (event, { prompt, model, systemPrompt, stream = false }) => {
    if (state.phase !== 'ready' || state.readyModels.length === 0) {
      const warmingPhases = ['checking', 'downloading', 'installing', 'starting', 'pulling'];
      if (warmingPhases.includes(state.phase)) {
        return { error: 'warming_up', message: `Chatr AI is still starting up (${state.phase}). Please wait 20–30 seconds and try again.` };
      }
      return { error: 'local_unavailable', message: 'Local AI is not ready. Please check the AI status indicator in the top bar.' };
    }

    const targetModel = model || state.readyModels[0];

    try {
      const askController = new AbortController();
      const timeoutId = setTimeout(() => askController.abort(), 600000); // 10 min for large summaries

      let res;
      try {
        res = await fetch(`${OLLAMA_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetModel,
            system: systemPrompt || undefined,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.7,
              num_predict: 1024  // Enough for meeting summaries and action items
            }
          }),
          signal: askController.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res || !res.ok) throw new Error(`Ollama /api/generate error: ${res?.status || 'no response'}`);
      const data = await res.json();
      return { text: data.response || '' };


    } catch (err) {
      log.error('[Ollama] Ask failed:', err.message);
      return { error: 'request_failed', message: err.message };
    }
  });

  /** Get list of available local models */
  ipcMain.handle('ai:list-models', async () => {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`, {}, 2000);
      if (!res.ok) return { models: [] };
      const data = await res.json();
      return { models: (data.models || []).map(m => ({ name: m.name, size: m.size })) };
    } catch {
      return { models: [] };
    }
  });

  /** Force retry bootstrap (user triggered from settings) */
  ipcMain.handle('ai:retry-setup', async () => {
    state.retryCount = 0;
    if (state.mainWindow) {
      bootstrap(state.mainWindow);
    }
    return { started: true };
  });

  /** Cleanup on quit */
  app.on('will-quit', () => {
    if (state.ollamaProcess) {
      try { process.kill(state.ollamaProcess.pid, 'SIGTERM'); } catch {}
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { bootstrap, registerIpcHandlers, state };
