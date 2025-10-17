import Phaser from 'phaser';
import time
from mem0 import MemoryClient
// ============================================================
// NPC CLASS - This is a "person" in the game world
// ============================================================
// Think of this as a template for creating characters.
// Each NPC has a body (rectangle), a name tag, speech bubble,
// memories, and a daily schedule of where to go.

class NPC {
  // Constructor = the "birth" of an NPC. We give them a name, color, and starting position
  constructor(scene, name, color, x, y) {
    this.scene = scene;           // The game world they live in
    this.name = name;              // Their name (e.g., "Alice")
    this.color = color;            // Their color (hex code like 0x5fa8d3)

    // VISUAL PARTS: What you see on screen
    this.sprite = scene.add.rectangle(x, y, 12, 18, color).setOrigin(0.5, 1);  // Their body (a colored rectangle)
    this.label = scene.add.text(x, y-22, name, { fontSize: '10px', color: '#fff' }).setOrigin(0.5, 1);  // Name tag floating above
    this.sayText = scene.add.text(x, y-34, '', { fontSize: '10px', color: '#fff', backgroundColor:'#0008', padding:{left:4,right:4,top:2,bottom:2}}).setOrigin(0.5, 1);  // Speech bubble
    this.sayUntil = 0;             // Timer: when to clear the speech bubble

    // MOVEMENT: Where they are and where they're going
    this.pos = new Phaser.Math.Vector2(x, y);      // Current position (x, y coordinates)
    this.target = new Phaser.Math.Vector2(x, y);   // Where they want to walk to
    this.speed = 42;               // How fast they walk (pixels per second)

    // BRAIN: Memory and schedule
    this.memories = [];            // List of things they remember: {text, ts, importance}
    this.schedule = [];            // Daily agenda: [{t:'08:00', x, y}] = "At 8am, go to (x,y)"
    this.nextScheduleIdx = 0;      // Which schedule item they're working on next
  }

  // UPDATE - Called every frame (~60 times per second). Makes the NPC walk toward their target
  update(dt) {
    // Calculate distance to target
    const d = Phaser.Math.Distance.Between(this.pos.x, this.pos.y, this.target.x, this.target.y);

    // If they're not at the target yet, move toward it
    if (d > 1) {
      const dirx = (this.target.x - this.pos.x) / d;  // X direction (normalized)
      const diry = (this.target.y - this.pos.y) / d;  // Y direction (normalized)
      this.pos.x += dirx * this.speed * dt;           // Move X position
      this.pos.y += diry * this.speed * dt;           // Move Y position

      // Update visual position of body and labels to match new position
      this.sprite.x = this.pos.x;
      this.sprite.y = this.pos.y;
      this.label.setPosition(this.pos.x, this.pos.y-22);
      this.sayText.setPosition(this.pos.x, this.pos.y-34);
    }

    // If speech bubble time expired, clear it
    if (this.scene.nowMs > this.sayUntil) this.sayText.setText('');
  }

  // SAY - Makes the NPC "talk" (shows text in speech bubble for a few seconds)
  say(line, ms=2500) {
    this.sayText.setText(line);
    this.sayUntil = this.scene.nowMs + ms;  // Show for 2.5 seconds by default
  }

  // REMEMBER - Adds a new memory to their brain
  remember(text, importance=0.5) {
    this.memories.push({ text, ts: this.scene.nowMs, importance });
    if (this.memories.length > 200) this.memories.shift();  // Forget old memories if over 200
  }

  // KNOWS CAFE EVENT - Checks if they heard about the 6pm café meetup
  // Looks at last 50 memories for keywords like "cafe", "meet", "18"
  knowsCafeEvent() {
    return this.memories.slice(-50).some(m => /cafe.*(meet|party|18)/i.test(m.text));
  }

