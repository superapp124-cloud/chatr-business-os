import fs from 'fs';

let content = fs.readFileSync('src/index.css', 'utf-8');

// The corrupted block is between ".card-enter-6" and "/* Apply subtle global polish" 
// Let's use a regex to replace everything from the first "/* Shield pulse heartbeat" to the end of the file
// with the pristine complete block.

const correctEnding = `/* Shield pulse heartbeat */
@keyframes shield-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92, 34, 255, 0.35); }
  50% { box-shadow: 0 0 0 10px rgba(92, 34, 255, 0); }
}
.shield-pulse {
  animation: shield-pulse 2.6s ease-in-out infinite;
}

/* Ambient float for hero elements */
@keyframes ambient-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}
.ambient-float { animation: ambient-float 4s ease-in-out infinite; }

/* Intelligent card interaction */
.intel-card {
  transition: transform 0.18s cubic-bezier(0.32, 0.72, 0, 1),
              box-shadow 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.intel-card:active { transform: scale(0.98) !important; }

/* Gradient text */
.text-gradient-primary {
  background: linear-gradient(135deg, hsl(262, 83%, 48%), hsl(280, 70%, 58%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* AI blink */
@keyframes ai-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.ai-blink { animation: ai-blink 1.2s ease-in-out infinite; }

/* Premium nav active glow */
.nav-active-glow {
  filter: drop-shadow(0 0 6px rgba(92, 34, 255, 0.5));
}

/* iOS 27 Vision Edition Glass Utilities */
.bg-glass {
  @apply bg-white/70 dark:bg-black/40 backdrop-blur-[40px] saturate-[180%];
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-panel {
  @apply bg-white/70 dark:bg-black/40 backdrop-blur-[40px] saturate-[180%] shadow-xl;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
`;

const replaceRegex = /\/\* Shield pulse heartbeat \*\/[\s\S]*$/;
content = content.replace(replaceRegex, correctEnding);

// Wait, I also need to make sure I add back the button/anchor global polishes that I might accidentally delete.
// Let's check if the button/a polish transition is BEFORE or AFTER Shield pulse heartbeat.
// It is before Shield pulse heartbeat.
// Let's make sure the file is completely fixed.

fs.writeFileSync('src/index.css', content);
console.log('Fixed index.css');
