// Arc: laptop action server with Free Voice Calling & AI Brain (Gemini / Groq / Offline).
// Only a fixed allowlist of actions exists. No shell input from the caller ever reaches a command line.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFiles, describe, buildIndex } from './files.js';
import { createMonitor } from './monitor.js';
import { createClassroom } from './classroom.js';
import { processUserMessage, getAiStatus } from './ai.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
for (const line of (fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const PORT = Number(process.env.PORT || 3710);
const TOKEN = process.env.ARC_TOKEN || process.env.JARVIS_TOKEN || '';
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const ALLOW_NO_CALLER = String(process.env.ALLOW_NO_CALLER || 'true') === 'true';
const OWNER_CALLER_ID = (process.env.OWNER_CALLER_ID || '').trim().toLowerCase();
const OWNER_HASHES = new Set(OWNER ? (() => {
  const ten = OWNER.slice(-10);
  const forms = [OWNER, `+${OWNER}`, ten, `0${ten}`, `+91${ten}`, `91${ten}`, `+91 ${ten}`];
  return forms.flatMap((f) => ['sha256', 'sha1', 'md5'].map((a) => crypto.createHash(a).update(f).digest('hex')));
})() : []);
let lastCaller = '';
const NOTES = path.join(os.homedir(), 'Documents', 'Arc Notes.md');

const activity = []; // newest first, shown on the live page
const recent = new Map(); // "action|input" -> { at, result promise }, for burst de-duplication
const DEDUPE_MS = 10_000;
function record(entry) {
  activity.unshift({ at: new Date().toLocaleTimeString('en-IN'), ...entry });
  activity.length = Math.min(activity.length, 50);
  console.log(`[${activity[0].at}]`, entry.action, JSON.stringify(entry.input || ''), '->', entry.result);
}

// ---------- safe launchers ----------
const run = (file, args) => new Promise((resolve) => {
  const p = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true });
  p.on('error', () => resolve(false));
  p.unref();
  setTimeout(() => resolve(true), 150);
});
const openUrl = (url) => run('explorer.exe', [url]);
const ps = (cmd) => new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true, timeout: 8000 }, (e, out) => resolve(e ? '' : String(out).trim())));
const psEnv = (script, vars = {}, { detached = false } = {}) => new Promise((resolve) => {
  const env = { ...process.env, ...vars };
  if (detached) {
    const p = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], { detached: true, stdio: 'ignore', windowsHide: true, env });
    p.on('error', () => resolve(false)); p.unref(); return setTimeout(() => resolve(true), 150);
  }
  execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15000, env }, (e) => resolve(!e));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPEAK = 'Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=0; $s.Speak($env:ARC_TEXT)';
const KEY = (code, times = 1) => `$w=New-Object -ComObject WScript.Shell; 1..${times} | % { $w.SendKeys([char]${code}); Start-Sleep -Milliseconds 40 }`;
const MEDIA = {
  play: [KEY(179), 'Toggled play and pause.'], pause: [KEY(179), 'Toggled play and pause.'], resume: [KEY(179), 'Toggled play and pause.'],
  next: [KEY(176), 'Skipped to the next track.'], previous: [KEY(177), 'Went back to the previous track.'], back: [KEY(177), 'Went back to the previous track.'],
  'volume up': [KEY(175, 6), 'Turned the volume up.'], louder: [KEY(175, 6), 'Turned the volume up.'],
  'volume down': [KEY(174, 6), 'Turned the volume down.'], quieter: [KEY(174, 6), 'Turned the volume down.'],
  mute: [KEY(173), 'Toggled mute.'], unmute: [KEY(173), 'Toggled mute.'],
};
const ROUTINES = {
  work: { say: 'Work mode on. Opening VS Code, Gmail and your calendar.', urls: ['https://mail.google.com', 'https://calendar.google.com'], apps: [['explorer.exe', ['vscode:']]] },
  study: { say: 'Study mode on. Lo-fi music and a fresh notepad.', urls: ['https://www.youtube.com/watch?v=jfKfPfyJRdk'], apps: [['notepad.exe', []]] },
  chill: { say: 'Chill mode on. Playing some music.', urls: ['https://www.youtube.com/results?search_query=arijit+singh+best+songs'], apps: [] },
  news: { say: 'Opening today\'s top news.', urls: ['https://news.google.com/home?hl=en-IN&gl=IN&ceid=IN:en'], apps: [] },
  demo: { say: 'Demo mode. Opening the Arc live console.', urls: ['http://localhost:3710'], apps: [] },
};

