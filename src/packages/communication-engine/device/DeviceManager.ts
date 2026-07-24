import { DeviceAdapter } from '../interfaces/DeviceAdapter';

export class DeviceManager {
  private adapter: DeviceAdapter;

  constructor(adapter: DeviceAdapter) {
    this.adapter = adapter;
  }

  public async initialize(): Promise<boolean> {
    return await this.adapter.requestPermissions();
  }

  public async getAudioStream(): Promise<MediaStream | null> {
    return await this.adapter.getAudioStream();
  }

  public async getVideoStream(): Promise<MediaStream | null> {
    return await this.adapter.getVideoStream();
  }

  // Future unified methods for device control
}
