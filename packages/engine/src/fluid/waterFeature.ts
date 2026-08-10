import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMovieFluidSpraySample,
  IAutoMovieFluidState,
  IAutoMovieFluidSurface,
  IAutoMovieValidation,
  IAutoMovieWaterFeature,
} from "@automovie/interface";

import { builtEnvironmentContainsPoint } from "../architecture/builtEnvironment";
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
 * A basin declared as a purely semantic container (a logical space with no
 * convex cells) is not geometrically checked: there is no volume to check
 * against, and inventing one would be the design deciding a fact the author did
 * not state.
 *
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
    if (space === undefined || space.cells.length === 0) return;
    for (const corner of latticeCorners(domain))
      if (
        builtEnvironmentContainsPoint(environment, feature.space, corner) ===
        false
      ) {
        out.push(
          "type",
          `${path}.domain`,
          `fluid lattice of "${domain.id}" reaches outside basin space "${feature.space}"`,
          corner,
        );
        return;
      }
  });

  return out.toValidation();
};

/** One frame of a bound water feature: the state, its surface, and its spray. */
export interface IAutoMovieWaterFeatureFrame {
  /** Identity of the feature the frame belongs to. */
  feature: string;

  /** The conserved fluid state the frame projects. */
  state: IAutoMovieFluidState;

  /** Free-surface geometry derived from that state. */
  surface: IAutoMovieFluidSurface;

  /** Bounded decorative spray sampled at the same step. */
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
 * @author Samchon
 */
export const lowerWaterFeature = (props: {
  feature: IAutoMovieWaterFeature;
  domain: IAutoMovieFluidDomain;
  time: number;
  /** Camera distance in metres driving spray LOD; defaults to `0`. */
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

/** The four bed points under the lattice's corner cells, in world space. */
const latticeCorners = (
  domain: IAutoMovieFluidDomain,
): { x: number; y: number; z: number }[] => {
  const lastColumn = domain.grid.columns - 1;
  const lastRow = domain.grid.rows - 1;
  return [
    [0, 0],
    [lastColumn, 0],
    [0, lastRow],
    [lastColumn, lastRow],
  ].map(([column, row]) => ({
    x: domain.grid.origin.x + (column + 0.5) * domain.grid.cellX,
    y: domain.grid.origin.y + domain.bed[row * domain.grid.columns + column],
    z: domain.grid.origin.z + (row + 0.5) * domain.grid.cellZ,
  }));
};
