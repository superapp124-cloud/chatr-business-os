/**
 * CHATR AI
 * Gemini-first on-device intelligence runtime for zero-cost private assistance.
 */

import {
  AgentType,
  BrainRequest,
  BrainResponse,
  BrainRuntimeStatus,
  DetectedIntent,
} from './types';
import { intentRouter } from './intentRouter';
import { generateOnDeviceText, isOnDeviceAIEnabled } from '@/lib/onDeviceAI';

interface DeviceGptResult {
  answer: string;
  sources: string[];
  followUp: string[];
  confidence: number;
  model?: string;
  provider?: string;
}

interface NativeDeviceGptResult {
  answer?: string;
  sources?: string[];
  followUp?: string[];
  confidence?: number;
  model?: string;
  provider?: string;
}

const DEVICE_USER_ID = 'device-offline-user';

const CAPABILITIES = [
  'Private scam triage',
  'Call summary guidance',
  'Job safety coaching',
  'Medicine and family reminders',
  'Bills and recharge planning',
  'Daily task planning',
];

class DeviceGptService {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  getDeviceUserId(): string {
    return DEVICE_USER_ID;
  }

  getStatus(): BrainRuntimeStatus {
    const isOffline = this.isOffline();
    const isNative = this.hasNativeDeviceGpt();
    const nativeStatus = this.getNativeStatus();
    const hasGeminiRoute = this.hasActualGeminiRoute();

    if (nativeStatus) {
      return {
        ...nativeStatus,
        mode: isOffline ? 'offline' : nativeStatus.mode,
        label: isOffline && nativeStatus.model.toLowerCase().includes('gemini')
          ? 'Gemini on-device offline'
          : nativeStatus.label,
        isOffline,
        isNative: nativeStatus.isNative || isNative,
        detail: isOffline && nativeStatus.model.toLowerCase().includes('gemini')
          ? 'Gemini on-device route is running locally on this phone. Zero cloud uploads.'
          : nativeStatus.detail,
      };
    }

    if (!hasGeminiRoute) {
      return {
        mode: isOffline ? 'offline' : 'device',
        label: isOffline ? 'Private local fallback offline' : 'Private local fallback',
        model: 'CHATR local safety rules',
        provider: 'Browser local fallback',
        isOffline,
        isNative: false,
        privacy: 'on_device',
        detail: 'Gemini Nano is not available in this browser session. CHATR will ask for real evidence and use local safety guidance without inventing alerts.',
        capabilities: CAPABILITIES,
      };
    }

    return {
      mode: isOffline ? 'offline' : 'device',
      label: isOffline ? 'Gemini on-device offline' : 'Gemini on-device ready',
      model: 'Gemini Nano On-Device',
      provider: 'Gemini on-device runtime',
      isOffline,
      isNative,
      privacy: 'on_device',
      detail: 'Gemini on-device route handles safety, calls, jobs, family, bills, and planning with zero cloud uploads.',
      capabilities: CAPABILITIES,
    };
  }

  isZeroCostMode(): boolean {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('chatr_connected_ai_enabled') !== 'true';
  }

  shouldHandleOnDevice(query: string, intent: DetectedIntent): boolean {
    if (this.isOffline()) return true;

    const lower = query.toLowerCase();
    const privatePatterns = [
      /otp|one.time|verification code|upi|bank|account|atm|pin|password|kyc|aadhaar|pan\b|card/i,
      /scam|fraud|phishing|blackmail|extortion|threat|urgent|blocked|suspended/i,
      /medicine|doctor|health|symptom|hospital|mom|dad|elder|family/i,
      /last call|call summary|summarize.*call|recording|transcript/i,
      /salary|resume|cv|interview|recruiter|job offer/i,
    ];

    return privatePatterns.some((pattern) => pattern.test(lower)) ||
      intent.agents.some((agent) => agent === 'health' || agent === 'jobs' || agent === 'personal');
  }

  async process(request: BrainRequest): Promise<BrainResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startedAt = this.now();
    const intent = intentRouter.detectIntent(request.query);
    const agents = request.forceAgent ? [request.forceAgent] : intent.agents;

    const result = await this.tryGeminiOnDevice(request.query, intent, agents) ||
      this.tryNative(request.query, intent, agents) ||
      this.runLocal(request.query, intent, agents);
    const runtime = {
      ...this.getStatus(),
      model: result.model || this.getStatus().model,
      provider: result.provider || this.getStatus().provider,
      privacy: 'on_device' as const,
    };

