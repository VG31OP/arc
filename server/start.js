// Starts Arc: laptop action server plus Cloudflare tunnel in one window.
// Provides both local and mobile phone web voice calling — 100% free with zero telecom fees.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SAVED = path.join(ROOT, 'tunnel-url.txt');
const env = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
const PORT = Number((env.match(/^PORT=(\d+)/m) || [])[1] || 3710);

if (!env.match(/^(?:ARC_TOKEN|JARVIS_TOKEN)=\S+/m)) {
  console.log('Settings are missing. Run this first:  node setup.js <your mobile number>');
  process.exit(1);
}
if (spawnSync('cloudflared', ['--version']).status !== 0) {
  console.log('cloudflared is not installed. Install it once with:');
  console.log('  winget install --id Cloudflare.cloudflared');
  console.log('then close this window and start Arc again.');
  process.exit(1);
}

const children = [];
const stopAll = () => { for (const c of children) { try { c.kill(); } catch {} } process.exit(0); };
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

let server;
let restarting = false;
const startServer = () => {
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'inherit' });
  children.push(server);
  server.on('exit', (code) => {
    if (restarting) { restarting = false; startServer(); return; }
    console.log(`\nThe Arc server stopped (code ${code}). If port is in use, close any other running Arc window.`);
    stopAll();
  });
};
startServer();

// Auto-restart server on settings or code change
const read = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '');
const last = { '.env': env, 'server.js': read('server.js'), 'ai.js': read('ai.js') };
for (const f of Object.keys(last)) {
  fs.watchFile(path.join(ROOT, f), { interval: 1000 }, () => {
    const now = read(f);
    if (now === last[f]) return;
    last[f] = now;
    console.log(`\n${f} changed, restarting Arc server...`);
    restarting = true;
    server.kill();
  });
}

const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], { cwd: ROOT });
children.push(tunnel);
let found = false;
const watch = (chunk) => {
  const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || found) return;
  found = true;
  const baseUrl = m[0];
  const toolUrl = `${baseUrl}/action`;
  fs.writeFileSync(SAVED, `${toolUrl}\n`);
  spawnSync('clip', [], { input: baseUrl });

  console.log('\n==============================================================');
  console.log(' ⚡ ARC IS READY (100% FREE VERSION)');
  console.log('--------------------------------------------------------------');
  console.log(' 💻 Laptop Dashboard:');
  console.log('    http://localhost:' + PORT);
  console.log('');
  console.log(' 📱 Mobile Phone Voice Call (Open on your phone browser):');
  console.log('    ' + baseUrl);
  console.log('    (Copied to clipboard! Just paste into your phone or browser)');
  console.log('--------------------------------------------------------------');
  console.log(' 🎤 To Talk: Click "Call Arc" on the dashboard and speak!');
  console.log(' 🔒 Keep this window open. Close it to switch Arc off.');
  console.log('==============================================================\n');
};
tunnel.stdout.on('data', watch);
tunnel.stderr.on('data', watch);
tunnel.on('exit', (code) => {
  console.log(`\nThe Cloudflare tunnel stopped (code ${code}). Start Arc again to get a new address.`);
  stopAll();
});
setTimeout(() => {
  if (!found) console.log('Still waiting for tunnel address... check internet connection.');
}, 30_000);
