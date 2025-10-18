// Utility-driven behavior system - NPCs decide actions based on internal needs
// Replaces expensive LLM movement calls with cheap mathematical utility scoring
// LLM still used for dialogue generation (best of both worlds!)

import { internal } from "./_generated/api";
import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE } from "./fields";
import { LOCATIONS } from "./locations";

// ============================================================
// UTILITY SYSTEM - NPCs choose actions by comparing scores
// ============================================================

// Action types that NPCs can perform
export type UtilityAction =
  | "SEEK_FOOD"      // Go to high food areas (café, park)
  | "SOCIALIZE"      // Seek out other NPCs to talk to
  | "EXPLORE"        // Wander to new/random places
  | "AVOID_HEAT"     // Flee from danger zones
  | "LOITER"         // Stay near current position, relax
  | "SEEK_SAFETY"    // Go to familiar safe landmarks
  | "SEEK_FAITH";    // Go to church for spiritual solace (despair/guilt driven)

// Utility score for each action (0-1, higher = more desirable)
export interface UtilityScores {
  SEEK_FOOD: number;
  SOCIALIZE: number;
  EXPLORE: number;
  AVOID_HEAT: number;
  LOITER: number;
  SEEK_SAFETY: number;
  SEEK_FAITH: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Clamp value between 0 and 1
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find argmax - return key with highest value
 */
function argmax(scores: UtilityScores): UtilityAction {
  let maxAction: UtilityAction = "LOITER";
  let maxScore = -Infinity;

  for (const [action, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxAction = action as UtilityAction;
    }
  }

  return maxAction;
}

/**
 * Sample field value at position (simplified for server-side)
 * Returns cached field values from context
 */
function sampleFieldFromCache(
  x: number,
  y: number,
  type: "heat" | "food" | "trauma",
  fieldCache: Array<{ gridX: number; gridY: number; type: string; value: number }>
): number {
  // Convert world coordinates to grid coordinates
  const gridX = Math.floor(x / CELL_SIZE);
  const gridY = Math.floor(y / CELL_SIZE);

  // Clamp to grid bounds
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, gridX));
  const clampedY = Math.max(0, Math.min(GRID_HEIGHT - 1, gridY));

  // Find cell in cache
  const cell = fieldCache.find(
    (c) => c.type === type && c.gridX === clampedX && c.gridY === clampedY
  );

  return cell?.value ?? 0;
}

/**
 * Count nearby NPCs within radius (for social/flocking calculations)
 */
function countNearbyNPCs(
  entity: any,
  allNPCs: any[],
  radius: number
): number {
  let count = 0;
  for (const other of allNPCs) {
    if (other._id === entity._id) continue; // Skip self
    const dist = distance(entity.x, entity.y, other.x, other.y);
    if (dist < radius) count++;
  }
  return count;
}

/**
 * Calculate average mood of nearby NPCs (for emotional contagion)
 */
function averageNearbyMood(
  entity: any,
  allNPCs: any[],
  radius: number
): number | null {
  const nearbyMoods: number[] = [];
  for (const other of allNPCs) {
    if (other._id === entity._id) continue; // Skip self
    const dist = distance(entity.x, entity.y, other.x, other.y);
    if (dist < radius) {
      nearbyMoods.push(other.personality.mood ?? 0.5);
    }
  }

  if (nearbyMoods.length === 0) return null;
  return nearbyMoods.reduce((a, b) => a + b, 0) / nearbyMoods.length;
}

/**
 * Find direction away from highest heat (for AVOID_HEAT)
 */
