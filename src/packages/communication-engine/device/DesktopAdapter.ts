import { DeviceAdapter } from '../interfaces/DeviceAdapter';
import { EventBus, CommunicationEvent } from '../core/EventBus';

export class DesktopAdapter implements DeviceAdapter {
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Stop tracks immediately, we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (e) {
      console.warn("DesktopAdapter: Permission denied", e);
      return false;
    }
  }

  async getAudioStream(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream, type: 'audio' });
      return stream;
    } catch (e) {
      console.error("DesktopAdapter: Failed to get audio", e);
      return null;
    }
  }

  async getVideoStream(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream, type: 'video' });
      return stream;
    } catch (e) {
      console.error("DesktopAdapter: Failed to get video", e);
      return null;
    }
  }

  async getScreenStream(): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (e) {
      return null;
    }
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return await navigator.mediaDevices.enumerateDevices();
  }

  async setAudioOutputDevice(deviceId: string): Promise<void> {
    // Requires sinkId API (supported in Chromium browsers)
    console.warn("setAudioOutputDevice called with", deviceId);
  }
}
