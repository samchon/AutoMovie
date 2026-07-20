import {
  IAutoMovieCameraCoverageEntry,
  compileCameraCoverage,
  compileCameraMove,
} from "@automovie/engine";
import { IAutoMovieCamera, IAutoMovieCameraIntent } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { qclose, vclose } from "../internal/predicates";

/** The side camera covering the beat from +X (fovY 90° keeps the math exact). */
const ALT: IAutoMovieCamera = {
  id: "cam-alt",
  transform: {
    translation: { x: 5, y: 1.44, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  fovY: 90,
  near: 0.1,
  far: 1000,
};

const SUBJECT = { base: { x: 0, y: 0, z: 0 }, height: 2, at: null };

const intent = (
  start: number,
  over: Partial<IAutoMovieCameraIntent> = {},
): IAutoMovieCameraIntent => ({
  start,
  framing: "medium",
  move: "static",
  focus: { x: 0, y: 1.2, z: 0 },
  focalLength: 85,
  ...over,
});

const entry = (
  start: number,
  move: "static" | "push-in",
  spanIntent: IAutoMovieCameraIntent,
): IAutoMovieCameraCoverageEntry => ({
  action: {
    verb: "frame",
    actor: "cam-alt",
    start,
    duration: move === "static" ? 1 : "auto",
    framing: "medium",
    move,
    on: { kind: "point", point: { x: 0, y: 0, z: 0 } },
  },
  subject: SUBJECT,
  intent: spanIntent,
});

/**
 * The multi-camera half of #1187 at the camera compiler: one beat's coverage
 * take compiles through the SAME framing grammar as the hero take, with the
 * covering camera as the parameter, and pairs the clip with the take's per-span
 * intent records as one `IAutoMovieShotCoverage`. The grammar solves each
 * camera against its own staged bearing, so the side camera frames its own
 * angle; the intent rides as guide metadata, never back into the solve.
 *
 * Scenarios (fovY 90°, so `tan(fovY/2) = 1`; subject height 2 framed `medium`
 * shows 1.24 m, hence `d = 0.62`; aim = 0.72 × height = y 1.44):
 *
 * 1. A `static medium` span on the +X side camera keys the camera at `(0.62, 1.44,
 *    0)` (bearing +X from the aim), yawed +90° to look −X: the covering
 *    camera's own bearing drives its own angle, not the hero's.
 * 2. Two spans (static 0–1, then push-in to shot end) compile byte-identically to
 *    `compileCameraMove` on the same camera and entries, the tracks target
 *    `cam-alt`, and the two intent records ride in span order.
 * 3. The empty entries boundary is a locked-off covering camera: `cameraMotion:
 *    null`, `cameraIntent: []`, the camera id still carried.
 */
export const test_film_camera_coverage = (): void => {
  // 1. the covering camera's own staged bearing frames its own angle.
  const side = compileCameraCoverage({
    camera: ALT,
    clipId: "cam:beat-1:cam-alt",
    entries: [entry(0, "static", intent(0))],
    shotDuration: 2,
  });
  TestValidator.equals("take names its camera", side.camera, "cam-alt");
  TestValidator.predicate(
    "locked-off is not forced",
    side.cameraMotion !== null,
  );
  if (side.cameraMotion !== null) {
    const [translation, rotation] = side.cameraMotion.tracks;
    TestValidator.predicate(
      "side angle keyed on the camera's own bearing",
      vclose(
        {
          x: translation!.values[0]!,
          y: translation!.values[1]!,
          z: translation!.values[2]!,
        },
        { x: 0.62, y: 1.44, z: 0 },
      ),
    );
    TestValidator.predicate(
      "yawed +90° to look down −X",
      qclose(
        {
          x: rotation!.values[0]!,
          y: rotation!.values[1]!,
          z: rotation!.values[2]!,
          w: rotation!.values[3]!,
        },
        { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      ),
    );
    TestValidator.equals(
      "tracks target the covering camera",
      side.cameraMotion.tracks.map((t) =>
        t.channel.kind === "node" ? t.channel.node : "",
      ),
      ["cam-alt", "cam-alt"],
    );
  }

  // 2. same grammar as the hero compiler; intent rides in span order.
  const intents = [
    intent(0),
    intent(1, { move: "push-in", focus: null, focalLength: 35 }),
  ];
  const entries = [
    entry(0, "static", intents[0]!),
    entry(1, "push-in", intents[1]!),
  ];
  const take = compileCameraCoverage({
    camera: ALT,
    clipId: "cam:beat-1:cam-alt",
    entries,
    shotDuration: 3,
  });
  const hero = compileCameraMove({
    clipId: "cam:beat-1:cam-alt",
    camera: ALT,
    entries,
    shotDuration: 3,
  });
  TestValidator.equals(
    "the take's clip is the hero grammar on the same camera",
    JSON.stringify(take.cameraMotion),
    JSON.stringify(hero),
  );
  TestValidator.equals("intent records ride in span order", take.cameraIntent, [
    intents[0],
    intents[1],
  ]);

  // 3. no frame spans: a locked-off covering camera.
  const locked = compileCameraCoverage({
    camera: ALT,
    clipId: "cam:beat-1:cam-alt",
    entries: [],
    shotDuration: 2,
  });
  TestValidator.equals(
    "an empty take is locked off",
    [locked.camera, locked.cameraMotion, locked.cameraIntent],
    ["cam-alt", null, []],
  );
};
