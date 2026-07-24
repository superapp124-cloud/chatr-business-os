const http = require('http');

const KERNEL_URL = 'http://127.0.0.1:8087';
const CONCURRENCY = 50;
const DURATION_MS = 30000;

console.log(`Starting Kernel Stress Test (${CONCURRENCY} concurrent requests)...`);

let stats = {
  started: 0,
  completed: 0,
  failed: 0,
  tokens: 0,
  totalLatency: 0
};

async function streamRequest(id) {
  return new Promise((resolve) => {
    const req = http.request(`${KERNEL_URL}/conversation/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let tokens = 0;
      let startMs = Date.now();
      
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                tokens++;
                stats.tokens++;
              }
            } catch (e) {}
          }
        }
      });
      
      res.on('end', () => {
        stats.completed++;
        stats.totalLatency += (Date.now() - startMs);
        resolve();
      });
    });

    req.on('error', (err) => {
      stats.failed++;
      resolve();
    });

    req.write(JSON.stringify({
      conversationId: `stress-${id}`,
      message: 'Hello, testing the kernel stream.',
      userId: 'tester'
    }));
    req.end();
  });
}

async function run() {
  const startTime = Date.now();
  let promises = [];
  
  for (let i = 0; i < CONCURRENCY; i++) {
    stats.started++;
    promises.push(streamRequest(i));
  }
  
  await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  console.log('\n--- Test Complete ---');
  console.log(`Time: ${totalTime}ms`);
  console.log(`Started: ${stats.started}`);
  console.log(`Completed: ${stats.completed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Tokens streamed: ${stats.tokens}`);
  if (stats.completed > 0) {
    console.log(`Avg Latency: ${Math.round(stats.totalLatency / stats.completed)}ms`);
  }
}

run();
