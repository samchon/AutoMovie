import {
  IAutoMoviePlantingArrangement,
  IAutoMoviePlantingState,
} from "@automovie/interface";
import * as THREE from "three";

/**
 * A viewer-owned planting cluster drawn as two instanced batches.
 *
 * @author Samchon
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
 */
export interface IAutoMoviePlantingObject {
  /**
   * Add this group to the current scene.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  object: THREE.Group;

  /**
   * Every branch of every member, as one instanced draw.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  branches: THREE.InstancedMesh;

  /**
   * Every leaf of every member, as one instanced draw, or `null` when bare.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  leaves: THREE.InstancedMesh | null;

  /**
   * Branch instances drawn: `members × branches`.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  branchCount: number;

  /**
   * Leaf instances drawn: `members × leaves`.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  leafCount: number;

  /**
   * Release geometries, and the materials this object created.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
   */
  dispose: () => void;
}

/**
 * Project one derived plant and its arrangement into GPU-instanced batches.
 *
 * A bed of forty ferns is **two draws**, not forty scene subtrees: one
 * instanced batch for every branch of every member and one for every leaf. That
 * is the whole point of deriving one prototype structure and a list of
 * placements rather than duplicating geometry per plant.
 *
 * Every instance matrix is the placement's full transform composed with the
 * branch or leaf's own — translation, unit quaternion and per-axis scale on
 * both sides, composed as `Matrix4`. Nothing is reduced to a yaw or to one
 * uniform number: a member scaled `1.2 × 0.9 × 1.2` is drawn scaled `1.2 × 0.9
 * × 1.2`.
 *
 * A structure that has not emerged, or a bed whose every slot was refused, is a
 * hidden batch bounded at a point rather than an empty one bounded by nothing:
 * a bounding sphere computed over zero instances has a radius of `-Infinity`,
 * and a camera would cull against it.
 *
 * A branch is a unit cylinder scaled to `(r, length, r)` with `r` the mean of
 * its two radii and rotated from `+y` onto its own axis. The taper a segment
 * carries in the derived structure is therefore averaged, which is the stated
 * cost of drawing every branch in one instanced batch; the derived record keeps
 * both radii for anything that needs them. A leaf is a unit plane scaled by its
 * per-axis size, which is exactly the prototype the derivation emitted.
 *
 * @author Samchon
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Displays this surface from declared vegetation individuals and clusters.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Materializes those vegetation forms without inferring ecology.
 */
