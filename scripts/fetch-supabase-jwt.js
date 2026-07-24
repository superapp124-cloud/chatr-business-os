#!/usr/bin/env node
/**
 * fetch-supabase-jwt.js
 *
 * Automatically fetches the Supabase JWT secret from the Supabase Management API
 * and writes it to backend-mock/.env so the real-time server can verify JWTs.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<your-personal-access-token> node scripts/fetch-supabase-jwt.js
 *
 * Get your personal access token at:
 *   https://supabase.com/dashboard/account/tokens
 *
 * The script will:
 *   1. Read VITE_SUPABASE_URL from .env to determine the project ref
 *   2. Call the Supabase Management API to fetch project secrets
 *   3. Write SUPABASE_JWT_SECRET to backend-mock/.env
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_ENV = path.join(ROOT, 'backend-mock', '.env');
const FRONTEND_ENV = path.join(ROOT, '.env');

// ── Read project ref from frontend .env ──────────────────────────────────────
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function writeEnvValue(filePath, key, value) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + '\n' + line + '\n';
  }
  fs.writeFileSync(filePath, content);
  console.log(`✅ Written ${key} to ${path.relative(ROOT, filePath)}`);
}

async function fetchJwtSecret(accessToken, projectRef) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/api-keys`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // The Management API returns { jwt_secret: '...' } in project details
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse Supabase API response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchProjectDetails(accessToken, projectRef) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Supabase API response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ SUPABASE_ACCESS_TOKEN not set.');
    console.error('   Get one at: https://supabase.com/dashboard/account/tokens');
    console.error('   Run: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/fetch-supabase-jwt.js');
    process.exit(1);
  }

  const frontendEnv = readEnvFile(FRONTEND_ENV);
  const supabaseUrl = frontendEnv.VITE_SUPABASE_URL || frontendEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('❌ Could not find VITE_SUPABASE_URL in .env');
    process.exit(1);
  }

  // Extract project ref from URL: https://<ref>.supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    console.error('❌ Could not parse project ref from:', supabaseUrl);
    process.exit(1);
  }

  const projectRef = match[1];
  console.log(`🔍 Fetching JWT secret for project: ${projectRef}`);

  try {
    const project = await fetchProjectDetails(accessToken, projectRef);

    if (project.jwt_secret) {
      writeEnvValue(BACKEND_ENV, 'SUPABASE_JWT_SECRET', project.jwt_secret);
      console.log('🎉 JWT secret configured! Restart the backend server to apply.');
    } else {
      console.warn('⚠️  JWT secret not found in API response.');
      console.warn('   Go to Supabase Dashboard → Settings → API → JWT Secret');
      console.warn('   and set SUPABASE_JWT_SECRET in backend-mock/.env manually.');
    }
  } catch (err) {
    console.error('❌ API error:', err.message);
    process.exit(1);
  }
}

main();
