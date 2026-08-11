import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMovieFluidSpraySample,
  IAutoMovieFluidState,
  IAutoMovieFluidSurface,
  IAutoMovieValidation,
  IAutoMovieWaterFeature,
} from "@automovie/interface";

import {
  builtEnvironmentContainsPoint,
  builtSpaceIsConvex,
  builtSpaceStatesVolume,
} from "../architecture/builtEnvironment";
import { ViolationCollector } from "../validation/violation";
import { sampleFluidSpray } from "./fluidSpray";
import { fluidSurfaceGeometry } from "./fluidSurface";
import { sampleFluidDomain, simulateFluidDomain } from "./shallowWater";
import { validateFluidDomain } from "./validateFluidDomain";

const FEATURE_KINDS = new Set([
  "pond",
  "channel",
  "fountain",
  "waterfall",
  "reservoir",
  "other",
]);
const FEATURE_MODES = new Set(["static", "flowing", "simulated"]);

/**
 * Validate the bindings that make independent fluid domains a building's water
 * features.
 *
 * This is the seam, and it is deliberately one-directional: the architecture
 * record knows nothing about fluid, and the fluid record knows nothing about
 * architecture. The feature is the only place the two names meet, so this is
 * the only place their agreement can be checked — that the cited space is a
 * real logical space of the cited building, that every rim boundary really does
 * bound that space rather than some other room, that the cited domain exists
 * and is itself valid, and that the lattice actually sits inside the basin
 * instead of overhanging a room the author never meant to flood.
 *
 * A basin declared as a purely semantic container (a logical space that states
 * no volume at all) is not geometrically checked: there is no volume to check
 * against, and inventing one would be the design deciding a fact the author did
 * not state. Neither is a domain that already failed its own validation: an
 * unusable grid has no lattice to place, and reporting where its cells fell
 * would be a second answer derived from the first bad one.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-refusal Refuses unresolved basin, rim, and domain bindings before lowering.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Validates the join between a water feature and its independent fluid domain.
 * @evidence requirements/building-exterior/building-integrated-water.md#building-water-validation `validateWaterFeatures` rejects unresolved building, basin, rim, or domain identity, an unbounded rim, and fluid cells placed outside the declared basin volume.
 * @evidence specifications/building-envelope/services-water-weather-and-site.md#building-envelope-water-validation-boundary The validator implements the host, basin, rim, bounded-domain, and contained-depth subset without claiming professional pressure or drainage analysis.
 * @author Samchon
 */
