type SdpMediaSummary = {
  kind: string;
  direction: string;
  codecs: string[];
};

type SdpSummary = {
  type: string;
  iceUfrag?: string;
  media: SdpMediaSummary[];
};

export type WebRTCDiagnosticsPayload = {
  timestamp: number;
  callId: string;
  pcState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  selectedCandidatePair?: {
    rttMs: number;
    availableOutgoingBitrate?: number;
    localType?: string;
    remoteType?: string;
    localProtocol?: string;
    remoteProtocol?: string;
  };
  inboundVideo?: {
    packetsReceived: number;
    packetsLost: number;
    framesDecoded: number;
    framesDropped: number;
    framesPerSecond?: number;
    jitterMs?: number;
    freezeCount?: number;
    decoder?: string;
    codec?: string;
  };
  outboundVideo?: {
    packetsSent: number;
    framesEncoded: number;
    framesSent?: number;
    targetBitrateKbps?: number;
    encoder?: string;
    codec?: string;
  };
  inboundAudio?: {
    packetsReceived: number;
    packetsLost: number;
    jitterMs?: number;
  };
  outboundAudio?: {
    packetsSent: number;
  };
};

type DiagnosticsOptions = {
  callId: string;
  instanceId: string;
  isVideo: boolean | (() => boolean);
  intervalMs?: number;
  emit?: (event: string, payload: unknown) => void;
};

const PREFIX = '[WebRTCDiagnostics]';

export function summarizeSessionDescription(
  description: RTCSessionDescriptionInit | null | undefined,
): SdpSummary | null {
  if (!description?.sdp) return null;

  const sections = description.sdp.split('\r\nm=');
  const sessionLines = sections[0].split('\r\n');
  const mediaSections = sections.slice(1).map(section => `m=${section}`);
  const iceUfrag = sessionLines.find(line => line.startsWith('a=ice-ufrag:'))?.slice('a=ice-ufrag:'.length);

  return {
    type: description.type || 'unknown',
    iceUfrag,
    media: mediaSections.map(section => {
      const lines = section.split('\r\n');
      const kind = lines[0]?.split(' ')[0]?.replace('m=', '') || 'unknown';
      const direction = lines.find(line =>
        line === 'a=sendrecv' || line === 'a=sendonly' || line === 'a=recvonly' || line === 'a=inactive'
      )?.replace('a=', '') || 'unspecified';
      const rtpmap = lines
        .filter(line => line.startsWith('a=rtpmap:'))
        .map(line => line.replace(/^a=rtpmap:\d+\s*/i, '').split('/')[0])
        .filter(Boolean);
      const codecs = Array.from(new Set(rtpmap));
      return { kind, direction, codecs };
    }),
  };
}

export function logSdpSummary(label: string, description: RTCSessionDescriptionInit | null | undefined): void {
  const summary = summarizeSessionDescription(description);
  if (!summary) {
    console.log(`${PREFIX} ${label}: no SDP`);
    return;
  }

  const media = summary.media
    .map(m => `${m.kind}:${m.direction}:${m.codecs.join('|') || 'no-codecs'}`)
    .join(', ');
  console.log(`${PREFIX} ${label}: type=${summary.type} ice=${summary.iceUfrag || 'n/a'} media=[${media}]`);
}

