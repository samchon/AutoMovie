import {
  AutoMovieWaterFeatureMode,
  IAutoMovieFluidSpraySample,
  IAutoMovieFluidSurface,
} from "@automovie/interface";
import * as THREE from "three";

/**
 * A viewer-owned water surface bound to one fluid domain.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
 * @author Samchon
 */
export interface IAutoMovieFluidSurfaceObject {
  /**
   * Add this mesh to the current scene.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  object: THREE.Mesh;

  /**
   * Re-upload the surface of a newly solved step of the **same** domain. Throws
   * for any other one: the mesh is named for the domain it was built from, and
   * a segmentation pass resolves it by that name, so a surface uploaded under
   * the wrong name is painted as the water it is not.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  update: (surface: IAutoMovieFluidSurface) => void;

  /**
   * Release the geometry, and the material when this object created it.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  dispose: () => void;
}

/**
 * A viewer-owned bounded spray for one fluid domain.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
 * @author Samchon
 */
export interface IAutoMovieFluidSprayObject {
  /**
   * Add these points to the current scene.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  object: THREE.Points;

  /**
   * Re-upload the particles of a newly sampled step.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  update: (sample: IAutoMovieFluidSpraySample) => void;

  /**
   * Release the geometry, and the material when this object created it.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  dispose: () => void;

  /**
   * Particles currently drawn, after the engine's cap and LOD thinning.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
   */
  count: () => number;
}

/**
 * Project one engine-derived free surface into a `three.js` mesh.
 *
 * The viewer contributes no geometry of its own: positions, normals, UVs and
 * the per-vertex flow vector all come from `fluidSurfaceGeometry`, so the water
 * a camera sees and the depth field the mass balance was proven against are one
 * statement. A `flowing` feature is told so through the `aFlow` attribute and a
 * `flowing` flag in `userData`, which a ripple shader scrolls along; it never
 * re-derives the velocity.
 *
 * The result is an ordinary opaque-graph `THREE.Mesh`, which is why it appears
 * in the beauty, normal, depth and mask passes without any pass knowing water
 * exists: the structural passes swap the material of every mesh they find. Its
 * bounding sphere is the engine's own extent of the drawn surface, so what a
 * camera culls and what the depth field says are the same statement.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
 * @author Samchon
 */
export const buildFluidSurfaceObject = (props: {
  surface: IAutoMovieFluidSurface;
  /** Water material; a translucent default is created when absent. */
  material?: THREE.Material;
  /** Feature mode; only `flowing` asks the renderer to scroll ripples. */
  mode?: AutoMovieWaterFeatureMode;
}): IAutoMovieFluidSurfaceObject => {
  const geometry = new THREE.BufferGeometry();
  const owned = props.material === undefined;
  const material =
    props.material ??
    new THREE.MeshStandardMaterial({
      color: 0x2f6f8f,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
  const mesh = new THREE.Mesh(geometry, material);
  const domain = props.surface.domain;
  mesh.name = `water:${domain}`;
  const upload = (surface: IAutoMovieFluidSurface): void => {
    if (surface.domain !== domain)
      throw new Error(
        `water surface object of "${domain}" cannot upload a surface of "${surface.domain}"`,
      );
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
    geometry.setAttribute(
      "aFlow",
      new THREE.Float32BufferAttribute(surface.flow, 2),
    );
    geometry.setIndex(surface.mesh.indices ?? []);
    // The bounding sphere comes from the engine's own extent of the DRAWN
    // surface, not from `computeBoundingSphere`. A lattice carries one vertex
    // per cell including the dry ones, so measuring the vertex buffer would
    // report a drained rim as part of the water and cull the pond by a box no
    // depth value supports.
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
  };
  upload(props.surface);
  mesh.userData.flowing = props.mode === "flowing";
  return {
    object: mesh,
    update: upload,
    dispose: () => {
      geometry.dispose();
      if (owned) material.dispose();
    },
  };
};

/**
 * Project one bounded spray sample into a `three.js` point cloud.
 *
 * The engine has already applied the emitter's hard cap and its distance
 * thinning, so the viewer uploads exactly the particles the reference sample
 * declared and never invents a particle of its own. Spray is a `THREE.Points`,
 * which the structural guide passes hide by design: mist is decoration and must
 * not colour a segmentation mask or read as geometry in a depth pass.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Displays this surface from the selected compiled fluid tier.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Materializes that tier without introducing a second fluid solve.
 * @author Samchon
 */
export const buildFluidSprayObject = (props: {
  sample: IAutoMovieFluidSpraySample;
  /** Spray material; an additive default is created when absent. */
  material?: THREE.PointsMaterial;
}): IAutoMovieFluidSprayObject => {
  const geometry = new THREE.BufferGeometry();
  const owned = props.material === undefined;
  const material =
    props.material ??
    new THREE.PointsMaterial({
      color: 0xdff2ff,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      size: 0.05,
    });
  const points = new THREE.Points(geometry, material);
  points.name = "water-spray";
  let count = 0;
  const upload = (sample: IAutoMovieFluidSpraySample): void => {
    const positions: number[] = [];
    const sizes: number[] = [];
    const ages: number[] = [];
    for (const particle of sample.particles) {
      positions.push(
        particle.position.x,
        particle.position.y,
        particle.position.z,
      );
      sizes.push(particle.size);
      ages.push(particle.ageRatio);
    }
    count = sample.particles.length;
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aAge", new THREE.Float32BufferAttribute(ages, 1));
    geometry.computeBoundingSphere();
    points.userData.step = sample.step;
    points.visible = count > 0;
  };
  upload(props.sample);
  return {
    object: points,
    update: upload,
    dispose: () => {
      geometry.dispose();
      if (owned) material.dispose();
    },
    count: () => count,
  };
};
