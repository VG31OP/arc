# ARC laptop server

The part of Arc that runs on your laptop.

Easiest: open the folder above in your AI assistant or double-click `../Start-Arc.bat`.

```bash
npm install
node setup.js 919876543210   # your mobile number; creates .env with a fresh password
node start.js                # server + tunnel; prints the tool URL for Sarvam
```

- `node setup.js --show-token` prints Arc's password again.
- Saving `.env` while Arc runs restarts the server without changing the tunnel address.
- `npm start` runs the server alone, without a tunnel.
- Every action Arc can take is in `server.js`, inside `const ACTIONS = {`. Add your own there.
