import { TestValidator } from "@nestia/e2e";

import {
  portraitWebCaptureLabel,
  portraitWebHardwareRenderer,
  verifyPortraitWebBasis,
} from "../../../scripts/face-review/web/logic.mjs";
import { throwsError } from "../internal/predicates";

/**
 * A web observation keeps its complete export identity and a local output label.
 * Scenarios:
 * 1. Matching model, GLB, profile, configuration and input hashes pass; changing
 *    or omitting any one refuses, including an empty advertised digest.
 * 2. Real ANGLE device names pass while absent and software renderer names fail.
 * 3. Single-component labels pass at both length limits; traversal, separators,
 *    whitespace, an empty label and an oversized label refuse.
 */
export const test_subject_face_web_identity = (): void => {
  const basis = {
    model: "a",
    gltf: "b",
    profile: "c",
    configuration: "d",
    input: "e",
  };
  verifyPortraitWebBasis(basis, { ...basis });
  for (const key of Object.keys(basis)) {
    TestValidator.predicate(
      "changed digest refuses",
      throwsError(
        () => verifyPortraitWebBasis(basis, { ...basis, [key]: "changed" }),
        "incomplete or changed",
      ),
    );
    const missing: Record<string, string> = { ...basis };
    delete missing[key];
    TestValidator.predicate(
      "missing bytes refuse",
      throwsError(
        () => verifyPortraitWebBasis(basis, missing),
        "incomplete or changed",
      ),
    );
    TestValidator.predicate(
      "missing basis refuses",
      throwsError(
        () => verifyPortraitWebBasis(missing, basis),
        "incomplete or changed",
      ),
    );
    TestValidator.predicate(
      "empty digest refuses",
      throwsError(
        () =>
          verifyPortraitWebBasis(
            { ...basis, [key]: "" },
            { ...basis, [key]: "" },
          ),
        "incomplete or changed",
      ),
    );
  }
  for (const renderer of [
    "ANGLE (AMD, Radeon 780M, D3D11)",
    "ANGLE (NVIDIA, RTX, Vulkan)",
  ])
    TestValidator.predicate(
      "hardware device",
      portraitWebHardwareRenderer(renderer),
    );
  for (const renderer of [
    "",
    "   ",
    "unknown",
    "ANGLE SwiftShader",
    "llvmpipe",
    "softpipe",
    "Software Rasterizer",
    "Microsoft Basic Render Driver",
    "ANGLE WARP",
  ])
    TestValidator.predicate(
      "software or unknown device",
      !portraitWebHardwareRenderer(renderer),
    );
  for (const label of ["a", "round_1-variant", "x".repeat(80)])
    TestValidator.equals(
      "safe label retained",
      portraitWebCaptureLabel(label),
      label,
    );
  for (const label of [
    "",
    "../round",
    "a/b",
    "a\\b",
    "a b",
    ".",
    "-x",
    "x".repeat(81),
  ])
    TestValidator.predicate(
      "nonlocal or malformed label refuses",
      throwsError(() => portraitWebCaptureLabel(label), "Capture label"),
    );
};
