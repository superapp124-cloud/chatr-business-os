export let globalAudioContext: AudioContext | null = null;

export const getGlobalAudioContext = (): AudioContext => {
  if (!globalAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioContext = new AudioContextClass({ sampleRate: 16000 });
  }
  return globalAudioContext;
};
