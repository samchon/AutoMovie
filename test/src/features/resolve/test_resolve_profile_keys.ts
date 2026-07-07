import { profileSemanticKeys } from "@automovie/engine";
import { IAutoMovieDriver, IAutoMovieProfile } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const profileWith = (
  drivers: IAutoMovieDriver[],
  limits: IAutoMovieProfile["limits"] = [],
): IAutoMovieProfile => ({
  id: "p",
  name: "p",
  controls: [],
  drivers,
  limits,
});

/**
 * ProfileSemanticKeys walks exactly the references bindProfile remaps — limit
 * node channels and every driver's node fields — deduplicated in
 * first-reference order, so forgeProp can demand every boneMap entry in one
 * correction round.
 *
 * Scenarios:
 *
 * 1. Limits contribute node-channel keys; pointer channels contribute nothing.
 * 2. Copy(owner, source), aim(owner, target), parent(owner, parent) contribute
 *    their node pairs.
 * 3. Ik contributes chain + goal + a non-null pole node; a null pole (or null pole
 *    node) contributes nothing extra.
 * 4. Driven contributes only its node-kind output/source channels.
 * 5. Spring contributes chain + a non-null center; a null center adds nothing.
 * 6. Duplicates across limits and drivers fold to first-reference order.
 * 7. An unknown driver type throws (the walker refuses to guess a shape).
 */
export const test_resolve_profile_keys = (): void => {
  const keys = profileSemanticKeys(
    profileWith(
      [
        {
          type: "copy",
          owner: "a",
          source: "b",
          translation: true,
          rotation: true,
          scale: false,
          influence: 1,
        },
        {
          type: "aim",
          owner: "c",
          target: "d",
          aimAxis: { x: 0, y: 0, z: 1 },
          upAxis: { x: 0, y: 1, z: 0 },
          worldUp: { x: 0, y: 1, z: 0 },
          influence: 1,
        },
        {
          type: "ik",
          solver: "twoBone",
          chain: ["e", "f"],
          goal: "g",
          pole: { node: "h", angle: 0 },
          iterations: null,
          influence: 1,
        },
        {
          type: "parent",
          owner: "i",
          parent: "j",
          translation: true,
          rotation: true,
          scale: false,
        },
        {
          type: "driven",
          output: { kind: "node", node: "k", path: "rotation" },
          source: { kind: "pointer", pointer: "/x", valueType: "scalar" },
          inRange: [0, 1],
          outRange: [0, 1],
          clamp: false,
        },
        {
          type: "spring",
          chain: ["l", "a"],
          stiffness: 1,
          drag: 0.5,
          gravityPower: 0,
          gravityDir: { x: 0, y: -1, z: 0 },
          hitRadius: 0,
          center: "m",
        },
      ],
      [
        {
          channel: { kind: "node", node: "a", path: "rotation" },
          min: null,
          max: null,
        },
        {
          channel: { kind: "pointer", pointer: "/y", valueType: "scalar" },
          min: null,
          max: null,
        },
      ],
    ),
  );
  TestValidator.equals("dedup in first-reference order", keys, [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
  ]);

  const nulls = profileSemanticKeys(
    profileWith([
      {
        type: "ik",
        solver: "twoBone",
        chain: ["e"],
        goal: "g",
        pole: null,
        iterations: null,
        influence: 1,
      },
      {
        type: "ik",
        solver: "twoBone",
        chain: [],
        goal: "g",
        pole: { node: null, angle: 90 },
        iterations: null,
        influence: 1,
      },
      {
        type: "spring",
        chain: ["l"],
        stiffness: 1,
        drag: 0.5,
        gravityPower: 0,
        gravityDir: { x: 0, y: -1, z: 0 },
        hitRadius: 0,
        center: null,
      },
    ]),
  );
  TestValidator.equals("null pole/center add nothing", nulls, ["e", "g", "l"]);

  TestValidator.predicate(
    "unknown driver type throws",
    throwsError(
      () =>
        profileSemanticKeys(
          profileWith([{ type: "warp" } as unknown as IAutoMovieDriver]),
        ),
      "unknown driver type",
    ),
  );
};
