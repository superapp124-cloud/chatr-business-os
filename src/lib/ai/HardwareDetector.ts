export interface HardwareProfile {
  cpuCores: number;
  deviceMemoryGB: number;
  gpuType: 'unknown' | 'integrated' | 'discrete';
  recommendedModelClass: 'small' | 'medium' | 'large';
}

export class HardwareDetector {
  static getProfile(): HardwareProfile {
    // navigator.hardwareConcurrency gives the number of logical cores
    const cpuCores = navigator.hardwareConcurrency || 4;
    
    // navigator.deviceMemory is an experimental API (not in all browsers, but often available in Chromium/Electron)
    // Returns approximate RAM in GB
    const deviceMemoryGB = (navigator as any).deviceMemory || 8;

    // Simple heuristic for model class based on user's feedback:
    // 8 GB RAM -> Small model
    // 16 GB RAM -> 3-7B model (medium)
    // 32 GB+ -> 7-14B model (large)
    
    let recommendedModelClass: 'small' | 'medium' | 'large' = 'small';
    
    if (deviceMemoryGB >= 32) {
      recommendedModelClass = 'large';
    } else if (deviceMemoryGB >= 16) {
      recommendedModelClass = 'medium';
    } else {
      recommendedModelClass = 'small';
    }

    return {
      cpuCores,
      deviceMemoryGB,
      gpuType: 'unknown', // True GPU detection requires WebGL context parsing
      recommendedModelClass
    };
  }

  static getRecommendedLocalModelName(): string {
    const profile = this.getProfile();
    switch(profile.recommendedModelClass) {
      case 'large':
        return 'llama-3-8b-instruct-q4f16_1-mlc';
      case 'medium':
        return 'phi-3-mini-4k-instruct-q4f16_1-mlc';
      case 'small':
      default:
        return 'gemma-2b-it-q4f16_1-mlc';
    }
  }
}