async function readBattery() {
  const raw = await ps('$b=Get-CimInstance Win32_Battery; if($b){"$($b.EstimatedChargeRemaining)|$($b.BatteryStatus)"}else{"none"}');
  if (!raw || raw === 'none') return null;
  const [pct, st] = raw.split('|');
  return { pct: Number(pct), charging: st === '2' || st === '6' || st === '7' || st === '8' || st === '9' };
}

const classroom = createClassroom({ root: ROOT, env: process.env });
const monitor = createMonitor({
  root: ROOT,
  env: process.env,
  record: (e) => record(e),
  battery: readBattery,
  speak: (text) => psEnv(SPEAK, { ARC_TEXT: text, JARVIS_TEXT: text }, { detached: true })
});
const FOCUS_MUSIC = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';

const SITES = {
  youtube: 'https://www.youtube.com', gmail: 'https://mail.google.com', google: 'https://www.google.com',
  whatsapp: 'https://web.whatsapp.com', linkedin: 'https://www.linkedin.com', github: 'https://github.com',
  maps: 'https://maps.google.com', 'google maps': 'https://maps.google.com', calendar: 'https://calendar.google.com',
  'google calendar': 'https://calendar.google.com', drive: 'https://drive.google.com', 'google drive': 'https://drive.google.com',
  twitter: 'https://x.com', x: 'https://x.com', instagram: 'https://www.instagram.com', amazon: 'https://www.amazon.in',
  flipkart: 'https://www.flipkart.com', irctc: 'https://www.irctc.co.in', cricbuzz: 'https://www.cricbuzz.com',
  chatgpt: 'https://chatgpt.com', sarvam: 'https://www.sarvam.ai', netflix: 'https://www.netflix.com', spotify: 'https://open.spotify.com',
};
const APPS = {
  notepad: ['notepad.exe', []], calculator: ['calc.exe', []], calc: ['calc.exe', []],
  chrome: ['cmd.exe', ['/c', 'start', '', 'chrome']], browser: ['cmd.exe', ['/c', 'start', '', 'chrome']],
  'vs code': ['explorer.exe', ['vscode:']], vscode: ['explorer.exe', ['vscode:']], 'visual studio code': ['explorer.exe', ['vscode:']], code: ['explorer.exe', ['vscode:']],
  'file explorer': ['explorer.exe', []], explorer: ['explorer.exe', []], files: ['explorer.exe', []],
  downloads: ['explorer.exe', [path.join(os.homedir(), 'Downloads')]], documents: ['explorer.exe', [path.join(os.homedir(), 'Documents')]],
  paint: ['mspaint.exe', []], camera: ['explorer.exe', ['microsoft.windows.camera:']], spotify: ['explorer.exe', ['spotify:']],
  settings: ['explorer.exe', ['ms-settings:']], 'task manager': ['taskmgr.exe', []], terminal: ['cmd.exe', ['/c', 'start', '', 'wt']],
  word: ['cmd.exe', ['/c', 'start', '', 'winword']], excel: ['cmd.exe', ['/c', 'start', '', 'excel']],
  powerpoint: ['cmd.exe', ['/c', 'start', '', 'powerpnt']], kivi: ['cmd.exe', ['/c', 'start', '', 'kivi']],
};
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
const norm = (s) => clean(s).toLowerCase().replace(/^(the|my)\s+/, '').replace(/[.!?]+$/, '');

