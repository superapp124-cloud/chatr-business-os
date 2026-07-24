import { useEffect, useRef, useState } from 'react';

type TranscriptionStreamInput = MediaStream | null | undefined | Array<MediaStream | null | undefined>;
type BrowserSpeechRecognitionAlternative = { transcript?: string };
type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
};
type BrowserSpeechRecognitionErrorEvent = { error?: string };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
};

const NATIVE_SPEECH_LANGUAGE = 'en-US';
const WHISPER_CHUNK_SECONDS = 10;
const MIN_SPEECH_RMS = 0.006;
const MIN_SPEECH_PEAK = 0.035;
const MIN_ACTIVE_SAMPLE_RATIO = 0.015;
const ACTIVE_SAMPLE_FLOOR = 0.012;

const COMMON_WHISPER_HALLUCINATIONS = new Set([
  'you',
  'thank you',
  'thanks for watching',
  'thank you for watching',
]);

const cleanTranscriptText = (text: string) => {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/<\|.*?\|>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const shouldKeepTranscript = (text: string, previousText: string | null) => {
  const normalized = text.toLowerCase();
  if (text.length < 2) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (COMMON_WHISPER_HALLUCINATIONS.has(normalized)) return false;
  if (/^(music|applause|silence)$/i.test(normalized)) return false;
  if (previousText && normalized === previousText.toLowerCase()) return false;
  return true;
};

const hasEnoughSpeechEnergy = (audioBuffer: Float32Array) => {
  let sumSquares = 0;
  let peak = 0;
  let activeSamples = 0;

  for (let i = 0; i < audioBuffer.length; i += 1) {
    const value = Math.abs(audioBuffer[i]);
    sumSquares += value * value;
    if (value > peak) peak = value;
    if (value >= ACTIVE_SAMPLE_FLOOR) activeSamples += 1;
  }

  const rms = Math.sqrt(sumSquares / audioBuffer.length);
  const activeRatio = activeSamples / audioBuffer.length;
  return rms >= MIN_SPEECH_RMS && peak >= MIN_SPEECH_PEAK && activeRatio >= MIN_ACTIVE_SAMPLE_RATIO;
};

const getNativeSpeechRecognition = () => {
  const speechWindow = window as SpeechRecognitionWindow;
  const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = NATIVE_SPEECH_LANGUAGE;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
};

export const useCallTranscription = (
  isActive: boolean,
  onResult?: (text: string) => void,
  streamInput?: TranscriptionStreamInput
) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);

  const onResultRef = useRef(onResult);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      setIsListening(false);
      return;
    }

    const providedStreams = (Array.isArray(streamInput) ? streamInput : [streamInput])
      .filter((stream): stream is MediaStream => !!stream && stream.getAudioTracks().length > 0);

    let cleanupAudio: (() => void) | undefined;
    let recognition: BrowserSpeechRecognition | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let fallbackStarted = false;

    function ensureWorker() {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (e) => {
          if (e.data.type === 'progress') {
            if (e.data.data?.status === 'initiate') setDownloadProgress(0);
            if (e.data.data?.progress) setDownloadProgress(Math.round(e.data.data.progress));
            if (e.data.data?.status === 'done' && e.data.data?.file?.includes('decoder')) setDownloadProgress(100);
          }
          else if (e.data.type === 'result' && onResultRef.current && e.data.text?.trim()) {
            const cleanedText = cleanTranscriptText(e.data.text);

            if (shouldKeepTranscript(cleanedText, lastResultRef.current)) {
              lastResultRef.current = cleanedText;
              onResultRef.current(`Call: ${cleanedText}\n`);
            }
            
            setDownloadProgress(null);
          }
          else if (e.data.type === 'error' && onResultRef.current) {
            console.error('[Transcription Hook] Whisper AI Worker Error:', e.data.error);
            setError(`Local transcription failed: ${e.data.error}`);
            setDownloadProgress(null);
          }
        };
      }
    }

    function startWhisper(streams: MediaStream[]) {
      if (cancelled) return undefined;
      console.log('[Transcription Hook] Starting local Whisper fallback transcription. Streams:', streams.length);
      ensureWorker();

      setIsListening(true);
      setError(null);
      setDownloadProgress(0);
      
      try {
        const audioWindow = window as SpeechRecognitionWindow;
        const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
        if (!AudioContextCtor) throw new Error('AudioContext is not available.');
        const audioCtx = new AudioContextCtor({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const chunkSize = Math.floor(audioCtx.sampleRate * WHISPER_CHUNK_SECONDS);

        const mix = audioCtx.createGain();
        mix.gain.value = 1;
        const sources = streams.map((stream) => {
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(mix);
          return source;
        });

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        const silentOutput = audioCtx.createGain();
        silentOutput.gain.value = 0;
        let audioBuffer: Float32Array = new Float32Array(0);

        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const newBuffer = new Float32Array(audioBuffer.length + inputData.length);
          newBuffer.set(audioBuffer);
          newBuffer.set(inputData, audioBuffer.length);
          audioBuffer = newBuffer;

          if (audioBuffer.length < chunkSize) return;

          const chunk = audioBuffer;
          audioBuffer = new Float32Array(0);

          if (!hasEnoughSpeechEnergy(chunk)) return;

          try {
            workerRef.current?.postMessage({ type: 'transcribe', audioData: chunk }, [chunk.buffer]);
          } catch (err) {
            console.error('[Transcription Hook] Failed to post audio to worker:', err);
          }
        };

        mix.connect(processor);
        processor.connect(silentOutput);
        silentOutput.connect(audioCtx.destination);

        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch((err) => {
            console.error('[Transcription Hook] Failed to resume AudioContext:', err);
          });
        }

        return () => {
          processor.disconnect();
          silentOutput.disconnect();
          mix.disconnect();
          sources.forEach((source) => source.disconnect());
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Transcription Hook] Failed to attach local audio processor:', err);
        setError('Failed to attach local audio processor: ' + message);
        setIsListening(false);
        return undefined;
      }
    }

    const startWhisperFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;

      if (recognition) {
        try { recognition.stop(); } catch {
          // The browser may already have stopped this recognizer.
        }
      }

      if (providedStreams.length > 0) {
        cleanupAudio = startWhisper(providedStreams);
        return;
      }

      console.log('[Transcription Hook] No call stream available, requesting microphone for local transcription.');
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone access is not available in this environment.');
        setIsListening(false);
        setDownloadProgress(null);
      } else {
        navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          ownedStreamRef.current = stream;
          cleanupAudio = startWhisper([stream]);
        })
        .catch((err) => {
          console.error('[Transcription Hook] Microphone access denied:', err);
          setError('Microphone access denied: ' + err.message);
          setIsListening(false);
          setDownloadProgress(null);
        });
      }
    };

    const startNativeSpeechRecognition = () => {
      // Electron's built-in speech recognition usually fails silently without API keys.
      // Force Whisper fallback in Electron for reliable transcription.
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        return false;
      }

      recognition = getNativeSpeechRecognition();
      if (!recognition) return false;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setDownloadProgress(null);
      };

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        if (!onResultRef.current) return;

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result.isFinal) continue;

          const cleanedText = cleanTranscriptText(result[0]?.transcript || '');
          if (!shouldKeepTranscript(cleanedText, lastResultRef.current)) continue;

          lastResultRef.current = cleanedText;
          onResultRef.current(`You: ${cleanedText}\n`);
        }
      };

      recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        const speechError = event?.error || 'unknown';
        console.warn('[Transcription Hook] Native speech recognition error:', speechError);

        if (speechError === 'no-speech' || speechError === 'aborted') return;

        setError('Native English speech recognition is unavailable; using local Whisper fallback.');
        startWhisperFallback();
      };

      recognition.onend = () => {
        if (cancelled || fallbackStarted) return;
        restartTimer = setTimeout(() => {
          if (cancelled || fallbackStarted) return;
          try {
            recognition?.start();
          } catch (err) {
            console.warn('[Transcription Hook] Native speech recognition restart failed:', err);
            startWhisperFallback();
          }
        }, 300);
      };

      try {
        recognition.start();
        return true;
      } catch (err) {
        console.warn('[Transcription Hook] Native speech recognition start failed:', err);
        return false;
      }
    };

    if (!startNativeSpeechRecognition()) {
      startWhisperFallback();
    }

    return () => {
      cancelled = true;
      if (restartTimer) clearTimeout(restartTimer);
      if (recognition) {
        try { recognition.stop(); } catch {
          // The browser may already have stopped this recognizer.
        }
      }
      cleanupAudio?.();
      ownedStreamRef.current?.getTracks().forEach((track) => track.stop());
      ownedStreamRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
      setIsListening(false);
    };
  }, [isActive, streamInput]);

  return { isListening, error, downloadProgress };
};
