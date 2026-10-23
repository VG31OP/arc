// Arc AI Brain: Natural Language understanding with Free Gemini, Free Groq, or Built-in Smart Parser.
// No paid APIs required. Works 100% free out-of-the-box.

const SYSTEM_INSTRUCTION = `You are Arc, Boss's personal assistant. You run Boss's laptop and you call Boss when something needs attention.
You are warm, quick, smart and a little cheeky, like a good friend.
Always call the owner "Boss". Keep every spoken reply to one or two short, natural spoken sentences.
Use casual words like okay, hmm, got it, one sec. No lists, no markdown.

When the user asks you to do something on their laptop, choose the best action from the tools available.
If no action is needed (like greetings, chit-chat, or questions about who you are), just reply conversationally as Arc.
`;

export const TOOLS_SCHEMA = [
  { name: 'open_website', description: 'Opens a website by name or URL (e.g., YouTube, Gmail, IRCTC, GitHub)', parameters: { type: 'object', properties: { input: { type: 'string', description: 'The website name or URL' } }, required: ['input'] } },
  { name: 'web_search', description: 'Searches Google and displays results on laptop screen', parameters: { type: 'object', properties: { input: { type: 'string', description: 'The search query' } }, required: ['input'] } },
  { name: 'play_youtube', description: 'Plays a video or song on YouTube', parameters: { type: 'object', properties: { input: { type: 'string', description: 'The song, video, or artist name' } }, required: ['input'] } },
  { name: 'open_app', description: 'Opens a Windows app (notepad, calculator, chrome, vs code, file explorer, downloads, paint, camera, settings, task manager, word, excel, powerpoint)', parameters: { type: 'object', properties: { input: { type: 'string', description: 'The application name' } }, required: ['input'] } },
  { name: 'take_note', description: 'Saves a note dictated by Boss into Arc Notes', parameters: { type: 'object', properties: { input: { type: 'string', description: 'The note text' } }, required: ['input'] } },
  { name: 'read_notes', description: 'Reads aloud the latest notes', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'show_notes', description: 'Opens the notes file in Notepad on screen', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'system_status', description: 'Checks laptop battery level, charging status, time and date', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'lock_screen', description: 'Locks the Windows laptop workstation immediately', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'take_screenshot', description: 'Captures and saves a full screenshot of the laptop screen', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'media_control', description: 'Controls music playback or volume: play, pause, next, previous, volume up, volume down, mute', parameters: { type: 'object', properties: { input: { type: 'string', description: 'play | pause | next | previous | volume up | volume down | mute' } }, required: ['input'] } },
  { name: 'run_routine', description: 'Activates a laptop preset mode: work, study, chill, news, or demo', parameters: { type: 'object', properties: { input: { type: 'string', description: 'work | study | chill | news | demo' } }, required: ['input'] } },
  { name: 'set_timer', description: 'Sets a countdown timer that Arc announces out loud', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Duration and optional label, e.g. 5 minutes for tea' } }, required: ['input'] } },
  { name: 'speak_on_laptop', description: 'Makes laptop speakers say words out loud', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Words to speak' } }, required: ['input'] } },
  { name: 'draft_email', description: 'Opens a new Gmail compose draft without sending', parameters: { type: 'object', properties: { input: { type: 'string', description: 'to | subject | body' } }, required: ['input'] } },
  { name: 'directions', description: 'Opens Google Maps directions to a destination', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Destination place or address' } }, required: ['input'] } },
  { name: 'weather', description: 'Shows weather for a city or location', parameters: { type: 'object', properties: { input: { type: 'string', description: 'City name' } }, required: ['input'] } },
  { name: 'find_file', description: 'Finds and opens a document or presentation on Desktop, Documents, Downloads or OneDrive', parameters: { type: 'object', properties: { input: { type: 'string', description: 'File name or topic' } }, required: ['input'] } },
  { name: 'focus_session', description: 'Starts a focus study session: opens file, plays lo-fi music, alerts when done', parameters: { type: 'object', properties: { input: { type: 'string', description: 'e.g. 25 minutes for maths project' } }, required: ['input'] } },
  { name: 'add_deadline', description: 'Saves a deadline and reminder', parameters: { type: 'object', properties: { input: { type: 'string', description: 'title | when, e.g. chemistry assignment | tomorrow 5 pm' } }, required: ['input'] } },
  { name: 'list_deadlines', description: 'Lists all pending deadlines', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'finish_deadline', description: 'Marks a deadline as submitted so reminders stop', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Assignment title' } }, required: ['input'] } },
  { name: 'classroom_due', description: 'Checks pending Google Classroom assignments', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'submit_assignment', description: 'Prepares Google Classroom assignment submission and finds matching report file', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Assignment name, optionally | file name' } }, required: ['input'] } },
  { name: 'confirm_submission', description: 'Uploads the prepared file to Google Classroom', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
  { name: 'submission_status', description: 'Checks status of background Google Classroom upload', parameters: { type: 'object', properties: { input: { type: 'string', description: 'none' } } } },
];

// ---------- Built-in Offline Natural Language Intent Matcher ----------
export function offlineIntentMatcher(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();

  if (/^(hi|hello|hey|namaste|whats up|sup|arc)\b/i.test(lower) && lower.split(/\s+/).length <= 3) {
    return { action: null, input: '', reply: "Hey Boss, I'm here. What do you need on the laptop?" };
  }
  if (/who are you|what can you do|introduce yourself/i.test(lower)) {
    return { action: null, input: '', reply: "I'm Arc, your personal assistant. I can open apps, search files, play YouTube, control media, set timers, and run your laptop." };
  }

  // YouTube / Music
  const ytMatch = lower.match(/(?:play|youtube|gaana|chalao)\s+(?:on youtube\s+)?(.+)/i) ||
                  lower.match(/(.+?)\s+(?:play karo|chala do|on youtube)/i);
  if (ytMatch && !/timer|routine|mode/i.test(lower)) {
    const song = ytMatch[1].replace(/\s*(on youtube|play karo|chalao|song|video)\s*/gi, '').trim();
    if (song) return { action: 'play_youtube', input: song, reply: `Playing ${song} on YouTube.` };
  }

  // Battery / System status
  if (/battery|charge|charging|system status|power|laptop status|what time|tarikh|samay/i.test(lower)) {
    return { action: 'system_status', input: 'none', reply: 'Checking your system status...' };
  }

  // Screen lock
  if (/lock\s*(laptop|screen|pc|workstation)|laptop lock|screen lock/i.test(lower)) {
    return { action: 'lock_screen', input: 'none', reply: 'Locking your laptop now, Boss.' };
  }

  // Screenshot
  if (/screenshot|screen capture|screen record/i.test(lower)) {
    return { action: 'take_screenshot', input: 'none', reply: 'Taking a screenshot now.' };
  }

  // Volume & Media
  if (/volume up|increase volume|sound badhao|louder|awaz badhao/i.test(lower)) {
    return { action: 'media_control', input: 'volume up', reply: 'Turned volume up.' };
  }
  if (/volume down|decrease volume|sound kam karo|quieter|awaz kam karo/i.test(lower)) {
    return { action: 'media_control', input: 'volume down', reply: 'Turned volume down.' };
  }
  if (/mute|unmute|chup raho/i.test(lower)) {
    return { action: 'media_control', input: 'mute', reply: 'Toggled mute.' };
  }
  if (/pause|stop music|rok do/i.test(lower)) {
    return { action: 'media_control', input: 'pause', reply: 'Paused playback.' };
  }
  if (/resume|unpause|shuru karo/i.test(lower)) {
    return { action: 'media_control', input: 'play', reply: 'Resumed playback.' };
  }
  if (/next track|next song|agla gaana/i.test(lower)) {
    return { action: 'media_control', input: 'next', reply: 'Skipped to next track.' };
  }

  // Timer
  const timerMatch = lower.match(/(?:set (?:a )?timer(?: for)?|timer lagao)\s+(.+)/i) ||
                     lower.match(/(\d+\s*(?:minute|min|sec|hour|ghanta)[^\n]*)/i);
  if (timerMatch && /timer/i.test(lower)) {
    const spec = timerMatch[1].replace(/timer\s*(for)?/gi, '').trim();
    return { action: 'set_timer', input: spec, reply: `Setting timer for ${spec}.` };
  }

  // Notes
  if (/read (?:my )?notes|sunao notes|last notes/i.test(lower)) {
    return { action: 'read_notes', input: 'none', reply: 'Reading your latest notes.' };
  }
  if (/show (?:my )?notes|open notes|notes file/i.test(lower)) {
    return { action: 'show_notes', input: 'none', reply: 'Opening your notes file on screen.' };
  }
  const noteMatch = lower.match(/(?:take (?:a )?note|write down|note down|note karo)\s*[:\-]?\s*(.+)/i);
  if (noteMatch) {
    return { action: 'take_note', input: noteMatch[1].trim(), reply: `Saving note: ${noteMatch[1].trim()}` };
  }

  // Focus Session
  const focusMatch = lower.match(/(?:start )?(?:focus session|study session)(?: for)?\s*(.+)?/i);
  if (focusMatch) {
    return { action: 'focus_session', input: focusMatch[1]?.trim() || '25 minutes', reply: 'Starting your focus session.' };
  }

  // Find File
  const fileMatch = lower.match(/(?:find|open|search for|kholo)\s+(?:file|document|pdf|report|doc)\s+(.+)/i) ||
                    lower.match(/(.+?)\s+(?:file|assignment|pdf)\s+(?:kholo|dhundo|open)/i);
  if (fileMatch) {
    const q = fileMatch[1].trim();
    return { action: 'find_file', input: q, reply: `Looking for ${q} on your laptop.` };
  }

  // Deadlines
  if (/list deadlines|what is due|mera assignment kab due hai|check deadlines/i.test(lower)) {
    return { action: 'list_deadlines', input: 'none', reply: 'Checking your deadlines.' };
  }
  const dlMatch = lower.match(/(?:remind me|add deadline|deadline add karo)\s*[:\-]?\s*(.+)/i);
  if (dlMatch) {
    return { action: 'add_deadline', input: dlMatch[1].trim(), reply: `Saved deadline: ${dlMatch[1].trim()}` };
  }

  // Routines
  if (/work mode/i.test(lower)) return { action: 'run_routine', input: 'work', reply: 'Work mode activated.' };
  if (/study mode/i.test(lower)) return { action: 'run_routine', input: 'study', reply: 'Study mode activated.' };
  if (/chill mode/i.test(lower)) return { action: 'run_routine', input: 'chill', reply: 'Chill mode activated.' };
  if (/news mode/i.test(lower)) return { action: 'run_routine', input: 'news', reply: 'Opening top news.' };
  if (/demo mode/i.test(lower)) return { action: 'run_routine', input: 'demo', reply: 'Demo mode activated.' };

  // Weather
  const weatherMatch = lower.match(/weather (?:in|for)?\s*([a-zA-Z\s]+)/i) ||
                       lower.match(/([a-zA-Z\s]+)\s+ka mausam/i);
  if (weatherMatch && /weather|mausam/i.test(lower)) {
    const city = weatherMatch[1].trim();
    return { action: 'weather', input: city, reply: `Checking weather for ${city}.` };
  }

  // Directions
  const dirMatch = lower.match(/(?:directions|rasta|route)\s+(?:to|for)\s+(.+)/i);
  if (dirMatch) {
    return { action: 'directions', input: dirMatch[1].trim(), reply: `Showing directions to ${dirMatch[1].trim()}.` };
  }

  // Apps
  const appMatch = lower.match(/(?:open|start|launch|chalao)\s+(notepad|calculator|calc|chrome|browser|vs code|vscode|code|explorer|files|downloads|documents|paint|camera|settings|task manager|word|excel|powerpoint|spotify)/i);
  if (appMatch) {
    return { action: 'open_app', input: appMatch[1].trim(), reply: `Opening ${appMatch[1].trim()}.` };
  }

  // Google Search
  const searchMatch = lower.match(/(?:search|google|search for)\s+(.+)/i);
  if (searchMatch) {
    return { action: 'web_search', input: searchMatch[1].trim(), reply: `Searching Google for ${searchMatch[1].trim()}.` };
  }

  // Generic Open
  const openMatch = lower.match(/(?:open|go to|kholo)\s+([a-z0-9\.\-]+)/i);
  if (openMatch) {
    return { action: 'open_website', input: openMatch[1].trim(), reply: `Opening ${openMatch[1].trim()}.` };
  }

  // Laptop Speak
  const speakMatch = lower.match(/(?:speak|bolo|say on laptop)\s*[:\-]?\s*(.+)/i);
  if (speakMatch) {
    return { action: 'speak_on_laptop', input: speakMatch[1].trim(), reply: 'Speaking on laptop.' };
  }

  // Default fallback conversational reply
  return { action: null, input: '', reply: "I heard you, Boss. Let me know what you want me to do on your laptop." };
}

// ---------- Google Gemini Free Tier Integration ----------
async function callGemini(apiKey, message, history = []) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const formattedTools = [{
    functionDeclarations: TOOLS_SCHEMA.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }];

  const contents = [];
  // Add recent history if provided
  for (const h of history.slice(-4)) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: formattedTools,
    generationConfig: { temperature: 0.3, maxOutputTokens: 250 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0]?.content?.parts || [];
  
  // Check for function call
  const call = candidate.find(p => p.functionCall);
  if (call) {
    const fn = call.functionCall;
    const input = fn.args?.input || 'none';
    return {
      action: fn.name,
      input,
      reply: `On it, Boss. Executing ${fn.name.replace(/_/g, ' ')}.`,
      model: 'gemini-2.0-flash'
    };
  }

  // Text reply
  const textPart = candidate.find(p => p.text);
  return {
    action: null,
    input: '',
    reply: textPart?.text?.trim() || "Yes Boss, what should I do?",
    model: 'gemini-2.0-flash'
  };
}

// ---------- Groq Free Tier Integration ----------
async function callGroq(apiKey, message, history = []) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.slice(-4).map(h => ({ role: h.role, content: h.text })),
    { role: 'user', content: message }
  ];

  const tools = TOOLS_SCHEMA.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  
  if (choice?.tool_calls?.length) {
    const call = choice.tool_calls[0].function;
    let input = 'none';
    try {
      const args = JSON.parse(call.arguments || '{}');
      input = args.input || 'none';
    } catch {}
    return {
      action: call.name,
      input,
      reply: `On it, Boss. Running ${call.name.replace(/_/g, ' ')}.`,
      model: 'groq/llama-3.3-70b'
    };
  }

  return {
    action: null,
    input: '',
    reply: choice?.content?.trim() || "Yes Boss, what can I do for you?",
    model: 'groq/llama-3.3-70b'
  };
}

// ---------- Unified Arc AI Engine ----------
export async function processUserMessage(message, history = [], env = process.env) {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const groqKey = env.GROQ_API_KEY?.trim();

  // Try Google Gemini if key is provided
  if (geminiKey) {
    try {
      return await callGemini(geminiKey, message, history);
    } catch (e) {
      console.warn(`[Gemini Free API warning: ${e.message}] Falling back to smart intent parser...`);
    }
  }

  // Try Groq if key is provided
  if (groqKey) {
    try {
      return await callGroq(groqKey, message, history);
    } catch (e) {
      console.warn(`[Groq Free API warning: ${e.message}] Falling back to smart intent parser...`);
    }
  }

  // Built-in 100% Free Smart Offline Intent Matcher
  const matched = offlineIntentMatcher(message);
  return { ...matched, model: 'offline-smart-engine' };
}

export function getAiStatus(env = process.env) {
  if (env.GEMINI_API_KEY?.trim()) return { mode: 'gemini', label: 'Google Gemini (Free API)' };
  if (env.GROQ_API_KEY?.trim()) return { mode: 'groq', label: 'Groq Cloud (Free API)' };
  return { mode: 'offline', label: 'Built-in Smart Engine (100% Free Offline)' };
}
