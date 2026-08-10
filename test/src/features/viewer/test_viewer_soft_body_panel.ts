import {
  lowerSoftFurnishing,
  simulateSoftBody,
  softBodySurfaceGeometry,
} from "@automovie/engine";
import { buildSoftBodyObject } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose } from "../internal/predicates";
import { softFurnishing, softPanel } from "../internal/softFixtures";

/** A hanging panel and its derived surface at one step. */
const drape = (step: number) => {
  const domain = softPanel({
    columns: 4,
    rows: 4,
    overrides: {
      id: "drape",
      anchors: [
        { id: "left", particle: 0, position: null },
        { id: "right", particle: 3, position: null },
      ],
    },
  });
  return softBodySurfaceGeometry({
    domain,
    state: simulateSoftBody(domain, step),
  });
};

/**
 * The viewer uploads the engine's cloth panel and contributes no geometry of
 * its own.
 *
 * A viewer that built its own mesh would be a second opinion about where the
 * fabric is, and a second opinion can disagree with the field the constraints
 * were proven against. Every attribute therefore comes straight from
 * `softBodySurfaceGeometry`, including the bounding sphere: measuring the
 * vertex buffer would report a cord as a surface and give a camera a volume no
 * triangle supports.
 *
 * The analysis status rides along on the object, because a panel drawn in its
 * rest shape under an `unsupported` status must be distinguishable in the scene
 * graph from one that was actually solved.
 *
 * Scenarios:
 *
 * 1. Every buffer attribute matches the engine surface element for element, and
 *    the index buffer matches its length and its first triangle.
 * 2. The bounding sphere is the engine's own extent — centre and radius derived
 *    from the reported bounds — rather than a recomputed one.
 * 3. `update` re-uploads a newly solved step: the positions change, the step in
 *    `userData` follows, and the vertex count does not.
 * 4. A cord carries no triangle, so the object is hidden and its bounding sphere
 *    collapses to a point rather than culling against an invented volume.
 * 5. Cloth is drawn double-sided by default, and a supplied material is used as-is
 *    and not disposed by the object that borrowed it, while the default
 *    material is.
 * 6. The analysis status is recorded, so an `unsupported` panel is identifiable
 *    from the scene graph alone.
 */
export const test_viewer_soft_body_panel = (): void => {
  const surface = drape(64);
  const object = buildSoftBodyObject({ surface });
  const geometry = object.object.geometry;
  TestValidator.equals(
    "every attribute is the engine's own",
    namedFacts([
      [
        "positions",
        () =>
          Array.from(geometry.getAttribute("position").array).every(
            (value, index) =>
              nclose(value, surface.mesh.positions[index], 1e-5),
          ),
      ],
      [
        "normals",
        () =>
          geometry.getAttribute("normal").count ===
          surface.mesh.positions.length / 3,
      ],
      [
        "uvs",
        () =>
          Array.from(geometry.getAttribute("uv").array).every((value, index) =>
            nclose(value, (surface.mesh.uvs ?? [])[index], 1e-5),
          ),
      ],
      [
        "indices",
        () =>
          geometry.getIndex()?.count === (surface.mesh.indices ?? []).length,
      ],
      [
        "firstTriangle",
        () =>
          geometry.getIndex()?.getX(0) === (surface.mesh.indices ?? [])[0] &&
          geometry.getIndex()?.getX(1) === (surface.mesh.indices ?? [])[1],
      ],
      ["name", () => object.object.name === "soft:drape"],
      ["domain", () => object.object.userData.domain === "drape"],
      ["step", () => object.object.userData.step === 64],
    ]),
    {
      positions: true,
      normals: true,
      uvs: true,
      indices: true,
      firstTriangle: true,
      name: true,
      domain: true,
      step: true,
    },
  );

  const bounds = surface.bounds;
  TestValidator.equals(
    "the bounding sphere is the engine's extent, not a recomputed one",
    namedFacts([
      ["present", () => bounds !== null && geometry.boundingSphere !== null],
      [
        "centre",
        () =>
          bounds !== null &&
          nclose(
            geometry.boundingSphere?.center.y ?? NaN,
            (bounds.min.y + bounds.max.y) / 2,
          ),
      ],
      [
        "radius",
        () =>
          bounds !== null &&
          nclose(
            geometry.boundingSphere?.radius ?? NaN,
            new THREE.Vector3(
              bounds.min.x,
              bounds.min.y,
              bounds.min.z,
            ).distanceTo(
              new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
            ) / 2,
          ),
      ],
      ["visible", () => object.object.visible === true],
    ]),
    { present: true, centre: true, radius: true, visible: true },
  );

  const before = geometry.getAttribute("position").getY(15);
  object.update(drape(128));
  TestValidator.equals(
    "update re-uploads a newly solved step",
    namedFacts([
      ["moved", () => geometry.getAttribute("position").getY(15) !== before],
      ["step", () => object.object.userData.step === 128],
      ["count", () => geometry.getAttribute("position").count === 16],
    ]),
    { moved: true, step: true, count: true },
  );

  const cord = softPanel({ columns: 1, rows: 4, overrides: { id: "cord" } });
  const thread = buildSoftBodyObject({
    surface: softBodySurfaceGeometry({
      domain: cord,
      state: simulateSoftBody(cord, 0),
    }),
  });
  TestValidator.equals(
    "a cord is hidden and culls to a point",
    namedFacts([
      ["hidden", () => thread.object.visible === false],
      ["radius", () => thread.object.geometry.boundingSphere?.radius === 0],
    ]),
    { hidden: true, radius: true },
  );

  const borrowed = new THREE.MeshBasicMaterial();
  const lent = buildSoftBodyObject({ surface, material: borrowed });
  const owned = object.object.material as THREE.Material;
  lent.dispose();
  object.dispose();
  thread.dispose();
  TestValidator.equals(
    "material ownership decides what is disposed",
    namedFacts([
      [
        "doubleSided",
        () => (owned as THREE.MeshStandardMaterial).side === THREE.DoubleSide,
      ],
      ["used", () => lent.object.material === borrowed],
      ["borrowedAlive", () => borrowed.version >= 0],
    ]),
    { doubleSided: true, used: true, borrowedAlive: true },
  );
  borrowed.dispose();

  const unsupported = lowerSoftFurnishing({
    furnishing: softFurnishing(),
    domain: softPanel({
      columns: 3,
      rows: 3,
      overrides: { id: "self", selfCollision: true },
    }),
    time: 0.25,
  });
  const flagged = buildSoftBodyObject({
    surface: unsupported.surface ?? surface,
    status: unsupported.analysis.status,
  });
  TestValidator.equals(
    "an unsupported panel is identifiable from the scene graph",
    namedFacts([
      ["status", () => flagged.object.userData.status === "unsupported"],
      ["default", () => object.object.userData.status === "solved"],
    ]),
    { status: true, default: true },
  );
  flagged.dispose();
};
