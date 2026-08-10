import { arrangePlantingCluster, growPlanting } from "@automovie/engine";
import { buildPlantingObject } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose, qclose, vclose } from "../internal/predicates";
import { plantingCluster, plantingRecipe } from "../internal/softFixtures";

const FOLIAGE = {
  density: 4,
  minLevel: 1,
  size: { x: 0.05, y: 0.125, z: 0.05 },
  scaleJitter: 0,
  rollJitter: 0,
};

/**
 * A planting cluster is drawn as GPU-instanced batches whose matrices are the
 * lossless composition of the member's transform with the branch's or leaf's
 * own.
 *
 * Repetition must never become scene nodes. A bed of six ferns is two draws —
 * one batch of branches and one of leaves — and the instance count is exactly
 * `members × parts`, which is the whole reason the engine derives one prototype
 * structure and a list of placements instead of duplicating geometry.
 *
 * Losslessness is the second half of the contract. Decomposing an instance's
 * matrix must return the member's own translation, its unit quaternion and its
 * three independent scale axes, composed with the part's: a degraded yaw or a
 * uniform scale would be a fact about the plant nobody authored. The comparison
 * is made to single-precision tolerance because `InstancedMesh` stores its
 * matrices as 32-bit floats — that rounding is the GPU's, not the derivation's,
 * and the reference values on the engine side stay double precision.
 *
 * Scenarios:
 *
 * 1. The group holds exactly two instanced meshes, with instance counts equal to
 *    `members × branches` and `members × leaves`.
 * 2. The first branch instance decomposes to the first member's transform composed
 *    with the branch's own: the midpoint of the trunk, the rotation carrying
 *    `+y` onto the trunk axis, and the mean radius by the length.
 * 3. The first leaf instance is, element for element, the member's matrix times
 *    the leaf's own — and the leaf's own matrix round-trips back to exactly the
 *    translation, unit quaternion and per-axis scale the derivation emitted.
 *    The composed matrix deliberately does **not** decompose back to the
 *    product of the two scales: a per-axis parent scale composed with a rotated
 *    child is a sheared transform, which is why the check is on the matrix
 *    rather than on a decomposition that would have to invent a rotation for
 *    it.
 * 4. Every instance matrix is finite and every batch reports a bounding sphere, so
 *    nothing is culled against an unset volume.
 * 5. A branch the envelope cut to nothing keeps its instance slot and collapses to
 *    a zero-height cylinder, rather than being skipped — which would shift
 *    every later branch's index — or drawn with an undefined axis.
 * 6. A bare structure with no foliage rule produces no leaf batch at all rather
 *    than an empty one, and disposing releases what the object created while
 *    leaving a borrowed material alone.
 * 7. A structure that never emerged draws nothing: the batch is hidden and its
 *    bounding sphere is a point, rather than the empty sphere of radius
 *    `-Infinity` that computing bounds over zero instances would leave for a
 *    camera to cull against.
 */
