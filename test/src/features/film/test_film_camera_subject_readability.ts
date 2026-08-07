import {
  compileCameraMove,
  intersectsPerspectiveFrustumSegment,
  projectToNdc,
  resolveCameraAt,
} from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const HEIGHT = 1.7;
const ASPECT = 16 / 9;

const camera = (): IAutoMovieCamera => ({
  id: "cam",
  transform: {
    translation: { x: 0, y: 1, z: 6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  fovY: 40,
  near: 0.1,
  far: 200,
});

const frame = (
  framing: IAutoMovieCameraAction["framing"],
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing,
  move: "static",
  on: { kind: "node", node: "hero" },
});

/** Solve the live camera for one framing of a subject standing at `base`. */
const solved = (
  framing: IAutoMovieCameraAction["framing"],
  base: IAutoMovieVector3,
) => {
  const live = camera();
  const clip = compileCameraMove({
    clipId: "clip",
    camera: live,
    entries: [
      { action: frame(framing), subject: { base, height: HEIGHT, at: null } },
    ],
    shotDuration: 4,
  });
  return resolveCameraAt(live.transform, clip, live.id, 2);
};

const ORIGIN: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };

/**
 * Whether a subject standing at `base` reads through a camera framed on
 * `framedOn`. The two differ only in the negative case: a camera re-solved on
 * the displaced subject would simply follow it, which tests nothing.
 */
const readable = (
  framing: IAutoMovieCameraAction["framing"],
  base: IAutoMovieVector3,
  framedOn: IAutoMovieVector3 = base,
): boolean =>
  intersectsPerspectiveFrustumSegment({
    camera: solved(framing, framedOn),
    from: base,
    to: { x: base.x, y: base.y + HEIGHT, z: base.z },
    near: camera().near,
    far: camera().far,
    halfY: Math.tan((camera().fovY * Math.PI) / 360),
    aspect: ASPECT,
  });

/**
 * A required subject reads when the camera's frame contains part of the
 * subject, not when it contains the subject's ground point.
 *
 * The distinction is not academic. The framing grammar aims a `medium` shot at
 * 0.72 of the subject's height and shows 0.62 of it, so the visible band runs
 * from 0.41 h to 1.03 h and the ground point the older test projected is far
 * below the frame. `close` is worse and decides the shape of the check: it
 * shows 0.71 h to 0.99 h, so **neither** end of the subject is on screen while
 * its middle fills the frame, and any test that samples chosen points — base,
 * top, midpoint — reports the subject absent. Only clipping the subject's
 * extent against the frustum finds it.
 *
 * The oracle is the framing arithmetic itself, not the engine's output: with
 * the tables at `FRAMING_HEIGHT_FRACTION` and `FRAMING_AIM_FRACTION`, the
 * visible band is `aim ± visible/2` in units of subject height, and the
 * expectations below follow from whether that band meets `[0, 1]`.
 *
 * Scenarios:
 *
 * 1. All four framings read a correctly staged subject. `wide` (−1.50 h … 2.50 h)
 *    and `full` (−0.075 h … 1.075 h) contain the whole subject; `medium` and
 *    `close` contain only a slice, which is enough.
 * 2. The negative twin: with the camera still framed on the origin, a subject
 *    displaced 1,000 m sideways reads at no framing, so widening the test did
 *    not make readability unconditional.
 * 3. The ground point alone still fails `medium` and `close` and still passes
 *    `wide` and `full`, which is exactly the asymmetry that made the point test
 *    wrong; a zero-height subject therefore keeps the old outcome.
 * 4. A subject behind the camera fails on the near plane, and one past `far` fails
 *    on the far plane, at a framing that otherwise reads.
 * 5. A segment parallel to a side plane is decided by its position: one lying
 *    outside is refused, and the frustum-crossing case above is admitted.
 */
export const test_film_camera_subject_readability = (): void => {
  const framings = ["wide", "full", "medium", "close"] as const;

  TestValidator.equals(
    "every shot size reads a correctly staged subject",
    namedFacts(framings.map((f) => [f, () => readable(f, ORIGIN)])),
    { wide: true, full: true, medium: true, close: true },
  );
  TestValidator.equals(
    "a displaced subject reads at no shot size",
    namedFacts(
      framings.map((f) => [
        f,
        () => readable(f, { x: 1_000, y: 0, z: 0 }, ORIGIN),
      ]),
    ),
    { wide: false, full: false, medium: false, close: false },
  );

  const groundOnly = (framing: IAutoMovieCameraAction["framing"]): boolean => {
    const resolved = solved(framing, ORIGIN);
    const halfY = Math.tan((camera().fovY * Math.PI) / 360);
    const projection = projectToNdc(resolved, ORIGIN, halfY, ASPECT);
    return (
      projection.depth >= camera().near &&
      projection.depth <= camera().far &&
      Math.abs(projection.ndcX) <= 1 &&
      Math.abs(projection.ndcY) <= 1
    );
  };
  TestValidator.equals(
    "the ground point alone is what the cropped shot sizes exclude",
    namedFacts(framings.map((f) => [f, () => groundOnly(f)])),
    { wide: true, full: true, medium: false, close: false },
  );

  const depthProbe = (from: IAutoMovieVector3, to: IAutoMovieVector3) =>
    intersectsPerspectiveFrustumSegment({
      camera: solved("wide", ORIGIN),
      from,
      to,
      near: camera().near,
      far: camera().far,
      halfY: Math.tan((camera().fovY * Math.PI) / 360),
      aspect: ASPECT,
    });
  const behind = solved("wide", ORIGIN).position.z + 1;
  TestValidator.equals(
    "depth bounds still refuse a subject the frame cannot show",
    namedFacts([
      [
        "behindTheLens",
        () =>
          depthProbe({ x: 0, y: 0, z: behind }, { x: 0, y: HEIGHT, z: behind }),
      ],
      [
        "beyondFar",
        () =>
          depthProbe({ x: 0, y: 0, z: -1_000 }, { x: 0, y: HEIGHT, z: -1_000 }),
      ],
    ]),
    { behindTheLens: false, beyondFar: false },
  );

  // A horizontal segment holds one constant distance to each side plane, so
  // the parallel branch decides it outright instead of finding a crossing.
  TestValidator.equals(
    "a segment parallel to the side planes is decided by its own position",
    namedFacts([
      [
        "insideTheFrame",
        () => depthProbe({ x: -0.2, y: 0.85, z: 0 }, { x: 0.2, y: 0.85, z: 0 }),
      ],
      [
        "outsideTheFrame",
        () =>
          depthProbe({ x: -0.2, y: 1_000, z: 0 }, { x: 0.2, y: 1_000, z: 0 }),
      ],
    ]),
    { insideTheFrame: true, outsideTheFrame: false },
  );
};
