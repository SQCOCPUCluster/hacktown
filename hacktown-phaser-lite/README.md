# HackTown (Phaser Lite)
A zero-dependency (besides Phaser + Vite) hackathon template that looks like a tiny town where NPCs gossip about a 6pm café meetup and converge there. No server required.

## Run
```bash
npm i
npm run dev
```
Open the printed localhost URL. Arrow keys / WASD to move. Watch NPCs talk and gather near the CAFÉ around 18:00 (sim time).

## How it works
- **Phaser** renders rectangles as people and blocks for landmarks (Park/School/Café).
- Each NPC has a **schedule**, a minimal **memory log**, and simple rules for **proximity chat**.
- The clock advances 1 minute per real second; during 17:45–18:20, anyone who knows about the event heads to the café.
- Alice seeds the gossip; others learn via proximity chat.