export const test_viewer_planting_instances = (): void => {
  const domain = plantingRecipe({ foliage: FOLIAGE });
  const plant = growPlanting(domain);
  const arrangement = arrangePlantingCluster(plantingCluster());
  const object = buildPlantingObject({ plant, arrangement });

  TestValidator.equals(
    "a cluster is two instanced draws, not a forest of scene nodes",
    {
      children: object.object.children.length,
      branches: object.branchCount,
      leaves: object.leafCount,
      branchInstances: object.branches.count,
      leafInstances: object.leaves?.count ?? -1,
      instancedMeshes: object.object.children.filter(
        (child) => child instanceof THREE.InstancedMesh,
      ).length,
    },
    {
      children: 2,
      branches: arrangement.placements.length * plant.branches.length,
      leaves: arrangement.placements.length * plant.leaves.length,
      branchInstances: arrangement.placements.length * plant.branches.length,
      leafInstances: arrangement.placements.length * plant.leaves.length,
      instancedMeshes: 2,
    },
  );

  const member = arrangement.placements[0];
  const trunk = plant.branches[0];
  const matrix = new THREE.Matrix4();
  object.branches.getMatrixAt(0, matrix);
  const translation = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(translation, rotation, scale);
  const expected = new THREE.Matrix4()
    .compose(
      new THREE.Vector3(
        member.translation.x,
        member.translation.y,
        member.translation.z,
      ),
      new THREE.Quaternion(
        member.rotation.x,
        member.rotation.y,
        member.rotation.z,
        member.rotation.w,
      ),
      new THREE.Vector3(member.scale.x, member.scale.y, member.scale.z),
    )
    .multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(
          (trunk.start.x + trunk.end.x) / 2,
          (trunk.start.y + trunk.end.y) / 2,
          (trunk.start.z + trunk.end.z) / 2,
        ),
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(
            trunk.end.x - trunk.start.x,
            trunk.end.y - trunk.start.y,
            trunk.end.z - trunk.start.z,
          ).normalize(),
        ),
        new THREE.Vector3(
          (trunk.radiusStart + trunk.radiusEnd) / 2,
          1,
          (trunk.radiusStart + trunk.radiusEnd) / 2,
        ),
      ),
    );
  const wantTranslation = new THREE.Vector3();
  const wantRotation = new THREE.Quaternion();
  const wantScale = new THREE.Vector3();
  expected.decompose(wantTranslation, wantRotation, wantScale);
  TestValidator.equals(
    "a branch instance is the member's transform composed with the branch's",
    namedFacts([
      ["translation", () => vclose(translation, wantTranslation, 1e-5)],
      ["rotation", () => qclose(rotation, wantRotation, 1e-5)],
      [
        "scaleY",
        () =>
          nclose(
            scale.y,
            member.scale.y *
              Math.sqrt(
                (trunk.end.x - trunk.start.x) ** 2 +
                  (trunk.end.y - trunk.start.y) ** 2 +
                  (trunk.end.z - trunk.start.z) ** 2,
              ),
            1e-5,
          ),
      ],
      [
        "scaleX",
        () =>
          nclose(
            scale.x,
            member.scale.x * ((trunk.radiusStart + trunk.radiusEnd) / 2),
            1e-5,
          ),
      ],
      ["nonUniform", () => scale.x !== scale.y && scale.y !== scale.z],
    ]),
    {
      translation: true,
      rotation: true,
      scaleY: true,
      scaleX: true,
      nonUniform: true,
    },
  );

  const leaf = plant.leaves[0];
  const leafMatrix = new THREE.Matrix4();
  object.leaves?.getMatrixAt(0, leafMatrix);
  const leafLocal = new THREE.Matrix4().compose(
    new THREE.Vector3(
      leaf.translation.x,
      leaf.translation.y,
      leaf.translation.z,
    ),
    new THREE.Quaternion(
      leaf.rotation.x,
      leaf.rotation.y,
      leaf.rotation.z,
      leaf.rotation.w,
    ),
    new THREE.Vector3(leaf.scale.x, leaf.scale.y, leaf.scale.z),
  );
  const leafExpected = new THREE.Matrix4()
    .compose(
      new THREE.Vector3(
        member.translation.x,
        member.translation.y,
        member.translation.z,
      ),
      new THREE.Quaternion(
        member.rotation.x,
        member.rotation.y,
        member.rotation.z,
        member.rotation.w,
      ),
      new THREE.Vector3(member.scale.x, member.scale.y, member.scale.z),
    )
    .multiply(leafLocal);
  const backTranslation = new THREE.Vector3();
  const backRotation = new THREE.Quaternion();
  const backScale = new THREE.Vector3();
  leafLocal.decompose(backTranslation, backRotation, backScale);
  TestValidator.equals(
    "a leaf instance is the exact composition of two full transforms",
    namedFacts([
      [
        "elements",
        () =>
          leafMatrix.elements.every((value, index) =>
            nclose(value, leafExpected.elements[index], 1e-5),
          ),
      ],
      [
        "localRoundTrip",
        () =>
          vclose(backTranslation, leaf.translation, 1e-12) &&
          qclose(backRotation, leaf.rotation, 1e-12) &&
          vclose(backScale, leaf.scale, 1e-12),
      ],
      ["perAxis", () => leaf.scale.x !== leaf.scale.y],
      [
        "shearedByDesign",
        () => {
          const scale = new THREE.Vector3();
          leafMatrix.decompose(
            new THREE.Vector3(),
            new THREE.Quaternion(),
            scale,
          );
          return nclose(scale.x, member.scale.x * leaf.scale.x, 1e-5) === false;
        },
      ],
    ]),
    {
      elements: true,
      localRoundTrip: true,
      perAxis: true,
      shearedByDesign: true,
    },
  );

  TestValidator.equals(
    "every instance is finite and every batch is bounded",
    namedFacts([
      [
        "branches",
        () =>
          Array.from(object.branches.instanceMatrix.array).every((value) =>
            Number.isFinite(value),
          ),
      ],
      [
        "leaves",
        () =>
          Array.from(object.leaves?.instanceMatrix.array ?? []).every((value) =>
            Number.isFinite(value),
          ),
      ],
      ["branchBounds", () => object.branches.boundingSphere !== null],
      ["leafBounds", () => (object.leaves?.boundingSphere ?? null) !== null],
      ["cluster", () => object.object.userData.cluster === "atrium-bed"],
      ["stage", () => object.object.userData.stage === 1],
      ["rejected", () => object.object.userData.rejected === 0],
    ]),
    {
      branches: true,
      leaves: true,
      branchBounds: true,
      leafBounds: true,
      cluster: true,
      stage: true,
      rejected: true,
    },
  );

  const borrowed = new THREE.MeshBasicMaterial();
  const bare = buildPlantingObject({
    plant: growPlanting(plantingRecipe()),
    arrangement,
    branchMaterial: borrowed,
  });
  const cut = growPlanting(
    plantingRecipe({
      structure: { ...plantingRecipe().structure, length: 2 },
      pruning: {
        kind: "box",
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
      },
    }),
  );
  const pruned = buildPlantingObject({ plant: cut, arrangement });
  const stub = new THREE.Matrix4();
  pruned.branches.getMatrixAt(cut.branches.length - 1, stub);
  TestValidator.equals(
    "a branch pruned to nothing keeps its slot and collapses instead of skewing",
    namedFacts([
      [
        "zeroLength",
        () => {
          const tip = cut.branches[cut.branches.length - 1];
          return (
            tip.start.x === tip.end.x &&
            tip.start.y === tip.end.y &&
            tip.start.z === tip.end.z
          );
        },
      ],
      ["finite", () => stub.elements.every((value) => Number.isFinite(value))],
      [
        "collapsed",
        () => {
          const scale = new THREE.Vector3();
          stub.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
          return scale.y === 0;
        },
      ],
      [
        "slots",
        () =>
          pruned.branchCount ===
          arrangement.placements.length * cut.branches.length,
      ],
    ]),
    { zeroLength: true, finite: true, collapsed: true, slots: true },
  );
  pruned.dispose();

  TestValidator.equals(
    "a bare structure has no leaf batch, and a borrowed material is left alone",
    namedFacts([
      ["noLeaves", () => bare.leaves === null && bare.leafCount === 0],
      ["oneChild", () => bare.object.children.length === 1],
      ["borrowed", () => bare.branches.material === borrowed],
    ]),
    { noLeaves: true, oneChild: true, borrowed: true },
  );
  const dormant = buildPlantingObject({
    plant: growPlanting(
      plantingRecipe({ growth: { stage: 0, onset: 0.25 }, foliage: FOLIAGE }),
    ),
    arrangement,
  });
  TestValidator.equals(
    "a structure that never emerged is hidden and bounded at a point",
    namedFacts([
      ["branchCount", () => dormant.branchCount === 0],
      ["leafCount", () => dormant.leafCount === 0],
      ["hidden", () => dormant.branches.visible === false],
      ["bounded", () => dormant.branches.boundingSphere?.radius === 0],
      ["noLeafBatch", () => dormant.leaves === null],
      ["oneChild", () => dormant.object.children.length === 1],
    ]),
    {
      branchCount: true,
      leafCount: true,
      hidden: true,
      bounded: true,
      noLeafBatch: true,
      oneChild: true,
    },
  );
  dormant.dispose();

  bare.dispose();
  object.dispose();
  borrowed.dispose();
};
