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
  framing: IAutoMovieCameraAction["framing"],
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing,
  move: "static",
  on: { kind: "point", point: { x: 0, y: 0, z: 0 } },
});

const SUBJECT = { base: { x: 0, y: 0, z: 0 }, height: 2, at: null };

/**
 * Camera framing names index the deterministic height and aim lookup tables.
 * Unknown names must fail before `undefined` fractions can turn into NaN camera
 * keys.
 *
 * Scenario: a forged framing name throws instead of compiling malformed camera
 * key values.
 */
export const test_film_camera_framing_type = (): void => {
  TestValidator.predicate(
    "unknown camera framing rejects",
    throwsError(
      () =>
        compileCameraMove({
          clipId: "clip",
          camera: CAMERA,
          entries: [{ action: frame("macro" as never), subject: SUBJECT }],
          shotDuration: 2,
        }),
      ["unknown camera framing", "macro"],
    ),
  );
};
