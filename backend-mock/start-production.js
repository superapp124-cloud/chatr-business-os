#!/usr/bin/env node
/**
 * start-production.js — Zero-config production launcher
 *
 * Reads backend-mock/.env and starts the real-time server.
 * Use this when you don't have PM2 or Docker available.
 *
 * Usage:
 *   node backend-mock/start-production.js
 *
 * Or add to root package.json scripts:
 *   "start:realtime": "node backend-mock/start-production.js"
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER = path.join(__dirname, 'server-enhanced.js');
const ENV_FILE = path.join(__dirname, '.env');

// Load .env manually so we don't need dotenv installed globally
if (fs.existsSync(ENV_FILE)) {
  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const port = process.env.PORT || 3000;

console.log(`
╔══════════════════════════════════════════════════╗
║     CHATR Real-Time Server — Production Mode     ║
╠══════════════════════════════════════════════════╣
║  PORT  → ${String(port).padEnd(39)}║
║  REDIS → ${(process.env.REDIS_URL ? 'configured' : 'single-node').padEnd(39)}║
║  JWT   → ${(process.env.SUPABASE_JWT_SECRET ? 'configured ✅' : 'dev-mode (no auth) ⚠️').padEnd(39)}║
╚══════════════════════════════════════════════════╝
`);

if (!process.env.SUPABASE_JWT_SECRET) {
  console.warn('⚠️  SUPABASE_JWT_SECRET is not set — JWT auth is DISABLED.');
  console.warn('   Run: node scripts/fetch-supabase-jwt.js (after setting SUPABASE_ACCESS_TOKEN)');
  console.warn('   Or manually paste the secret from: Supabase Dashboard → Settings → API → JWT Secret\n');
}

const proc = spawn(process.execPath, [SERVER], {
  stdio: 'inherit',
  env: process.env,
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    proc.kill(sig);
  });
}
