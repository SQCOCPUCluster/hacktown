// Functions for global world stats (time, population, births/deaths)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get the current world statistics
export const getWorldState = query({
  handler: async (ctx) => {
    const state = await ctx.db.query("worldState").first();
    if (!state) {
      // Return default values if world not initialized yet
      return {
        currentTime: 0,
        population: 0,
        totalBirths: 0,
        totalDeaths: 0,
        totalThoughts: 0,
        lastTickTime: Date.now(),
      };
    }
    return state;
  },
});

// Set up the world for the first time
export const initializeWorld = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("worldState").first();
    if (existing) {
      return existing._id;  // Already initialized, do nothing
    }

    // Create initial world state with zero values
    return await ctx.db.insert("worldState", {
      currentTime: 0,
      population: 0,
      totalBirths: 0,
      totalDeaths: 0,
      totalThoughts: 0,
      lastTickTime: Date.now(),
    });
  },
});

// Move time forward (usually called every few seconds)
export const tickWorld = mutation({
  args: {
    deltaMinutes: v.number(),
  },
  handler: async (ctx, { deltaMinutes }) => {
    const state = await ctx.db.query("worldState").first();
    if (!state) return;

    // Add time to the simulation clock
    await ctx.db.patch(state._id, {
      currentTime: state.currentTime + deltaMinutes,
      lastTickTime: Date.now(),
    });
  },
});

// Count another AI thought being generated
export const incrementThoughts = mutation({
  handler: async (ctx) => {
    const state = await ctx.db.query("worldState").first();
    if (!state) return;

    await ctx.db.patch(state._id, {
      totalThoughts: state.totalThoughts + 1,
    });
  },
});

// Track population changes (births and deaths)
export const updatePopulation = mutation({
  args: {
    delta: v.number(),  // +1 for birth, -1 for death
  },
  handler: async (ctx, { delta }) => {
    const state = await ctx.db.query("worldState").first();
    if (!state) return;

    const updates: any = {
      population: state.population + delta,
    };

    // Track whether this was a birth or death
    if (delta > 0) {
      updates.totalBirths = state.totalBirths + 1;
    } else if (delta < 0) {
      updates.totalDeaths = state.totalDeaths + 1;
    }

    await ctx.db.patch(state._id, updates);
  },
});
