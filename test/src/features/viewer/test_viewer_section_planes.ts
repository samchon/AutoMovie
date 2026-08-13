import {
  IAutoMovieSectionPlane,
  autoMovieSectionPlanesKeepPoint,
} from "@automovie/engine";
import { applyAutoMovieSectionPlanes } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";

/** A horizontal cut at y = 3 removing everything above it. */
const CEILING: IAutoMovieSectionPlane = {
  point: { x: 0, y: 3, z: 0 },
  normal: { x: 0, y: 2, z: 0 },
};

/** A vertical cut at x = 0 removing everything west of it. */
const WEST_WALL: IAutoMovieSectionPlane = {
  point: { x: 0, y: 0, z: 0 },
  normal: { x: -1, y: 0, z: 0 },
};

const scene = (): {
  root: THREE.Scene;
  single: THREE.MeshStandardMaterial;
  multi: THREE.MeshStandardMaterial[];
} => {
  const root = new THREE.Scene();
  const single = new THREE.MeshStandardMaterial();
  const multi = [
    new THREE.MeshStandardMaterial(),
    new THREE.MeshStandardMaterial(),
  ];
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), single));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), multi));
  // A non-drawing child, so the walk must skip what carries no material rather
  // than reach into `undefined`.
  root.add(new THREE.Group());
  return { root, single, multi };
};

const materialsOf = (root: THREE.Object3D): THREE.Material[] => {
  const found: THREE.Material[] = [];
  root.traverse((object) => {
    const holder = object as { material?: THREE.Material | THREE.Material[] };
    if (holder.material === undefined) return;
    for (const material of Array.isArray(holder.material)
      ? holder.material
      : [holder.material])
      found.push(material);
  });
  return found;
};

/**
 * The section a reviewer actually looks through: the state handed to `three.js`
 * one step before the renderer, read back instead of inferred from a picture.
 *
 * Two facts decide whether a cut shows the right half, and both are convention
 * translations that no screenshot would explain if they were wrong.
 * `IAutoMovieSectionPlane.normal` points at the half-space to REMOVE, while a
 * `THREE.Plane` keeps the side ITS normal points at, so the runtime plane must
 * carry the negated normal; and `three.js` discards only a strictly negative
 * signed distance, so a vertex exactly on the cut is drawn — which must be the
 * same answer `autoMovieSectionPlanesKeepPoint` gives, or the engine would
 * report a floor present that the renderer erased.
 *
 * Expectations are hand geometry: with the removed half above y = 3, a runtime
 * plane through (0,3,0) with normal (0,−1,0) has constant +3, so its distance
 * to a point is `3 − y` — positive below, zero on the cut, negative above.
 *
 * Scenarios:
 *
 * 1. One declared plane switches local clipping on, and every material in the
 *    subtree — including each member of an array material — receives the same
 *    plane array with `clipIntersection` false. A material-less child is
 *    skipped rather than faulted.
 * 2. The built plane's normal is the NEGATED declared normal, unit length, and
 *    its `distanceToPoint` sign agrees with `autoMovieSectionPlanesKeepPoint`
 *    below, above, and exactly on the cut. This is the whole convention.
 * 3. A non-unit declared normal still produces a unit runtime plane at the same
 *    place, so a caller need not pre-normalize.
 * 4. Taking a section bumps each material's `version` (the shader bakes the
 *    plane COUNT), while re-applying the SAME count leaves the version alone,
 *    so sliding a cut costs no recompile. `version` rather than `needsUpdate`,
 *    because the latter is a write-only setter in `three.js` and reading it
 *    back would assert `undefined === true` forever.
 * 5. Two planes produce two runtime planes in declared order, and the count
 *    change again marks the materials for recompile.
 * 6. Releasing the section (an empty list) clears every material back to `null`
 *    and switches local clipping off, so an uncut scene renders exactly as it
 *    did before section planes existed. The negative twin of case 1.
 */
export const test_viewer_section_planes = (): void => {
  // 1. one plane reaches every material, and only the ones that exist
  const first = scene();
  const renderer = { localClippingEnabled: false };
  const built = applyAutoMovieSectionPlanes({
    renderer,
    root: first.root,
    planes: [CEILING],
  });
  TestValidator.equals(
    "one declared plane switches local clipping on",
    renderer.localClippingEnabled,
    true,
  );
  TestValidator.equals("one declared plane builds one", built.length, 1);
  const materials = materialsOf(first.root);
  TestValidator.equals(
    "every mesh material in the subtree is reached",
    materials.length,
    3,
  );
  TestValidator.predicate(
    "every material holds that exact plane array, intersecting",
    materials.every(
      (material) =>
        material.clippingPlanes === built &&
        material.clipIntersection === false,
    ),
  );

  // 2. the convention: negated normal, and agreement at the boundary
  const plane = built[0]!;
  TestValidator.predicate(
    "the runtime plane carries the negated, unit normal",
    nclose(plane.normal.x, 0) &&
      nclose(plane.normal.y, -1) &&
      nclose(plane.normal.z, 0),
  );
  for (const [label, y] of [
    ["under", 2],
    ["on", 3],
    ["over", 4],
  ] as const)
    TestValidator.equals(
      `renderer and engine agree ${label} the cut`,
      plane.distanceToPoint(new THREE.Vector3(0, y, 0)) >= 0,
      autoMovieSectionPlanesKeepPoint([CEILING], { x: 0, y, z: 0 }),
    );

  // 3. a non-unit declared normal still lands unit, at the same place
  TestValidator.predicate(
    "a length-2 declared normal produces the same unit plane",
    nclose(plane.constant, 3),
  );

  // 4. recompile only when the count changes
  TestValidator.predicate(
    "taking a section marks every material for recompile",
    materials.every((material) => material.version === 1),
  );
  applyAutoMovieSectionPlanes({
    renderer,
    root: first.root,
    planes: [{ ...CEILING, point: { x: 0, y: 1, z: 0 } }],
  });
  TestValidator.predicate(
    "sliding a cut of the same count costs no recompile",
    materials.every((material) => material.version === 1),
  );

  // 5. two planes, in declared order, with a fresh compile
  const pair = applyAutoMovieSectionPlanes({
    renderer,
    root: first.root,
    planes: [CEILING, WEST_WALL],
  });
  TestValidator.equals("two declared planes build two", pair.length, 2);
  TestValidator.predicate(
    "the second runtime plane is the negated west normal",
    nclose(pair[1]!.normal.x, 1) && nclose(pair[1]!.constant, 0),
  );
  TestValidator.predicate(
    "a changed count marks every material for recompile",
    materials.every((material) => material.version === 2),
  );

  // 6. releasing the section restores the uncut scene
  const released = applyAutoMovieSectionPlanes({
    renderer,
    root: first.root,
    planes: [],
  });
  TestValidator.equals("releasing builds no plane", released.length, 0);
  TestValidator.equals(
    "releasing switches local clipping off",
    renderer.localClippingEnabled,
    false,
  );
  TestValidator.predicate(
    "every material is back to no clipping planes",
    materials.every((material) => material.clippingPlanes === null),
  );
};