// ---------- actions ----------
const ACTIONS = {
  async open_website({ input }) {
    const q = norm(input);
    if (!q) return 'Which website should I open?';
    let url = SITES[q];
    if (!url && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(q)) url = `https://${q}`;
    if (!url && /^https?:\/\/\S+$/i.test(clean(input))) url = clean(input);
    if (!url) url = `https://www.google.com/search?btnI=1&q=${encodeURIComponent(q + ' official site')}`;
    await openUrl(url);
    return `Opened ${q} in the browser.`;
  },
  async web_search({ input }) {
    const q = clean(input);
    if (!q) return 'What should I search for?';
    await openUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
    return `Searching Google for ${q}. Results are on your screen.`;
  },
  async play_youtube({ input }) {
    const q = clean(input);
    if (!q) return 'What should I play?';
    let id = null;
    try {
      const html = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en-IN' }, signal: AbortSignal.timeout(6000) })).text();
      id = html.match(/"videoId":"([\w-]{11})"/)?.[1] || null;
    } catch {}
    await openUrl(id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
    return id ? `Playing ${q} on YouTube.` : `Opened YouTube results for ${q}.`;
  },
  async open_app({ input }) {
    const q = norm(input);
    const app = APPS[q];
    if (!app) {
      if (SITES[q]) return ACTIONS.open_website({ input: q });
      return `I can't open ${q || 'that'}. I can open notepad, calculator, chrome, VS Code, file explorer, downloads, paint, camera, settings, task manager, Word, Excel or PowerPoint.`;
    }
    const ok = await run(app[0], app[1]);
    return ok ? `Opened ${q}.` : `I tried to open ${q} but it did not start.`;
  },
  async take_note({ input }) {
    const text = clean(input);
    if (!text) return 'What should I write down?';
    fs.mkdirSync(path.dirname(NOTES), { recursive: true });
    if (!fs.existsSync(NOTES)) fs.writeFileSync(NOTES, '# Arc Notes\n\n');
    fs.appendFileSync(NOTES, `- ${new Date().toLocaleString('en-IN')}: ${text}\n`);
    return `Noted: ${text}.`;
  },
  async read_notes() {
    if (!fs.existsSync(NOTES)) return 'You have no notes yet.';
    const lines = fs.readFileSync(NOTES, 'utf8').split('\n').filter(l => l.startsWith('- ')).slice(-5);
    if (!lines.length) return 'You have no notes yet.';
    return `Your last ${lines.length} notes: ` + lines.map(l => l.replace(/^- [^:]+:\d\d:\d\d(?:\s?[ap]m)?:\s*/i, '').replace(/^- /, '')).join('. ') + '.';
  },
  async show_notes() {
    if (!fs.existsSync(NOTES)) return 'You have no notes yet.';
    await run('notepad.exe', [NOTES]);
    return 'Your notes are open on the screen.';
  },
  async system_status() {
    const raw = await ps('$b=Get-CimInstance Win32_Battery; if($b){"$($b.EstimatedChargeRemaining)|$($b.BatteryStatus)"}else{"none"}');
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    let battery = 'no battery reading';
    if (raw && raw !== 'none') {
      const [pct, st] = raw.split('|');
      battery = `battery at ${pct} percent, ${st === '2' ? 'charging' : 'on battery power'}`;
    }
    return `It is ${time} on ${date}. The laptop is on, ${battery}.`;
  },
  async lock_screen() {
    setTimeout(() => run('rundll32.exe', ['user32.dll,LockWorkStation']), 1500);
    return 'Locking your laptop now.';
  },
  async media_control({ input }) {
    const q = norm(input).replace(/^(the )?(music|song|video)\s*/, '').trim() || 'play';
    const hit = MEDIA[q] || Object.entries(MEDIA).find(([k]) => q.includes(k))?.[1];
    if (!hit) return 'I can play or pause, skip to next or previous, turn the volume up or down, or mute.';
    await psEnv(hit[0]);
    return hit[1];
  },
  async speak_on_laptop({ input }) {
    const text = clean(input);
    if (!text) return 'What should the laptop say?';
    await psEnv(SPEAK, { ARC_TEXT: text, JARVIS_TEXT: text }, { detached: true });
    return `The laptop is saying: ${text}`;
  },
  async take_screenshot() {
    const dir = path.join(os.homedir(), 'Pictures', 'Arc');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `screenshot-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`);
    const ok = await psEnv('Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save($env:ARC_PATH)', { ARC_PATH: file });
    if (!ok || !fs.existsSync(file)) return 'I could not take the screenshot.';
    return 'Screenshot taken and saved in your Pictures, Arc folder.';
  },
  async set_timer({ input }) {
    const q = clean(input).toLowerCase();
    const n = Number(q.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
    if (!n) return 'For how many minutes?';
    const secs = Math.round(/sec/.test(q) ? n : /hour/.test(q) ? n * 3600 : n * 60);
    if (secs > 6 * 3600) return 'I can set timers up to 6 hours.';
    const label = clean(input).replace(/^\s*\d+(?:\.\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)?\s*(for|to)?\s*/i, '').trim();
    const msg = label ? `Timer done: ${label}` : 'Your timer is done';
    await psEnv(`Start-Sleep -Seconds ([int]$env:ARC_SECS); ${SPEAK}`, { ARC_SECS: String(secs), ARC_TEXT: msg, JARVIS_TEXT: msg }, { detached: true });
    const human = secs < 60 ? `${secs} seconds` : `${Math.round(secs / 60)} minutes`;
    return `Timer set for ${human}${label ? ` for ${label}` : ''}. Arc will speak when it's done.`;
  },
  async draft_email({ input }) {
    const raw = clean(input);
    if (!raw) return 'Who is the email to, and what should it say?';
    const [to = '', subject = '', ...bodyParts] = raw.split('|').map((s) => s.trim());
    const u = new URL('https://mail.google.com/mail/');
    u.searchParams.set('view', 'cm'); u.searchParams.set('fs', '1');
    if (/@/.test(to)) u.searchParams.set('to', to);
    u.searchParams.set('su', subject || (/@/.test(to) ? '' : to));
    u.searchParams.set('body', bodyParts.join(' | '));
    await openUrl(u.toString());
    return 'The email draft is open in Gmail. I have not sent it, check it and press send yourself.';
  },
  async directions({ input }) {
    const q = clean(input);
    if (!q) return 'Where do you want to go?';
    await openUrl(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`);
    return `Directions to ${q} are on the screen.`;
  },
  async weather({ input }) {
    const place = !clean(input) || norm(input) === 'none' ? 'Hyderabad' : clean(input);
    await openUrl(`https://www.google.com/search?q=${encodeURIComponent('weather ' + place)}`);
    return `Weather for ${place} is on the screen.`;
  },
  async run_routine({ input }) {
    const q = norm(input).replace(/\s*mode$/, '');
    const r = ROUTINES[q];
    if (!r) return `I know these modes: ${Object.keys(ROUTINES).join(', ')}.`;
    for (const app of r.apps) await run(app[0], app[1]);
    for (const u of r.urls) { await openUrl(u); await sleep(300); }
    return r.say;
  },
  async find_file({ input }) {
    const q = clean(input);
    if (!q || norm(q) === 'none') return 'Which file should I look for?';
    const hits = findFiles(q, 3);
    if (!hits.length) return `I couldn't find a file matching ${q} on your Desktop, Documents, Downloads or OneDrive.`;
    const best = describe(hits[0]);
    await run('explorer.exe', [hits[0].full]);
    const others = hits.length > 1 ? ` I also found ${hits.length - 1} similar file${hits.length > 2 ? 's' : ''}, ask if it's not the right one.` : '';
    return `Opened ${best.file} from ${best.where}, last edited ${best.when}.${others}`;
  },
  async focus_session({ input }) {
    const raw = clean(input);
    const mins = Math.min(180, Math.max(1, Number(raw.match(/(\d+)\s*(?:min|minute)/i)?.[1] || raw.match(/^(\d+)/)?.[1] || 25)));
    const topic = raw.replace(/\d+\s*(minutes?|mins?)?/i, '').replace(/^\s*(for|on|of)\s+/i, '').replace(/\b(focus|session|study)\b/gi, '').trim();
    let opened = '';
    if (topic && norm(topic) !== 'none') {
      const hit = findFiles(topic, 1)[0];
      if (hit) { await run('explorer.exe', [hit.full]); opened = ` I opened ${describe(hit).file}.`; }
    }
    await openUrl(FOCUS_MUSIC);
    const label = topic && norm(topic) !== 'none' ? topic : 'your focus session';
    setTimeout(async () => {
      await psEnv(SPEAK, { ARC_TEXT: `Time is up. ${mins} minutes on ${label} done. Take a short break.`, JARVIS_TEXT: `Time is up. ${mins} minutes on ${label} done. Take a short break.` }, { detached: true });
      await monitor.callOwner(`Boss, it's Arc. Your ${mins} minute focus session on ${label} is done. Great work. Take a five minute break, then tell me if you want another round.`, `focus session done: ${label}`);
    }, mins * 60_000);
    return `Focus session started: ${mins} minute${mins === 1 ? '' : 's'} on ${label}.${opened} Focus music is playing. I'll alert you when time is up.`;
  },
  async add_deadline({ input }) {
    const r = monitor.add(input);
    return r.error || r.text;
  },
  async list_deadlines() { return monitor.spokenList(); },
  async finish_deadline({ input }) { return monitor.finish(input); },
  async classroom_due() { return classroom.spokenDue(); },
  async submit_assignment({ input }) { return classroom.prepare(input); },
  async confirm_submission() { return classroom.confirm(); },
  async submission_status() { return classroom.submissionStatus(); },
};
const ALIASES = { open_site: 'open_website', website: 'open_website', search: 'web_search', youtube: 'play_youtube', play: 'play_youtube', app: 'open_app', note: 'take_note', notes: 'read_notes', status: 'system_status', battery: 'system_status', lock: 'lock_screen', media: 'media_control', volume: 'media_control', say: 'speak_on_laptop', speak: 'speak_on_laptop', screenshot: 'take_screenshot', timer: 'set_timer', email: 'draft_email', maps: 'directions', routine: 'run_routine', mode: 'run_routine', file: 'find_file', open_file: 'find_file', focus: 'focus_session', deadline: 'add_deadline', remind: 'add_deadline', deadlines: 'list_deadlines', submitted: 'finish_deadline', done: 'finish_deadline' };

// ---------- auth ----------
function authorise(req, body) {
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(req.socket.remoteAddress) && !req.headers['cf-connecting-ip'];
  if (isLocal) return null; // Local laptop requests are always safe

  const auth = req.headers.authorization || '';
  const url = new URL(req.url, 'http://x');
  const tokenParam = url.searchParams.get('token') || '';
  const given = auth.replace(/^Bearer\s+/i, '') || req.headers['x-arc-token'] || req.headers['x-jarvis-token'] || body.token || tokenParam || '';
  
  if (TOKEN && given.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN))) {
    return null;
  }
  if (!TOKEN && ALLOW_NO_CALLER) return null;
  return 'bad token';
}

