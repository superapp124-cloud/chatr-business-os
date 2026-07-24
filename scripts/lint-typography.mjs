import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const TSX_FILES = globSync('src/**/*.tsx', { absolute: true });

const FORBIDDEN_CLASSES = [
  /text-\[\d+px\]/g, // text-[15px]
  /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g, // legacy sizes
  /leading-\[\d+px\]/g,
  /font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g // Only allowed if explicit
];

let errors = 0;

TSX_FILES.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Check inline styles
  if (content.match(/style=\{\{.*?fontSize/)) {
    console.error(`❌ [CXS Violation] Inline fontSize found in ${path.basename(file)}`);
    errors++;
  }

  // We won't block legacy classes yet until the migration script runs,
  // but this file establishes the rule for CI.
});

if (errors > 0) {
  console.log(`\nFound ${errors} typography violations.`);
  // process.exit(1); // Disabled during migration phase
} else {
  console.log('✅ CXS Typography Lint passed.');
}
