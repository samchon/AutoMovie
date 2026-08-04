import { Quaternion, stageScene } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, vclose } from "../internal/predicates";

const script = makeScriptWrite();

const LENS_A: IAutoMovieVector3 = { x: 2, y: 1.5, z: 0.35 };
const LENS_B: IAutoMovieVector3 = { x: -2, y: 1.5, z: 0.35 };

const camera = (
  node: string,
  position: IAutoMovieVector3,
  lookAt:
    | { kind: "node"; node: string }
    | { kind: "point"; point: IAutoMovieVector3 },
) => ({ node, position, lookAt, fovDeg: 40 });

const stage = (
  cameras: ReturnType<typeof camera>[],
  set?: { node: string; model: string; position: IAutoMovieVector3 }[],
) =>
  stageScene(
    script,
    makeStagingWrite(set === undefined ? { cameras } : { cameras, set }),
  );

/**
 * A camera may aim at any staged placement, another camera included.
 *
 * `performShot` resolves a positional target against every staged placement,
 * cameras among them (#1294), so a subject the performance stage happily frames
 * must not be refused one rung earlier. Staging built its own lookup from
 * actors and set pieces alone, which made "camera B opens on camera A" (a
 * making-of angle, a monitor, a mirror) impossible to stage while `perform`
 * accepted the same subject.
 *
 * Widening the table must not widen anything else: the two refusals staging
 * owns for a camera target, an id nothing placed and a camera aimed at its own
 * position, both still fire.
 *
 * Scenarios:
 *
 * 1. `cam-b` aims at `cam-a` and composes the SAME rotation as an explicit `point`
 *    at `cam-a`'s position, which is what proves the id resolved to that
 *    camera's own placement rather than to some other one.
 * 2. That rotation aims the camera's local `-Z` (the glTF convention staging
 *    lowers every camera by) along `cam-a - cam-b`, normalised `(1, 0, 0)` for
 *    these two lenses: an independent geometric oracle, not a re-run of the
 *    engine's basis math.
 * 3. The counter-cases one property away still stage: an actor target and a set
 *    piece target compose as before.
 * 4. The negative twin: a camera aimed at an id nothing placed is still refused at
 *    `$input.cameras[0].lookAt.node`, and the message names all three placement
 *    flavours.
 * 5. The boundary the placement entry makes reachable: a camera aimed at ITSELF
 *    resolves to its own position, so the zero-length look vector is refused at
 *    `$input.cameras[0].lookAt` rather than composing a degenerate rotation.
 */
export const test_film_stage_scene_camera_target = (): void => {
  // 1. camera B frames camera A, exactly as an explicit lens point does.
  const staged = stage([
    camera("cam-a", LENS_A, { kind: "node", node: "knightA" }),
    camera("cam-b", LENS_B, { kind: "node", node: "cam-a" }),
  ]);
  const explicit = stage([
    camera("cam-a", LENS_A, { kind: "node", node: "knightA" }),
    camera("cam-b", LENS_B, { kind: "point", point: LENS_A }),
  ]);
  TestValidator.equals("a camera may aim at a camera", staged.success, true);
  if (staged.success !== true || explicit.success !== true)
    throw new Error("both camera-target twins must stage");
  const aimed = staged.scene.cameras.find((c) => c.id === "cam-b")!;
  TestValidator.equals(
    "the camera id composes the explicit lens point's camera",
    aimed,
    explicit.scene.cameras.find((c) => c.id === "cam-b")!,
  );

  // 2. the independent oracle: local -Z points from cam-b at cam-a.
  TestValidator.predicate(
    "the composed rotation aims the lens at the other camera",
    vclose(
      Quaternion.rotateVector(aimed.transform.rotation, {
        x: 0,
        y: 0,
        z: -1,
      }),
      { x: 1, y: 0, z: 0 },
    ),
  );

  // 3. the counter-cases one property away.
  TestValidator.equals(
    "actor and set piece targets still stage",
    stage(
      [
        camera("cam-a", LENS_A, { kind: "node", node: "knightB" }),
        camera("cam-b", LENS_B, { kind: "node", node: "altar" }),
      ],
      [{ node: "altar", model: "box", position: { x: 1, y: 0, z: 1 } }],
    ).success,
    true,
  );

  // 4. the negative twin: an id nothing placed.
  const ghost = stage([
    camera("cam-a", LENS_A, { kind: "node", node: "nobody" }),
  ]);
  TestValidator.predicate(
    "an unplaced camera target is still refused, naming every placement flavour",
    hasViolation(ghost, "type", "$input.cameras[0].lookAt.node") &&
      ghost.success === false &&
      ghost.violations.some((item) =>
        item.expected.includes("placed actor, set piece, or camera"),
      ),
  );

  // 5. the boundary: a camera aimed at itself.
  const narcissus = stage([
    camera("cam-a", LENS_A, { kind: "node", node: "cam-a" }),
  ]);
  TestValidator.predicate(
    "a camera aimed at itself is refused as a zero-length look vector",
    hasViolation(narcissus, "range", "$input.cameras[0].lookAt"),
  );
};
