import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface Recording {
 id: string;
 callId: string;
 url: string;
 duration: number;
 size: number;
 recordedAt: string;
}

interface RecordingOptions {
 participantName?: string;
}

function chooseMimeType(): string {
 const candidates = [
 'audio/webm;codecs=opus',
 'audio/webm',
 'audio/mp4',
 ];

 return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export const useCallRecording = () => {
 const [isRecording, setIsRecording] = useState(false);
 const [recordings, setRecordings] = useState<Recording[]>([]);
 const mediaRecorderRef = useRef<MediaRecorder | null>(null);
 const chunksRef = useRef<Blob[]>([]);
 const startTimeRef = useRef<number>(0);
 const startedAtRef = useRef<string>('');
 const mimeTypeRef = useRef<string>('audio/webm');
 const participantNameRef = useRef<string>('');

 const startRecording = useCallback(async (
 callId: string,
 stream: MediaStream,
 options: RecordingOptions = {}
 ) => {
 try {
 const mimeType = chooseMimeType();
 const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
 mediaRecorderRef.current = mediaRecorder;
 chunksRef.current = [];
 startTimeRef.current = Date.now();
 startedAtRef.current = new Date().toISOString();
 mimeTypeRef.current = mediaRecorder.mimeType || mimeType || 'audio/webm';
 participantNameRef.current = options.participantName || '';

 mediaRecorder.ondataavailable = (event) => {
 if (event.data.size > 0) {
 chunksRef.current.push(event.data);
 }
 };

 mediaRecorder.start(1000);
 setIsRecording(true);
 toast.info('Recording started locally');

 return true;
 } catch (error) {
 console.error('Failed to start recording:', error);
 toast.error('Failed to start local recording');
 return false;
 }
 }, []);

 const stopRecording = useCallback(async (callId: string): Promise<Recording | null> => {
 return new Promise((resolve) => {
 if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
 resolve(null);
 return;
 }

 mediaRecorderRef.current.onstop = async () => {
 const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
 const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });

 try {
 if (!window.electronAPI?.localFiles) {
 throw new Error('Local file bridge is unavailable. Use the CHATR desktop app to save recordings.');
 }

 const buffer = await blob.arrayBuffer();
 const saved = await window.electronAPI.localFiles.saveRecording({
 callId,
 participantName: participantNameRef.current,
 mimeType: blob.type || mimeTypeRef.current,
 data: buffer,
 startedAt: startedAtRef.current,
 durationSeconds: duration,
 });

 if (!saved.ok || !saved.path) {
 throw new Error(saved.error || 'Recording could not be saved.');
 }

 const recording: Recording = {
 id: `${callId}-${startedAtRef.current}`,
 callId,
 url: saved.path,
 duration,
 size: blob.size,
 recordedAt: startedAtRef.current,
 };

 setRecordings((prev) => [...prev, recording]);
 toast.success(`Recording saved to Documents\\CHATR Workspace\\Call Recordings`);
 resolve(recording);
 } catch (error) {
 console.error('Failed to save recording:', error);
 toast.error(error instanceof Error ? error.message : 'Failed to save local recording');
 resolve(null);
 } finally {
 chunksRef.current = [];
 mediaRecorderRef.current = null;
 }
 };

 mediaRecorderRef.current.stop();
 setIsRecording(false);
 });
 }, []);

 const getCallRecordings = useCallback(async (callId?: string): Promise<Recording[]> => {
 return callId ? recordings.filter((recording) => recording.callId === callId) : recordings;
 }, [recordings]);

 const deleteRecording = useCallback(async (recordingId: string): Promise<boolean> => {
 setRecordings((prev) => prev.filter((recording) => recording.id !== recordingId));
 toast.info('Removed recording from this session list. The local file was left in Documents.');
 return true;
 }, []);

 return {
 isRecording,
 recordings,
 startRecording,
 stopRecording,
 getCallRecordings,
 deleteRecording,
 };
};
