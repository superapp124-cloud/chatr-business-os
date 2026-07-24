import { DeviceAdapter } from '../interfaces/DeviceAdapter';

export class AndroidAdapter implements DeviceAdapter {
  async requestPermissions(): Promise<boolean> {
    // TODO: Implement Capacitor Android permissions
    return false;
  }

  async getAudioStream(): Promise<MediaStream | null> {
    // TODO: Implement via Capacitor or standard web depending on webview config
    return null;
  }

  async getVideoStream(): Promise<MediaStream | null> {
    return null;
  }

  async getScreenStream(): Promise<MediaStream | null> {
    return null;
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return [];
  }

  async setAudioOutputDevice(deviceId: string): Promise<void> {
    // TODO
  }
}
