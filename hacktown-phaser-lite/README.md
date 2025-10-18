# HackTown 🏘️

> **A living, breathing simulation where AI-powered NPCs think, remember, and interact autonomously in real-time.**

Built in 12 hours as an exploration of emergent AI behavior. Each NPC has a unique personality, makes decisions with LLM reasoning, remembers past interactions, and lives a full lifecycle from birth to death.

## 🎥 Demo

[Demo Video Coming Soon]

**Watch NPCs**:
- 🧠 Think contextually based on personality and memories
- 💬 Have organic conversations and spread gossip
- 😊😐😞 Change color based on mood (green=happy, red=stressed, blue=sad)
- 👶👴 Grow from young (small) to elder (large)
- ⚰️ Die from age, stress, or dangerous events
- 🎭 React to world events (villains, festivals, storms)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Convex
```bash
npx convex dev
```
This will prompt you to create a Convex account (free) and set up your project.

### 3. Set up Groq API Key
1. Get a free API key from [Groq Console](https://console.groq.com)
2. Add it to your Convex environment:
```bash
npx convex env set GROQ_API_KEY your_api_key_here
```

### 4. Seed the World (Optional)
```bash
npx convex run seed:seedWorld
```
This creates initial NPCs and world state.

### 5. Run the Game
```bash
npm run dev
```
Open the printed localhost URL. Arrow keys / WASD to move. Watch NPCs think, talk, and live their lives!

---

## 🎮 Keyboard Controls

| Key | Action |
|-----|--------|
| `Arrow Keys` / `WASD` | Move player character |
| `D` | Toggle conversation range debug circles |
| `V` | Stress 30% of NPCs (test red visual effect) |
| `H` | Make 40% of NPCs happy (test green visual effect) |
| `R` | Reset all NPCs to neutral colors |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PHASER (Frontend)                  │
│   - Rendering NPCs, landmarks, speech bubbles      │
│   - Smooth interpolation & visual effects          │
│   - Dashboard UI & thought panel                   │
└─────────────────┬───────────────────────────────────┘
                  │ Real-time WebSocket sync
┌─────────────────▼───────────────────────────────────┐
│               CONVEX (Backend)                      │
│   - Real-time database (entities, events, etc.)    │
│   - Cron jobs: worldTick, aiThinkTick, godTick     │
│   - Mutations: spawn NPCs, start conversations     │
└─────────────────┬───────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
┌────────▼─────┐  ┌────────▼────────┐
│  GROQ LLM    │  │   MEM0 CLOUD    │
│ (Reasoning)  │  │   (Memory)      │
│ llama-3.3    │  │ Gossip chains   │
└──────────────┘  └─────────────────┘
```

### Data Flow

1. **World Tick** (every 3 seconds): Move NPCs, age them, update positions
2. **AI Think Tick** (every 8 seconds): 3-5 random NPCs generate thoughts with Groq LLM
3. **God Tick** (every 2 minutes): Spawn new NPCs or trigger events (villains, festivals)
4. **Reaper Tick** (every 30 seconds): Check for deaths based on age/health/stress
5. **Conversation Tick** (every 5 seconds): Check for nearby NPCs and start conversations

---

## 🧠 How It Works
### Personality System (6 Traits)

Each NPC is born with randomized personality traits (0-1 scale):

| Trait | Low | High |
|-------|-----|------|
| **Curiosity** | Stays in comfort zone | Explores actively |
| **Empathy** | Self-focused | Helps others |
| **Boldness** | Cautious, risk-averse | Daring, seeks thrills |
| **Order** | Spontaneous | Likes routine |
| **Mood** | Pessimistic | Optimistic |
| **Weirdness** | Conventional | Eccentric |

Personality influences:
- **Movement decisions**: Curious NPCs explore edges, social NPCs cluster at café
- **Conversation style**: Empathetic NPCs ask about feelings, bold NPCs make jokes
- **Stress response**: High-order NPCs panic during chaos, bold NPCs thrive on it

### AI Decision-Making

NPCs use **Groq's Llama 3.3 70B** model for contextual reasoning:

1. **Context gathering**: Retrieve recent memories from Mem0, check nearby NPCs/events
2. **Prompt construction**: Include personality traits, location, time of day, mood, stress
3. **LLM inference**: Generate thought + action (e.g., "I should check on the café meetup")
4. **Action execution**: Move toward target, start conversation, or idle
5. **Memory storage**: Save thought and action to Mem0 for future recall

**Fallback mode**: If Groq API fails, NPCs use rule-based logic (random walk + social gathering)

### Memory & Gossip

- **Mem0 Cloud** stores semantic memories for each NPC
- When NPCs converse, they **distort gossip** (90% accuracy) to simulate telephone game
- Memories include: conversations, events witnessed, location visits, emotional reactions
- LLM retrieves top 3-5 relevant memories when making decisions

### Socio-Economic World State

The dashboard tracks global metrics calculated from all NPCs:

- **Prosperity**: Average health + inverse population pressure
- **Stability**: Inverse of active events + inverse average stress
- **Happiness**: Average mood + health
- **Tension**: Average stress + active dangerous events
- **Scarcity**: Population pressure + danger level

These metrics create "emotional weather" that affects the whole world's vibe.

### Mortality System

Death probability calculated per tick using:
- **Age risk**: Sigmoid curve (young safe, old risky)
- **Starvation risk**: Health below 30% increases risk
- **Stress risk**: Chronic stress shortens lifespan
- **Danger risk**: Active villain events increase local mortality

NPCs live 10-30 minutes on average (configurable).

---

## 📊 Dashboard Guide

**Top-Left HUD**:
- Current time (simulation minutes)
- Agent count (alive NPCs)

**Top-Right Dashboard**:
- **Population**: Alive / Births / Deaths
- **Activity**: Time elapsed / Total AI thoughts generated
- **Metrics**: ASCII progress bars for prosperity, stability, happiness, tension, scarcity

**Bottom Panel**:
- **Nearby Thoughts**: Shows thoughts from NPCs within 200px of player (closest first)

---

## 🎨 Visual Language

| Color | Meaning |
|-------|---------|
| 🟢 Green | Happy (mood > 0.65) |
| 🔵 Blue | Sad (mood < 0.35) |
| 🔴 Red | Stressed (stress > 0.5) |
| ⚫ Black triangle | Villain (with red pulsing glow) |
| ⚪ White triangle | Hero (with gold pulsing glow) |

| Size | Meaning |
|------|---------|
| Small | Young (age < 3000 ticks) |
| Normal | Adult |
| Large | Elder (age > 12000 ticks) |

---

## 🛠️ Tech Stack

- **[Phaser 3](https://phaser.io/)**: Game engine for rendering and animation
- **[Vite](https://vitejs.dev/)**: Fast dev server and build tool
- **[Convex](https://www.convex.dev/)**: Real-time backend with automatic sync
- **[Groq](https://groq.com/)**: Fast LLM inference (llama-3.3-70b-versatile)
- **[Mem0](https://mem0.ai/)**: Semantic memory and context management
- **TypeScript**: Backend type safety
- **JavaScript**: Frontend game logic

---

## 📁 Project Structure

```
hacktown-phaser-lite/
├── convex/               # Backend (Convex functions)
│   ├── schema.ts         # Database schema (entities, events, memories, etc.)
│   ├── tick.ts           # Cron jobs (worldTick, aiThinkTick, reaperTick)
│   ├── godEvents.ts      # God agent (spawns NPCs, triggers events)
│   ├── conversations.ts  # NPC conversation system
│   ├── ai.ts             # Groq LLM integration
│   ├── memories.ts       # Mem0 memory storage
│   └── worldState.ts     # Global stats and metrics
├── main.js               # Frontend (Phaser game logic)
├── index.html            # HTML + dashboard UI
├── DEMO_SCRIPT.md        # 90-second demo walkthrough
└── README.md             # This file
```

---

## 🔮 Roadmap (Phase 3: Emergent Physics)

**Status**: Deferred until after demo (8-9 hours estimated)

Planned features to reduce token costs and create more organic behavior:

1. **Scalar Fields** (2 hours)
   - Heat maps for danger zones (villains leave "hot" areas that spread and fade)
   - Food density grids (NPCs cluster at high-food areas like café)
   - Spatial memory without expensive LLM calls

2. **Utility Drives** (2-3 hours)
   - Replace LLM movement with hunger/loneliness/curiosity drives
   - Keep LLM only for dialogue generation
   - ~70% reduction in token costs

3. **Boids Flocking** (2-3 hours)
   - Separation, alignment, cohesion for organic crowd movement
   - Natural clustering at social hubs (café, park)
   - Stampede behavior during villain events

4. **Enhanced Hazard Model** (30 min)
   - Sigmoid curves for age-based mortality
   - Correlate death with lived conditions (hungry + stressed + in danger = higher risk)

---

## 🐛 Troubleshooting

**NPCs not moving**:
- Check Convex dashboard - is `worldTick` cron running?
- Run `npx convex dev` to ensure backend is connected

**No AI thoughts**:
- Verify `GROQ_API_KEY` is set: `npx convex env get GROQ_API_KEY`
- Check Groq API quota at [console.groq.com](https://console.groq.com)
- Fallback mode should still show rule-based behavior

**Dashboard shows zeros**:
- Run `npx convex run worldState:initializeWorld` to initialize world state
- Spawn NPCs: `npx convex run godEvents:spawnNPC` (repeat 5-10 times)

**Speech bubbles not showing**:
- Open browser console - look for conversation logs
- Ensure NPCs are within 80px of each other (press `D` to see debug circles)

---

## 📝 License

MIT License - feel free to fork, modify, and build upon this!

---

## ⚙️ Configuration Notes

### Current Setup (Ollama Local LLM)

The project is configured to use **Ollama** (local LLM) via **ngrok tunnel** for maximum privacy and cost control:

- **Model**: `llama3.2:3b` (2GB, fast inference)
- **Tunnel**: Ollama exposed via ngrok for cloud access from Convex
- **Cost**: $0 (runs on your machine)
- **Speed**: ~2-3 seconds per thought

To use Groq instead (faster, cloud-based):
1. Edit [convex/ai.ts:5](convex/ai.ts#L5)
2. Change `const USE_GROQ = false` → `const USE_GROQ = true`
3. Deploy: `npx convex deploy`

### ngrok Setup

Ollama runs locally (port 11434), but Convex backend needs cloud access. ngrok creates a secure tunnel:

```bash
# Start Ollama (if not running)
ollama serve

# Start ngrok tunnel
ngrok http 11434

# Copy the HTTPS URL (e.g., https://xxxx.ngrok.app)
# Update OLLAMA_NGROK_URL in convex/ai.ts
```

**Note**: Free ngrok accounts allow 1 simultaneous tunnel. Paid accounts support multiple.

---

## 🙏 Credits

Built as a 12-hour exploration of emergent AI behavior.

**Inspiration**:
- Westworld's emergent narratives
- The Sims' personality-driven autonomy
- Dwarf Fortress's emergent storytelling

**Tech Stack**:
- [Phaser 3](https://phaser.io/) - Game engine
- [Convex](https://www.convex.dev/) - Real-time backend
- [Ollama](https://ollama.ai/) - Local LLM runtime (llama3.2:3b)
- [ngrok](https://ngrok.com/) - Secure tunneling
- [Groq](https://groq.com/) - Cloud LLM option (llama-3.3-70b)
- [Mem0](https://mem0.ai/) - Semantic memory