  // PLAN FOR - Checks if it's time to go to next scheduled location
  // Example: If schedule says "09:00 go to café" and current time is 09:05, set target to café
  planFor(timeStr) {
    while (this.nextScheduleIdx < this.schedule.length && this.schedule[this.nextScheduleIdx].t <= timeStr) {
      const it = this.schedule[this.nextScheduleIdx];
      this.target.set(it.x, it.y);  // Update target to next scheduled location
      this.nextScheduleIdx++;
    }
  }
}

// ============================================================
// HACKTOWNSCENE CLASS - The main game world/level
// ============================================================
// This is where everything happens: the map, NPCs, player, and game loop

class HackTownScene extends Phaser.Scene {
  constructor() { super('hack'); }  // Name this scene 'hack'

  // INIT - Runs first, sets up basic variables
  init() {
    this.w = 900; this.h = 520;    // World size (width x height in pixels)
    this.origin = new Phaser.Math.Vector2(0,0);  // Top-left corner
    this.start = performance.now();   // Record when the game started (for time calculations)
    this.nowMs = 0;                   // Current game time in milliseconds
    this.agents = [];                 // List to hold all NPCs
    this.player = null;               // Will hold the player character
    this.cafe = new Phaser.Math.Vector2(620, 290);  // Café location (the meetup spot!)
  }

  // PRELOAD - Normally loads images/sounds, but we're using rectangles so it's empty
  preload(){}

