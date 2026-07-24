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
          text: `You are a real-time translator. Translate to Hindi.`
        }]
      },
      generationConfig: {
        responseModalities: ["AUDIO"],
      }
    }
  };
  ws.send(JSON.stringify(setupMessage));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.setupComplete) {
    console.log('Setup Complete, sending realtimeInput...');
    
    // Send clientContent instead of realtimeInput
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: "Hello, how are you? Please translate this to Hindi." }]
        }],
        turnComplete: true
      }
    }));
  }
  
  if (msg.serverContent) {
    console.log('Received serverContent!');
    if (msg.serverContent.modelTurn) {
      const parts = msg.serverContent.modelTurn.parts;
      console.log('Received modelTurn with parts:', parts.length);
      for (const p of parts) {
        if (p.inlineData) {
          console.log(`Part has inlineData with mimeType: ${p.inlineData.mimeType}, length: ${p.inlineData.data.length}`);
        } else if (p.text) {
          console.log(`Part has text: ${p.text}`);
        } else {
          console.log(`Part has unknown content: ${Object.keys(p)}`);
        }
      }
    }
  }
});

ws.on('error', console.error);
