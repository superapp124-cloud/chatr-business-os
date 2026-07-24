const fs = require('fs');
const https = require('https');
const path = require('path');

const files = [
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd.jsep.mjs',
  'ort-wasm-simd.jsep.wasm',
  'ort-wasm.jsep.mjs',
  'ort-wasm.jsep.wasm',
  'ort-wasm-threaded.jsep.mjs',
  'ort-wasm-threaded.jsep.wasm'
];

const dir = path.join(__dirname, 'public', 'wasm');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

files.forEach(file => {
  const dest = path.join(dir, file);
  https.get(`https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/${file}`, response => {
    const fileStream = fs.createWriteStream(dest);
    response.pipe(fileStream);
    fileStream.on('finish', () => console.log('Downloaded ' + file));
  });
});
