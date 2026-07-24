'use strict';

const { safeStorage, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');

const log = (() => { try { return require('electron-log'); } catch { return console; } })();

/**
 * Local Identity Provider
 * 
 * Manages OAuth connections and securely stores tokens on the local OS
 * via Electron's safeStorage (OS Keychain).
 */
class LocalIdentityProvider {
  constructor() {
    this.name = 'LocalIdentityProvider';
    // Path to store the encrypted token blob
    const { app } = require('electron');
    const userData = app.getPath('userData');
    this.tokenFilePath = path.join(userData, 'identity.enc');
    this._tokens = this._loadTokens();
  }

  _loadTokens() {
    try {
      if (!fs.existsSync(this.tokenFilePath)) return {};
      const encrypted = fs.readFileSync(this.tokenFilePath);
      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      }
      return {};
    } catch (err) {
      log.error(`[LocalIdentityProvider] Failed to load tokens: ${err.message}`);
      return {};
    }
  }

  _saveTokens() {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify(this._tokens));
        fs.writeFileSync(this.tokenFilePath, encrypted);
      } else {
        log.warn(`[LocalIdentityProvider] OS Encryption unavailable. Tokens not saved to disk.`);
      }
    } catch (err) {
      log.error(`[LocalIdentityProvider] Failed to save tokens: ${err.message}`);
    }
  }

  async execute(context) {
    const { action, provider } = context;

    if (action === 'get_accounts') {
      const accounts = Object.keys(this._tokens).map(key => ({
        id: key,
        provider: this._tokens[key].provider,
        email: this._tokens[key].email || 'unknown@example.com',
        status: 'connected'
      }));
      return accounts;
    }

    if (action === 'connect') {
      return await this._handleConnect(provider);
    }

    if (action === 'revoke') {
      const accountId = context.accountId;
      if (this._tokens[accountId]) {
        delete this._tokens[accountId];
        this._saveTokens();
      }
      return { success: true };
    }

    throw new Error(`[LocalIdentityProvider] Unknown action: ${action}`);
  }

  async _handleConnect(providerName) {
    return new Promise((resolve) => {
      // 1. Create a local HTTP server to catch the OAuth redirect
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost:3456');
        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization Successful</h1><p>You can close this tab and return to CHATR.</p><script>window.close()</script>');
          
          // In a real implementation, we would exchange `code` for tokens here
          // using a PKCE flow directly from the Kernel.
          // For now, we simulate the token exchange:
          const accountId = crypto.randomUUID();
          this._tokens[accountId] = {
            provider: providerName,
            accessToken: `mock_access_${code}`,
            refreshToken: `mock_refresh_${code}`,
            email: `user_${Math.floor(Math.random()*1000)}@${providerName}.com`
          };
          this._saveTokens();
          
          server.close();
          resolve({ success: true, accountId, provider: providerName });
        }
      });

      server.listen(3456, () => {
        // 2. Open the browser to the provider's OAuth page
        const redirectUri = encodeURIComponent('http://localhost:3456/oauth/callback');
        const authUrl = `https://oauth.${providerName}.com/auth?client_id=CHATR_DESKTOP&redirect_uri=${redirectUri}&response_type=code`;
        shell.openExternal(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        resolve({ success: false, error: 'Timeout waiting for OAuth callback.' });
      }, 5 * 60 * 1000);
    });
  }
}

module.exports = { LocalIdentityProvider };