function findSafeDirection(
  entity: any,
  fieldCache: Array<{ gridX: number; gridY: number; type: string; value: number }>
): { x: number; y: number } {
  const currentHeat = sampleFieldFromCache(entity.x, entity.y, "heat", fieldCache);

  // Sample heat in 8 directions
  const sampleRadius = 120;
  const directions = [
    { dx: 1, dy: 0 },   // Right
    { dx: -1, dy: 0 },  // Left
    { dx: 0, dy: 1 },   // Down
    { dx: 0, dy: -1 },  // Up
    { dx: 1, dy: 1 },   // Down-right
    { dx: -1, dy: 1 },  // Down-left
    { dx: 1, dy: -1 },  // Up-right
    { dx: -1, dy: -1 }, // Up-left
  ];

  let safestDirection = directions[0];
  let lowestHeat = currentHeat;

  for (const dir of directions) {
    const testX = entity.x + dir.dx * sampleRadius;
    const testY = entity.y + dir.dy * sampleRadius;

    // Clamp to world bounds
    const clampedX = Math.max(50, Math.min(850, testX));
    const clampedY = Math.max(50, Math.min(470, testY));

    const heatInDirection = sampleFieldFromCache(clampedX, clampedY, "heat", fieldCache);

    if (heatInDirection < lowestHeat) {
      lowestHeat = heatInDirection;
      safestDirection = dir;
    }
  }

  // Return target position in safest direction
  const targetX = Math.max(50, Math.min(850, entity.x + safestDirection.dx * sampleRadius));
  const targetY = Math.max(50, Math.min(470, entity.y + safestDirection.dy * sampleRadius));

  return { x: targetX, y: targetY };
}

// ============================================================
// MAIN UTILITY CALCULATION
// ============================================================

/**
 * Calculate utility scores for all actions based on NPC's current state
 * Returns the action with highest utility
 */
export function decideAction(
  entity: any,
  allNPCs: any[],
  fieldCache: Array<{ gridX: number; gridY: number; type: string; value: number }>
): UtilityAction {
  // Extract NPC state
  const energy = entity.energy ?? 0.7;
  const social = entity.social ?? 0.5;
  const safety = entity.safety ?? 0.6;
  const stress = entity.stress ?? 0.3;
  const mood = entity.personality.mood ?? 0.5;

  // Sample local fields
  const localHeat = sampleFieldFromCache(entity.x, entity.y, "heat", fieldCache);
  const localFood = sampleFieldFromCache(entity.x, entity.y, "food", fieldCache);
  const localTrauma = sampleFieldFromCache(entity.x, entity.y, "trauma", fieldCache);

  // Count nearby NPCs
  const nearbyCount = countNearbyNPCs(entity, allNPCs, 80);
  const crowded = nearbyCount > 3;

  // ============================================================
  // CALCULATE UTILITY SCORES (0-1 scale)
  // ============================================================

  // HUNGER DRIVE - Low energy → seek food
  const hungerUrgency = clamp01(1 - energy); // 0=full, 1=starving
  const foodAvailable = clamp01(localFood);
  const SEEK_FOOD_SCORE =
    0.7 * hungerUrgency +                    // Hungry? Go find food!
    0.2 * (1 - foodAvailable) +               // Not here? Go elsewhere!
    0.1 * (nearbyCount / 5);                  // Others here? Social eating bonus

  // LONELINESS DRIVE - Low social → seek others
  const lonelinessUrgency = clamp01(1 - social);
  const SOCIALIZE_SCORE =
    0.8 * lonelinessUrgency +                 // Lonely? Find friends!
    0.3 * (nearbyCount / 5) +                 // Others nearby? Join them!
    0.2 * entity.personality.empathy +        // Empathetic people love socializing
    -0.4 * localHeat +                        // Don't socialize in danger zones
    -0.2 * crowded;                           // Avoid crowding (boids separation)

  // CURIOSITY DRIVE - Explore new places
  const EXPLORE_SCORE =
    0.7 * entity.personality.curiosity +      // Curious NPCs wander
    0.2 * energy +                            // Need energy to explore
    -0.3 * localHeat +                        // Don't explore danger zones
    -0.2 * hungerUrgency +                    // Can't explore while starving
    -0.1 * lonelinessUrgency;                 // Can't explore while lonely

  // FEAR DRIVE - Avoid danger zones (heat = danger)
  const dangerLevel = clamp01(localHeat + localTrauma * 0.5);
  const AVOID_HEAT_SCORE =
    0.8 * dangerLevel +                       // High heat? RUN!
    0.3 * stress +                            // Stressed? Extra cautious
    0.2 * (1 - entity.personality.boldness) + // Timid NPCs flee faster
    0.1 * (nearbyCount > 0 ? 0.3 : 0);        // Herd alarm (others fleeing?)

  // COMFORT DRIVE - Stay in safe, familiar places
  const comfortLevel = clamp01(1 - localHeat);
  const LOITER_SCORE =
    0.4 * comfortLevel +                      // Safe here? Stay put
    0.3 * energy +                            // Well-fed? Can relax
    0.2 * social +                            // Socially satisfied? Just chill
    0.1 * (1 - entity.personality.curiosity) + // Low curiosity = homebody
    -0.3 * hungerUrgency +                    // Can't loiter while starving
    -0.2 * lonelinessUrgency;                 // Can't loiter while lonely

  // SAFETY DRIVE - Go to known safe landmarks
  const SEEK_SAFETY_SCORE =
    0.6 * stress +                            // Stressed? Seek comfort
    0.4 * dangerLevel +                       // Danger nearby? Flee to safety
    0.2 * (1 - energy) +                      // Low energy? Go to café
    0.1 * entity.personality.order;           // Orderly NPCs prefer landmarks

  // FAITH DRIVE - Seek spiritual solace at church (despair/guilt/trauma driven)
  const despair = entity.despair ?? 0;
  const traumaCount = entity.traumaMemories?.length ?? 0;
  const traumaUrgency = clamp01(traumaCount / 5); // 0-5 traumas normalized
  const SEEK_FAITH_SCORE =
    0.7 * despair +                           // High despair → seek meaning/salvation
    0.5 * stress +                            // Stressed → seek spiritual comfort
    0.4 * traumaUrgency +                     // Traumatized → seek redemption
    0.3 * localTrauma +                       // Trauma field → seek church sanctuary
    0.2 * (1 - mood) +                        // Low mood → seek hope
    -0.3 * entity.personality.boldness +      // Timid NPCs more religious
    -0.2 * energy;                            // Need energy to walk to church

  const scores: UtilityScores = {
    SEEK_FOOD: SEEK_FOOD_SCORE,
    SOCIALIZE: SOCIALIZE_SCORE,
    EXPLORE: EXPLORE_SCORE,
    AVOID_HEAT: AVOID_HEAT_SCORE,
    LOITER: LOITER_SCORE,
    SEEK_SAFETY: SEEK_SAFETY_SCORE,
    SEEK_FAITH: SEEK_FAITH_SCORE,
  };

  // Return action with highest utility
  return argmax(scores);
}

