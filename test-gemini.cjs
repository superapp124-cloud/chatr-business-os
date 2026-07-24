const WebSocket = require('ws');
const GEMINI_API_KEY = "AIzaSyAAjZTs9lQmQLZz3s_WIsNwD5qb4DSC_Pk";
const URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

const ws = new WebSocket(URL);

ws.on('open', () => {
  console.log('Connected');
  const setupMessage = {
    setup: {
      model: 'models/gemini-2.5-flash-native-audio-latest',
      systemInstruction: {
        parts: [{
          text: `You are a real-time translator. The user is speaking in Kashmiri. You must translate what they say into Hindi. Speak only the translated text in Hindi with no additional commentary.`
        }]
      },
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede"
            }
          }
        }
      }
    }
  };
  ws.send(JSON.stringify(setupMessage));
});

ws.on('message', (data) => {
  console.log('Message:', data.toString());
  ws.close();
});

ws.on('close', (code, reason) => {
  console.log(`Closed: ${code} - ${reason.toString()}`);
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
