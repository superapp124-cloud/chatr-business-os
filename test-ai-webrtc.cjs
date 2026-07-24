const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  console.log('Testing AI Track Swap...');
  const context = await browser.newContext();
  const page1 = await context.newPage();
  
  // We don't actually need to do a full call. We can just run a unit test in the browser console!
  await page1.goto('http://localhost:8080');
  
  await page1.waitForTimeout(2000);
  
  const result = await page1.evaluate(async () => {
    try {
      const pc = new RTCPeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micTrack = stream.getAudioTracks()[0];
      const sender = pc.addTrack(micTrack, stream);
      
      const audioCtx = new AudioContext();
      const destNode = audioCtx.createMediaStreamDestination();
      const aiTrack = destNode.stream.getAudioTracks()[0];
      
      await sender.replaceTrack(aiTrack);
      return "SUCCESS: replaceTrack works on fake media!";
    } catch (e) {
      return "ERROR: " + e.message;
    }
  });
  
  console.log('Browser test result:', result);
  await browser.close();
})();
