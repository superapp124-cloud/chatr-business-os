const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultPort = process.env.CAP_LIVE_PORT || '8080';

function getLanIpv4() {
  const preferredMatchers = [/wi-?fi/i, /wlan/i, /ethernet/i];
  const fallback = [];

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

      const candidate = { name, address: entry.address };
      if (preferredMatchers.some((matcher) => matcher.test(name))) {
        return candidate;
      }

      fallback.push(candidate);
    }
  }

  return fallback[0] || null;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  const network = getLanIpv4();
  if (!network) {
    console.error('Could not detect a LAN IPv4 address. Connect this computer to Wi-Fi and try again.');
    process.exit(1);
  }

  const liveHost = `${network.address}:${defaultPort}`;
  const liveUrl = `http://${liveHost}`;
  const env = {
    ...process.env,
    CAP_SERVER_SCHEME: 'http',
    CAP_SERVER_HOST: liveHost,
  };

  console.log(`Preparing Android live reload for ${liveUrl}`);
  console.log('Copying Capacitor config into the Android project...');
  await run('npx', ['cap', 'copy', 'android'], { env });

  console.log('');
  console.log(`Starting Vite on ${liveUrl}`);
  console.log('Keep this process running while you test on the phone.');
  console.log('');
  console.log('One-time install step if the app is not already pointed at live reload:');
  console.log(`  1. Set CAP_SERVER_HOST=${liveHost}`);
  console.log('  2. Build/install the Android app once');
  console.log('  3. After that, web edits will appear in the app automatically');
  console.log('');

  await run('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', defaultPort], { env });
}

main().catch((error) => {
  console.error('');
  console.error(error.message);
  process.exit(1);
});
