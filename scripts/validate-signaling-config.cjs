#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const envFiles = ['.env', '.env.local', '.env.production', '.env.staging']
  .map((file) => path.join(root, file))
  .filter((file) => fs.existsSync(file));

function parseEnvFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }

  return values;
}

function isPrivateHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('127.')
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    || hostname.endsWith('.local');
}

function hostFromUrl(value) {
  if (!value) return '';

  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

let failed = false;

for (const file of envFiles) {
  const env = parseEnvFile(file);
  const socketUrl = env.VITE_SIGNALING_URL || env.VITE_SOCKET_URL || '';
  const environment = env.VITE_SIGNALING_ENV || env.VITE_APP_ENV || env.VITE_ENVIRONMENT || '';
  const host = hostFromUrl(socketUrl);
  const isProductionLike = /production|staging|preview/i.test(environment) || file.endsWith('.env.production') || file.endsWith('.env.staging');

  if (socketUrl && !host) {
    console.error(`[signaling-config] Invalid socket URL in ${path.basename(file)}: ${socketUrl}`);
    failed = true;
    continue;
  }

  if (isProductionLike && isPrivateHost(host)) {
    console.error(`[signaling-config] Production-like environment cannot use private signaling endpoint in ${path.basename(file)}: ${socketUrl}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('[signaling-config] Signaling configuration passed');
