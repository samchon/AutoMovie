import {
  intersectsPerspectiveFrustumBox,
  intersectsPerspectiveFrustumSegment,
  intersectsPerspectiveFrustumSphere,
  projectToNdc,
  resolveAutoMovieDeliveryCrop,
} from "@automovie/engine";
import { IAutoMovieDeliveryCrop } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

const CAMERA = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

const RIGHT_HALF: IAutoMovieDeliveryCrop = {
  left: 0.5,
  top: 0,
  right: 1,
  bottom: 1,
};

const segment = (
  x: number,
  crop: IAutoMovieDeliveryCrop | undefined,
): boolean =>
  intersectsPerspectiveFrustumSegment({
    camera: CAMERA,
    from: { x, y: 0, z: -2 },
    to: { x, y: 0.5, z: -2 },
    near: 1,
    far: 10,
    halfY: 1,
    aspect: 1,
    crop,
  });

const verticalSegment = (
  y: number,
  crop: IAutoMovieDeliveryCrop | undefined,
): boolean =>
  intersectsPerspectiveFrustumSegment({
    camera: CAMERA,
    from: { x: 0, y, z: -2 },
    to: { x: 0.5, y, z: -2 },
    near: 1,
    far: 10,
    halfY: 1,
    aspect: 1,
    crop,
  });

/** Delivery crop is one validated gate across point and bounded projection. */
export const test_film_camera_delivery_crop = (): void => {
  const whole = resolveAutoMovieDeliveryCrop(undefined);
  const explicitWhole: IAutoMovieDeliveryCrop = {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
  };
  const uncropped = projectToNdc(CAMERA, { x: 0.5, y: 0.25, z: -1 }, 1, 1);
  const explicit = projectToNdc(
    CAMERA,
    { x: 0.5, y: 0.25, z: -1 },
    1,
    1,
    explicitWhole,
  );
  TestValidator.equals(
    "omitted and explicit whole crops are exact no-ops",
    { whole, explicit, uncropped },
    { whole: explicitWhole, explicit: uncropped, uncropped },
  );

  const source = { left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 };
  const resolved = resolveAutoMovieDeliveryCrop(source);
  source.left = 0;
  TestValidator.equals(
    "a crop resolves by value and maps its window onto the complete output",
    {
      resolved,
      projected: projectToNdc(
        CAMERA,
        { x: 0.5, y: 0.25, z: -1 },
        1,
        1,
        resolved,
      ),
    },
    {
      resolved: { left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 },
      projected: { ndcX: 1, ndcY: 0.5, depth: 1 },
    },
  );

  TestValidator.equals(
    "closed crop edges include exact contact and reject either outside side",
    namedFacts([
      ["leftEdge", () => segment(0, RIGHT_HALF)],
      ["rightEdge", () => segment(2, RIGHT_HALF)],
      ["leftOutside", () => segment(-0.001, RIGHT_HALF) === false],
      ["rightOutside", () => segment(2.001, RIGHT_HALF) === false],
      [
        "cropOnlyRejection",
        () => segment(-0.001, undefined) && !segment(-0.001, RIGHT_HALF),
      ],
      [
        "wholeParity",
        () => segment(-1, undefined) === segment(-1, explicitWhole),
      ],
    ]),
    {
      leftEdge: true,
      rightEdge: true,
      leftOutside: true,
      rightOutside: true,
      cropOnlyRejection: true,
      wholeParity: true,
    },
  );

  const BOTTOM_HALF: IAutoMovieDeliveryCrop = {
    left: 0,
    top: 0.5,
    right: 1,
    bottom: 1,
  };
  TestValidator.equals(
    "top-origin vertical crop includes both exact edges and rejects outside",
    namedFacts([
      ["topEdge", () => verticalSegment(0, BOTTOM_HALF)],
      ["bottomEdge", () => verticalSegment(-2, BOTTOM_HALF)],
      ["topOutside", () => !verticalSegment(0.001, BOTTOM_HALF)],
      ["bottomOutside", () => !verticalSegment(-2.001, BOTTOM_HALF)],
    ]),
    { topEdge: true, bottomEdge: true, topOutside: true, bottomOutside: true },
  );

  TestValidator.equals(
    "box and sphere acceptance use the same off-axis delivery gate",
    namedFacts([
      [
        "boxAtCropEdge",
        () =>
          intersectsPerspectiveFrustumBox({
            camera: CAMERA,
            min: { x: 0, y: -0.1, z: -2.1 },
            max: { x: 0.1, y: 0.1, z: -1.9 },
            near: 1,
            far: 10,
            halfY: 1,
            aspect: 1,
            crop: RIGHT_HALF,
          }),
      ],
      [
        "boxOutsideCrop",
        () =>
          intersectsPerspectiveFrustumBox({
            camera: CAMERA,
            min: { x: -0.2, y: -0.1, z: -2.1 },
            max: { x: -0.1, y: 0.1, z: -1.9 },
            near: 1,
            far: 10,
            halfY: 1,
            aspect: 1,
            crop: RIGHT_HALF,
          }) === false,
      ],
      [
        "sphereAtCropEdge",
        () =>
          intersectsPerspectiveFrustumSphere({
            camera: CAMERA,
            center: { x: 0, y: 0, z: -2 },
            radius: 0,
            near: 1,
            far: 10,
            halfY: 1,
            aspect: 1,
            crop: RIGHT_HALF,
          }),
      ],
      [
        "sphereOutsideCrop",
        () =>
          intersectsPerspectiveFrustumSphere({
            camera: CAMERA,
            center: { x: -0.001, y: 0, z: -2 },
            radius: 0,
            near: 1,
            far: 10,
            halfY: 1,
            aspect: 1,
            crop: RIGHT_HALF,
          }) === false,
      ],
    ]),
    {
      boxAtCropEdge: true,
      boxOutsideCrop: true,
      sphereAtCropEdge: true,
      sphereOutsideCrop: true,
    },
  );

  const invalid = [
    { left: Number.NaN, top: 0, right: 1, bottom: 1 },
    { left: -0.1, top: 0, right: 1, bottom: 1 },
    { left: 0, top: 0, right: 1.1, bottom: 1 },
    { left: 0.5, top: 0, right: 0.5, bottom: 1 },
    { left: 0, top: 0.75, right: 1, bottom: 0.25 },
  ] satisfies IAutoMovieDeliveryCrop[];
  TestValidator.predicate(
    "invalid and out-of-raster crop regions fail closed",
    invalid.every((crop) =>
      throwsError(() => resolveAutoMovieDeliveryCrop(crop)),
    ),
  );
};