/**
 * Generate target position based on chosen action
 */
export function generateTargetFromAction(
  action: UtilityAction,
  entity: any,
  allNPCs: any[],
  fieldCache: Array<{ gridX: number; gridY: number; type: string; value: number }>
): { x: number; y: number } {
  const worldWidth = 900;
  const worldHeight = 520;

  switch (action) {
    case "SEEK_FOOD": {
      // Go to highest food density (café is best, park second)
      const cafe = LOCATIONS.find((l) => l.name === "Café");
      const park = LOCATIONS.find((l) => l.name === "Park");

      // Sample food at both locations
      const cafeFood = cafe ? sampleFieldFromCache(cafe.x, cafe.y, "food", fieldCache) : 0;
      const parkFood = park ? sampleFieldFromCache(park.x, park.y, "food", fieldCache) : 0;

      const target = cafeFood >= parkFood && cafe ? cafe : park!;

      return {
        x: target.x + (Math.random() - 0.5) * 60,
        y: target.y + (Math.random() - 0.5) * 60,
      };
    }

    case "SOCIALIZE": {
      // Find nearest cluster of NPCs
      if (allNPCs.length === 0) {
        // No one around, go to social landmarks
        const landmarks = [
          LOCATIONS.find((l) => l.name === "Café"),
          LOCATIONS.find((l) => l.name === "Park"),
        ].filter(Boolean);
        const target = landmarks[Math.floor(Math.random() * landmarks.length)];
        return target ? { x: target.x, y: target.y } : { x: entity.x, y: entity.y };
      }

      // Find closest NPC
      let closestNPC = allNPCs[0];
      let minDist = Infinity;
      for (const other of allNPCs) {
        if (other._id === entity._id) continue;
        const dist = distance(entity.x, entity.y, other.x, other.y);
        if (dist < minDist) {
          minDist = dist;
          closestNPC = other;
        }
      }

      // Head toward them
      return {
        x: closestNPC.x + (Math.random() - 0.5) * 40,
        y: closestNPC.y + (Math.random() - 0.5) * 40,
      };
    }

    case "EXPLORE": {
      // Random wandering with slight bias toward edges/corners
      const edgeBias = entity.personality.curiosity > 0.7;
      if (edgeBias && Math.random() < 0.5) {
        // Go to edges
        return {
          x: Math.random() < 0.5 ? Math.random() * 100 : worldWidth - Math.random() * 100,
          y: Math.random() < 0.5 ? Math.random() * 100 : worldHeight - Math.random() * 100,
        };
      } else {
        // Random anywhere
        return {
          x: Math.random() * worldWidth,
          y: Math.random() * worldHeight,
        };
      }
    }

    case "AVOID_HEAT": {
      // Find direction with lowest heat
      return findSafeDirection(entity, fieldCache);
    }

    case "LOITER": {
      // Stay near current position, small random movement
      return {
        x: Math.max(50, Math.min(worldWidth - 50, entity.x + (Math.random() - 0.5) * 80)),
        y: Math.max(50, Math.min(worldHeight - 50, entity.y + (Math.random() - 0.5) * 80)),
      };
    }

    case "SEEK_SAFETY": {
      // Go to safest landmark (lowest heat)
      let safestLandmark = LOCATIONS[0];
      let lowestHeat = Infinity;

      for (const landmark of LOCATIONS) {
        const heat = sampleFieldFromCache(landmark.x, landmark.y, "heat", fieldCache);
        if (heat < lowestHeat) {
          lowestHeat = heat;
          safestLandmark = landmark;
        }
      }

      return {
        x: safestLandmark.x + (Math.random() - 0.5) * 60,
        y: safestLandmark.y + (Math.random() - 0.5) * 60,
      };
    }

    case "SEEK_FAITH": {
      // Go to church for spiritual solace
      const church = LOCATIONS.find((l) => l.name === "Church");

      if (!church) {
        // Fallback if church doesn't exist
        return { x: entity.x, y: entity.y };
      }

      // Gather near church entrance (with some randomness)
      return {
        x: church.x + (Math.random() - 0.5) * 50,
        y: church.y + (Math.random() - 0.5) * 50,
      };
    }

    default:
      return { x: entity.x, y: entity.y };
  }
}

