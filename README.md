# ARC: 100% Free Voice Assistant for Windows ⚡

> Talk to **Arc** with your voice from your laptop or phone, and your laptop does what you ask.  
> **100% Free**: No paid phone numbers, no telecom credits, and no required paid APIs.

---

## 🌟 Key Free Features

- **Free Web Voice Call**: Click **"📞 Call Arc"** right on your laptop or mobile phone browser to talk to Arc just like a real phone call! Uses browser Web Speech API (zero carrier charges).
- **Free AI Intelligence**:
  - **Option 1 (Built-in)**: Smart Natural Language Engine that works **100% offline with ZERO API keys** and zero sign-ups.
  - **Option 2 (Free Gemini API)**: Add a free `GEMINI_API_KEY` from Google AI Studio (`gemini-2.0-flash`) for advanced conversational reasoning and function calling.
  - **Option 3 (Free Groq API)**: Add a free `GROQ_API_KEY` from Groq Cloud (Llama 3.3).
- **Free Remote Mobile Access**: Uses the free Cloudflare tunnel (`cloudflared`) to generate a secure HTTPS link you can open on your phone's browser from anywhere to voice-control your laptop.
- **Free Local Voice Reminders**: When deadlines or battery are low, Arc announces it out loud through your laptop speakers and browser chime — no telephony fees.

---

## 🚀 Quick Start (in 2 Minutes)

1. **Launch Arc**:
   Double-click **[`Start-Arc.bat`](file:///e:/Project/ARRC-Build-Your-Own-J/arc/Start-Arc.bat)**.
   - It automatically installs Node.js and `cloudflared` if you don't have them.
   - It will ask for your mobile number (used for owner verification).
   - *(Optional)* Paste a free Google Gemini key or press **Enter** to skip and use the 100% offline smart mode.
2. **Talk to Arc**:
   - Open **`http://localhost:3710`** on your laptop (or open the free Cloudflare tunnel link on your phone).
   - Click **"📞 Call Arc"**.
   - Arc will say: *"Hey Boss, it's Arc. What can I do for you?"*.
   - Speak naturally!

---

## 🎯 What You Can Say to Arc

| Category | Examples |
|---|---|
| **Media & Music** | *"Play Arijit Singh on YouTube"*, *"Volume badhao"*, *"Pause"*, *"Mute"* |
| **System Status** | *"What is my battery level?"*, *"What time is it?"*, *"Lock my screen"* |
| **Apps & Websites** | *"Open VS Code"*, *"Open Chrome"*, *"Open Calculator"*, *"Search Google for quantum computing"* |
| **Notes** | *"Take a note: meeting with Rahul tomorrow at 3 pm"*, *"Read my notes"*, *"Show notes"* |
| **Timers & Modes** | *"Set a 5 minute timer for tea"*, *"Work mode on"*, *"Study mode"*, *"Chill mode"* |
| **Files & Focus** | *"Find my chemistry assignment"*, *"25 minute focus session for study"* |
| **Deadlines** | *"Remind me, DBMS project due tomorrow 5 pm"*, *"What is due?"*, *"Mark DBMS as submitted"* |

---

## 📁 Project Structure

```
arc/
├── Start-Arc.bat                  # One-click Windows launcher
├── Copy-for-Sarvam.bat            # Optional helper if using Sarvam telephony
├── START-HERE.txt                 # Beginner guide
├── README.md                      # Full documentation
├── CLAUDE.md / AGENTS.md          # AI pair-programming assistant instructions
├── arc-agent/
│   ├── 1-instructions-prompt.txt  # Arc personality and instructions
│   └── 2-tool-description.txt     # Action definitions
└── server/
    ├── ai.js                      # Free AI engine (Gemini / Groq / Offline intent parser)
    ├── server.js                  # Laptop action execution server & web voice call API
    ├── live.html                  # Sleek ARC Console with Web Voice Call & Arc Reactor
    ├── start.js                   # Dual launcher (Server + Cloudflare tunnel)
    ├── setup.js                   # Interactive configuration script
    ├── monitor.js                 # Free voice announcements for deadlines & battery
    ├── files.js                   # Fast document & media search
    └── classroom.js               # Google Classroom automation
```
