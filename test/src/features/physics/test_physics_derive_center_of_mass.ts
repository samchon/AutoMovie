import { deriveCenterOfMass } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const at = (x: number, y: number, z: number, s = 1): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: s, y: s, z: s },
});

const unit = { type: "box", width: 1, height: 1, depth: 1 } as const;

/**
 * `deriveCenterOfMass` is the volume-weighted centroid the engine falls back to
 * when a body leaves `centerOfMass` null. It weighs each primitive part by its
 * (transform-scaled) solid volume at its transformed centroid, assuming uniform
 * density.
 *
 * Scenarios:
 *
 * 1. A single box with no transform → the box's own centroid, the origin.
 * 2. A single box translated to (1,2,3) → that translation, since a symmetric
 *    primitive's centroid rides its transform.
 * 3. Two equal boxes at ±x → the midpoint, the origin.
 * 4. A unit box at the origin and a 2×2×2 box out at x=3 → pulled toward the
 *    heavier box, weighted by volume (1:8), not by count.
 * 5. Transform scale multiplies a part's volume: a unit box scaled 2× (volume 8)
 *    out at x=3 balances an unscaled unit box the same 1:8 as scenario 4.
 * 6. A cone contributes its off-origin centroid (+height/4), shifted by its
 *    transform.
 */
export const test_physics_derive_center_of_mass = (): void => {
  TestValidator.predicate(
    "single untransformed box → origin",
    vclose(deriveCenterOfMass(makeProp([primitivePart("b", unit)]))!, {
      x: 0,
      y: 0,
      z: 0,
    }),
  );
  TestValidator.predicate(
    "translated box → its translation",
    vclose(
      deriveCenterOfMass(makeProp([primitivePart("b", unit, at(1, 2, 3))]))!,
      { x: 1, y: 2, z: 3 },
    ),
  );
  TestValidator.predicate(
    "two equal boxes at ±x → midpoint",
    vclose(
      deriveCenterOfMass(
        makeProp([
          primitivePart("l", unit, at(-1, 0, 0)),
          primitivePart("r", unit, at(1, 0, 0)),
        ]),
      )!,
      { x: 0, y: 0, z: 0 },
    ),
  );
  TestValidator.predicate(
    "weighted toward the larger box (1:8)",
    vclose(
      deriveCenterOfMass(
        makeProp([
          primitivePart("small", unit, at(0, 0, 0)),
          primitivePart(
            "big",
            { type: "box", width: 2, height: 2, depth: 2 },
            at(3, 0, 0),
          ),
        ]),
      )!,
      { x: 24 / 9, y: 0, z: 0 },
    ),
  );
  TestValidator.predicate(
    "transform scale multiplies volume",
    vclose(
      deriveCenterOfMass(
        makeProp([
          primitivePart("plain", unit, at(0, 0, 0)),
          primitivePart("scaled", unit, at(3, 0, 0, 2)),
        ]),
      )!,
      { x: 24 / 9, y: 0, z: 0 },
    ),
  );
  TestValidator.predicate(
    "cone centroid shifted by its transform",
    vclose(
      deriveCenterOfMass(
        makeProp([
          primitivePart(
            "c",
            { type: "cone", radius: 1, height: 4 },
            at(0, 5, 0),
          ),
        ]),
      )!,
      { x: 0, y: 6, z: 0 },
    ),
  );
};
