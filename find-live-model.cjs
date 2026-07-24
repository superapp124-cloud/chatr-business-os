const https = require('https');

https.get('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAAjZTs9lQmQLZz3s_WIsNwD5qb4DSC_Pk', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const liveModels = json.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent'));
      console.log('Live Models:', JSON.stringify(liveModels.map(m => m.name), null, 2));
    } catch (e) {
      console.error(e);
      console.log(data);
    }
  });
});
