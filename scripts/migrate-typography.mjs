import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// Run specifically on the target files passed as arguments, or all if none
const targetPatterns = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['src/**/*.tsx'];
const files = [...new Set(targetPatterns.flatMap(pattern => globSync(pattern, { absolute: true })))];

console.log(`Analyzing ${files.length} files for typography migration...`);

let replacedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // 1. Context-aware mapping using Regex heuristics
  // Buttons
  content = content.replace(/(<button[^>]*className=["'][^"']*)text-(xs|sm|base)([^"']*["'])/g, '$1text-button$3');
  // Navs
  content = content.replace(/(<nav[^>]*className=["'][^"']*)text-(xs|sm|base)([^"']*["'])/g, '$1text-nav$3');
  // Tables
  content = content.replace(/(<t[hd][^>]*className=["'][^"']*)text-(xs|sm|base)([^"']*["'])/g, '$1text-table$3');
  // Inputs
  content = content.replace(/(<input[^>]*className=["'][^"']*)text-(xs|sm|base)([^"']*["'])/g, '$1text-input$3');

  // 2. Fallback semantic mapping for remaining generic classes
  content = content.replace(/\btext-xs\b/g, 'text-label');
  content = content.replace(/\btext-sm\b/g, 'text-secondary');
  content = content.replace(/\btext-base\b/g, 'text-body');
  content = content.replace(/\btext-lg\b/g, 'text-section');
  content = content.replace(/\btext-xl\b/g, 'text-workspace');
  content = content.replace(/\btext-2xl\b/g, 'text-page');
  content = content.replace(/\btext-3xl\b/g, 'text-display');
  content = content.replace(/\btext-4xl\b/g, 'text-display');
  content = content.replace(/\btext-5xl\b/g, 'text-display');
  
  // 3. Strip redundant weights & line-heights now covered natively by the CXS tokens
  // CXS tokens provide font-medium, font-semibold, font-bold natively depending on the token.
  // We remove these if they co-occur with a CXS token, assuming the token handles it. 
  // (Intentional deviations will be manually fixed in QA).
  const cxsTokens = 'text-(display|page|workspace|section|card|button|input|table|nav|metric|body|secondary|label|caption|tiny)';
  
  // Strip leading-* if next to a CXS token
  const leadingRegex = new RegExp(`(${cxsTokens}[^"']*)leading-(tight|snug|relaxed|normal|none)\\b`, 'g');
  content = content.replace(leadingRegex, '$1');
  
  // Strip font-* if next to a CXS token (specifically stripping default token weights)
  // Display/Metric: 700 (bold), Page/Workspace/Section/Card: 600 (semibold)
  const semiboldRegex = new RegExp(`(text-(page|workspace|section|card)[^"']*)font-semibold\\b`, 'g');
  content = content.replace(semiboldRegex, '$1');

  const boldRegex = new RegExp(`(text-(display|metric)[^"']*)font-bold\\b`, 'g');
  content = content.replace(boldRegex, '$1');
  
  const mediumRegex = new RegExp(`(text-(button|nav|label|tiny)[^"']*)font-medium\\b`, 'g');
  content = content.replace(mediumRegex, '$1');

  const regularRegex = new RegExp(`(text-(input|table|body|secondary|caption)[^"']*)font-normal\\b`, 'g');
  content = content.replace(regularRegex, '$1');

  // Clean up double spaces created by stripping
  content = content.replace(/ +/g, ' ');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    replacedCount++;
  }
});

console.log(`✅ Migration complete. Updated ${replacedCount} files.`);
