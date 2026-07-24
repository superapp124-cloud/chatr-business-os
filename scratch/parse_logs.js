const fs = require('fs');
const path = require('path');

// Read overview.txt
const overviewPath = 'C:\\Users\\Arshid.Wani\\.gemini\\antigravity\\brain\\5cf48059-4668-43e8-a5d0-4dd4d6d5867d\\.system_generated\\logs\\overview.txt';
if (!fs.existsSync(overviewPath)) {
  console.error('overview.txt not found');
  process.exit(1);
}

const content = fs.readFileSync(overviewPath, 'utf8');
const lines = content.split('\n');

// Find the step 235 (or step_index: 692 or similar) user input
let logcatText = '';
for (const line of lines) {
  if (line.includes('"step_index":692') || line.includes('"step_index":235')) {
    try {
      const data = JSON.parse(line);
      logcatText = data.content || '';
    } catch (e) {
      console.error('Failed to parse line:', e);
    }
    break;
  }
}

if (!logcatText) {
  console.log('Could not find logcat in overview.txt');
  process.exit(1);
}

// Split the logcat by line and look for interesting entries
const logLines = logcatText.split('\\n');
console.log(`Total log lines: ${logLines.length}`);

const warningsAndErrors = [];
const timingLogs = [];
const webrtcLogs = [];

for (const line of logLines) {
  const lineLower = line.toLowerCase();
  
  // Capture timeline
  if (line.includes('IncomingCallActivity') || line.includes('ChatrConnection') || line.includes('Capacitor') || line.includes('React mount') || line.includes('reported ready') || line.includes('nativeCallAction')) {
    timingLogs.push(line);
  }
  
  // Capture WebRTC specific logs
  if (lineLower.includes('webrtc') || lineLower.includes('ice') || lineLower.includes('peerconnection') || lineLower.includes('sdp') || lineLower.includes('turn') || lineLower.includes('stun')) {
    webrtcLogs.push(line);
  }
  
  // Capture errors or warnings
  if (line.includes(' E ') || line.includes(' W ') || lineLower.includes('fail') || lineLower.includes('error') || lineLower.includes('warn') || lineLower.includes('exception')) {
    // Exclude hidden method access warnings to keep it clean
    if (!line.includes('Accessing hidden method') && !line.includes('Accessing hidden field')) {
      warningsAndErrors.push(line);
    }
  }
}

console.log('\n--- TIMING LOGS ---');
timingLogs.slice(0, 100).forEach(l => console.log(l));

console.log('\n--- WEBRTC LOGS ---');
webrtcLogs.slice(0, 100).forEach(l => console.log(l));

console.log('\n--- WARNINGS & ERRORS ---');
warningsAndErrors.slice(0, 100).forEach(l => console.log(l));
