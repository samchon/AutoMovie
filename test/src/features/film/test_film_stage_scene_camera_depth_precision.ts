import { stageScene } from "@automovie/engine";
import type { IAutoMovieStageCamera } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/** Authored clip and precision values are validated and lowered without defaults. */
export const test_film_stage_scene_camera_depth_precision = (): void => {
  const base = makeStagingWrite();
  const authored = {
    ...base.cameras[0]!,
    near: 0.25,
    far: 250,
    depthPrecision: { minimumDepthBits: 16, maximumStepMeters: 0.5 },
  };
  const accepted = stageScene(
    makeScriptWrite(),
    makeStagingWrite({ cameras: [authored] }),
  );
  TestValidator.equals(
    "accepted values reach the resolved camera without aliasing",
    namedFacts([
      ["success", () => accepted.success],
      [
        "values",
        () =>
          accepted.success &&
          accepted.scene.cameras[0]!.near === 0.25 &&
          accepted.scene.cameras[0]!.far === 250 &&
          accepted.scene.cameras[0]!.depthPrecision.minimumDepthBits === 16 &&
          accepted.scene.cameras[0]!.depthPrecision.maximumStepMeters === 0.5,
      ],
      [
        "copied",
        () =>
          accepted.success &&
          accepted.scene.cameras[0]!.depthPrecision !== authored.depthPrecision,
      ],
    ]),
    { success: true, values: true, copied: true },
  );

  const camera = (index: number, value: unknown): IAutoMovieStageCamera =>
    ({
      ...base.cameras[0]!,
      node: `invalid-${index}`,
      lookAt: { kind: "point", point: { x: 0, y: 1, z: 0 } },
      ...(value as object),
    }) as IAutoMovieStageCamera;
  const rejected = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      cameras: [
        camera(0, { near: Number.NaN }),
        camera(1, { near: 0 }),
        camera(2, { far: Number.POSITIVE_INFINITY }),
        camera(3, { near: 2, far: 2 }),
        camera(4, { depthPrecision: null }),
        camera(5, {
          depthPrecision: { minimumDepthBits: "24", maximumStepMeters: 1 },
        }),
        camera(6, {
          depthPrecision: { minimumDepthBits: 1.5, maximumStepMeters: 1 },
        }),
        camera(7, {
          depthPrecision: { minimumDepthBits: 0, maximumStepMeters: 1 },
        }),
        camera(8, {
          depthPrecision: { minimumDepthBits: 54, maximumStepMeters: 1 },
        }),
        camera(9, {
          depthPrecision: {
            minimumDepthBits: 24,
            maximumStepMeters: "small",
          },
        }),
        camera(10, {
          depthPrecision: {
            minimumDepthBits: 24,
            maximumStepMeters: Number.POSITIVE_INFINITY,
          },
        }),
        camera(11, {
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 0 },
        }),
      ],
    }),
  );
  TestValidator.predicate(
    "invalid clip, capability, and threshold operands are addressed",
    rejected.success === false &&
      hasViolation(rejected, "range", "$input.cameras[0].near") &&
      hasViolation(rejected, "range", "$input.cameras[1].near") &&
      hasViolation(rejected, "range", "$input.cameras[2].far") &&
      hasViolation(rejected, "range", "$input.cameras[3].far") &&
      hasViolation(rejected, "type", "$input.cameras[4].depthPrecision") &&
      [5, 6, 7, 8].every((index) =>
        hasViolation(
          rejected,
          "range",
          `$input.cameras[${index}].depthPrecision.minimumDepthBits`,
        ),
      ) &&
      [9, 10, 11].every((index) =>
        hasViolation(
          rejected,
          "range",
          `$input.cameras[${index}].depthPrecision.maximumStepMeters`,
        ),
      ),
  );
};
