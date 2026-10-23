// One-time setup: creates server\.env with a fresh password for Arc, your mobile number, and optional free AI key.
//
//   node setup.js 919876543210
//   node setup.js --show-token
//
// Safe to run twice: an existing .env is never overwritten.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(ROOT, '.env');
const EXAMPLE = path.join(ROOT, '.env.example');

const readToken = () => {
  if (!fs.existsSync(ENV)) return '';
  const text = fs.readFileSync(ENV, 'utf8');
  return (text.match(/^(?:ARC_TOKEN|JARVIS_TOKEN)=(.*)$/m) || [])[1]?.trim() || '';
};

if (process.argv.includes('--show-token')) {
  if (!fs.existsSync(ENV)) {
    console.log('No .env yet. Run: node setup.js <your mobile number>');
    process.exit(1);
  }
  console.log(readToken() || 'ARC_TOKEN is empty in .env');
  process.exit(0);
}

if (fs.existsSync(ENV)) {
  console.log('.env already exists, leaving it as it is.');
  console.log(`Password set: ${readToken() ? 'yes' : 'NO, fill ARC_TOKEN in .env'}`);
  process.exit(0);
}

let number = (process.argv[2] || '').replace(/\D/g, '');
let geminiKey = '';

if (!number) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  number = (await rl.question('Your mobile number with country code, digits only (e.g. 919876543210): ')).replace(/\D/g, '');
  geminiKey = (await rl.question('Free Google Gemini API Key (press Enter to skip & use 100% offline smart mode): ')).trim();
  rl.close();
}

if (number.length < 10 || number.length > 15) {
  console.log(`"${number}" doesn't look right. Use digits with country code (e.g. 919876543210).`);
  process.exit(1);
}

const token = crypto.randomBytes(24).toString('hex');
let env = fs.readFileSync(EXAMPLE, 'utf8')
  .replace(/^ARC_TOKEN=.*$/m, `ARC_TOKEN=${token}`)
  .replace(/^OWNER_NUMBER=.*$/m, `OWNER_NUMBER=${number}`);

if (geminiKey) {
  env = env.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${geminiKey}`);
}

fs.writeFileSync(ENV, env);

console.log('\n==============================================================');
console.log(' Setup Complete! Settings saved in server\\.env');
console.log(` Owner phone: ${number}`);
console.log(` AI Mode: ${geminiKey ? 'Google Gemini (Free API)' : 'Built-in Smart Engine (100% Free Offline)'}`);
console.log(` Arc Security Token: ${token}`);
console.log('==============================================================\n');