export const buildPlantingObject = (props: {
  plant: IAutoMoviePlantingState;
  arrangement: IAutoMoviePlantingArrangement;
  /** Branch material; an opaque default is created when absent. */
  branchMaterial?: THREE.Material;
  /** Leaf material; a double-sided default is created when absent. */
  leafMaterial?: THREE.Material;
  /** Radial segments of the branch cylinder; defaults to 6. */
  branchSegments?: number;
}): IAutoMoviePlantingObject => {
  const group = new THREE.Group();
  group.name = `planting:${props.arrangement.cluster}`;

  const branchGeometry = new THREE.CylinderGeometry(
    1,
    1,
    1,
    props.branchSegments ?? 6,
    1,
    false,
  );
  const ownedBranchMaterial = props.branchMaterial === undefined;
  const branchMaterial =
    props.branchMaterial ??
    new THREE.MeshStandardMaterial({
      color: 0x6b5136,
      roughness: 0.9,
      metalness: 0,
    });
  const branchCount =
    props.arrangement.placements.length * props.plant.branches.length;
  const branches = new THREE.InstancedMesh(
    branchGeometry,
    branchMaterial,
    branchCount,
  );
  branches.name = `planting-branches:${props.arrangement.cluster}`;

  const leafCount =
    props.arrangement.placements.length * props.plant.leaves.length;
  const ownedLeafMaterial = leafCount > 0 && props.leafMaterial === undefined;
  const foliage =
    leafCount === 0
      ? null
      : {
          geometry: new THREE.PlaneGeometry(1, 1, 1, 1),
          material:
            props.leafMaterial ??
            new THREE.MeshStandardMaterial({
              color: 0x4c7a3a,
              roughness: 0.7,
              metalness: 0,
              side: THREE.DoubleSide,
            }),
        };
  const leaves =
    foliage === null
      ? null
      : new THREE.InstancedMesh(foliage.geometry, foliage.material, leafCount);
  if (leaves !== null)
    leaves.name = `planting-leaves:${props.arrangement.cluster}`;

  const placement = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const translation = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  let branchSlot = 0;
  let leafSlot = 0;
  for (const member of props.arrangement.placements) {
    placement.compose(
      translation.set(
        member.translation.x,
        member.translation.y,
        member.translation.z,
      ),
      rotation.set(
        member.rotation.x,
        member.rotation.y,
        member.rotation.z,
        member.rotation.w,
      ),
      scale.set(member.scale.x, member.scale.y, member.scale.z),
    );
    for (const branch of props.plant.branches) {
      axis.set(
        branch.end.x - branch.start.x,
        branch.end.y - branch.start.y,
        branch.end.z - branch.start.z,
      );
      const length = axis.length();
      const radius = (branch.radiusStart + branch.radiusEnd) / 2;
      // A pruned branch can be cut to nothing. Drawing a zero-length cylinder
      // would leave a degenerate instance whose normals are undefined, so the
      // slot keeps its identity and collapses to an invisible scale instead of
      // shifting every later branch's index.
      local.compose(
        translation.set(
          (branch.start.x + branch.end.x) / 2,
          (branch.start.y + branch.end.y) / 2,
          (branch.start.z + branch.end.z) / 2,
        ),
        length === 0
          ? rotation.identity()
          : rotation.setFromUnitVectors(up, axis.divideScalar(length)),
        scale.set(radius, length, radius),
      );
      branches.setMatrixAt(
        branchSlot,
        world.multiplyMatrices(placement, local),
      );
      ++branchSlot;
    }
    if (leaves === null) continue;
    for (const leaf of props.plant.leaves) {
      local.compose(
        translation.set(
          leaf.translation.x,
          leaf.translation.y,
          leaf.translation.z,
        ),
        rotation.set(
          leaf.rotation.x,
          leaf.rotation.y,
          leaf.rotation.z,
          leaf.rotation.w,
        ),
        scale.set(leaf.scale.x, leaf.scale.y, leaf.scale.z),
      );
      leaves.setMatrixAt(leafSlot, world.multiplyMatrices(placement, local));
      ++leafSlot;
    }
  }
  branches.instanceMatrix.needsUpdate = true;
  // A plant that has not emerged, or a bed whose every slot was refused, draws
  // no instance at all. `computeBoundingSphere` over zero instances leaves an
  // empty box behind and a sphere of radius `-Infinity`, which a camera culls
  // against as though it were a volume; the batch is hidden and bounded at a
  // point instead.
  if (branchCount === 0) {
    branches.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    branches.visible = false;
  } else branches.computeBoundingSphere();
  group.add(branches);
  if (leaves !== null) {
    leaves.instanceMatrix.needsUpdate = true;
    leaves.computeBoundingSphere();
    group.add(leaves);
  }
  group.userData.cluster = props.arrangement.cluster;
  group.userData.domain = props.plant.domain;
  group.userData.stage = props.plant.stage;
  group.userData.rejected = props.arrangement.rejected;

  return {
    object: group,
    branches,
    leaves,
    branchCount,
    leafCount,
    dispose: () => {
      branchGeometry.dispose();
      if (ownedBranchMaterial) branchMaterial.dispose();
      if (foliage !== null) {
        foliage.geometry.dispose();
        if (ownedLeafMaterial) foliage.material.dispose();
      }
      branches.dispose();
      if (leaves !== null) leaves.dispose();
    },
  };
};
