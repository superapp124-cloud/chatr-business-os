import { useEffect, useState } from 'react';

const LOCAL_AUDIO_TRANSLATION_UNAVAILABLE =
  'Local-only live translation is not available yet. Cloud audio AI is disabled for privacy.';

export const useAudioInterceptor = (
  isEnabled: boolean,
  localStream: MediaStream | null,
  fromLanguage: string = 'Kashmiri',
  toLanguage: string = 'Hindi'
) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setError(null);
      return;
    }

    if (!localStream) {
      setError('Microphone stream is not ready for local translation.');
      return;
    }

    console.info(
      `[AI Audio] ${fromLanguage} to ${toLanguage} translation blocked: cloud audio AI is disabled.`
    );
    setError(LOCAL_AUDIO_TRANSLATION_UNAVAILABLE);
  }, [fromLanguage, isEnabled, localStream, toLanguage]);

  return {
    processedStream: null as MediaStream | null,
    isConnected: false,
    isReady: false,
    error,
  };
};