export const validateWaterFeatures = (props: {
  environment: IAutoMovieBuiltEnvironment;
  features: IAutoMovieWaterFeature[];
  domains: IAutoMovieFluidDomain[];
}): IAutoMovieValidation => {
  const { environment, features, domains } = props;
  const out = new ViolationCollector();
  const root = "$input";

  const spaces = new Map(environment.spaces.map((space) => [space.id, space]));
  const boundaries = new Map(
    environment.boundaries.map((boundary) => [boundary.id, boundary]),
  );
  const byDomain = new Map(domains.map((domain) => [domain.id, domain]));

  const seenDomains = new Set<string>();
  // Whether each domain is usable on its own terms, in the same last-one-wins
  // order `byDomain` resolves an id in, so the verdict the geometry check reads
  // belongs to the record it is about to measure.
  const soundness = new Map<string, boolean>();
  domains.forEach((domain, index) => {
    if (seenDomains.has(domain.id))
      out.push(
        "type",
        `${root}.domains[${index}].id`,
        `fluid domain id "${domain.id}" is duplicated`,
        domain.id,
      );
    seenDomains.add(domain.id);
    const validation = validateFluidDomain({ domain });
    soundness.set(domain.id, validation.success);
    // Re-path rather than re-word: the domain's own violation keeps its kind,
    // its measured overshoot and its severity, so a binding report reads as the
    // same finding `validateFluidDomain` would give, at the address the binding
    // knows the domain by.
    if (validation.success === false)
      for (const item of validation.violations)
        out.items.push({
          ...item,
          path: item.path.replace("$input", `${root}.domains[${index}]`),
        });
  });

  const seenFeatures = new Set<string>();
  features.forEach((feature, index) => {
    const path = `${root}.features[${index}]`;
    if (feature.id.trim().length === 0)
      out.push(
        "type",
        `${path}.id`,
        "water feature id must be non-empty",
        feature.id,
      );
    else if (seenFeatures.has(feature.id))
      out.push(
        "type",
        `${path}.id`,
        `water feature id "${feature.id}" is duplicated`,
        feature.id,
      );
    seenFeatures.add(feature.id);

    if (!FEATURE_KINDS.has(feature.kind))
      out.push(
        "type",
        `${path}.kind`,
        `water feature kind must be one of ${[...FEATURE_KINDS].join(", ")}`,
        feature.kind,
      );
    if (!FEATURE_MODES.has(feature.mode))
      out.push(
        "type",
        `${path}.mode`,
        `water feature mode must be one of ${[...FEATURE_MODES].join(", ")}`,
        feature.mode,
      );
    if (feature.environment !== environment.id)
      out.push(
        "type",
        `${path}.environment`,
        `water feature must cite its owning built environment "${environment.id}"`,
        feature.environment,
      );
    // `null` is the renderer's own default and says so; a blank string is a
    // citation of a material with no name, which a budget would then attribute
    // to a material nobody can find.
    if (feature.material !== null && feature.material.trim().length === 0)
      out.push(
        "type",
        `${path}.material`,
        "water feature material must be a material id or null for the default",
        feature.material,
      );

    const space = spaces.get(feature.space);
    if (space === undefined)
      out.push(
        "type",
        `${path}.space`,
        `basin logical space "${feature.space}" does not resolve in built environment "${environment.id}"`,
        feature.space,
      );

    const seenBoundaries = new Set<string>();
    feature.boundaries.forEach((id, at) => {
      const boundary = boundaries.get(id);
      if (boundary === undefined) {
        out.push(
          "type",
          `${path}.boundaries[${at}]`,
          `rim boundary "${id}" does not resolve in built environment "${environment.id}"`,
          id,
        );
        return;
      }
      if (seenBoundaries.has(id))
        out.push(
          "type",
          `${path}.boundaries[${at}]`,
          `rim boundary "${id}" is duplicated`,
          id,
        );
      seenBoundaries.add(id);
      if (!boundary.spaces.includes(feature.space))
        out.push(
          "type",
          `${path}.boundaries[${at}]`,
          `rim boundary "${id}" does not bound basin space "${feature.space}"`,
          boundary.spaces,
        );
    });

    const domain = byDomain.get(feature.domain);
    if (domain === undefined) {
      out.push(
        "type",
        `${path}.domain`,
        `fluid domain "${feature.domain}" was not supplied with this binding`,
        feature.domain,
      );
      return;
    }
    if (
      space === undefined ||
      builtSpaceStatesVolume(space) === false ||
      soundness.get(feature.domain) !== true
    )
      return;
    const stray = strayCell({
      environment,
      space: feature.space,
      domain,
      // One convex cell is decided exactly by the lattice's own corners; a
      // basin written as several cells, or as a boundary shell, is not convex,
      // and there the corners only say the ends of the lattice are somewhere in
      // the room while its middle may stand over the notch between two of them,
      // or over an atrium void cut clean through the basin.
      exhaustive: builtSpaceIsConvex(space) === false,
    });
    if (stray !== null)
      out.push(
        "type",
        `${path}.domain`,
        `fluid lattice of "${domain.id}" reaches outside basin space "${feature.space}"`,
        stray,
      );
  });

  return out.toValidation();
};

/**
 * One frame of a bound water feature: the state, its surface, and its spray.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Carries the exact solved state and its declared feature identity.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Exposes one coherent frame of the independent fluid domain.
 */
