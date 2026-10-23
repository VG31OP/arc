# Setting up Arc (100% Free Edition - Instructions for AI Coding Assistants)

The user wants their own Arc: a free voice assistant that runs their Windows laptop.
Arc works 100% free without paid phone numbers, paid credits, or paid APIs.

## Architecture
1. **Frontend**: ARC Console (`server/live.html`) at `http://localhost:3710` (or over free Cloudflare tunnel on mobile).
   - Has a built-in "📞 Call Arc" button using the browser Web Speech API.
   - User speaks into mic, Arc speaks back via browser speech synthesis.
2. **Backend**: Node.js server (`server/server.js`) with 26 safe, verified Windows actions.
3. **AI Brain (`server/ai.js`)**:
   - Built-in Natural Language Smart Intent Matcher (works offline with 0 keys).
   - Optional Free Google Gemini API (`GEMINI_API_KEY` from Google AI Studio).
   - Optional Free Groq Cloud API (`GROQ_API_KEY`).
4. **Reminders & Alerts**:
   - Spoken out loud over laptop speakers via Windows SAPI / PowerShell `System.Speech`.
   - Browser audio chime and notifications.

## How to help the user get started
1. If Node.js or `cloudflared` is missing, install them via `winget`.
2. Run `npm install` inside `server\`.
3. Run `node setup.js <mobile_number>` inside `server\`.
   - Prompt them if they have a free Gemini key (or skip to use built-in offline smart mode).
4. Run `Start-Arc.bat` (or `node start.js`).
5. Direct the user to open `http://localhost:3710` and press **"Call Arc"** to talk!
