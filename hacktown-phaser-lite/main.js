import Phaser from 'phaser';
import { ConvexHttpClient } from 'convex/browser';

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";
const convex = new ConvexHttpClient(convexUrl);

console.log('🔗 Connecting to Convex at:', convexUrl);

// NPC CLASS - Enhanced with Convex sync
// ============================================================
class NPC {
  constructor(scene, entityData) {
    this.scene = scene;
    this.id = entityData._id;  // Convex ID
    this.name = entityData.name;
    this.color = parseInt(entityData.color);

    // VISUAL PARTS
    this.sprite = scene.add.rectangle(entityData.x, entityData.y, 12, 18, this.color).setOrigin(0.5, 1);
    this.label = scene.add.text(entityData.x, entityData.y-22, this.name, { fontSize: '10px', color: '#fff' }).setOrigin(0.5, 1);
    this.sayText = scene.add.text(entityData.x, entityData.y-34, '', { fontSize: '10px', color: '#fff', backgroundColor:'#0008', padding:{left:4,right:4,top:2,bottom:2}}).setOrigin(0.5, 1);
    this.sayUntil = 0;

    // MOVEMENT - sync from Convex
    this.pos = new Phaser.Math.Vector2(entityData.x, entityData.y);
    this.target = new Phaser.Math.Vector2(entityData.targetX, entityData.targetY);
    this.speed = entityData.speed || 42;

    // CONVEX STATE
    this.convexData = entityData;
  }

  // Update from Convex data
  syncFromConvex(data) {
    this.convexData = data;

    // Update target if changed
    if (data.targetX !== this.target.x || data.targetY !== this.target.y) {
      this.target.set(data.targetX, data.targetY);
    }

    // Show last action if available
    if (data.lastAction && this.scene.nowMs < this.sayUntil) {
      // Don't override currently displaying speech
    } else if (data.lastAction) {
      // Could optionally show lastAction here
    }
  }

  update(dt) {
    // Same movement logic as before
    const d = Phaser.Math.Distance.Between(this.pos.x, this.pos.y, this.target.x, this.target.y);

    if (d > 1) {
      const dirx = (this.target.x - this.pos.x) / d;
      const diry = (this.target.y - this.pos.y) / d;
      this.pos.x += dirx * this.speed * dt;
      this.pos.y += diry * this.speed * dt;

      this.sprite.x = this.pos.x;
      this.sprite.y = this.pos.y;
      this.label.setPosition(this.pos.x, this.pos.y-22);
      this.sayText.setPosition(this.pos.x, this.pos.y-34);
    }

    if (this.scene.nowMs > this.sayUntil) this.sayText.setText('');
  }

  say(line, ms=2500) {
    this.sayText.setText(line);
    this.sayUntil = this.scene.nowMs + ms;
  }
}

// ============================================================
// HACKTOWNSCENE CLASS - Convex-powered version
// ============================================================
class HackTownConvexScene extends Phaser.Scene {
  constructor() { super('hack'); }

  init() {
    this.w = 900; this.h = 520;
    this.origin = new Phaser.Math.Vector2(0,0);
    this.start = performance.now();
    this.nowMs = 0;
    this.agents = new Map();  // Map of ID -> NPC instance
    this.player = null;
    this.cafe = new Phaser.Math.Vector2(620, 290);

    // Convex subscription state
    this.convexEntities = [];
    this.convexWorldState = null;
    this.lastSyncTime = 0;
  }

  preload(){}

  create(){
    // ===== DRAW THE WORLD (Same as before) =====
    this.add.rectangle(0,0,this.w,this.h,0x0c0f14).setOrigin(0);

    const g = this.add.graphics();
    g.lineStyle(1, 0x1b2636, 1);
    for(let x=0;x<=this.w;x+=40){ g.lineBetween(x,0,x,this.h); }
    for(let y=0;y<=this.h;y+=40){ g.lineBetween(0,y,this.w,y); }

    // ===== LANDMARKS =====
    this.add.rectangle(580, 260, 120, 90, 0x335544).setOrigin(0,0).setStrokeStyle(2,0x88aa99);
    this.add.text(640, 255, 'CAFÉ', {color:'#cfe', fontSize:'12px'}).setOrigin(0.5,1);

    this.add.rectangle(160, 120, 180, 120, 0x263a2e).setOrigin(0,0).setStrokeStyle(2,0x6aa386);
    this.add.text(250, 115, 'PARK', {color:'#cfe', fontSize:'12px'}).setOrigin(0.5,1);

    this.add.rectangle(640, 60, 180, 110, 0x3a2b2e).setOrigin(0,0).setStrokeStyle(2,0xbb8899);
    this.add.text(730, 55, 'SCHOOL', {color:'#fde', fontSize:'12px'}).setOrigin(0.5,1);

    // ===== PLAYER CHARACTER =====
    this.player = this.add.rectangle(100, 400, 12, 18, 0xffffff).setOrigin(0.5, 1);
    this.playerLabel = this.add.text(100, 378, 'You', { fontSize:'10px', color:'#fff'}).setOrigin(0.5,1);

    // ===== KEYBOARD CONTROLS =====
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // ===== START CONVEX SUBSCRIPTION =====
    this.startConvexSync();

    console.log('🎮 HackTown Convex Scene created');
  }

