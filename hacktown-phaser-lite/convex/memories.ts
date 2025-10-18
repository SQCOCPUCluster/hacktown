// Functions for NPC memories (storing and retrieving what NPCs remember)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get recent memories for a specific NPC
export const getMemories = query({
  args: {
    entityId: v.id("entities"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { entityId, limit = 50 }) => {
    // Fetch memories newest first, limited to 50 by default
    return await ctx.db
      .query("memories")
      .withIndex("by_entity", (q) => q.eq("entityId", entityId))
      .order("desc")
      .take(limit);
  },
});

// Save a new memory for an NPC
export const addMemory = mutation({
  args: {
    entityId: v.id("entities"),
    entityName: v.string(),
    text: v.string(),
    timestamp: v.number(),
    importance: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memories", args);
  },
});

// Search an NPC's memories for a specific word
export const searchMemories = query({
  args: {
    entityId: v.id("entities"),
    keyword: v.string(),
  },
  handler: async (ctx, { entityId, keyword }) => {
    // Get all memories for this NPC
    const allMemories = await ctx.db
      .query("memories")
      .withIndex("by_entity", (q) => q.eq("entityId", entityId))
      .collect();

    // Filter for keyword match, sort by importance, return top 10
    return allMemories
      .filter((m) => m.text.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);
  },
});

// Get only important memories (significance > 0.6)
export const getImportantMemories = query({
  args: {
    entityId: v.id("entities"),
  },
  handler: async (ctx, { entityId }) => {
    // Fetch all memories for this NPC
    const allMemories = await ctx.db
      .query("memories")
      .withIndex("by_entity", (q) => q.eq("entityId", entityId))
      .collect();

    // Filter for high importance, sort by time, return top 10
    return allMemories
      .filter((m) => m.importance > 0.6)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  },
});
