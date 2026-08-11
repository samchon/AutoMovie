/**
 * How high the ground is, as a rule rather than a mesh.
 *
 * One declaration, because two records ask the question: the production world's
 * terrain, which a crowd is placed on, and the scene's standable space, which a
 * performer stands and foot-plants on. A rule spelled twice is how a member and
 * the figure beside it come to stand on two different grounds, so both cite
 * this and one engine function answers it.
 *
 * Every kind is pure arithmetic over its own stored numbers: the same rule
 * answers the same height on every machine and every run.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Declares the elevation rule from which ground height and slope are deterministically derived.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Types the supported single-valued terrain surface inputs and their sampling state.
 * @author Samchon
 */
export type IAutoMovieHeightRule =
  | {
      /** Flat surface. */
      kind: "constant";
      /** Surface height in meters. */
      value: number;
    }
  | {
      /** Planar slope. */
      kind: "plane";
      /** Plane height at the world origin. */
      originHeight: number;
      /** Height gained per positive X meter. */
      slopeX: number;
      /** Height gained per positive Z meter. */
      slopeZ: number;
    }
  | {
      /**
       * Sampled relief: a regular XZ grid of heights over the surface.
       *
       * `constant` is one number and `plane` is a single tilt, so neither can
       * express a rise: a hill, a terraced square, a riverbank, a stepped
       * approach. This is the smallest rule that can. The grid is a lattice of
       * stored heights and the surface height between them is interpolated, so
       * relief costs `columns * rows` numbers rather than a mesh.
       *
       * **Bounds.** The grid is a sampling lattice, not an extent: the
       * footprint still says where the surface exists, exactly as it does for
       * `constant` and `plane`. A query outside the lattice clamps to the
       * nearest edge sample rather than extrapolating, because extrapolating a
       * sampled relief invents terrain nobody authored, and a lattice that
       * covers its footprint never reaches this at all.
       *
       * **Interpolation.** Bilinear between the four surrounding samples. The
       * result is continuous across cell boundaries and reproduces a stored
       * sample exactly at its own lattice point, so a member standing on a
       * sample stands at the authored height.
       *
       * **Determinism.** Pure arithmetic over the stored samples: the same
       * design answers the same height on every machine and every run. Nothing
       * is sampled from an image, a noise function, or a seed here; a generator
       * that wants relief bakes its samples into this array, where the compiler
       * digests them with the rest of the design.
       */
      kind: "heightfield";
      /** World X of sample column zero, in meters. */
      originX: number;
      /** World Z of sample row zero, in meters. */
      originZ: number;
      /** Finite column pitch along +X in meters, strictly above zero. */
      spacingX: number;
      /** Finite row pitch along +Z in meters, strictly above zero. */
      spacingZ: number;
      /** Sample columns along +X; at least two. */
      columns: number;
      /** Sample rows along +Z; at least two. */
      rows: number;
      /**
       * Finite sample heights in meters, row-major: index `row * columns +
       * column`. Exactly `columns * rows` entries.
       */
      samples: number[];
    };