  async startConvexSync() {
    console.log('📡 Starting Convex real-time sync...');

    try {
      // Initial fetch
      await this.fetchConvexData();

      // Poll every 1 second (you can replace this with actual subscriptions later)
      this.convexSyncTimer = setInterval(() => {
        this.fetchConvexData();
      }, 1000);

    } catch (error) {
      console.error('❌ Convex sync error:', error);
    }
  }

  async fetchConvexData() {
    try {
      // Fetch entities
      const entities = await convex.query("entities:listEntities");

      // Fetch world state
      const worldState = await convex.query("worldState:getWorldState");

      this.updateFromConvex(entities, worldState);

    } catch (error) {
      console.error('Convex fetch error:', error);
    }
  }

  updateFromConvex(entities, worldState) {
    this.convexWorldState = worldState;

    // Update or create NPCs based on Convex data
    for (const entityData of entities) {
      if (this.agents.has(entityData._id)) {
        // Update existing
        const npc = this.agents.get(entityData._id);
        npc.syncFromConvex(entityData);
      } else {
        // Create new
        const npc = new NPC(this, entityData);
        this.agents.set(entityData._id, npc);
        console.log(`✨ Created NPC: ${entityData.name}`);
      }
    }

    // Update UI
    document.getElementById('agentCount').textContent = String(this.agents.size);
  }

  update(_, dtMS){
    const dt = Math.min(dtMS/1000, 0.033);
    this.nowMs = performance.now() - this.start;

    // ===== CLOCK (Use Convex world time if available) =====
    let minutes, hour, minute, timeStr;

    if (this.convexWorldState && this.convexWorldState.currentTime !== undefined) {
      // Use Convex server time
      minutes = this.convexWorldState.currentTime;
    } else {
      // Fallback to local time
      minutes = Math.floor(this.nowMs / 1000);
    }

    hour = 8 + Math.floor(minutes / 60);
    minute = minutes % 60;
    timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

    const clockEl = document.getElementById('clock');
    if(clockEl) clockEl.textContent = timeStr;

    // ===== PLAYER MOVEMENT =====
    const pvel = new Phaser.Math.Vector2(0,0);
    const speed = 90;

    if (this.cursors.left.isDown || this.keys.A.isDown) pvel.x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) pvel.x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) pvel.y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) pvel.y += 1;

    if (pvel.lengthSq()>0) pvel.normalize().scale(speed*dt);

    this.player.x += pvel.x;
    this.player.y += pvel.y;
    this.playerLabel.setPosition(this.player.x, this.player.y-22);

    // ===== UPDATE ALL NPCs =====
    for (const [id, npc] of this.agents) {
      npc.update(dt);
    }

    // ===== SIMPLE HUD =====
    const hud = document.getElementById('help');
    if (hud && this.convexWorldState) {
      hud.innerHTML = `Convex Mode: <b>${this.agents.size} NPCs</b> synced from server<br/>` +
        `Population: ${this.convexWorldState.population} | Thoughts: ${this.convexWorldState.totalThoughts}`;
    }
  }

  shutdown() {
    // Clean up subscription when scene closes
    if (this.convexSyncTimer) {
      clearInterval(this.convexSyncTimer);
    }
  }
}

// ============================================================
// GAME BOOT
// ============================================================
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 900,
  height: 520,
  backgroundColor: '#0c0f14',
  parent: document.body,
  scene: [HackTownConvexScene]
});

console.log('🚀 HackTown Convex Edition started');
