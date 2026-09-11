import { TestValidator } from "@nestia/e2e";
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

import { resetPortraitWebSubject } from "../../../scripts/face-review/web/logic.mjs";

/**
 * A reference-pose parent must be updated before child bounds frame a close view.
 * Scenarios:
 * 1. A two-unit cube centred at (2,3,4) beneath a translated/rotated parent has
 *    stale child bounds after changing only the local matrix to identity.
 * 2. The actual viewer reset restores centre (2,3,4) and size (2,2,2) before any
 *    rendering callback. A repeated reset retains the same bounds.
 */
export const test_subject_face_web_reference_transition = (): void => {
  const group = new Group(),
    geometry = new BoxGeometry(2, 2, 2),
    material = new MeshBasicMaterial();
  const child = new Mesh(geometry, material);
  child.position.set(2, 3, 4);
  group.add(child);
  group.matrixAutoUpdate = false;
  group.matrix.makeRotationZ(Math.PI / 2);
  group.matrix.setPosition(10, 20, 30);
  group.updateMatrixWorld(true);
  group.matrix.identity();
  const stale = new Box3().expandByObject(child).getCenter(new Vector3());
  TestValidator.predicate(
    "negative twin retains stale parent pose",
    stale.distanceTo(new Vector3(2, 3, 4)) > 1,
  );
  resetPortraitWebSubject(group);
  const bounds = new Box3().expandByObject(child);
  TestValidator.predicate(
    "close centre is subject-local",
    bounds.getCenter(new Vector3()).distanceTo(new Vector3(2, 3, 4)) < 1e-12,
  );
  TestValidator.predicate(
    "close span retains cube dimensions",
    bounds.getSize(new Vector3()).distanceTo(new Vector3(2, 2, 2)) < 1e-12,
  );
  resetPortraitWebSubject(group);
  TestValidator.predicate(
    "repeated transition is stable",
    new Box3().expandByObject(child).equals(bounds),
  );
  geometry.dispose();
  material.dispose();
};