  // CREATE - Runs once at start, sets up the world
  create(){
    // ===== DRAW THE WORLD =====

    // Background: dark rectangle covering the whole screen
    this.add.rectangle(0,0,this.w,this.h,0x0c0f14).setOrigin(0);

    // Grid lines: makes it look like graph paper
    const g = this.add.graphics();
    g.lineStyle(1, 0x1b2636, 1);
    for(let x=0;x<=this.w;x+=40){ g.lineBetween(x,0,x,this.h); }  // Vertical lines
    for(let y=0;y<=this.h;y+=40){ g.lineBetween(0,y,this.w,y); }  // Horizontal lines

    // ===== LANDMARKS (Places NPCs can visit) =====

    // CAFÉ - The main meeting spot at 6pm
    this.add.rectangle(580, 260, 120, 90, 0x335544).setOrigin(0,0).setStrokeStyle(2,0x88aa99);
    this.add.text(640, 255, 'CAFÉ', {color:'#cfe', fontSize:'12px'}).setOrigin(0.5,1);

    // PARK - Green space for hanging out
    this.add.rectangle(160, 120, 180, 120, 0x263a2e).setOrigin(0,0).setStrokeStyle(2,0x6aa386);
    this.add.text(250, 115, 'PARK', {color:'#cfe', fontSize:'12px'}).setOrigin(0.5,1);

    // SCHOOL - Education building
    this.add.rectangle(640, 60, 180, 110, 0x3a2b2e).setOrigin(0,0).setStrokeStyle(2,0xbb8899);
    this.add.text(730, 55, 'SCHOOL', {color:'#fde', fontSize:'12px'}).setOrigin(0.5,1);

    // ===== PLAYER CHARACTER (You!) =====
    this.player = this.add.rectangle(100, 400, 12, 18, 0xffffff).setOrigin(0.5, 1);  // White rectangle
    this.playerLabel = this.add.text(100, 378, 'You', { fontSize:'10px', color:'#fff'}).setOrigin(0.5,1);

    // ===== KEYBOARD CONTROLS =====
    this.cursors = this.input.keyboard.createCursorKeys();  // Arrow keys
    this.keys = this.input.keyboard.addKeys('W,A,S,D');     // WASD keys

    // ===== CREATE THE 5 NPCs =====
    // Helper function to quickly create NPCs and add them to our list
    const A = (name, color, x, y) => {
      const n = new NPC(this, name, color, x, y);
      this.agents.push(n); return n;
    };

    const alice = A('Alice', 0x5fa8d3, 220, 160);  // Blue
    const ben   = A('Ben',   0xd85f5f, 480, 340);  // Red
    const chloe = A('Chloe', 0x9acd32, 740, 120);  // Yellow-green
    const diego = A('Diego', 0xffaf40, 140, 420);  // Orange
    const eve   = A('Eve',   0xc084fc, 360, 220);  // Purple

    // ===== SEED MEMORIES (Initial thoughts each NPC starts with) =====
    // Alice is the organizer - she plans the café meetup
    alice.remember('I plan a small meetup at the cafe at 18:00 to talk side projects.', 0.9);
    // Others have related interests that make them receptive to the invitation
    ben.remember('Alice often hosts meetups.', 0.5);
    chloe.remember('I want to meet more builders.', 0.6);
    diego.remember('I enjoy talking about app ideas at the cafe.', 0.5);
    eve.remember('I should socialize after school.', 0.5);

    // ===== DAILY SCHEDULES (Where each NPC goes during the day) =====
    // Format: {t:'HH:MM', x, y} = "At this time, walk to this (x,y) location"

    alice.schedule = [
      {t:'08:15', x:260,y:170}, // Morning: go to park
      {t:'09:30', x:610,y:300}, // Work at café
      {t:'12:00', x:350,y:240}, // Lunch break
      {t:'15:00', x:610,y:300}, // Back to café
      {t:'17:50', x:610,y:300}  // Arrive early for 6pm meetup
    ];

    ben.schedule = [
      {t:'09:00', x:350,y:240},
      {t:'10:30', x:480,y:340},
      {t:'17:45', x:630,y:300}  // Head to café before 6pm
    ];

    chloe.schedule = [
      {t:'09:00', x:730,y:120}, // School all day
      {t:'16:30', x:260,y:170}, // Park after school
      {t:'18:00', x:620,y:300}  // Café at 6pm sharp
    ];

    diego.schedule = [
      {t:'09:30', x:420,y:360},
      {t:'12:30', x:610,y:300},
      {t:'18:00', x:630,y:300}
    ];

    eve.schedule = [
      {t:'08:30', x:360,y:220},
      {t:'15:30', x:260,y:170},
      {t:'18:05', x:625,y:295}  // Fashionably late to café
    ];

    // Update the HTML display with NPC count
    document.getElementById('agentCount').textContent = String(this.agents.length);
  }
  // UPDATE - The game loop! Runs ~60 times per second (60 FPS)
  // This is where all the magic happens: time passes, player moves, NPCs think and talk
  update(_, dtMS){
    // dt = "delta time" = time since last frame (prevents jittery movement)
    const dt = Math.min(dtMS/1000, 0.033);  // Cap at 33ms to avoid huge jumps
    this.nowMs = performance.now() - this.start;  // How long the game has been running

    // ===== FAST-FORWARD CLOCK =====
    // 1 real second = 1 simulated minute. Day starts at 08:00
    const minutes = Math.floor(this.nowMs / 1000);  // Convert milliseconds to minutes
    const hour = 8 + Math.floor(minutes / 60);      // Hour (starts at 8am)
    const minute = minutes % 60;                    // Minute within the hour
    const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;  // Format: "08:15"

    // Update clock display on screen
    const clockEl = document.getElementById('clock');
    if(clockEl) clockEl.textContent = timeStr;

    // ===== PLAYER MOVEMENT (Arrow keys or WASD) =====
    const pvel = new Phaser.Math.Vector2(0,0);  // Player velocity vector
    const speed = 90;  // Pixels per second

    // Check which keys are pressed and set direction
    if (this.cursors.left.isDown || this.keys.A.isDown) pvel.x -= 1;   // Left
    if (this.cursors.right.isDown || this.keys.D.isDown) pvel.x += 1;  // Right
    if (this.cursors.up.isDown || this.keys.W.isDown) pvel.y -= 1;     // Up
    if (this.cursors.down.isDown || this.keys.S.isDown) pvel.y += 1;   // Down

    // Normalize diagonal movement so you don't move faster diagonally
    if (pvel.lengthSq()>0) pvel.normalize().scale(speed*dt);

    // Actually move the player
    this.player.x += pvel.x;
    this.player.y += pvel.y;
    this.playerLabel.setPosition(this.player.x, this.player.y-22);

    // ===== NPC BRAIN TICKS (Each NPC thinks and acts) =====
    for (const a of this.agents) {
      // Check if NPC should move to next scheduled location
      a.planFor(timeStr);

      // ===== PROXIMITY CHAT (NPCs talk when near each other) =====
      const near = nearestAgent(a, this.agents);  // Find closest other NPC
      // If someone is within 26 pixels AND we randomly decide to talk (2% chance per frame)
      if (near && Phaser.Math.Distance.BetweenPoints(a.pos, near.pos) < 26 && Math.random() < 0.02) {
        // Alice spreads the invitation before 6pm
        if (a.name === 'Alice' && hour < 18) {
          a.say(`Hey ${near.name}, café at 18:00?`);
          near.remember('Heard invitation from Alice for cafe at 18:00.', 0.7);  // Near NPC remembers!
        }
        // If this NPC already knows about café event, they spread the word too
        else if (a.knowsCafeEvent()) {
          a.say(`See you at the café later?`);
        }
        // Otherwise just random small talk
        else {
          a.say(smallTalk());
        }
      }

      // ===== CAFÉ CONVERGENCE (17:45-18:20: Everyone who knows heads to café) =====
      const t = hour*60 + minute;  // Convert time to total minutes (e.g., 18:00 = 1080 minutes)
      // If it's between 5:45pm and 6:20pm, AND this NPC knows about the event...
      if (t >= 17*60+45 && t <= 18*60+20 && (a.knowsCafeEvent())) {
        // Set their target to café (with slight randomness so they don't all stand in one spot)
        a.target.copy(this.cafe).add(new Phaser.Math.Vector2(rand(-12,12), rand(-8,8)));
      }

      // Update NPC movement
      a.update(dt);
    }
  }
}

