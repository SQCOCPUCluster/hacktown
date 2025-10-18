# 12-Hour Vibe-Coded Build Plan

A step-by-step guide to building a living little world on screen. No fluff, just the beats you need to hit.

---

## Hour 0–1 — Put the stage up (Phaser) + plug in the brainstem (Convex)

**What:**

* Start a fresh Phaser project so you can draw a map and a few characters.
* Start a Convex project so there's a always-on "world brain" in the cloud.
* Make one simple data table for "entities" (id, x, y, name).

**Why:**
You need a *place to see stuff* (Phaser) and a *place to remember stuff* (Convex). Without both, nothing feels alive.

**Checkpoint:**
You can see a character on screen and move it; Convex can list those entities.

---

## Hour 1–3 — Make the world breathe (real-time sync loop)

**What:**

* Connect the browser to Convex so the game **pulls** the latest world state and **listens** for changes.
* Add a tiny "tick" in Convex (runs every second) that nudges NPC positions a little.

**Why:**
Real-time sync is the heart beat. Even random motion makes the world feel awake before any AI shows up.

**Checkpoint:**
You stop touching the keyboard; characters still drift because the backend says so.

---

## Hour 3–4 — Give every character a seed personality (at birth)

**What:**

* When an NPC is created, store a small personality bundle (e.g., curiosity, empathy, boldness, order, mood, weirdness; values 0–1).
* Save it with the agent record.

**Why:**
Personality is the gravitational field for choices. It makes later decisions coherent instead of noise.

**Checkpoint:**
Newly spawned agents each have personality numbers stored; you can print them in the console.

---

## Hour 4–5 — Add a first mind (Groq) to decide "what next"

**What:**

* On each tick, pick a few agents.
* Send a short prompt to Groq with **who they are** (name + personality) and **what's around** (simple context).
* Store Groq's one-line "next action" text.

**Why:**
Now motion and speech come from *reasons*, not just randomness. Even simple lines feel alive.

**Checkpoint:**
You see a stream of short "thoughts" being saved (e.g., "Walks toward the fountain.").

---

## Hour 5–6 — Let them speak on screen (tiny UI pass)

**What:**

* In Phaser, show a small speech bubble or nameplate above each character with the last action text.
* Update it whenever Convex state changes.

**Why:**
Visible thoughts create story. People watching instantly feel patterns instead of staring at aimless dots.

**Checkpoint:**
Bubbles change without page refresh as the backend updates.

---

## Hour 6–7 — Add memory (store, then recall)

**What:**

* When an agent acts or interacts, save a one-line memory ("Bob greeted Alice at the market").
* Add a vector/"semantic" index to the memory table.
* Next time the agent thinks, pull the top 3–5 relevant memories and include them in the Groq prompt.

**Why:**
Memory gives continuity. Agents start doing callbacks to their own past, which reads as personality.

**Checkpoint:**
You can inspect an agent and see short memories being saved and retrieved.

---

## Hour 7–8 — Add mortality (small, composable risk)

**What:**

* Each tick, compute a tiny per-agent death chance using: baseline × age × health × stress × danger × population pressure.
* If the dice hit, mark `alive = false`, record a "death" event.

**Why:**
Turnover creates stakes. Rooms empty, new folks appear. That churn is what makes the world feel like time is passing.

**Checkpoint:**
Over a few minutes, at least one agent dies and fades from the screen.

---

## Hour 8–9 — Add the God Agent (creation + events)

**What:**

* A second cron that runs every few minutes:

  * Sometimes **spawns** a new agent (with personality seed).
  * Sometimes **fires an event** (festival, storm, villain). Events briefly modify stress/danger and influence behavior.

**Why:**
Top-down rhythm makes population ebb and flow. It prevents stagnation and creates chapters in the day.

**Checkpoint:**
You can see new names appear. During an event, speech and motion feel different (more cautious, more social, etc.).

---

## Hour 9–10 — Sand down rough edges (smoothing + safety rails)

**What:**

* Smooth movement in Phaser (interpolate between positions so motion glides).
* Throttle backend updates to ~5–10 times per second; don't spam the network.
* Put a cap on how many agents think each tick (e.g., 5–10) to control token costs.
* Cache repeated LLM prompts/answers for a few minutes.

**Why:**
Polish buys you "this feels pro" without building a whole engine. Guards keep the bill predictable.

**Checkpoint:**
Movement looks fluid, CPU/fan is calm, token count isn't exploding.

---

## Hour 10–11 — Make it presentable (readability + vibe)

**What:**

* Tint sprites or add colored auras based on mood/personality (calm = cool tone, bold = hotter tone).
* Add a tiny dashboard overlay:

  * "Alive: 87 | Births: 12 | Deaths: 5 | Thoughts today: 312"
* Give the world a short name and title card.

**Why:**
Observers can read the room at a glance. Numbers make the "living system" idea obvious.

**Checkpoint:**
One glance tells a newcomer what's happening without you explaining.

---

## Hour 11–12 — Lock the demo (script + recording + fallback)

**What:**

* Write a 60-second demo script:

  1. "Here's the stage (Phaser)."
  2. "Here's the brain (Convex) beating every second."
  3. "Here's thought and memory (Groq + vector recall)."
  4. "Here's life and death (hazard)."
  5. "Here's God mode (spawn + events)."
* Record a 90-second screen capture.
* Prepare a **plan B** switch: if Groq rate-limits, fall back to canned lines for a minute (world still runs).

**Why:**
A demo isn't code; it's a story. You need one clean path that always works—even if the AI hiccups.

**Checkpoint:**
You have a video, a live build, and a one-page explainer. You're demo-proof.

---

# Guardrails & Recovery Buttons

* **If LLM is slow:** reduce "agents per tick" from 10 → 3; reuse last action for others.
* **If FPS dips:** stop rendering speech for off-screen NPCs; lower sprite count temporarily.
* **If tokens spike:** cache identical prompts; length-limit memories passed to Groq.
* **If nothing interesting happens:** temporarily boost "event frequency" and "boldness" during demo.

---

# What you'll have at the end

* A browser window where little people **move**, **speak**, **remember**, **die**, and **new ones appear**—all driven by a simple, understandable loop.
* A short recording and a one-page overview you can send to anyone.
* A codebase that's small but extensible: personalities can deepen, events can chain, art can improve later.