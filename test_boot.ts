import { kernel } from './src/core/runtime/Kernel';

kernel.boot()
  .then(() => console.log('BOOT SUCCESS'))
  .catch(err => {
    console.error('BOOT FAILED:');
    console.error(err);
  });
