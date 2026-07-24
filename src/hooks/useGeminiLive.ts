import { useCallback, useState } from 'react';

export interface UseGeminiLiveOptions {
  fromLanguage: string;
  toLanguage: string;
  onAudioData: (pcmBase64: string) => void;
  onTextData?: (text: string) => void;
}

const DISABLED_MESSAGE =
  'Cloud live audio AI is disabled. Use a local Ollama audio bridge before enabling live translation.';

export const useGeminiLive = (_options: UseGeminiLiveOptions) => {
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    setError(DISABLED_MESSAGE);
  }, []);

  const disconnect = useCallback(() => {
    setError(null);
  }, []);

  const sendAudioChunk = useCallback((_base64PCM: string) => {
    setError(DISABLED_MESSAGE);
  }, []);

  return {
    isConnected: false,
    isReady: false,
    error,
    connect,
    disconnect,
    sendAudioChunk,
  };
};
