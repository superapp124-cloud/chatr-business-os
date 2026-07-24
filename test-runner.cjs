const { app } = require('electron');
const { CertificationRunner } = require('./electron/chatr-core/certifications/certification-runner.cjs');

app.whenReady().then(async () => {
  try {
    const runner = new CertificationRunner();
    const results = await runner.runAll();
    console.log(JSON.stringify(results, null, 2));
    app.quit();
  } catch (e) {
    console.error(e);
    app.exit(1);
  }
});
