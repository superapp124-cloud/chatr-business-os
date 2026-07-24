import { openDB } from 'idb';

const DB_NAME = 'chatr-device-crypto';
const STORE_NAME = 'keys';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export class DeviceCryptoService {
  /**
   * Generates a new P-256 ECDSA keypair, stores the non-extractable private key
   * in IndexedDB, and returns the public key as a JWK.
   */
  async generateKeypair(): Promise<JsonWebKey> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign", "verify"]
    );

    const db = await initDB();
    await db.put(STORE_NAME, keyPair.privateKey, 'privateKey');
    await db.put(STORE_NAME, keyPair.publicKey, 'publicKey');

    return window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  }

  async setDeviceId(deviceId: string) {
    const db = await initDB();
    await db.put(STORE_NAME, deviceId, 'deviceId');
  }

  async getDeviceId(): Promise<string | null> {
    const db = await initDB();
    return await db.get(STORE_NAME, 'deviceId') || null;
  }

  async getPublicKeyJwk(): Promise<JsonWebKey | null> {
    const db = await initDB();
    const publicKey = await db.get(STORE_NAME, 'publicKey');
    if (!publicKey) return null;
    return window.crypto.subtle.exportKey("jwk", publicKey);
  }

  async hasKeypair(): Promise<boolean> {
    const db = await initDB();
    const privateKey = await db.get(STORE_NAME, 'privateKey');
    return !!privateKey;
  }

  async signChallenge(challenge: string): Promise<string> {
    const db = await initDB();
    const privateKey = await db.get(STORE_NAME, 'privateKey');
    
    if (!privateKey) throw new Error("No private key found.");

    const dataBuffer = new TextEncoder().encode(challenge);
    const signatureBuffer = await window.crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      dataBuffer
    );

    return Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async clearKeypair(): Promise<void> {
    const db = await initDB();
    await db.delete(STORE_NAME, 'privateKey');
    await db.delete(STORE_NAME, 'publicKey');
    await db.delete(STORE_NAME, 'deviceId');
  }
}

export const DeviceCrypto = new DeviceCryptoService();
