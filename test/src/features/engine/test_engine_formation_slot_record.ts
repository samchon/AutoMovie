import { formationSlotRecord, seededValue } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** The domain a formation member's motion phase is seeded under. */
const PHASE_DOMAIN = 0x70686173;

const UNIT = { id: "levy", modelRecipe: "member", facingDeg: 30, seed: 42 };
const AT = { x: 1, y: 2.5, z: -3 };

/**
 * One formation slot regenerates to the member record its identity law names.
 *
 * The node, actor, recipe, heading and position are each computed here from the
 * slot and the inputs handed over, and the motion phase is the seeded value of
 * the formation seed and slot under the phase domain, computed with the seeding
 * primitive directly.
 *
 * Scenarios:
 *
 * 1. An anonymous slot is named by the formation id and six-digit slot and
 *    carries the base recipe, the heading, the position it was handed and the
 *    seeded phase.
 * 2. The same slot with an actor is named by that actor and keeps the same phase.
 * 3. Slot 0 pads to six digits and slot 1234567 keeps all seven.
 * 4. The phase follows the slot and the seed: the neighbouring slot and another
 *    seed draw different phases, while another actor, position, recipe or heading
 *    at the same slot and seed leaves it unchanged, and it lies in [0, 1).
 */
export const test_engine_formation_slot_record = (): void => {
  const phase = seededValue(UNIT.seed, 7, PHASE_DOMAIN);
  TestValidator.equals(
    "an anonymous slot is named by its formation and slot",
    formationSlotRecord(UNIT, 7, { actor: null, position: AT }),
    {
      slot: 7,
      node: "formation:levy:slot:000007",
      actor: null,
      modelRecipe: "member",
      position: { x: 1, y: 2.5, z: -3 },
      facingDeg: 30,
      motionPhase: phase,
    },
  );
  TestValidator.equals(
    "a hero slot is named by its actor and keeps the slot's phase",
    formationSlotRecord(UNIT, 7, { actor: "captain", position: AT }),
    {
      slot: 7,
      node: "captain",
      actor: "captain",
      modelRecipe: "member",
      position: { x: 1, y: 2.5, z: -3 },
      facingDeg: 30,
      motionPhase: phase,
    },
  );

  const recordPhase = (
    unit: typeof UNIT,
    slot: number,
    member: { actor: string | null; position: typeof AT },
  ): number => formationSlotRecord(unit, slot, member).motionPhase;
  TestValidator.equals(
    "the node pads the slot and the phase follows only slot and seed",
    namedFacts([
      [
        "padded",
        () =>
          formationSlotRecord(UNIT, 0, { actor: null, position: AT }).node ===
          "formation:levy:slot:000000",
      ],
      [
        "wide",
        () =>
          formationSlotRecord(UNIT, 1_234_567, { actor: null, position: AT })
            .node === "formation:levy:slot:1234567",
      ],
      [
        "neighbourDiffers",
        () =>
          recordPhase(UNIT, 8, { actor: null, position: AT }) ===
            seededValue(UNIT.seed, 8, PHASE_DOMAIN) &&
          recordPhase(UNIT, 8, { actor: null, position: AT }) !== phase,
      ],
      [
        "seedDiffers",
        () =>
          recordPhase({ ...UNIT, seed: 43 }, 7, {
            actor: null,
            position: AT,
          }) === seededValue(43, 7, PHASE_DOMAIN) &&
          recordPhase({ ...UNIT, seed: 43 }, 7, {
            actor: null,
            position: AT,
          }) !== phase,
      ],
      [
        "unmovedByTheRest",
        () =>
          recordPhase({ ...UNIT, modelRecipe: "other", facingDeg: 90 }, 7, {
            actor: "banner",
            position: { x: 9, y: 9, z: 9 },
          }) === phase,
      ],
      ["unitInterval", () => phase >= 0 && phase < 1],
    ]),
    {
      padded: true,
      wide: true,
      neighbourDiffers: true,
      seedDiffers: true,
      unmovedByTheRest: true,
      unitInterval: true,
    },
  );
};
