import { TestValidator } from "@nestia/e2e";

import { portraitCaptureProfile } from "../../subjects/captureProfile";

/**
 * The inspection plan must expose both sides and fit a real source-image crop.
 * This checks usable viewing conditions, not filenames or source text.
 *
 * Scenarios:
 * 1. Front, both oblique directions, both profiles, back, steep top/bottom and
 *    an oblique opposing the frontal oblique are reachable.
 * 2. The perspective camera and image extents are finite and non-degenerate.
 * 3. The reference crop remains inside the image and every area light has a
 *    positive size/power and a finite position and colour.
 */
export const test_subject_capture_profile = (): void => {
  const plan = portraitCaptureProfile;
  const yaws = plan.views.map((view) => view.yaw);
  TestValidator.predicate(
    "top and bottom coverage",
    plan.views.some((view) => (view.pitch ?? 0) > 60) &&
      plan.views.some((view) => (view.pitch ?? 0) < -60),
  );
  TestValidator.predicate(
    "opposing oblique coverage",
    yaws.some(
      (a) => a > 0 && a < 90 && yaws.some((b) => Math.abs(a - b) === 180),
    ),
  );
  TestValidator.predicate(
    "front and back",
    yaws.includes(0) && yaws.some((yaw) => Math.abs(yaw) === 180),
  );
  TestValidator.predicate(
    "both oblique sides",
    yaws.some((yaw) => yaw > 0 && yaw < 90) &&
      yaws.some((yaw) => yaw < 0 && yaw > -90),
  );
  TestValidator.predicate(
    "both profiles",
    yaws.includes(90) && yaws.includes(-90),
  );
  TestValidator.predicate(
    "usable perspective",
    plan.camera.verticalFov > 0 &&
      plan.camera.verticalFov < 180 &&
      plan.camera.distance > 0 &&
      plan.camera.target.every(Number.isFinite),
  );
  TestValidator.predicate(
    "usable image",
    plan.image.width > 0 && plan.image.height > 0,
  );
  const crop = plan.reference.crop;
  TestValidator.predicate(
    "source crop",
    crop.x >= 0 &&
      crop.y >= 0 &&
      crop.size > 0 &&
      crop.x + crop.size <= plan.reference.width &&
      crop.y + crop.size <= plan.reference.height,
  );
  TestValidator.predicate(
    "usable area lights",
    plan.cycles.lights.every(
      (light) =>
        light.power > 0 &&
        light.size > 0 &&
        light.position.every(Number.isFinite) &&
        light.color.every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
    ),
  );
};