function getNumber(report: RTCStats, key: string): number {
  const value = (report as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getString(report: RTCStats, key: string): string | undefined {
  const value = (report as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function getCodecMimeType(stats: RTCStatsReport, codecId: string | undefined): string | undefined {
  if (!codecId) return undefined;
  const codec = stats.get(codecId);
  return codec ? getString(codec, 'mimeType') : undefined;
}

function getSelectedPair(
  stats: RTCStatsReport,
): { pair?: RTCStats; local?: RTCStats; remote?: RTCStats } {
  let pair: RTCStats | undefined;

  stats.forEach(report => {
    if (report.type === 'transport') {
      const selectedId = getString(report, 'selectedCandidatePairId');
      if (selectedId) {
        pair = stats.get(selectedId);
      }
    }
  });

  if (!pair) {
    stats.forEach(report => {
      const selected = (report as unknown as Record<string, unknown>).selected === true;
      const nominated = (report as unknown as Record<string, unknown>).nominated === true;
      const state = getString(report, 'state');
      if (report.type === 'candidate-pair' && (selected || (nominated && state === 'succeeded'))) {
        pair = report;
      }
    });
  }

  if (!pair) return {};

  const localId = getString(pair, 'localCandidateId');
  const remoteId = getString(pair, 'remoteCandidateId');
  return {
    pair,
    local: localId ? stats.get(localId) : undefined,
    remote: remoteId ? stats.get(remoteId) : undefined,
  };
}

export function startWebRTCDiagnostics(
  pc: RTCPeerConnection,
  options: DiagnosticsOptions,
): () => void {
  const intervalMs = options.intervalMs ?? 2_000;
  let stopped = false;
  let lastInboundVideoFrames = 0;
  let lastOutboundVideoFrames = 0;
  let lastFrameProgressAt = Date.now();

  const logState = (label: string) => {
    console.log(
      `${PREFIX} ${options.instanceId} ${label}: pc=${pc.connectionState} ice=${pc.iceConnectionState} gather=${pc.iceGatheringState} signaling=${pc.signalingState}`,
    );
  };

  const onIce = () => logState('ice-state');
  const onConnection = () => logState('pc-state');
  const onGathering = () => logState('ice-gathering');

  pc.addEventListener('iceconnectionstatechange', onIce);
  pc.addEventListener('connectionstatechange', onConnection);
  pc.addEventListener('icegatheringstatechange', onGathering);

  const timer = setInterval(async () => {
    if (stopped || pc.connectionState === 'closed') return;

    try {
      const stats = await pc.getStats();
      const selected = getSelectedPair(stats);
      const payload: WebRTCDiagnosticsPayload = {
        timestamp: Date.now(),
        callId: options.callId,
        pcState: pc.connectionState,
        iceState: pc.iceConnectionState,
      };

      if (selected.pair) {
        payload.selectedCandidatePair = {
          rttMs: Math.round(getNumber(selected.pair, 'currentRoundTripTime') * 1000),
          availableOutgoingBitrate: getNumber(selected.pair, 'availableOutgoingBitrate') || undefined,
          localType: selected.local ? getString(selected.local, 'candidateType') : undefined,
          remoteType: selected.remote ? getString(selected.remote, 'candidateType') : undefined,
          localProtocol: selected.local ? getString(selected.local, 'protocol') : undefined,
          remoteProtocol: selected.remote ? getString(selected.remote, 'protocol') : undefined,
        };
      }

      stats.forEach(report => {
        const kind = getString(report, 'kind') || getString(report, 'mediaType');
        if (report.type === 'inbound-rtp' && kind === 'video') {
          payload.inboundVideo = {
            packetsReceived: getNumber(report, 'packetsReceived'),
            packetsLost: getNumber(report, 'packetsLost'),
            framesDecoded: getNumber(report, 'framesDecoded'),
            framesDropped: getNumber(report, 'framesDropped'),
            framesPerSecond: getNumber(report, 'framesPerSecond') || undefined,
            jitterMs: Math.round(getNumber(report, 'jitter') * 1000) || undefined,
            freezeCount: getNumber(report, 'freezeCount') || undefined,
            decoder: getString(report, 'decoderImplementation'),
            codec: getCodecMimeType(stats, getString(report, 'codecId')),
          };
        }

        if (report.type === 'outbound-rtp' && kind === 'video') {
          payload.outboundVideo = {
            packetsSent: getNumber(report, 'packetsSent'),
            framesEncoded: getNumber(report, 'framesEncoded'),
            framesSent: getNumber(report, 'framesSent') || undefined,
            targetBitrateKbps: Math.round(getNumber(report, 'targetBitrate') / 1000) || undefined,
            encoder: getString(report, 'encoderImplementation'),
            codec: getCodecMimeType(stats, getString(report, 'codecId')),
          };
        }

        if (report.type === 'inbound-rtp' && kind === 'audio') {
          payload.inboundAudio = {
            packetsReceived: getNumber(report, 'packetsReceived'),
            packetsLost: getNumber(report, 'packetsLost'),
            jitterMs: Math.round(getNumber(report, 'jitter') * 1000) || undefined,
          };
        }

        if (report.type === 'outbound-rtp' && kind === 'audio') {
          payload.outboundAudio = {
            packetsSent: getNumber(report, 'packetsSent'),
          };
        }
      });

      const inboundFrames = payload.inboundVideo?.framesDecoded ?? 0;
      const outboundFrames = payload.outboundVideo?.framesEncoded ?? 0;
      const inboundAudioPackets = payload.inboundAudio?.packetsReceived ?? 0;
      const outboundAudioPackets = payload.outboundAudio?.packetsSent ?? 0;
      const inboundDelta = inboundFrames - lastInboundVideoFrames;
      const outboundDelta = outboundFrames - lastOutboundVideoFrames;
      lastInboundVideoFrames = inboundFrames;
      lastOutboundVideoFrames = outboundFrames;

      if (inboundDelta > 0) {
        lastFrameProgressAt = Date.now();
      }

      const selectedPair = payload.selectedCandidatePair;
      console.log(
        `${PREFIX} ${options.instanceId} stats: rtt=${selectedPair?.rttMs ?? 0}ms pair=${selectedPair?.localType || '?'}->${selectedPair?.remoteType || '?'} ` +
          `inV=${inboundFrames}(+${inboundDelta}) outV=${outboundFrames}(+${outboundDelta}) ` +
          `inA=${inboundAudioPackets} outA=${outboundAudioPackets} ` +
          `lossV=${payload.inboundVideo?.packetsLost ?? 0} fps=${payload.inboundVideo?.framesPerSecond ?? 0} ` +
          `inCodec=${payload.inboundVideo?.codec || 'n/a'} outCodec=${payload.outboundVideo?.codec || 'n/a'} ` +
          `decoder=${payload.inboundVideo?.decoder || 'n/a'} encoder=${payload.outboundVideo?.encoder || 'n/a'}`,
      );

      options.emit?.('diagnostics', payload);

      const isVideoCall = typeof options.isVideo === 'function' ? options.isVideo() : options.isVideo;
      if (isVideoCall) {
        options.emit?.('mediaHealth', {
          kind: 'video',
          receivingFrames: inboundDelta > 0,
          framesDecoded: inboundFrames,
          framesDelta: inboundDelta,
          staleMs: Date.now() - lastFrameProgressAt,
          outboundFramesEncoded: outboundFrames,
          outboundFramesDelta: outboundDelta,
          selectedCandidatePair: selectedPair,
        });
      }
    } catch (error) {
      console.warn(`${PREFIX} ${options.instanceId} stats unavailable`, error);
    }
  }, intervalMs);

  logState('attached');

  return () => {
    stopped = true;
    clearInterval(timer);
    pc.removeEventListener('iceconnectionstatechange', onIce);
    pc.removeEventListener('connectionstatechange', onConnection);
    pc.removeEventListener('icegatheringstatechange', onGathering);
    console.log(`${PREFIX} ${options.instanceId} detached`);
  };
}
