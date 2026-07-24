import React, { useRef, useEffect } from 'react';

interface AudioWaveformProps {
 stream: MediaStream | null;
 /** Color of the waveform ring. Default: emerald */
 color?: string;
 /** Canvas size in px (square). Default: 160 */
 size?: number;
 className?: string;
}

/**
 * Phase 10 – GPU-accelerated circular audio waveform visualizer.
 * Reads frequency data from the remote/local MediaStream and draws
 * breathing pulse rings that react to voice amplitude in real-time.
 */
export function AudioWaveform({ stream, color = '#10b981', size = 160, className }: AudioWaveformProps) {
 const canvasRef = useRef<HTMLCanvasElement>(null);

 useEffect(() => {
 if (!stream || !canvasRef.current) return;

 const canvas = canvasRef.current;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 let animId: number;
 let audioCtx: AudioContext | null = null;
 let analyser: AnalyserNode | null = null;

 try {
 const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
 audioCtx = new AudioCtor();
 analyser = audioCtx.createAnalyser();
 analyser.fftSize = 64;
 analyser.smoothingTimeConstant = 0.85;

 const source = audioCtx.createMediaStreamSource(stream);
 source.connect(analyser);
 } catch (e) {
 console.warn('[AudioWaveform] AudioContext unavailable:', e);
 return;
 }

 const bufLen = analyser!.frequencyBinCount;
 const data = new Uint8Array(bufLen);
 const cx = size / 2;
 const cy = size / 2;
 const BASE_RADIUS = size * 0.27;
 const MAX_EXTRA = size * 0.18;

 const render = () => {
 animId = requestAnimationFrame(render);
 analyser!.getByteFrequencyData(data);
 const avg = data.reduce((a, b) => a + b, 0) / bufLen;
 const norm = avg / 255; // 0-1

 ctx.clearRect(0, 0, size, size);

 // Outer breathing glow ring
 const radius1 = BASE_RADIUS + norm * MAX_EXTRA;
 const alpha1 = 0.12 + norm * 0.35;
 ctx.beginPath();
 ctx.arc(cx, cy, radius1 + 10, 0, 2 * Math.PI);
 ctx.strokeStyle = color + Math.round(alpha1 * 255).toString(16).padStart(2, '0');
 ctx.lineWidth = 14;
 ctx.stroke();

 // Mid ring
 ctx.beginPath();
 ctx.arc(cx, cy, radius1, 0, 2 * Math.PI);
 ctx.strokeStyle = color + Math.round((alpha1 + 0.25) * 255).toString(16).padStart(2, '0');
 ctx.lineWidth = 4;
 ctx.stroke();

 // Inner solid ring
 ctx.beginPath();
 ctx.arc(cx, cy, BASE_RADIUS * 0.85, 0, 2 * Math.PI);
 ctx.strokeStyle = color;
 ctx.lineWidth = 2.5;
 ctx.globalAlpha = 0.6 + norm * 0.4;
 ctx.stroke();
 ctx.globalAlpha = 1;
 };

 render();

 return () => {
 cancelAnimationFrame(animId);
 analyser?.disconnect();
 audioCtx?.close().catch(() => {});
 };
 }, [stream, color, size]);

 return (
 <canvas
 ref={canvasRef}
 width={size}
 height={size}
 className={className}
 style={{ pointerEvents: 'none' }}
 />
 );
}

export default AudioWaveform;
