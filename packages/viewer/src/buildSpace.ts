import { tessellateSurface } from "@automovie/engine";
import { IAutoMovieSpace, IAutoMovieSurface } from "@automovie/interface";
import * as THREE from "three";

/**
 * Name of the group `buildScene` adds for a scene's space geometry.
 *
 * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Materializes this space surface from the resolved scene state only.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Keeps compiled space state distinct from its viewer-owned runtime group.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the runtime ownership side of isolated scene lowering.
 */
export const SPACE_GROUP_NAME = "__automovie_space";

/**
 * Build the structural ground of an {@link IAutoMovieSpace}: one `Mesh` per
 * standable surface, grouped under {@link SPACE_GROUP_NAME}.
 *
 * This is what closes the gap between the space the feet obey and the world the
 * guide passes draw (#1173). The surfaces were already the engine's semantic
 * ground (`heightAt`, support contacts, walkability) but nothing ever drew
 * them, so a depth or mask pass of a staged scene showed actors floating in a
 * void. Building them as real meshes is enough: every structural pass collects
 * geometry as `scene.traverse` ∩ `isMesh` and replaces its material, so the
 * ground joins depth, mask, normal, and outline with no pass-side special case,
 * unlike the playground's `GridHelper`, which is a `LineSegments` and is hidden
 * before every structural pass.
 *
 * The ordinary material writes neither colour nor depth. A support patch is a
 * semantic declaration used by grounding and locomotion, not proof that an
 * authored slab, terrain mesh, or platform exists. Drawing the declaration in
 * beauty would let a missing physical floor look complete, and writing only
 * depth would still let it occlude authored geometry. Guide passes replace the
 * material and therefore keep the structural geometry #1173 introduced.
 *
 * Each surface is tessellated by the engine. Floors and ramps become a convex
 * fan; heightfields split at their authored lattice and preserve every relief
 * sample. Every vertex height comes from the same `surfaceHeightAt` query used
 * by grounding, so semantic ground and its structural-pass geometry cannot
 * diverge.
 *
 * The hull is counter-clockwise in the XZ plan, whose fan normal points
 * **down**, so the fan is wound in reverse: front faces look up, which is what
 * an override material (all single-sided) needs in order to draw at all.
 *
 * A degenerate footprint (fewer than three non-collinear points, rejected by
 * `validateSpace`, but a hand-built space may still carry one) encloses no area
 * and contributes no mesh rather than an invalid geometry.
 *
 * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Materializes this space surface from the resolved scene state only.
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Keeps semantic support out of beauty while retaining it for structural products.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the boundary from resolved staging space to viewer geometry.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the support patch as structural-only render geometry.
 * @author Samchon
 */
export const buildSpaceObject = (space: IAutoMovieSpace): THREE.Group => {
  const group = new THREE.Group();
  group.name = SPACE_GROUP_NAME;
  for (const surface of space.surfaces) {
    const geometry = buildSurfaceGeometry(surface);
    if (geometry === null) continue;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    mesh.name = surface.id;
    group.add(mesh);
  }
  return group;
};

/**
 * One surface footprint as a triangulated planar patch, or `null` when the
 * footprint encloses no area.
 */
const buildSurfaceGeometry = (
  surface: IAutoMovieSurface,
): THREE.BufferGeometry | null => {
  const mesh = tessellateSurface(surface);
  if (mesh === null) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mesh.positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(mesh.normals, 3),
  );
  geometry.setIndex(mesh.indices);
  return geometry;
};
