export interface VoiceOptions {
  pitch?: number;
  rate?: number;
}

export interface VoiceProvider {
  speak(text: string, options?: VoiceOptions, onStart?: () => void, onEnd?: () => void): void;
  stop(): void;
}

export class WebSpeechProvider implements VoiceProvider {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;
    // Load voices
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    };
    loadVoices();
    this.synthesis.onvoiceschanged = loadVoices;
  }

  speak(text: string, options?: VoiceOptions, onStart?: () => void, onEnd?: () => void): void {
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.rate = options?.rate ?? 1.0;
    
    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    this.synthesis.speak(utterance);
  }

  stop(): void {
    this.synthesis.cancel();
  }
}

export const voiceRuntime = new WebSpeechProvider();