    return {
      answer: result.answer,
      agents,
      intent,
      sources: result.sources,
      followUp: result.followUp,
      latencyMs: Math.round(this.now() - startedAt),
      runtime,
      modelUsed: runtime.model,
      privacy: runtime.privacy,
      offline: runtime.isOffline,
      confidence: result.confidence,
    };
  }

  private tryNative(query: string, intent: DetectedIntent, agents: AgentType[]): DeviceGptResult | null {
    if (!this.hasNativeDeviceGpt()) return null;

    try {
      const payload = JSON.stringify({
        query,
        intent,
        agents,
        offline: this.isOffline(),
        timestamp: new Date().toISOString(),
      });
      const raw = window.ChatrNativeRuntime?.deviceGPT?.(payload);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as NativeDeviceGptResult;
      if (!parsed.answer) return null;

      const nativeGemini = (parsed as { geminiOnDevice?: boolean }).geminiOnDevice === true;

      return {
        answer: parsed.answer,
        sources: parsed.sources?.length
          ? parsed.sources
          : nativeGemini
            ? ['Gemini on-device runtime', 'CHATR private safety rules']
            : ['CHATR local safety rules'],
        followUp: parsed.followUp?.length ? parsed.followUp : this.defaultFollowUp(agents[0]),
        confidence: parsed.confidence ?? 0.82,
        model: parsed.model || (nativeGemini ? 'Gemini Nano On-Device' : 'CHATR local fallback'),
        provider: parsed.provider || (nativeGemini ? 'Android Gemini on-device runtime' : 'Android local fallback'),
      };
    } catch (error) {
      console.debug('[CHATR AI] Native runtime failed, using web local pack:', error);
      return null;
    }
  }

  private async tryGeminiOnDevice(query: string, intent: DetectedIntent, agents: AgentType[]): Promise<DeviceGptResult | null> {
    const capacitorGemini = await this.tryCapacitorGemini(query, intent, agents);
    if (capacitorGemini) return capacitorGemini;

    const nativeGemini = this.tryNativeGemini(query, intent, agents);
    if (nativeGemini) return nativeGemini;

    const browserGemini = await this.tryBrowserGeminiNano(query, intent, agents);
    if (browserGemini) return browserGemini;

    return null;
  }

  private async tryCapacitorGemini(query: string, intent: DetectedIntent, agents: AgentType[]): Promise<DeviceGptResult | null> {
    if (!isOnDeviceAIEnabled()) return null;

    try {
      const guardedLocal = this.runLocal(query, intent, agents);
      const result = await generateOnDeviceText({
        task: 'general',
        prompt: [
          'You are CHATR Intelligence running through the native Gemini Nano route.',
          'Use only the user request and the safe local plan below.',
          'If the user has not provided evidence, ask for evidence instead of inventing events, risk scores, calls, reminders, SMS, or jobs.',
          '',
          `User request: ${query}`,
          '',
          'Safe local plan:',
          guardedLocal.answer,
        ].join('\n'),
        maxOutputTokens: 384,
      });

      if (!result?.text || result.geminiOnDevice !== true) return null;

      return {
        answer: this.ensureGeminiPrivacyLine(result.text.trim()),
        sources: ['Gemini Nano Capacitor plugin', ...guardedLocal.sources],
        followUp: guardedLocal.followUp,
        confidence: Math.max(0.82, guardedLocal.confidence),
        model: result.model || 'Gemini Nano On-Device',
        provider: result.provider || 'Android Gemini on-device runtime',
      };
    } catch (error) {
      console.debug('[CHATR AI] Capacitor Gemini route unavailable, using private fallback:', error);
      return null;
    }
  }

  private tryNativeGemini(query: string, intent: DetectedIntent, agents: AgentType[]): DeviceGptResult | null {
    if (typeof window === 'undefined' || typeof window.ChatrNativeRuntime?.geminiNanoGenerate !== 'function') {
      return null;
    }

    try {
      const payload = JSON.stringify({
        query,
        intent,
        agents,
        offline: this.isOffline(),
        privacy: 'on_device',
        timestamp: new Date().toISOString(),
      });
      const raw = window.ChatrNativeRuntime.geminiNanoGenerate(payload);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as NativeDeviceGptResult;
      if (!parsed.answer || (parsed as { geminiOnDevice?: boolean }).geminiOnDevice !== true) return null;

      return {
        answer: parsed.answer,
        sources: parsed.sources?.length ? parsed.sources : ['Gemini on-device runtime', 'CHATR private safety rules'],
        followUp: parsed.followUp?.length ? parsed.followUp : this.defaultFollowUp(agents[0]),
        confidence: parsed.confidence ?? 0.84,
        model: parsed.model || 'Gemini Nano On-Device',
        provider: parsed.provider || 'Android Gemini on-device runtime',
      };
    } catch (error) {
      console.debug('[CHATR AI] Gemini on-device bridge failed, using private local route:', error);
      return null;
    }
  }

  private async tryBrowserGeminiNano(query: string, intent: DetectedIntent, agents: AgentType[]): Promise<DeviceGptResult | null> {
    if (typeof window === 'undefined' || !this.hasBrowserGeminiPromptApi()) return null;

    const guardedLocal = this.runLocal(query, intent, agents);
    const systemPrompt = [
      'You are CHATR Intelligence running as an on-device Gemini assistant.',
      'Never ask to upload private calls, SMS, OTPs, bank details, health details, or recruiter messages.',
      'For safety, scam, health, family, and job-risk tasks, preserve the conservative checks from the CHATR local plan.',
      'If the user has not provided evidence, ask for evidence instead of inventing a risk score.',
      'Answer concisely for a mobile screen.',
    ].join(' ');
    const prompt = [
      `User request: ${query}`,
      '',
      'CHATR local safety plan to preserve:',
      guardedLocal.answer,
      '',
      'Rewrite or improve the answer, but keep it private, practical, and on-device.',
    ].join('\n');

    try {
      const answer = await this.runBrowserGeminiPrompt(prompt, systemPrompt);
      if (!answer) return null;

      return {
        answer: this.ensureGeminiPrivacyLine(answer.trim()),
        sources: ['Gemini Nano browser runtime', ...guardedLocal.sources],
        followUp: guardedLocal.followUp,
        confidence: Math.max(0.82, guardedLocal.confidence),
        model: 'Gemini Nano On-Device',
        provider: 'Browser built-in Gemini runtime',
      };
    } catch (error) {
      console.debug('[CHATR AI] Browser Gemini Nano unavailable, using private local route:', error);
      return null;
    }
  }

  private runLocal(query: string, intent: DetectedIntent, agents: AgentType[]): DeviceGptResult {
    const lower = query.toLowerCase();

    if (this.isAmbientCheckIn(lower)) {
      return this.ambientOperatingResponse(query, intent, agents);
    }

    if (this.matches(lower, ['otp', 'bank', 'upi', 'kyc', 'pin', 'password', 'scam', 'fraud', 'phishing', 'suspicious caller', 'blocked caller', 'caller blocked', 'suspicious', 'blocked'])) {
      return this.scamShieldResponse(query);
    }

    if (this.matches(lower, ['last call', 'call summary', 'summarize', 'meeting notes', 'transcript', 'follow-up'])) {
      return this.callCopilotResponse();
    }

    if (this.matches(lower, ['job', 'resume', 'cv', 'interview', 'recruiter', 'salary', 'offer letter'])) {
      return this.jobsResponse(query);
    }

    if (this.matches(lower, ['medicine', 'tablet', 'doctor', 'hospital', 'mom', 'dad', 'elder', 'health'])) {
      return this.familyHealthResponse(query);
    }

    if (this.matches(lower, ['recharge', 'bill', 'subscription', 'payment', 'due'])) {
      return this.lifeAdminResponse();
    }

    if (this.matches(lower, ['today', 'routine', 'plan my day', 'build my day', 'reminder', 'task'])) {
      return this.dailyPlanResponse();
    }

    return this.ambientOperatingResponse(query, intent, agents);
  }

  private ambientOperatingResponse(query: string, intent: DetectedIntent, agents: AgentType[]): DeviceGptResult {
    const trimmed = query.trim();
    const heardLine = trimmed.length > 2 && !/^(ok|okay|yes|start|help|hi|hello|hey)$/i.test(trimmed)
      ? `I heard: "${trimmed}". I do not need cloud AI to start helping with this.`
      : 'I am active. I will stay quiet until something needs your attention.';

    const primaryAgent = agents[0] || intent.agents[0] || 'personal';
    const modeLine = this.getModeLine(primaryAgent);

    return {
      answer: [
        'CHATR local fallback answer',
        '',
        heardLine,
        '',
        'Right now I can act on:',
        '1. Scam Shield: check OTP, bank, UPI, fake recruiter, and suspicious caller patterns.',
        '2. Call Copilot: turn call notes into summaries, tasks, reminders, and follow-up messages.',
        '3. Life Assistant: manage medicine, bills, recharge, appointments, and daily routines.',
        '4. Jobs Engine: verify recruiters, improve resume lines, practice interviews, and draft replies.',
        '',
        `Best next move: ${modeLine}`,
        '',
        'Privacy proof: this response used local CHATR rules in the app. No audio, SMS, call notes, or private text was uploaded.',
      ].join('\n'),
      sources: ['CHATR local intelligence rules', 'Private routing rules'],
      followUp: this.defaultFollowUp(primaryAgent),
      confidence: 0.81,
      model: 'CHATR local intelligence rules',
      provider: 'Browser local fallback',
    };
  }

  private scamShieldResponse(query: string): DeviceGptResult {
    const risk = this.scoreScamRisk(query);
    const severity = risk.score >= 80 ? 'high-risk' : risk.score >= 55 ? 'suspicious' : 'needs caution';

    return {
      answer: [
        `CHATR AI scan: treat this as ${severity} until verified.`,
        '',
        `Risk score: ${risk.score}%`,
        risk.reasons.length ? `Why: ${risk.reasons.join('; ')}.` : 'Why: the message asks for private or time-sensitive action.',
        '',
        'Do this now:',
        '1. Do not share OTP, PIN, UPI PIN, card details, or passwords.',
        '2. Call the bank, employer, or service only through an official number you find yourself.',
        '3. Block/report the sender if they pressure you or threaten account closure.',
        '4. Warn family if the message targets parents, elderly users, or shared accounts.',
        '',
        'This check ran locally on this phone, so the sensitive text stays private.',
      ].join('\n'),
      sources: ['CHATR local scam shield'],
      followUp: ['Create family warning', 'Save evidence snapshot', 'Block sender checklist'],
      confidence: risk.score / 100,
      model: 'CHATR local scam shield',
      provider: 'Browser local fallback',
    };
  }

  private callCopilotResponse(): DeviceGptResult {
    const lastCall = this.getLastNativeCallHint();

    return {
      answer: [
        'CHATR AI Call Copilot is ready.',
        '',
        lastCall
          ? `Latest native call detected: ${lastCall}. I can turn it into key points, follow-ups, reminders, and a clean shareable summary.`
          : 'Choose a recent call from Recents or paste call notes here, and I will create a clean summary immediately.',
        '',
        'What I can prepare:',
        '1. Key decisions and important names.',
        '2. Follow-up tasks, dates, and payment reminders.',
        '3. A short version you can share on WhatsApp or save as notes.',
        '',
        'This runs in private local fallback mode unless the native Gemini route is available.',
      ].join('\n'),
      sources: ['CHATR AI Call Copilot'],
      followUp: ['Summarize pasted transcript', 'Create follow-up tasks', 'Turn call into reminder'],
      confidence: 0.8,
      model: 'CHATR local call copilot',
      provider: this.hasNativeDeviceGpt() ? 'Android local fallback' : 'Browser local fallback',
    };
  }

  private jobsResponse(query: string): DeviceGptResult {
    const lower = query.toLowerCase();

    if (this.matches(lower, ['resume', 'cv', 'summary', 'profile'])) {
      return this.resumeResponse(query);
    }

    if (this.matches(lower, ['practice interview', 'interview practice', 'mock interview', 'interview answers'])) {
      return this.interviewPracticeResponse(query);
    }

    if (this.matches(lower, ['fake recruiter', 'recruiter', 'job offer', 'offer letter', 'registration fee', 'processing fee', 'security deposit'])) {
      return this.recruiterSafetyResponse(query);
    }

    return this.jobDiscoveryResponse(query);
  }

  private recruiterSafetyResponse(query: string): DeviceGptResult {
    const risk = this.scoreScamRisk(query);
    const hasEvidence = this.hasRecruiterEvidence(query);

    if (!hasEvidence) {
      return {
        answer: [
          'CHATR AI recruiter scan needs evidence.',
          '',
          'I cannot honestly score this recruiter yet because I only have the request, not the message or offer details.',
          '',
          'Paste any one of these and I will scan it locally:',
          '1. Recruiter WhatsApp/SMS message.',
          '2. Email address or company domain.',
          '3. Offer letter text or PDF details.',
          '4. Salary, role, joining date, and any fee/deposit request.',
          '',
          'Until then, safest rule: do not pay registration, training, laptop shipment, document verification, or security deposit fees.',
          '',
          'Privacy proof: the recruiter scan runs on this phone. Nothing is uploaded.',
        ].join('\n'),
        sources: ['CHATR local jobs helper'],
        followUp: ['Paste recruiter message', 'Draft verification questions', 'Practice interview'],
        confidence: 0.72,
        model: 'CHATR local jobs helper',
        provider: 'Browser local fallback',
      };
    }

    const severity = risk.score >= 75 ? 'high-risk' : risk.score >= 55 ? 'suspicious' : 'not enough red flags yet';

    return {
      answer: [
        `CHATR AI recruiter scan: ${severity}.`,
        '',
        `Risk signal: ${risk.score}%`,
        risk.reasons.length
          ? `Evidence seen: ${risk.reasons.join('; ')}.`
          : 'Evidence seen: no fee, OTP, pressure, or identity-theft phrase was found in the pasted text.',
        '',
        'Do this before replying:',
        '1. Verify the company domain and recruiter email. Avoid free email IDs for official offers.',
        '2. Ask for role, salary range, interview process, joining date, and reporting manager.',
        '3. Refuse any payment request for registration, training, laptop, verification, or security deposit.',
        '4. Search the company name plus "scam", "fraud", and "reviews" before sharing documents.',
        '',
        'I can draft a safe verification reply next.',
      ].join('\n'),
      sources: ['CHATR local jobs helper'],
      followUp: ['Draft safe recruiter reply', 'Save evidence snapshot', 'Practice interview'],
      confidence: Math.max(0.78, risk.score / 100),
      model: 'CHATR local jobs helper',
      provider: 'Browser local fallback',
    };
  }

  private resumeResponse(query: string): DeviceGptResult {
    const hasResumeText = query.trim().split(/\s+/).length > 10;

    return {
      answer: [
        'CHATR AI resume helper is ready on-device.',
        '',
        hasResumeText
          ? 'I can improve this into a sharper recruiter-facing summary.'
          : 'Paste your current resume summary, skills, or target role and I will rewrite it.',
        '',
        'Best format for India and emerging-market jobs:',
        '1. Start with role, years of experience, and top skills.',
        '2. Add measurable proof: revenue, users, speed, cost saved, tickets closed, campaigns run.',
        '3. Keep it ATS-friendly: plain words, no fancy formatting, no inflated claims.',
        '4. Tailor the first 3 lines to the job description before applying.',
        '',
        'Privacy proof: your resume text can be rewritten locally on this phone.',
      ].join('\n'),
      sources: ['CHATR local resume helper'],
      followUp: ['Rewrite my summary', 'Make ATS keywords', 'Draft cover letter'],
      confidence: hasResumeText ? 0.82 : 0.74,
      model: 'CHATR local resume helper',
      provider: 'Browser local fallback',
    };
  }

  private interviewPracticeResponse(query: string): DeviceGptResult {
    return {
      answer: [
        'CHATR AI interview practice is ready.',
        '',
        'We can run this voice-first:',
        '1. I ask one interview question at a time.',
        '2. You answer naturally.',
        '3. I score clarity, confidence, relevance, and salary-risk signals.',
        '4. I give a better version you can say in the actual call.',
        '',
        'Start with this:',
        'Tell me the role, company, and whether the interview is HR, technical, sales, support, or fresher.',
        '',
        'This practice stays in the private local fallback unless the native Gemini route is available.',
      ].join('\n'),
      sources: ['CHATR local interview helper'],
      followUp: ['Start HR mock interview', 'Practice salary answer', 'Prepare self introduction'],
      confidence: 0.82,
      model: 'CHATR local interview helper',
      provider: 'Browser local fallback',
    };
  }

  private jobDiscoveryResponse(query: string): DeviceGptResult {
    return {
      answer: [
        'CHATR AI Jobs Engine is active.',
        '',
        'Tell me your target role, city or remote preference, experience level, expected salary, and 3 strongest skills.',
        '',
        'I will help with:',
        '1. Verified job discovery.',
        '2. Fake recruiter detection.',
        '3. Resume and cover letter improvement.',
        '4. Interview and salary negotiation practice.',
        '',
        'Everything sensitive can stay local. If native Gemini is unavailable, this uses CHATR local fallback guidance.',
      ].join('\n'),
      sources: ['CHATR local jobs helper'],
      followUp: ['Check fake recruiter', 'Improve resume summary', 'Practice interview'],
      confidence: 0.78,
      model: 'CHATR local jobs helper',
      provider: 'Browser local fallback',
    };
  }

  private familyHealthResponse(query: string): DeviceGptResult {
    const isUrgent = /emergency|chest pain|breathing|unconscious|stroke|severe/i.test(query);

    return {
      answer: [
        isUrgent
          ? 'This may be urgent. Call local emergency services now and contact a nearby family member.'
          : 'CHATR AI Family Care is ready.',
        '',
        'On-device care plan:',
        '1. Confirm the medicine name, dosage, and time.',
        '2. Send a simple voice reminder or call the family member.',
        '3. If a dose was missed, follow the doctor/pharmacist instructions on the prescription.',
        '4. Escalate to family if reminders are missed repeatedly.',
        '',
        'I can store a local reminder plan and keep sensitive health details on this phone.',
      ].join('\n'),
      sources: ['CHATR local family care'],
      followUp: ['Create medicine reminder', 'Prepare family call script', 'Make doctor question list'],
      confidence: isUrgent ? 0.9 : 0.78,
      model: 'CHATR local family care',
      provider: 'Browser local fallback',
    };
  }

  private lifeAdminResponse(): DeviceGptResult {
    return {
      answer: [
        'CHATR AI Life Assistant can manage this offline.',
        '',
        'Suggested next step:',
        '1. Confirm the bill, recharge, or subscription name.',
        '2. Set a local reminder before the due date.',
        '3. Keep a low-data backup plan if recharge expires soon.',
        '4. If payment links arrive by SMS, run Scam Shield before tapping.',
      ].join('\n'),
      sources: ['CHATR local life assistant'],
      followUp: ['Set reminder', 'Check payment link safety', 'Build low-data plan'],
      confidence: 0.77,
      model: 'CHATR local life assistant',
      provider: 'Browser local fallback',
    };
  }

  private dailyPlanResponse(): DeviceGptResult {
    return {
      answer: [
        'CHATR AI daily operating plan',
        '',
        'Priority order for today:',
        '1. Protect: handle OTP, bank, suspicious caller, and fake recruiter warnings first.',
        '2. Care: check medicine, family callbacks, doctor notes, and missed reminders.',
        '3. Work: convert latest calls into follow-ups, tasks, dates, and clean messages.',
        '4. Money: check recharge, bills, payment links, and unusual spending signals.',
        '5. Jobs: prepare interview answers and verify recruiters before replying.',
        '',
        'I will interrupt only for urgent risk, family care, or time-sensitive tasks. Everything else stays in the quiet timeline.',
        '',
        'This plan was prepared from general CHATR local rules. It does not include calls, reminders, SMS, jobs, or bills unless you provide that data.',
      ].join('\n'),
      sources: ['CHATR local life assistant'],
      followUp: ['Create reminders', 'Prioritize family alerts', 'Prepare interview block'],
      confidence: 0.74,
      model: 'CHATR local life assistant',
      provider: 'Browser local fallback',
    };
  }

  private getModeLine(agent: AgentType): string {
    switch (agent) {
      case 'jobs':
        return 'paste the recruiter message or job offer, and I will score risk, find red flags, and draft a safe reply.';
      case 'health':
        return 'tell me the medicine, person, and timing, and I will create a simple family-safe reminder plan.';
      case 'work':
        return 'paste call notes or meeting points, and I will extract decisions, tasks, dates, and follow-ups.';
      case 'local':
        return 'tell me the service and area, and I will help compare options while keeping private details local.';
      case 'personal':
        return 'say what you want handled, and I will turn it into reminders, checks, or a daily plan.';
      default:
        return 'send me the message, call note, job offer, bill, or family reminder that needs attention.';
    }
  }

  private scoreScamRisk(text: string): { score: number; reasons: string[] } {
    const lower = text.toLowerCase();
    let score = 20;
    const reasons: string[] = [];

    const checks: Array<[RegExp, number, string]> = [
      [/otp|one.time|verification code/i, 25, 'asks about OTP or verification codes'],
      [/bank|account|atm|card|upi|kyc|aadhaar|pan\b/i, 20, 'mentions banking or identity details'],
      [/urgent|immediately|blocked|suspended|expire|final warning/i, 18, 'uses urgency or threat language'],
      [/suspicious|caller blocked|blocked caller|unknown caller|before you replied/i, 20, 'matches suspicious caller behavior'],
      [/password|pin|cvv|share|send|confirm/i, 18, 'asks for private credentials'],
      [/whatsapp|telegram|registration fee|processing fee|security deposit/i, 15, 'contains common fraud-channel or fee signals'],
    ];

    for (const [pattern, points, reason] of checks) {
      if (pattern.test(lower)) {
        score += points;
        reasons.push(reason);
      }
    }

    return {
      score: Math.min(score, 96),
      reasons: reasons.slice(0, 4),
    };
  }

  private getNativeStatus(): BrainRuntimeStatus | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.ChatrNativeRuntime?.getDeviceGPTStatus?.();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<BrainRuntimeStatus>;

      if (!parsed.label || !parsed.model) return null;
      const geminiOnDevice = (parsed as { geminiOnDevice?: boolean }).geminiOnDevice === true ||
        /gemini nano on-device/i.test(parsed.model);

      return {
        mode: parsed.mode || (this.isOffline() ? 'offline' : 'device'),
        label: parsed.label,
        model: parsed.model,
        provider: parsed.provider || (geminiOnDevice ? 'Android Gemini on-device runtime' : 'Android local fallback'),
        isOffline: this.isOffline(),
        isNative: geminiOnDevice,
        privacy: parsed.privacy || 'on_device',
        detail: parsed.detail || 'CHATR AI is available for private offline tasks.',
        capabilities: parsed.capabilities?.length ? parsed.capabilities : CAPABILITIES,
      };
    } catch {
      return null;
    }
  }

  private getLastNativeCallHint(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.ChatrNativeRuntime?.getRecentNativeCalls?.(1);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const first = Array.isArray(parsed) ? parsed[0] : parsed?.events?.[0] || parsed?.calls?.[0];
      if (!first) return null;

      const name = first.name || first.displayName || first.callerName || first.phoneNumber || 'Unknown caller';
      const type = first.type || first.direction || 'call';
      return `${name} (${type})`;
    } catch {
      return null;
    }
  }

  private defaultFollowUp(agent: AgentType): string[] {
    switch (agent) {
      case 'jobs':
        return ['Check recruiter safety', 'Draft safe recruiter reply', 'Practice interview'];
      case 'health':
        return ['Set medicine reminder', 'Prepare family voice note', 'Make doctor question list'];
      case 'work':
        return ['Summarize pasted notes', 'Create follow-up tasks', 'Draft follow-up message'];
      case 'personal':
        return ['Plan from notes', 'Check scam text', 'Create reminder plan'];
      default:
        return ['Check scam text', 'Summarize pasted notes', 'Plan from notes'];
    }
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private isAmbientCheckIn(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;

    return /^(ok|okay|yes|start|help|hi|hello|hey|thanks|thank you|what can you do|status|are you watching|ready)$/i.test(normalized) ||
      this.matches(normalized, ['what can you do', 'how can you help', 'start watching', 'private ai', 'local ai', 'zero cost']);
  }

  private hasRecruiterEvidence(text: string): boolean {
    const lower = text.toLowerCase();
    const wordCount = lower.trim().split(/\s+/).filter(Boolean).length;
    const directEvidenceSignals = [
      /@[\w.-]+\.[a-z]{2,}/i,
      /https?:\/\//i,
      /\b[a-z0-9-]+\.(com|in|org|net|co|io|ai)\b/i,
      /\b\d{10}\b/,
      /whatsapp|telegram|gmail|yahoo|outlook/i,
      /registration fee|processing fee|security deposit|training fee|laptop shipment|document verification|paytm|upi|send money/i,
      /otp|bank|aadhaar|aadhar|pan card|password|account number/i,
    ];
    const recruiterMessageSignals = [
      /salary|ctc|joining date|joining|offer letter|interview process|reporting manager/i,
      /selected|shortlisted|congratulations|dear candidate|walk.?in|urgent hiring/i,
      /send documents|share documents|verification|training bond|appointment letter/i,
    ];
    const directHit = directEvidenceSignals.some((pattern) => pattern.test(lower));
    const messageHits = recruiterMessageSignals.filter((pattern) => pattern.test(lower)).length;
    const requestOnly = /^(check|scan|review|verify|is|can you|tell me)\b/i.test(lower.trim()) && !directHit && messageHits === 0;

    return !requestOnly && (directHit || messageHits >= 2 || (wordCount > 12 && messageHits >= 1));
  }

  private hasActualGeminiRoute(): boolean {
    return this.hasCapacitorNativeRoute() ||
      this.hasNativeGeminiNano() ||
      this.hasBrowserGeminiPromptApi();
  }

  private hasCapacitorNativeRoute(): boolean {
    if (typeof window === 'undefined' || !isOnDeviceAIEnabled()) return false;

    const capacitor = (window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    }).Capacitor;

    try {
      if (typeof capacitor?.isNativePlatform === 'function') {
        return capacitor.isNativePlatform();
      }
      if (typeof capacitor?.getPlatform === 'function') {
        return capacitor.getPlatform() !== 'web';
      }
    } catch {
      return false;
    }

    return false;
  }

  private hasNativeGeminiNano(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof window.ChatrNativeRuntime?.getAICoreStatus === 'function') {
      return window.ChatrNativeRuntime.getAICoreStatus() === 'available';
    }
    return typeof window.ChatrNativeRuntime?.geminiNanoGenerate === 'function';
  }

  private hasBrowserGeminiPromptApi(): boolean {
    if (typeof window === 'undefined') return false;
    const browserWindow = window as unknown as {
      LanguageModel?: { create?: unknown };
      ai?: { languageModel?: { create?: unknown } };
    };

    return typeof browserWindow.LanguageModel?.create === 'function' ||
      typeof browserWindow.ai?.languageModel?.create === 'function';
  }

  private async runBrowserGeminiPrompt(prompt: string, systemPrompt: string): Promise<string | null> {
    const browserWindow = window as unknown as {
      LanguageModel?: {
        availability?: (...args: unknown[]) => Promise<string> | string;
        create?: (options?: Record<string, unknown>) => Promise<{
          prompt?: (input: string) => Promise<unknown>;
          destroy?: () => void;
        }>;
      };
      ai?: {
        languageModel?: {
          capabilities?: () => Promise<{ available?: string }>;
          create?: (options?: Record<string, unknown>) => Promise<{
            prompt?: (input: string) => Promise<unknown>;
            destroy?: () => void;
          }>;
        };
      };
    };

    const languageModel = browserWindow.LanguageModel;
    if (languageModel?.create) {
      const availability = typeof languageModel.availability === 'function'
        ? await Promise.resolve(languageModel.availability()).catch(() => 'unavailable')
        : 'available';

      if (/^(no|unavailable)$/i.test(String(availability))) return null;

      const session = await languageModel.create({ systemPrompt });
      const result = await session.prompt?.(prompt);
      session.destroy?.();
      return this.normalizeGeminiResult(result);
    }

    const legacyLanguageModel = browserWindow.ai?.languageModel;
    if (legacyLanguageModel?.create) {
      const capabilities = await legacyLanguageModel.capabilities?.().catch(() => undefined);
      if (capabilities?.available === 'no') return null;

      const session = await legacyLanguageModel.create({ systemPrompt });
      const result = await session.prompt?.(prompt);
      session.destroy?.();
      return this.normalizeGeminiResult(result);
    }

    return null;
  }

  private normalizeGeminiResult(result: unknown): string | null {
    if (typeof result === 'string') {
      const text = result.trim();
      return text && !this.isBrowserGeminiStub(text) ? text : null;
    }

    if (result && typeof result === 'object' && 'text' in result) {
      const text = (result as { text?: unknown }).text;
      const normalized = typeof text === 'string' ? text.trim() : '';
      return normalized && !this.isBrowserGeminiStub(normalized) ? normalized : null;
    }

    return null;
  }

  private isBrowserGeminiStub(text: string): boolean {
    return /on-device model is not available/i.test(text) ||
      /api is just echoing back the input/i.test(text) ||
      /^user request:/i.test(text);
  }

  private ensureGeminiPrivacyLine(answer: string): string {
    if (/0 cloud uploads|nothing is uploaded|on-device|on device/i.test(answer)) {
      return answer;
    }

    return [
      answer,
      '',
      'Privacy proof: Gemini on-device route handled this privately with 0 cloud uploads.',
    ].join('\n');
  }

  private hasNativeDeviceGpt(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.ChatrNativeRuntime?.deviceGPT === 'function';
  }

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

export const deviceGpt = new DeviceGptService();
