import { compileCameraMove } from "@automovie/engine";
import { IAutoMovieCamera, IAutoMovieCameraAction } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const CAMERA: IAutoMovieCamera = {
  id: "cam",
  transform: {
    translation: { x: 0, y: 1, z: 4 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  fovY: 90,
  near: 0.1,
  far: 1000,
};

const frame = (
  move: IAutoMovieCameraAction["move"],
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing: "full",
  move,
  on: { kind: "point", point: { x: 0, y: 0, z: 0 } },
});

const SUBJECT = { base: { x: 0, y: 0, z: 0 }, height: 2, at: null };

/**
 * Camera frame actions are a runtime grammar boundary. Unknown move names must
 * fail before the compiler emits a camera clip with no keys.
 *
 * Scenario: a forged move name throws instead of compiling an empty camera
 * motion.
 */
export const test_film_camera_move_type = (): void => {
  TestValidator.predicate(
    "unknown camera move rejects",
    throwsError(
      () =>
        compileCameraMove({
          clipId: "clip",
          camera: CAMERA,
          entries: [{ action: frame("crane" as never), subject: SUBJECT }],
          shotDuration: 2,
        }),
      ["unknown camera frame move", "crane"],
    ),
  );
};
