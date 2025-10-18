// Functions for world events (festivals, storms, etc.)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all events currently happening
export const getActiveEvents = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

// Start a new event (like a storm or festival)
export const createEvent = mutation({
  args: {
    type: v.string(),
    description: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    stressModifier: v.number(),
    dangerModifier: v.number(),
  },
  handler: async (ctx, args) => {
    // Create event and mark it as active
    return await ctx.db.insert("events", {
      ...args,
      active: true,
    });
  },
});

// Stop an event manually
export const endEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { active: false });
  },
});

// Automatically end events that have passed their end time
export const updateEventStatus = mutation({
  args: { currentTime: v.number() },
  handler: async (ctx, { currentTime }) => {
    const events = await ctx.db.query("events").collect();

    // Check each event and end it if time has passed
    for (const event of events) {
      if (event.active && currentTime > event.endTime) {
        await ctx.db.patch(event._id, { active: false });
      }
    }
  },
});
