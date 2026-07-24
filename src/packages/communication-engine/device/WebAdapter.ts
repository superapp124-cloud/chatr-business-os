import { DeviceAdapter } from '../interfaces/DeviceAdapter';

export class WebAdapter implements DeviceAdapter {
  async requestPermissions(): Promise<boolean> {
    // TODO: Standard web implementation
    return false;
  }

  async getAudioStream(): Promise<MediaStream | null> {
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