// ============================================================
// HELPER FUNCTIONS - Utility functions used throughout the game
// ============================================================

// NEARESTAGENT - Finds the closest NPC to a given NPC
// Used for proximity chat: NPCs only talk to their nearest neighbor
function nearestAgent(me, list){
  let best = null;        // The closest NPC found so far
  let bestd = 1e9;        // Distance to closest NPC (start with huge number)

  // Loop through all NPCs
  for (const p of list){
    if (p === me) continue;  // Skip self (can't talk to yourself!)

    // Calculate distance from 'me' to this NPC
    const d = Phaser.Math.Distance.BetweenPoints(me.pos, p.pos);

    // If this NPC is closer than previous closest, update
    if (d < bestd){
      best = p;
      bestd = d;
    }
  }
  return best;  // Return the closest NPC (or null if list was empty)
}

// SMALLTALK - Returns a random piece of casual conversation
// Used when NPCs don't have anything important to say
function smallTalk(){
  const lines = [
    'Ship something tiny today.',
    'Coffee then code?',
    'Got an idea for onboarding…',
    'Need a name for my app.',
    'Trying a new UI pattern.'
  ];
  // Pick a random line from the array
  return lines[(Math.random()*lines.length)|0];  // |0 truncates to integer
}

// RAND - Returns a random number between a and b
// Example: rand(5, 10) might return 7.3
const rand = (a,b)=> a + Math.random()*(b-a);

// ============================================================
// GAME BOOT - Start the Phaser game engine
// ============================================================
// This creates the game window and loads our HackTownScene
const game = new Phaser.Game({
  type: Phaser.AUTO,           // Auto-detect WebGL or Canvas renderer
  width: 900,                  // Game window width
  height: 520,                 // Game window height
  backgroundColor: '#0c0f14',  // Dark background color
  parent: document.body,       // Attach game canvas to the <body> element
  scene: [HackTownScene]       // List of scenes to load (we only have one)
});