// ---------- http ----------
const PAGE = fs.readFileSync(path.join(ROOT, 'live.html'), 'utf8');
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const viaTunnel = Boolean(req.headers['cf-connecting-ip']);

  // Allow web dashboard on localhost and via tunnel (for mobile browser voice calls!)
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    return json(res, 200, {
      owner: OWNER ? `…${OWNER.slice(-2)}` : null,
      lock: Boolean(OWNER || OWNER_CALLER_ID),
      lastCaller,
      allowNoCaller: ALLOW_NO_CALLER,
      actions: Object.keys(ACTIONS),
      phone: process.env.ARC_PHONE || process.env.JARVIS_PHONE || '',
      ai: getAiStatus(process.env),
      viaTunnel
    });
  }

  if (req.method === 'GET' && url.pathname === '/activity') return json(res, 200, activity);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, ai: getAiStatus(process.env).mode });

  // Console endpoints: deadlines and test call
  if (url.pathname.startsWith('/monitor')) {
    if (req.method === 'GET') return json(res, 200, monitor.status());
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 5000) break; }
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch {}
    if (url.pathname === '/monitor/add') { const r = monitor.add(`${b.title || ''} | ${b.when || ''}`); return json(res, r.error ? 400 : 200, { result: r.error || r.text }); }
    if (url.pathname === '/monitor/done') return json(res, 200, { result: monitor.finish(b.id) });
    if (url.pathname === '/monitor/test-call') {
      const msg = b.message || "Boss, it's Arc. This is a test of your urgent alert. Everything is working.";
      const r = await monitor.callOwner(msg, 'test call');
      return json(res, 200, r);
    }
    return json(res, 404, { result: 'Unknown endpoint' });
  }

  // ---------- Free AI Natural Language Chat / Voice Call endpoint ----------
  if (url.pathname === '/ai/chat' && req.method === 'POST') {
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > 20000) break; }
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch {}

    const message = String(body.message || body.input || body.query || '').trim();
    if (!message) return json(res, 400, { ok: false, error: 'Empty message' });

    // Tunnel access authentication
    const denied = authorise(req, body);
    if (denied) {
      record({ action: 'web_call', input: message, result: `REFUSED (${denied})`, refused: true });
      return json(res, 401, { ok: false, reply: "I can only take orders from my owner. Please authenticate with Arc's password." });
    }

    try {
      const decision = await processUserMessage(message, body.history || [], process.env);
      let actionResult = null;
      let finalReply = decision.reply;

      if (decision.action) {
        const actionName = ALIASES[decision.action] || decision.action;
        const fn = ACTIONS[actionName];
        if (fn) {
          const actionInput = decision.input || 'none';
          actionResult = await fn({ input: actionInput });
          finalReply = actionResult;
          record({ action: actionName, input: actionInput, result: actionResult, caller: 'Voice Call' });
        } else {
          record({ action: decision.action, input: decision.input, result: `Action not found: ${decision.action}` });
        }
      } else {
        record({ action: 'conversation', input: message, result: finalReply, caller: 'Voice Call' });
      }

      return json(res, 200, {
        ok: true,
        reply: finalReply,
        action: decision.action,
        input: decision.input,
        result: actionResult,
        model: decision.model
      });
    } catch (e) {
      record({ action: 'ai_error', input: message, result: e.message });
      return json(res, 500, { ok: false, reply: "Sorry Boss, something went wrong on the laptop.", error: e.message });
    }
  }

  // ---------- Sarvam API / Tools endpoint ----------
  const m = url.pathname.match(/^\/tools\/([a-z_]+)$/) || (url.pathname === '/action' ? [null, null] : null);
  if (!m) return json(res, 404, { result: 'Unknown endpoint' });

  let body = {};
  if (req.method !== 'GET') {
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > 20000) break; }
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { input: raw }; }
  }
  for (const [k, v] of url.searchParams) if (body[k] === undefined) body[k] = v;

  let name = m[1] || body.action || '';
  name = ALIASES[name] || name;
  const input = body.input ?? body.query ?? body.text ?? body.name ?? body.url ?? body.app ?? body.site ?? body.note ?? '';

  const denied = authorise(req, body);
  if (denied) { record({ action: name || '?', input, result: `REFUSED (${denied})`, refused: true }); return json(res, 401, { result: 'Not authorised.' }); }

  const fn = ACTIONS[name];
  if (!fn) return json(res, 400, { result: `I can't do ${name || 'that'} yet.` });

  const key = `${name}|${norm(input)}`;
  const prev = recent.get(key);
  if (prev && Date.now() - prev.at < DEDUPE_MS) {
    const result = await prev.result;
    return json(res, 200, { ok: true, result });
  }
  if (recent.size > 200) for (const [k, v] of recent) if (Date.now() - v.at > DEDUPE_MS) recent.delete(k);
  const pending = fn({ input });
  recent.set(key, { at: Date.now(), result: pending.catch(() => 'Something went wrong on the laptop.') });

  const callerRaw = String(req.headers['x-caller'] || body.caller || body.user_identifier || '').replace(/\D/g, '');
  const caller = callerRaw ? `…${callerRaw.slice(-2)}` : 'Sarvam';
  try {
    const result = await pending;
    record({ action: name, input, result, caller });
    json(res, 200, { ok: true, result });
  } catch (e) {
    record({ action: name, input, result: `ERROR ${e.message}` });
    json(res, 500, { ok: false, result: 'Something went wrong on the laptop.' });
  }
}).listen(PORT, () => {
  const aiInfo = getAiStatus(process.env);
  console.log(`==============================================================`);
  console.log(` ARC Action Server running on http://localhost:${PORT}`);
  console.log(` AI Brain Mode: ${aiInfo.label}`);
  console.log(` Owner phone: ${OWNER ? OWNER.slice(0, 4) + '…' : 'Open (ALLOW_NO_CALLER)'}`);
  console.log(`==============================================================`);
  monitor.start();
  setTimeout(() => buildIndex(true), 2000);
  if (process.env.CLASSROOM_SUBMIT) {
    const warmClassroom = () => classroom.openList({ fresh: true }).catch((e) => console.log('Classroom refresh failed:', e.message.split(/\r?\n/)[0]));
    setTimeout(warmClassroom, 5000);
    setInterval(warmClassroom, 20 * 60_000);
  }
});
