import {
  AutoMovieSoftAnalysisStatus,
  IAutoMovieSoftBodySurface,
} from "@automovie/interface";
import * as THREE from "three";

/**
 * A viewer-owned cloth panel bound to one soft-body domain.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result Displays this surface from an externally resolved deformation result.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-external-deformation-adoption Adopts that result without running a second soft-body solver.
 */
export interface IAutoMovieSoftBodyObject {
  /**
   * Add this mesh to the current scene.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result Displays this surface from an externally resolved deformation result.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-external-deformation-adoption Adopts that result without running a second soft-body solver.
   */
  object: THREE.Mesh;

  /**
   * Re-upload the panel at a newly analysed shot second.
   *
   * The status is required here for the same reason it is required to build the
   * object: it can change between seconds. A furnishing whose declared step
   * budget stops inside the cut is `solved` early and `not-run` later, and an
   * update that carried only geometry would leave the earlier claim standing
   * over the later panel.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result Displays this surface from an externally resolved deformation result.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-external-deformation-adoption Adopts that result without running a second soft-body solver.
   */
  update: (props: {
    surface: IAutoMovieSoftBodySurface;
    status: AutoMovieSoftAnalysisStatus;
  }) => void;

  /**
   * Release the geometry, and the material when this object created it.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result Displays this surface from an externally resolved deformation result.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-external-deformation-adoption Adopts that result without running a second soft-body solver.
   */
  dispose: () => void;
}

/**
 * Project one engine-derived cloth panel into a `three.js` mesh.
 *
 * The viewer contributes no geometry of its own: positions, normals, UVs and
 * indices all come from `softBodySurfaceGeometry`, so the curtain a camera sees
 * and the particle field the constraints were proven against are one statement.
 * Cloth is drawn double-sided because a panel has no inside — the back of a
 * curtain is a curtain — and lit with flipped normals on the far face, which is
 * what `THREE.DoubleSide` gives without a second draw.
 *
 * The result is an ordinary opaque-graph `THREE.Mesh`, which is why it appears
 * in the beauty, normal, depth and mask passes without any pass knowing cloth
 * exists: the structural passes swap the material of every mesh they find. Its
 * bounding sphere is the engine's own extent of the panel, so what a camera
 * culls and what the solve says are the same statement.
 *
 * The analysis status rides along in `userData.status`, and it is a required
 * argument of both the construction and every
 * {@link IAutoMovieSoftBodyObject.update}. A panel whose solve was refused as
 * `unsupported`, or never run, must be identifiable in the scene graph and in a
 * captured frame's sidecar; a still curtain that nobody can tell apart from a
 * solved one is exactly the silent pass this domain refuses, and a default
 * value here would be the cheapest way to reintroduce it.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-external-result Displays this surface from an externally resolved deformation result.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-external-deformation-adoption Adopts that result without running a second soft-body solver.
 */
export const buildSoftBodyObject = (props: {
  surface: IAutoMovieSoftBodySurface;
  /** Cloth material; a double-sided default is created when absent. */
  material?: THREE.Material;
  /**
   * What the analysis that produced this surface actually did.
   *
   * Required, and deliberately not defaulted. A default would be a claim, and
   * the one claim nobody should be able to make by omission is that a panel was
   * solved.
   */
  status: AutoMovieSoftAnalysisStatus;
}): IAutoMovieSoftBodyObject => {
  const geometry = new THREE.BufferGeometry();
  const owned = props.material === undefined;
  const material =
    props.material ??
    new THREE.MeshStandardMaterial({
      color: 0xd8cfc0,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `soft:${props.surface.domain}`;
  const upload = (frame: {
    surface: IAutoMovieSoftBodySurface;
    status: AutoMovieSoftAnalysisStatus;
  }): void => {
    const surface = frame.surface;
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(surface.mesh.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(surface.mesh.normals ?? [], 3),
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(surface.mesh.uvs ?? [], 2),
    );
    geometry.setIndex(surface.mesh.indices ?? []);
    // The bounding sphere comes from the engine's own extent of the DRAWN
    // panel, not from `computeBoundingSphere`. A lattice one particle wide
    // emits no triangle at all, and measuring its vertex buffer would report a
    // cord as a surface the camera has to keep in frame.
    const bounds = surface.bounds;
    if (bounds === null) {
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      mesh.visible = false;
    } else {
      const min = new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z);
      const max = new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z);
      geometry.boundingSphere = new THREE.Sphere(
        min.clone().add(max).multiplyScalar(0.5),
        min.distanceTo(max) / 2,
      );
      mesh.visible = true;
    }
    mesh.userData.domain = surface.domain;
    mesh.userData.step = surface.step;
    mesh.userData.status = frame.status;
  };
  upload({ surface: props.surface, status: props.status });
  return {
    object: mesh,
    update: upload,
    dispose: () => {
      geometry.dispose();
      if (owned) material.dispose();
    },
  };
};
