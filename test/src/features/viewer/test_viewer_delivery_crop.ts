import { projectToNdc, resolveAutoMovieDeliveryCrop } from "@automovie/engine";
import { IAutoMovieDeliveryCrop } from "@automovie/interface";
import {
  applyAutoMovieDeliveryCrop,
  readAutoMovieDeliveryCrop,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const CAMERA = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

const projected = (
  camera: THREE.PerspectiveCamera,
  point: THREE.Vector3,
): THREE.Vector3 => point.clone().project(camera);

/** Three.js delivery pixels and engine acceptance share one crop projection. */
export const test_viewer_delivery_crop = (): void => {
  const camera = new THREE.PerspectiveCamera(90, 2, 1, 10);
  camera.updateProjectionMatrix();
  const original = camera.projectionMatrix.toArray();
  applyAutoMovieDeliveryCrop(camera, undefined);
  const omitted = camera.projectionMatrix.toArray();
  applyAutoMovieDeliveryCrop(camera, {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
  });
  const explicit = camera.projectionMatrix.toArray();
  TestValidator.equals(
    "omitted and explicit whole crops preserve the original matrix",
    {
      omitted,
      explicit,
      active: readAutoMovieDeliveryCrop(camera),
    },
    { omitted: original, explicit: original, active: undefined },
  );

  const crop: IAutoMovieDeliveryCrop = {
    left: 0.25,
    top: 0.1,
    right: 0.75,
    bottom: 0.9,
  };
  applyAutoMovieDeliveryCrop(camera, crop);
  TestValidator.equals(
    "the renderer exposes the same crop to downstream culling and LOD",
    readAutoMovieDeliveryCrop(camera),
    crop,
  );
  const point = new THREE.Vector3(0.5, 0.25, -2);
  const actual = projected(camera, point);
  const expected = projectToNdc(
    CAMERA,
    { x: point.x, y: point.y, z: point.z },
    Math.tan(Math.PI / 4),
    2,
    crop,
  );
  TestValidator.predicate(
    "off-axis viewer projection equals engine crop projection",
    nclose(actual.x, expected.ndcX) && nclose(actual.y, expected.ndcY),
  );

  applyAutoMovieDeliveryCrop(camera, {
    left: 0.5,
    top: 0,
    right: 1,
    bottom: 1,
  });
  TestValidator.equals(
    "closed crop edges map onto the complete output edge",
    namedFacts([
      [
        "left",
        () => nclose(projected(camera, new THREE.Vector3(0, 0, -2)).x, -1),
      ],
      [
        "right",
        () => nclose(projected(camera, new THREE.Vector3(4, 0, -2)).x, 1),
      ],
    ]),
    { left: true, right: true },
  );

  TestValidator.predicate(
    "viewer crop rejects invalid regions through the shared resolver",
    throwsError(() =>
      applyAutoMovieDeliveryCrop(camera, {
        left: 0.75,
        top: 0,
        right: 0.25,
        bottom: 1,
      }),
    ) &&
      throwsError(() =>
        resolveAutoMovieDeliveryCrop({
          left: 0,
          top: Number.POSITIVE_INFINITY,
          right: 1,
          bottom: 1,
        }),
      ),
  );
};
