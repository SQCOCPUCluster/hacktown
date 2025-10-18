// Database blueprint - defines what tables exist and what data they hold
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // NPCs table - all the characters in your world
  entities: defineTable({
    name: v.string(),                        // Character's name
    color: v.string(),                       // Display color (hex code)
    x: v.number(),                           // Current X position
    y: v.number(),                           // Current Y position
    targetX: v.number(),                     // Where walking to (X)
    targetY: v.number(),                     // Where walking to (Y)
    speed: v.number(),                       // Movement speed
    personality: v.object({                  // Six traits defining behavior
      curiosity: v.number(),                 // Interest in new things (0-1)
      empathy: v.number(),                   // Care for others (0-1)
      boldness: v.number(),                  // Willingness to take risks (0-1)
      order: v.number(),                     // Organization level (0-1)
      mood: v.number(),                      // Current happiness (0-1)
      weirdness: v.number(),                 // Quirkiness (0-1)
    }),
    alive: v.boolean(),                      // Is character alive?
    health: v.number(),                      // Health (0-1)
    stress: v.number(),                      // Stress level (0-1)
    age: v.number(),                         // Age in simulation time
    lastAction: v.optional(v.string()),      // Current action
    lastThought: v.optional(v.string()),     // Current thought
  }).index("by_alive", ["alive"]),           // Index to quickly find living NPCs

  // Memories table - what NPCs remember
  memories: defineTable({
    entityId: v.id("entities"),              // Which NPC owns this memory
    entityName: v.string(),                  // NPC name for convenience
    text: v.string(),                        // The memory content
    timestamp: v.number(),                   // When it happened
    importance: v.number(),                  // How significant (0-1)
  }).index("by_entity", ["entityId"])        // Find all memories for one NPC
    .index("by_entity_time", ["entityId", "timestamp"]), // Find memories by NPC + time

  // Events table - things happening in the world
  events: defineTable({
    type: v.string(),                        // Event category
    description: v.string(),                 // What's happening
    startTime: v.number(),                   // When it starts
    endTime: v.number(),                     // When it ends
    active: v.boolean(),                     // Currently happening?
    stressModifier: v.number(),              // Effect on NPC stress
    dangerModifier: v.number(),              // Danger level
  }).index("by_active", ["active"]),         // Find active events quickly

  // World state table - global simulation stats
  worldState: defineTable({
    currentTime: v.number(),                 // Current simulation time
    population: v.number(),                  // Living NPCs count
    totalBirths: v.number(),                 // All-time births
    totalDeaths: v.number(),                 // All-time deaths
    totalThoughts: v.number(),               // AI thoughts generated
    lastTickTime: v.number(),                // Last update timestamp
  }),
});
