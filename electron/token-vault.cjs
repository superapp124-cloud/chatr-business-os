const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

function getTokenVaultPath() {
  return path.join(app.getPath('userData'), 'token-vault.enc');
}

function readVault() {
  try {
    const filePath = getTokenVaultPath();
    if (!fs.existsSync(filePath)) return {};

    const encrypted = fs.readFileSync(filePath);
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(encrypted)
      : encrypted.toString('utf8');
    return JSON.parse(raw);
  } catch (err) {
    log.error('[TokenVault] Failed to read vault:', err.message);
    return {};
  }
}

function writeVault(data) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    const bytes = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(serialized)
      : Buffer.from(serialized, 'utf8');
    fs.writeFileSync(getTokenVaultPath(), bytes);
    return true;
  } catch (err) {
    log.error('[TokenVault] Failed to write vault:', err.message);
    return false;
  }
}

function saveToken(providerId, tokenData) {
  const vault = readVault();
  vault[providerId] = {
    ...tokenData,
    updatedAt: new Date().toISOString()
  };
  return writeVault(vault);
}

function getToken(providerId) {
  const vault = readVault();
  return vault[providerId] || null;
}

module.exports = {
  saveToken,
  getToken
};
