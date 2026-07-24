export interface DeviceAdapter {
  requestPermissions(): Promise<boolean>;
  getAudioStream(): Promise<MediaStream | null>;
  getVideoStream(): Promise<MediaStream | null>;
  getScreenStream(): Promise<MediaStream | null>;
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  setAudioOutputDevice(deviceId: string): Promise<void>;
}
