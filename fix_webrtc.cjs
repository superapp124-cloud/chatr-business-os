const fs = require('fs');

const correctCode = `      if (!releaseFirst) {
        videoTrack.stop();
      }

      if (this.isAndroidRuntime()) {
        this.forceVP8Codec();
      }
      
      // Update state with actual detected facing
      this.currentFacingMode = actualFacing;
      
      // Force re-emit localStream to update UI (with mirror info)
      if (this.localStream) {
        const freshStream = new MediaStream(this.localStream.getTracks());
        this.localStream = freshStream;
        this.emit('localStream', this.localStream);
      }
      // Emit facing mode change so UI can update mirror
      this.emit('facingModeChanged', actualFacing);

      console.log('✅ [WebRTC] Camera switched to ' + actualFacing);
      return actualFacing;
    } catch (e: unknown) {
      if (releaseFirst) {
        try {
          console.warn('⚠️ [WebRTC] Camera switch failed, attempting to restore previous camera...');
          const recovery = await acquireCameraTrack(previousFacing, null);
          if (recovery) {
            await this.replaceTrack(recovery.track);
            if (this.localStream) {
              const freshStream = new MediaStream(this.localStream.getTracks());
              this.localStream = freshStream;
              this.emit('localStream', this.localStream);
            }
            this.emit('facingModeChanged', previousFacing);
            console.log('✅ [WebRTC] Restored previous camera after failed switch');
          }
        } catch (recoveryError) {
          console.error('❌ [WebRTC] Failed to restore previous camera:', recoveryError);
        }
      }
      console.error('❌ [WebRTC] Switch camera failed completely:', e);
      return this.currentFacingMode;
    } finally {
      this.isSwitchingCamera = false;
    }
  }

  async replaceTrack(newTrack: MediaStreamTrack): Promise<void> {
    const sender = this.pc?.getSenders().find(s => s.track?.kind === newTrack.kind);
    if (!sender) {
      throw new Error("No RTP sender found for " + newTrack.kind + " track");
    }

    await sender.replaceTrack(newTrack);
    
    // Update local stream
    if (this.localStream) {
      const oldTrack = this.localStream.getTracks().find(t => t.kind === newTrack.kind);
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
    }
  }

  applyZoom(scale: number) {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const capabilities = videoTrack.getCapabilities?.() as ZoomCapabilities | undefined;
      if (capabilities?.zoom) {
        const constraints: MediaTrackConstraints = { advanced: [{ zoom: scale } as ZoomConstraint] };
        videoTrack.applyConstraints(constraints);
      }
    } catch (e) {
      console.warn('Zoom not supported on this device');
    }
  }

  /**
   * Get peer connection for external access (e.g., ultra-low bandwidth hooks)
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  async end() {
    console.log('👋 [WebRTC] Ending call...');
    this.callState = 'ended';
    this.clearConnectionTimeout();
    
    // Security Governance: Log call end
    securityService.logEvent({
      eventType: 'call_end',
      severity: 'info',
      metadata: { callId: this.callId, duration: 'unknown' }
    });

    // Remove from active instances
    activeCallInstances.delete(this.callId);
    
    await this.cleanup();
    this.emit('ended');
  }

  private async cleanup() {
    // Stop local tracks
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;

    // Cleanup signaling manager
    if (this.signalingManager) {
      await this.signalingManager.close();
      this.signalingManager = null;
    }

    // Cleanup insertable streams
    if (this.insertableStreams) {
      this.insertableStreams.destroy();
      this.insertableStreams = null;
    }

    // Cleanup ICE refresh
    if (this.iceRefreshInterval) {
      clearInterval(this.iceRefreshInterval);
      this.iceRefreshInterval = null;
    }

    // Cleanup adaptive bitrate engine`;

const path = 'src/utils/simpleWebRTC.ts';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('      if (!releaseFirst) {');
const endIdx = content.lastIndexOf('    // Cleanup adaptive bitrate engine');

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + correctCode + content.substring(endIdx + '    // Cleanup adaptive bitrate engine'.length);
  fs.writeFileSync(path, content);
  console.log('Fixed successfully');
} else {
  console.log('Could not find markers', startIdx, endIdx);
}