export interface IAutoMovieWaterFeatureFrame {
  /**
   * Identity of the feature the frame belongs to.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Preserves which authored water feature owns the computed frame.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Keeps the feature-to-domain result join addressable.
   */
  feature: string;

  /**
   * The conserved fluid state the frame projects.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Records the computed state derived from the declared initial conditions.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Carries the independent domain state used by both surface and spray.
   */
  state: IAutoMovieFluidState;

  /**
   * Free-surface geometry derived from that state.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes the visible flow surface without inventing another solve.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Projects the independent domain into feature geometry.
   */
  surface: IAutoMovieFluidSurface;

  /**
   * Bounded decorative spray sampled at the same step.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Carries the declared spray population at the surface's step.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Keeps spray and surface on one coherent fluid-domain frame.
   */
  spray: IAutoMovieFluidSpraySample;
}

/**
 * Lower one bound water feature to everything a renderer needs at a shot
 * second.
 *
 * A `static` feature always reads its authored step-0 state, which is what
 * makes a mirror pool read identically in every frame of a cut; `flowing` and
 * `simulated` read the fixed-step solve at that second. The distinction between
 * those two is a surface-animation hint the renderer applies, never a different
 * solve — two features over the same domain must never disagree about where the
 * water is.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Lowers the authored water mode to state, surface, and bounded spray.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Produces the renderer-ready result of the feature's independent fluid domain.
 * @author Samchon
 */
export const lowerWaterFeature = (props: {
  feature: IAutoMovieWaterFeature;
  domain: IAutoMovieFluidDomain;
  time: number;
  /**
   * Camera distance in metres driving spray LOD; defaults to `0`. It must be a
   * real number: {@link sampleFluidSpray} refuses a non-finite one rather than
   * thinning the mist to nothing and reading as a fountain that stopped.
   */
  cameraDistance?: number;
}): IAutoMovieWaterFeatureFrame => {
  const state =
    props.feature.mode === "static"
      ? simulateFluidDomain(props.domain, 0)
      : sampleFluidDomain(props.domain, props.time);
  return {
    feature: props.feature.id,
    state,
    surface: fluidSurfaceGeometry({ domain: props.domain, state }),
    spray: sampleFluidSpray({
      domain: props.domain,
      state,
      cameraDistance: props.cameraDistance ?? 0,
    }),
  };
};

/**
 * The first bed point of the lattice standing outside the basin, or `null`.
 *
 * The points measured are cell centres, because that is where the water is: the
 * free surface carries one vertex per cell at its centre, so the drawn water
 * never reaches past the outermost centres and a rim half a cell wide is not
 * flooded by arithmetic nobody authored.
 *
 * `exhaustive` walks every cell; otherwise only the corner cells are measured,
 * which decides a rectangle against a single convex region exactly. The caller
 * pays the full walk exactly when the basin is not convex, and only for a
 * domain whose own cell budget has already been enforced.
 */
const strayCell = (props: {
  environment: IAutoMovieBuiltEnvironment;
  space: string;
  domain: IAutoMovieFluidDomain;
  exhaustive: boolean;
}): { x: number; y: number; z: number } | null => {
  const { domain } = props;
  const span = (length: number): number[] =>
    props.exhaustive ? Array.from({ length }, (_, at) => at) : [0, length - 1];
  for (const row of span(domain.grid.rows))
    for (const column of span(domain.grid.columns)) {
      const point = {
        x: domain.grid.origin.x + (column + 0.5) * domain.grid.cellX,
        y:
          domain.grid.origin.y + domain.bed[row * domain.grid.columns + column],
        z: domain.grid.origin.z + (row + 0.5) * domain.grid.cellZ,
      };
      if (
        builtEnvironmentContainsPoint(props.environment, props.space, point) ===
        false
      )
        return point;
    }
  return null;
};
