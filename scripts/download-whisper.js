import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelId = 'Xenova/whisper-tiny.en';
const filesToDownload = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'special_tokens_map.json',
  'tokenizer_config.json',
  'tokenizer.json',
  'vocab.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx'
];

const targetDir = path.join(__dirname, '..', 'public', 'models', modelId);

// Ensure directories exist
fs.mkdirSync(path.join(targetDir, 'onnx'), { recursive: true });

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`Skipping (already exists): ${dest}`);
      return resolve();
    }
    console.log(`Downloading: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302) {
        // Handle redirect
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        });
      } else {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading Whisper model for local bundling...');
  for (const file of filesToDownload) {
    const url = `https://huggingface.co/${modelId}/resolve/main/${file}`;
    const dest = path.join(targetDir, file);
    try {
      await downloadFile(url, dest);
    } catch (e) {
      console.error('Failed to download', file, e);
    }
  }
  console.log('Model download complete!');
}

main();
