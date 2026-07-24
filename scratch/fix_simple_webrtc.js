const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'utils', 'simpleWebRTC.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to avoid \r\n vs \n issues
const normalizedContent = content.replace(/\r\n/g, '\n');

const targetStr = `    if (signal.type !== 'signal-ack') {
      const hasStamp = signal.data && typeof signal.data === 'object' && '__chatr' in (signal.data as any);
      if (!hasStamp) {
        const seq = ++this.signalSeqCounter;
        const idempotencyKey = \`\${this.callId}-\${seq}-\${Date.now().toString(36)}\`;
        const enhancedData = {
          ...(signal.data as object || {}),
          __chatr: {
            seq,
            idempotencyKey,
            ackless: true
          }
        };
        finalSignal = {
          ...signal,
          data: enhancedData
        };
      }
    }
      targetId: this.partnerId 
    };
          from_user: this.userId,
          to_user: this.partnerId,
          signal_type: finalSignal.type,
          signal_data: finalSignal.data
        }]);

      if (error) throw error;
      console.log(\`📡 [WebRTC] Signal sent via Realtime: \${finalSignal.type}\`);
    } catch (e) {
      console.error('❌ [WebRTC] Signal send failed:', e);
      this.emit('error', 'Signaling failed. Check connection.');
    }
  }`.replace(/\r\n/g, '\n');

const replacementStr = `    if (signal.type !== 'signal-ack') {
      const hasStamp = signal.data && typeof signal.data === 'object' && '__chatr' in (signal.data as any);
      if (!hasStamp) {
        const seq = ++this.signalSeqCounter;
        const idempotencyKey = \`\${this.callId}-\${seq}-\${Date.now().toString(36)}\`;
        const enhancedData = {
          ...(signal.data as object || {}),
          __chatr: {
            seq,
            idempotencyKey,
            ackless: true
          }
        };
        finalSignal = {
          ...signal,
          data: enhancedData
        };
      }
    }

    try {
      const { error } = await supabase
        .from('webrtc_signals')
        .insert([{
          call_id: this.callId,
          from_user: this.userId,
          to_user: this.partnerId,
          signal_type: finalSignal.type,
          signal_data: finalSignal.data
        }]);

      if (error) throw error;
      console.log(\`📡 [WebRTC] Signal sent via Realtime: \${finalSignal.type}\`);
    } catch (e) {
      console.error('❌ [WebRTC] Signal send failed:', e instanceof Error ? e.message : String(e), JSON.stringify(e));
      this.emit('error', 'Signaling failed. Check connection.');
    }
  }`.replace(/\r\n/g, '\n');

if (normalizedContent.includes(targetStr)) {
  const result = normalizedContent.replace(targetStr, replacementStr);
  // Restore original line endings style if needed
  const finalResult = content.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
  fs.writeFileSync(filePath, finalResult, 'utf8');
  console.log('Successfully fixed simpleWebRTC.ts!');
} else {
  console.log('Target string not found!');
  const lines = normalizedContent.split('\n');
  console.log('Current content around target:');
  console.log(lines.slice(2030, 2080).join('\n'));
}
