import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export type ProviderLifecycleState = 'DISCOVERED' | 'REGISTERED' | 'ONBOARDED' | 'GENERATED' | 'CERTIFIED' | 'ACTIVE' | 'DEPRECATED';

export interface CompanyProfile {
  companyName: string;
  legalName: string;
  gst?: string;
  pan?: string;
  cin?: string;
  address: string;
  supportEmail: string;
  developerEmail: string;
  website: string;
  privacyPolicy: string;
  terms: string;
  logoUrl?: string;
  supportPhone: string;
}

export interface ProviderCredentials {
  providerName: string;
  lifecycleState: ProviderLifecycleState;
  sandboxKeys: Record<string, string>;
  productionKeys: Record<string, string>;
  oauthCredentials?: {
    clientId: string;
    clientSecret: string;
    redirectUrls: string[];
  };
  webhookUrls?: string[];
  certificates?: Record<string, string>;
  status: 'active' | 'pending' | 'revoked';
  renewalDates?: Record<string, string>;
  notes?: string;
}

export class SecretScanner {
  /**
   * Validates extracted credentials before storing them.
   * Prevents storing raw HTML or garbage strings as API keys.
   */
  static validate(keys: Record<string, string>): boolean {
    for (const [keyName, val] of Object.entries(keys)) {
      if (!val || typeof val !== 'string') return false;
      
      // Basic entropy/format checks
      if (val.length < 8) return false;
      if (val.includes('<html') || val.includes('<body')) return false;
      
      // If it looks like a typical Bearer token or JWT, allow it
      // Standard key patterns (sk_live_, pk_test_, etc.)
      const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(val);
      const isHex = /^[a-fA-F0-9]+$/.test(val);
      const isStandardPrefix = /^[a-zA-Z0-9_]+_[a-zA-Z0-9_]+$/.test(val);
      
      if (!isBase64 && !isHex && !isStandardPrefix && val.length > 200) {
        // Unusually long and not base64 might be garbage
        return false;
      }
    }
    return true;
  }
}

export class ProviderVault {
  private vaultPath: string;
  private encryptionKey: Buffer;

  constructor(vaultPath: string = path.join(process.cwd(), '.vault'), secret: string = 'default-dev-secret-32-chars-long!!') {
    this.vaultPath = vaultPath;
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async init(): Promise<void> {
    try {
      await fs.access(this.vaultPath);
    } catch {
      await fs.mkdir(this.vaultPath, { recursive: true });
    }
  }

  async saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    const filePath = path.join(this.vaultPath, 'company_profile.enc');
    const data = this.encrypt(JSON.stringify(profile, null, 2));
    await fs.writeFile(filePath, data);
  }

  async getCompanyProfile(): Promise<CompanyProfile | null> {
    const filePath = path.join(this.vaultPath, 'company_profile.enc');
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(this.decrypt(data));
    } catch {
      return null;
    }
  }

  async saveProviderCredentials(creds: ProviderCredentials): Promise<void> {
    // Secret Scanning Validation before encrypting
    if (!SecretScanner.validate(creds.sandboxKeys)) {
      throw new Error(`[SecretScanner] Validation failed for Sandbox Keys for ${creds.providerName}`);
    }
    if (!SecretScanner.validate(creds.productionKeys)) {
      throw new Error(`[SecretScanner] Validation failed for Production Keys for ${creds.providerName}`);
    }

    const filePath = path.join(this.vaultPath, `${creds.providerName.toLowerCase()}_creds.enc`);
    const data = this.encrypt(JSON.stringify(creds, null, 2));
    await fs.writeFile(filePath, data);
  }

  async getProviderCredentials(providerName: string): Promise<ProviderCredentials | null> {
    const filePath = path.join(this.vaultPath, `${providerName.toLowerCase()}_creds.enc`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(this.decrypt(data));
    } catch {
      return null;
    }
  }
}
