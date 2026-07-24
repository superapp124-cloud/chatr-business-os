import { pipeline, env } from '@huggingface/transformers';

console.log('[Whisper Worker] Worker script loaded and initializing...');

type ProgressEventPayload = Record<string, unknown>;
type WhisperTranscriber = (
    audioData: Float32Array,
    options: {
        chunk_length_s: number;
        return_timestamps: boolean;
        task: 'transcribe';
        language: 'english';
    }
) => Promise<{ text: string }>;

// Configure transformers for offline bundled usage
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;

const isPackagedWorker =
    self.location.protocol === 'file:' ||
    self.location.pathname.includes('/assets/');

// Dev workers are served from /src/workers; packaged workers live in /assets.
// Keep both paths local so Whisper never reaches out to Hugging Face/CDNs.
const publicAssetBase = isPackagedWorker ? '../' : '/';
env.localModelPath = new URL(`${publicAssetBase}models/`, self.location.href).href;
env.backends.onnx.wasm.wasmPaths = new URL(`${publicAssetBase}wasm/`, self.location.href).href;

console.log('[Whisper Worker] Env config:', { 
    localModelPath: env.localModelPath, 
    allowLocalModels: env.allowLocalModels, 
    allowRemoteModels: env.allowRemoteModels 
});

class PipelineSingleton {
    static task = 'automatic-speech-recognition' as const;
    static model = 'Xenova/whisper-tiny.en';
    static instancePromise: Promise<WhisperTranscriber> | null = null;
    static failed: boolean = false;

    static async getInstance(progress_callback: (progress: ProgressEventPayload) => void) {
        if (this.failed) {
            throw new Error('Pipeline creation previously failed. Not retrying to avoid spam.');
        }
        if (this.instancePromise === null) {
            console.log(`[Whisper Worker] Starting model pipeline creation for ${this.model}...`);
            this.instancePromise = pipeline(this.task, this.model, { progress_callback })
                .then((instance) => {
                    console.log(`[Whisper Worker] Model pipeline created successfully.`);
                    return instance as WhisperTranscriber;
                })
                .catch((err: unknown) => {
                    this.failed = true;
                    console.error('[Whisper Worker] FATAL ERROR creating pipeline:', err);
                    throw err;
                });
        }
        return this.instancePromise;
    }
}

let isTranscribing = false;
const audioQueue: Float32Array[] = [];
const MAX_QUEUE_SIZE = 6;

async function transcribeAudio(audioData: Float32Array) {
    console.log(`[Whisper Worker] Received transcribe command with ${audioData?.length} audio samples`);
    try {
        const transcriber = await PipelineSingleton.getInstance((x) => {
            console.log('[Whisper Worker] Model download progress:', x);
            self.postMessage({ type: 'progress', data: x });
        });

        console.log('[Whisper Worker] Running transcription on audio chunk...');
        const result = await transcriber(audioData, {
            chunk_length_s: 0,
            return_timestamps: false,
            task: 'transcribe',
            language: 'english'
        });

        console.log('[Whisper Worker] Transcription result:', result.text);
        self.postMessage({
            type: 'result',
            text: result.text
        });
    } catch (error: unknown) {
        console.error('[Whisper Worker] Error during transcription flow:', error);
        self.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

async function drainQueue() {
    if (isTranscribing || audioQueue.length === 0) return;
    isTranscribing = true;
    const audioData = audioQueue.shift()!;
    await transcribeAudio(audioData);
    isTranscribing = false;
    if (audioQueue.length > 0) drainQueue();
}

self.addEventListener('message', async (event) => {
    const { type, audioData } = event.data;

    if (type === 'transcribe') {
        audioQueue.push(audioData);
        while (audioQueue.length > MAX_QUEUE_SIZE) audioQueue.shift();
        drainQueue();
    }
});
