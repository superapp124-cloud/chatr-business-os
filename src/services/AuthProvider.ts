import { auth } from '@/firebase';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
} from 'firebase/auth';
import { supabase } from '@/integrations/supabase/client';
import { DeviceCrypto } from './DeviceCrypto';

class AuthProviderService {
  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private lastExchangeTime: number = 0;

  private async functionErrorMessage(error: unknown, fallback: string): Promise<string> {
    const functionError = error as { message?: string; context?: Response };
    const response = functionError?.context;

    if (response) {
      const status = response.status ? ` (${response.status})` : '';

      try {
        const body = await response.clone().json();
        const code = body?.code ? `${body.code}: ` : '';
        const message = body?.error || body?.message;
        if (message) return `${code}${message}${status}`;
      } catch {
        try {
          const text = await response.clone().text();
          if (text) return `${text}${status}`;
        } catch {}
      }
    }

    return functionError?.message || fallback;
  }

  private async applyChatrSession(session: { access_token?: string; refresh_token?: string | null }) {
    if (!session?.access_token) throw new Error("Failed to exchange identity");

    const refreshToken =
      session.refresh_token ||
      `chatr_synthetic_refresh_${crypto.randomUUID?.() ?? Date.now().toString(36)}`;

    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: refreshToken,
    });

    if (error) throw error;
  }

  private getGlobalContainer(): HTMLElement {
    let container = document.getElementById('chatr-global-recaptcha');
    if (!container) {
      container = document.createElement('div');
      container.id = 'chatr-global-recaptcha';
      // Do not use visibility: hidden, or visual recaptcha puzzles will be impossible to solve!
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.zIndex = '99999';
      document.body.appendChild(container);
    }
    return container;
  }

  public async initRecaptcha(containerId: string): Promise<void> {
    const container = this.getGlobalContainer();
    if (this.recaptchaVerifier) return;

    try {
      this.recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
      await this.recaptchaVerifier.render();
    } catch(e) {
      console.warn("[AuthProvider] Recaptcha pre-init error:", e);
      this.recaptchaVerifier = null;
    }
  }

  public clearRecaptcha() {
    if (this.recaptchaVerifier) {
      try { this.recaptchaVerifier.clear(); } catch(e) {}
      this.recaptchaVerifier = null;
    }
    const container = document.getElementById('chatr-global-recaptcha');
    if (container) container.remove();
  }

  public async sendOtp(phone: string): Promise<boolean> {
    try {
      this.clearRecaptcha(); // Always use a fresh verifier to prevent auth/code-expired
      const container = this.getGlobalContainer();
      container.innerHTML = '';
      this.recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
      await this.recaptchaVerifier.render();
      
      this.confirmationResult = await signInWithPhoneNumber(auth, phone, this.recaptchaVerifier);
      return true;
    } catch (error: any) {
      console.error("[AuthProvider] Failed to send OTP:", error);
      this.clearRecaptcha();
      throw error;
    }
  }

  public async verifyOtp(code: string): Promise<boolean> {
    if (!this.confirmationResult) throw new Error("No pending OTP verification");

    try {
      const result = await this.confirmationResult.confirm(code);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const response = await supabase.functions.invoke('identity-exchange', {
        body: { id_token: idToken }
      });

      if (response.error) {
        throw new Error(await this.functionErrorMessage(response.error, 'Failed to exchange identity'));
      }
      
      const data = response.data;
      if (!data?.session) throw new Error("Failed to exchange identity");

      this.lastExchangeTime = Date.now();

      await this.applyChatrSession(data.session);

      // After successful OTP, register this device in the background, passing the explicit token
      this.registerDevice(data.session.access_token).catch(e => console.warn("[AuthProvider] Device registration failed:", e));

      return true;
    } catch (error) {
      console.error("[AuthProvider] Failed to verify OTP:", error);
      throw error;
    }
  }

  private async registerDevice(token?: string) {
    try {
      // Clean up any old keys first
      await DeviceCrypto.clearKeypair();
      
      const publicJwk = await DeviceCrypto.generateKeypair();
      const ua = navigator.userAgent;
      const isMobile = /Mobi|Android/i.test(ua);
      const platform = isMobile ? 'Mobile' : 'Desktop';
      let browser = "Unknown Browser";
      if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari")) browser = "Safari";
      else if (ua.includes("Firefox")) browser = "Firefox";
      
      const deviceName = `${browser} on ${platform}`;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { data, error } = await supabase.functions.invoke('device-auth/register', {
        body: {
          public_key_jwk: publicJwk,
          device_name: deviceName,
          platform: navigator.platform,
        },
        headers
      });

      if (error) throw error;
      if (data?.device_id) {
        await DeviceCrypto.setDeviceId(data.device_id);
        console.log("[AuthProvider] Trusted Device registered successfully.");
      }
    } catch (e) {
      console.error("[AuthProvider] Error registering trusted device:", e);
    }
  }

  public async silentLogin(): Promise<boolean> {
    try {
      const hasKey = await DeviceCrypto.hasKeypair();
      const deviceId = await DeviceCrypto.getDeviceId();
      if (!hasKey || !deviceId) return false;

      // 1. Get Challenge
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke('device-auth/challenge', {
        body: { device_id: deviceId }
      });

      if (challengeError || !challengeData?.challenge) throw challengeError;

      // 2. Sign Challenge
      const signatureHex = await DeviceCrypto.signChallenge(challengeData.challenge);

      // 3. Verify & Get Assertion
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('device-auth/verify', {
        body: {
          device_id: deviceId,
          challenge: challengeData.challenge,
          signature_hex: signatureHex
        }
      });

      if (verifyError || !verifyData?.device_assertion) throw verifyError;

      // 4. Exchange Assertion for Session
      const response = await supabase.functions.invoke('identity-exchange', {
        body: { device_assertion: verifyData.device_assertion }
      });

      if (response.error || !response.data?.session) {
        throw new Error(await this.functionErrorMessage(response.error, 'Failed to exchange device identity'));
      }

      this.lastExchangeTime = Date.now();

      await this.applyChatrSession(response.data.session);

      // Note: We do not rotate keys on every login to avoid spamming the trusted_devices table.
      // The challenge/response is sufficient to prevent replay attacks.

      return true;
    } catch (e) {
      console.warn("[AuthProvider] Silent login failed:", e);
      // Clean up invalid keys
      await DeviceCrypto.clearKeypair();
      return false;
    }
  }

  public async getSession() {
    return supabase.auth.getSession();
  }

  public async signOut() {
    await DeviceCrypto.clearKeypair();
    await auth.signOut();
    return supabase.auth.signOut();
  }

  public setupSessionSync() {
    auth.onIdTokenChanged(async (user) => {
      if (user) {
        // Deduplicate: If we just manually ran identity-exchange within the last 10 seconds (e.g. from verifyOtp), skip this one
        if (Date.now() - this.lastExchangeTime < 10000) return;
        
        try {
          const idToken = await user.getIdToken();
          const { data, error } = await supabase.functions.invoke('identity-exchange', {
            body: { id_token: idToken }
          });
          
          if (!error && data?.session) {
            this.lastExchangeTime = Date.now();
            await this.applyChatrSession(data.session);
          } else if (error) {
            console.warn("[AuthProvider] Session sync failed:", await this.functionErrorMessage(error, 'Failed to sync session'));
          }
        } catch (err) {}
      }
    });
  }
}

export const AuthProvider = new AuthProviderService();
