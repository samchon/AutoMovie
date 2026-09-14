import {
  compiledFormationSlot,
  formationSlot,
  materializeCompiledFormation,
  worldRamp,
} from "@automovie/engine";
import { IAutoMovieFormationDesign } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

/** Thirty dressed members in five files, two of them promoted to heroes. */
const unit = (): IAutoMovieFormationDesign => ({
  id: "levy",
  modelRecipe: "member",
  count: 30,
  layout: {
    kind: "line",
    files: 5,
    ranks: 6,
    spacing: { lateral: 2, depth: 3 },
    dressing: { lateral: 0.3, depth: 0.2 },
  },
  anchor: { x: 4, y: 1, z: 2 },
  facingDeg: 30,
  seed: 42,
  capabilities: [],
  heroOverrides: [
    { slot: 7, actor: "captain" },
    { slot: 22, actor: "standard" },
  ],
});

/** A bank rising half a metre per metre toward +z under the whole unit. */
const bank = worldRamp({
  id: "bank",
  from: { x: 0, z: -20 },
  to: { x: 0, z: 40 },
  width: 80,
  baseHeight: 1 - 11,
  rise: 30,
  walkable: true,
});

/**
 * A member regenerated from a compiled formation is the member the grounded
 * design places, hero or anonymous.
 *
 * The compiled record spells a hero as a promoted slot and carries its terrain
 * as a snapshot, so the regenerator reads both from the record. The design
 * regenerator is the other spelling of the same identity law; this pins the two
 * equal on every slot, which is the guard that keeps a viewer, a shot source and
 * the builder's own summary on one answer.
 *
 * Scenarios:
 *
 * 1. Every slot of a dressed, turned unit on a bank regenerates from the compiled
 *    record exactly as the design regenerates it with the same terrain, down to
 *    node, actor, recipe, position, heading and motion phase.
 * 2. A hero slot is named by its actor and an anonymous slot by the formation id
 *    and six-digit slot, from the compiled record and from the design alike.
 * 3. The design without its terrain places a member up the bank at the anchor's
 *    own height, which is the flat answer a compiled record does not give.
 * 4. A slot outside the formation refuses.
 */
export const test_engine_compiled_formation_slot = (): void => {
  const design = unit();
  const compiled = materializeCompiledFormation({
    formation: design,
    surfaces: [bank],
  });
  const regenerated = Array.from({ length: design.count }, (_, slot) =>
    compiledFormationSlot(compiled, slot),
  );

  TestValidator.equals(
    "a compiled member is the member the grounded design places",
    regenerated,
    Array.from({ length: design.count }, (_, slot) =>
      formationSlot({ ...design, ground: compiled.ground }, slot),
    ),
  );

  const upTheBank = regenerated.reduce((highest, member) =>
    member.position.z > highest.position.z ? member : highest,
  );
  TestValidator.equals(
    "a compiled member keeps its identity and stands on its terrain",
    namedFacts([
      [
        "hero",
        () =>
          regenerated[7]!.node === "captain" &&
          regenerated[7]!.actor === "captain",
      ],
      [
        "anonymous",
        () =>
          regenerated[3]!.node === "formation:levy:slot:000003" &&
          regenerated[3]!.actor === null,
      ],
      [
        "onTheBank",
        () =>
          compiled.ground.length === 1 &&
          upTheBank.position.y > design.anchor.y + 1,
      ],
      [
        "flatWithoutTerrain",
        () =>
          nclose(
            formationSlot(design, upTheBank.slot).position.y,
            design.anchor.y,
            1e-12,
          ),
      ],
      [
        "designHero",
        () =>
          formationSlot(design, 7).node === "captain" &&
          formationSlot(design, 7).actor === "captain",
      ],
      [
        "designAnonymous",
        () =>
          formationSlot(design, 3).node === "formation:levy:slot:000003" &&
          formationSlot(design, 3).actor === null,
      ],
      [
        "outside",
        () =>
          throwsError(
            () => compiledFormationSlot(compiled, 30),
            'Formation "levy" slot 30 is outside 0..29',
          ),
      ],
    ]),
    {
      hero: true,
      anonymous: true,
      onTheBank: true,
      flatWithoutTerrain: true,
      designHero: true,
      designAnonymous: true,
      outside: true,
    },
  );
};
