import { convexHull2D, surfaceHeightAt } from "@automovie/engine";
import { IAutoMovieSpace, IAutoMovieSurface } from "@automovie/interface";
import * as THREE from "three";

/** Name of the group `buildScene` adds for a scene's space geometry. */
export const SPACE_GROUP_NAME = "__automovie_space";

/**
 * Flat neutral gray for a ground surface. Deliberately featureless: the set is
 * a structural hint for the diffusion passes, and appearance is the diffusion
 * model's job, so the surface carries shape and nothing else.
 */
const SPACE_COLOR = 0.62;

/**
 * Build the visible ground of an {@link IAutoMovieSpace}: one `Mesh` per
 * standable surface, grouped under {@link SPACE_GROUP_NAME}.
 *
 * This is what closes the gap between the space the feet obey and the world the
 * guide passes draw (#1173). The surfaces were already the engine's semantic
 * ground (`heightAt`, support contacts, walkability) but nothing ever drew
 * them, so a depth or mask pass of a staged scene showed actors floating in a
 * void. Building them as real meshes is enough: every structural pass collects
 * geometry as `scene.traverse` ∩ `isMesh`, so the ground joins depth, mask,
 * normal, and outline with no pass-side change, unlike the playground's
 * `GridHelper`, which is a `LineSegments` and is hidden before every structural
 * pass.
 *
 * Each surface becomes its convex footprint hull, fan-triangulated, with every
 * vertex lifted to {@link surfaceHeightAt}, so a floor or platform is a flat
 * slab at its anchor height and a ramp is the plane its `anchor → rampTo` axis
 * describes, without a second interpretation of the surface math. The hull is
 * counter-clockwise in the XZ plan, whose fan normal points **down**, so the
 * fan is wound in reverse: front faces look up, which is what an override
 * material (all single-sided) needs in order to draw at all.
 *
 * A degenerate footprint (fewer than three non-collinear points, rejected by
 * `validateSpace`, but a hand-built space may still carry one) encloses no area
 * and contributes no mesh rather than an invalid geometry.
 *
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
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(SPACE_COLOR, SPACE_COLOR, SPACE_COLOR),
        metalness: 0,
        roughness: 0.95,
      }),
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
  const hull = convexHull2D(surface.polygon);
  if (hull.length < 3) return null;
  const positions: number[] = [];
  for (const point of hull)
    positions.push(
      point.x,
      surfaceHeightAt(surface, point.x, point.z),
      point.z,
    );
  // Reverse fan: the hull is counter-clockwise in (x, z), and a (0, i, i + 1)
  // fan over that order has a −Y face normal (a floor visible only from below).
  const indices: number[] = [];
  for (let i = 1; i + 1 < hull.length; i++) indices.push(0, i + 1, i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