/**
 * Apply emotional contagion - mood spreads during conversations
 * Called when two NPCs interact
 */
export function applyEmotionalContagion(
  npc1: any,
  npc2: any
): { mood1: number; mood2: number } {
  const mood1 = npc1.personality.mood ?? 0.5;
  const mood2 = npc2.personality.mood ?? 0.5;

  // Average mood
  const avgMood = (mood1 + mood2) / 2;

  // How much each NPC shifts toward average (based on empathy)
  const empathy1 = npc1.personality.empathy ?? 0.5;
  const empathy2 = npc2.personality.empathy ?? 0.5;

  // High empathy = more influenced by others' moods
  const delta1 = clamp01((avgMood - mood1) * 0.3 * empathy1);
  const delta2 = clamp01((avgMood - mood2) * 0.3 * empathy2);

  return {
    mood1: clamp01(mood1 + delta1),
    mood2: clamp01(mood2 + delta2),
  };
}

/**
 * Check for food competition - multiple NPCs at same food source
 * Returns heat increase if competition detected
 */
export function checkFoodCompetition(
  entity: any,
  allNPCs: any[],
  action: UtilityAction
): number {
  if (action !== "SEEK_FOOD") return 0;

  // Count how many other NPCs are within 50px and also seeking food
  let competitorCount = 0;
  for (const other of allNPCs) {
    if (other._id === entity._id) continue;
    const dist = distance(entity.x, entity.y, other.x, other.y);
    // Assume they're seeking food if they're at high-food location
    if (dist < 50) {
      competitorCount++;
    }
  }

  // More competitors = more tension
  if (competitorCount >= 2) {
    return 0.03; // Raise local heat by 3%
  } else if (competitorCount >= 1) {
    return 0.01; // Raise local heat by 1%
  }

  return 0;
}
