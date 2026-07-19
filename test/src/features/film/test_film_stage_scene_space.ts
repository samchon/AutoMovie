import { spaceGround, stageScene } from "@automovie/engine";
import { IAutoMovieSpace } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, nclose } from "../internal/predicates";

/** A floor square and a ramp climbing 1 m over the 2 m east of it. */
const makeSpace = (
  partial: Partial<IAutoMovieSpace> = {},
): IAutoMovieSpace => ({
  id: "space-yard",
  surfaces: [
    {
      id: "floor",
      kind: "floor",
      polygon: [
        { x: -2, y: 0, z: -2 },
        { x: 2, y: 0, z: -2 },
        { x: 2, y: 0, z: 2 },
        { x: -2, y: 0, z: 2 },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
    {
      id: "ramp",
      kind: "ramp",
      polygon: [
        { x: 2, y: 0, z: -1 },
        { x: 4, y: 0, z: -1 },
        { x: 4, y: 0, z: 1 },
        { x: 2, y: 0, z: 1 },
      ],
      anchor: { x: 2, y: 0, z: 0 },
      rampTo: { x: 4, y: 1, z: 0 },
    },
  ],
  walkable: ["floor", "ramp"],
  ...partial,
});

/**
 * Staging may author the scene's `space` (#1173) — the ground's MEANING beside
 * the `set`'s geometry. `stageScene` gates it with the shared `validateSpace`
 * (re-rooted under `$input.space`, so one surface rule can never mean two
 * things) and copies it onto the composed scene, which is what finally lets the
 * pairing `IAutoMovieSurface` documents be authored end to end: before this the
 * space type existed and nothing ever emitted one.
 *
 * Scenarios:
 *
 * 1. A floor + ramp space stages onto the scene verbatim — ids, kinds, anchors,
 *    and walkability — and the composed scene feeds `spaceGround` directly: 0 m
 *    over the floor, 0.5 m at the ramp's midpoint (half of the 1 m climb), and
 *    the 0 m fallback off every footprint.
 * 2. Omitting `space` composes `space: null`, the scalar ground plane the engine
 *    assumed before spaces existed — an absent ground is stated, not implied.
 * 3. The gates fire at the submitted field: a concave footprint, a degenerate ramp
 *    axis, and a walkable id resolving to no surface are each refused under
 *    `$input.space.*` in one round.
 * 4. The negative twin: the same footprint with its notch vertex moved back onto
 *    the hull boundary stages clean, so the convexity gate is not an over-match
 *    on any four-point polygon.
 */
export const test_film_stage_scene_space = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({ space: makeSpace() }),
  );
  TestValidator.equals("staging with a space succeeds", staged.success, true);
  if (staged.success !== true) return;

  const space = staged.scene.space ?? null;
  TestValidator.equals("the space is carried onto the scene", space, {
    id: "space-yard",
    surfaces: makeSpace().surfaces,
    walkable: ["floor", "ramp"],
  });

  // The composed scene plugs straight into the ground callback the motion
  // seams consume: flat over the floor, half-climbed at the ramp's midpoint.
  const ground = spaceGround(space!);
  TestValidator.predicate(
    "the staged space answers ground height",
    nclose(ground(0, 0), 0) &&
      nclose(ground(3, 0), 0.5) &&
      nclose(ground(4, 0), 1) &&
      nclose(ground(20, 20), 0),
  );

  // 2. an omitted space is stated as null, not left absent.
  const bare = stageScene(makeScriptWrite(), makeStagingWrite());
  TestValidator.equals(
    "an omitted space composes as null",
    bare.success === true ? bare.scene.space : undefined,
    null,
  );

  // 3. every space gate reports under the submitted field.
  const refused = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      space: makeSpace({
        surfaces: [
          {
            id: "floor",
            kind: "floor",
            // (0, 0) sits strictly inside the hull of the other three — the
            // notch the ground query would silently fill.
            polygon: [
              { x: -2, y: 0, z: -2 },
              { x: 2, y: 0, z: -2 },
              { x: 0, y: 0, z: 2 },
              { x: 0, y: 0, z: 0 },
            ],
            anchor: { x: 0, y: 0, z: 0 },
            rampTo: null,
          },
          {
            id: "ramp",
            kind: "ramp",
            polygon: [
              { x: 2, y: 0, z: -1 },
              { x: 4, y: 0, z: -1 },
              { x: 4, y: 0, z: 1 },
            ],
            anchor: { x: 2, y: 0, z: 0 },
            // Same (x, z) as the anchor: no axis to interpolate along.
            rampTo: { x: 2, y: 1, z: 0 },
          },
        ],
        walkable: ["floor", "balcony"],
      }),
    }),
  );
  TestValidator.predicate(
    "every space gate fires under $input.space in one round",
    refused.success === false &&
      hasViolation(refused, "type", "$input.space.surfaces[0].polygon") &&
      hasViolation(refused, "range", "$input.space.surfaces[1].rampTo") &&
      hasViolation(refused, "type", "$input.space.walkable[1]"),
  );

  // 4. the negative twin — the notch vertex pulled back onto the hull edge.
  const convex = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      space: makeSpace({
        surfaces: [
          {
            id: "floor",
            kind: "floor",
            polygon: [
              { x: -2, y: 0, z: -2 },
              { x: 2, y: 0, z: -2 },
              { x: 0, y: 0, z: 2 },
              { x: 0, y: 0, z: -2 },
            ],
            anchor: { x: 0, y: 0, z: 0 },
            rampTo: null,
          },
        ],
        walkable: ["floor"],
      }),
    }),
  );
  TestValidator.equals(
    "a collinear-on-edge vertex is not a concave notch",
    convex.success,
    true,
  );
};
