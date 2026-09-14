import {
  IAutoMovieFormationSlot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { seededValue } from "./math/random";

/**
 * The member record one formation slot regenerates to.
 *
 * A design and a compiled formation share this identity law and differ only in
 * what they hand it: where a promoted hero is spelled, and the terrain the slot's
 * position is placed on. A hero slot is named by its actor and an anonymous slot
 * by the formation id and six-digit slot; every member carries the base recipe
 * and the designed heading; and its motion phase is seeded by the formation seed
 * and the slot under the phase domain, whichever actor or position it is handed.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Derives the anonymous node key from formation identity and the logical slot, or names a promoted hero by its actor.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Keeps logical slot identity explicit in the member record every formation spelling returns.
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Returns the same member identity and seeded motion phase for a slot whichever formation record regenerates it.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Keeps the design and compiled slot regenerators on one member record law, so they return the same identity and phase.
 */
export const formationSlotRecord = (
  formation: {
    id: string;
    modelRecipe: string;
    facingDeg: number;
    seed: number;
  },
  slot: number,
  member: { actor: string | null; position: IAutoMovieVector3 },
): IAutoMovieFormationSlot => ({
  slot,
  node:
    member.actor ??
    `formation:${formation.id}:slot:${String(slot).padStart(6, "0")}`,
  actor: member.actor,
  modelRecipe: formation.modelRecipe,
  position: member.position,
  facingDeg: formation.facingDeg,
  motionPhase: seededValue(formation.seed, slot, 0x70686173),
});
