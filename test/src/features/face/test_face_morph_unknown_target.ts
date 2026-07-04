import { IAutoMovieFaceTemplate, morphFace } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * A parameter naming a morph target the template does not carry is a broken
 * asset, not a validation matter — the document itself may be perfectly legal
 * against a richer template. morphFace throws instead of silently skipping, so
 * an asset/parameter mismatch can never produce a half-applied face.
 *
 * Scenario: a template with only `eyeSize` morphed by `jaw.width` throws.
 */
export const test_face_morph_unknown_target = (): void => {
  const template: IAutoMovieFaceTemplate = {
    positions: [0, 0, 0],
    targets: { eyeSize: [1, 0, 0] },
  };
  TestValidator.error("missing morph target throws", () =>
    morphFace({
      template,
      face: makeFace({ jaw: { width: 1 } }),
    }),
  );
};
