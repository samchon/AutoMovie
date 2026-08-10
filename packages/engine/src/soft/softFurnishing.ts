import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieSoftAnalysis,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftBodyState,
  IAutoMovieSoftBodySurface,
  IAutoMovieSoftFurnishing,
  IAutoMovieValidation,
} from "@automovie/interface";

import { builtEnvironmentContainsPoint } from "../architecture/builtEnvironment";
import { ViolationCollector } from "../validation/violation";
import { sampleSoftBody, simulateSoftBody } from "./softBody";
import { softBodySurfaceGeometry } from "./softBodySurface";
import { validateSoftBodyDomain } from "./validateSoftBodyDomain";

const FURNISHING_KINDS = new Set([
  "curtain",
  "blind",
  "rug",
  "cushion",
  "bed-linen",
  "membrane",
  "other",
]);
const FURNISHING_MODES = new Set(["rest", "simulated"]);

/**
 * Validate the bindings that make independent soft-body domains a building's
 * furnishings.
 *
 * This is the seam, and it is deliberately one-directional: the architecture
 * record knows nothing about cloth, and the cloth record knows nothing about
 * architecture. The furnishing is the only place the two names meet, so this is
 * the only place their agreement can be checked — that the cited space is a
 * real logical space of the cited environment, that every support really is an
 * element of it, that the cited domain exists and is itself valid, that the
 * named state the furnishing asks to hold is one the domain declares, and that
 * the panel's rest mesh actually hangs inside the room instead of through the
 * wall behind it.
 *
 * A room declared as a purely semantic container (a logical space with no
 * convex cells) is not geometrically checked: there is no volume to check
 * against, and inventing one would be the design deciding a fact the author did
 * not state.
 *
 * @author Samchon
 */
export const validateSoftFurnishings = (props: {
  environment: IAutoMovieBuiltEnvironment;
  furnishings: IAutoMovieSoftFurnishing[];
  domains: IAutoMovieSoftBodyDomain[];
}): IAutoMovieValidation => {
  const { environment, furnishings, domains } = props;
  const out = new ViolationCollector();
  const root = "$input";

  const spaces = new Map(environment.spaces.map((space) => [space.id, space]));
  const elements = new Set(environment.elements.map((element) => element.id));
  const byDomain = new Map(domains.map((domain) => [domain.id, domain]));

  const seenDomains = new Set<string>();
  domains.forEach((domain, index) => {
    if (seenDomains.has(domain.id))
      out.push(
        "type",
        `${root}.domains[${index}].id`,
        `soft body domain id "${domain.id}" is duplicated`,
        domain.id,
      );
    seenDomains.add(domain.id);
    const validation = validateSoftBodyDomain({ domain });
    // Re-path rather than re-word: the domain's own violation keeps its kind,
    // its measured overshoot and its severity, so a binding report reads as the
    // same finding `validateSoftBodyDomain` would give, at the address the
    // binding knows the domain by.
    if (validation.success === false)
      for (const item of validation.violations)
        out.items.push({
          ...item,
          path: item.path.replace("$input", `${root}.domains[${index}]`),
        });
  });

  const seenFurnishings = new Set<string>();
  furnishings.forEach((furnishing, index) => {
    const path = `${root}.furnishings[${index}]`;
    if (furnishing.id.trim().length === 0)
      out.push(
        "type",
        `${path}.id`,
        "soft furnishing id must be non-empty",
        furnishing.id,
      );
    else if (seenFurnishings.has(furnishing.id))
      out.push(
        "type",
        `${path}.id`,
        `soft furnishing id "${furnishing.id}" is duplicated`,
        furnishing.id,
      );
    seenFurnishings.add(furnishing.id);

    if (!FURNISHING_KINDS.has(furnishing.kind))
      out.push(
        "type",
        `${path}.kind`,
        `soft furnishing kind must be one of ${[...FURNISHING_KINDS].join(", ")}`,
        furnishing.kind,
      );
    if (!FURNISHING_MODES.has(furnishing.mode))
      out.push(
        "type",
        `${path}.mode`,
        `soft furnishing mode must be one of ${[...FURNISHING_MODES].join(", ")}`,
        furnishing.mode,
      );
    if (furnishing.environment !== environment.id)
      out.push(
        "type",
        `${path}.environment`,
        `soft furnishing must cite its owning built environment "${environment.id}"`,
        furnishing.environment,
      );

    const space = spaces.get(furnishing.space);
    if (space === undefined)
      out.push(
        "type",
        `${path}.space`,
        `logical space "${furnishing.space}" does not resolve in built environment "${environment.id}"`,
        furnishing.space,
      );

    const seenSupports = new Set<string>();
    furnishing.supports.forEach((id, at) => {
      if (!elements.has(id))
        out.push(
          "type",
          `${path}.supports[${at}]`,
          `support element "${id}" does not resolve in built environment "${environment.id}"`,
          id,
        );
      else if (seenSupports.has(id))
        out.push(
          "type",
          `${path}.supports[${at}]`,
          `support element "${id}" is duplicated`,
          id,
        );
      seenSupports.add(id);
    });

    const domain = byDomain.get(furnishing.domain);
    if (domain === undefined) {
      out.push(
        "type",
        `${path}.domain`,
        `soft body domain "${furnishing.domain}" was not supplied with this binding`,
        furnishing.domain,
      );
      return;
    }
    if (
      furnishing.state !== null &&
      domain.states.every((state) => state.id !== furnishing.state)
    )
      out.push(
        "type",
        `${path}.state`,
        `soft body domain "${domain.id}" does not declare a named state "${furnishing.state}"`,
        furnishing.state,
      );
    if (space === undefined || space.cells.length === 0) return;
    const particles = domain.lattice.columns * domain.lattice.rows;
    if (domain.rest.length !== particles * 3) return;
    for (let particle = 0; particle < particles; ++particle) {
      const point = {
        x: domain.rest[particle * 3],
        y: domain.rest[particle * 3 + 1],
        z: domain.rest[particle * 3 + 2],
      };
      if (
        builtEnvironmentContainsPoint(environment, furnishing.space, point) ===
        false
      ) {
        out.push(
          "type",
          `${path}.domain`,
          `rest particle ${particle} of "${domain.id}" lies outside space "${furnishing.space}"`,
          point,
        );
        return;
      }
    }
  });

  return out.toValidation();
};

/** One frame of a bound furnishing: what was computed, and what was claimed. */
export interface IAutoMovieSoftFurnishingFrame {
  /** Identity of the furnishing the frame belongs to. */
  furnishing: string;

  /** What the analysis actually did, including anything it declined to claim. */
  analysis: IAutoMovieSoftAnalysis;

  /** The particle state, or `null` when nothing was computed at all. */
  state: IAutoMovieSoftBodyState | null;

  /** Drawable geometry derived from that state, or `null` beside it. */
  surface: IAutoMovieSoftBodySurface | null;
}

/**
 * Lower one bound furnishing to everything a renderer needs at a shot second,
 * beside an honest account of what was computed.
 *
 * The account is the point. Four outcomes are possible and each one is named:
 *
 * | Condition                                                       | Status        | Geometry                            |
 * | --------------------------------------------------------------- | ------------- | ----------------------------------- |
 * | the domain does not validate                                    | `not-run`     | none                                |
 * | the furnishing asks to hold a state the domain does not declare | `not-run`     | none                                |
 * | the domain asks for self-collision                              | `unsupported` | the rest configuration              |
 * | `mode` is `rest`                                                | `rest`        | the rest configuration              |
 * | otherwise                                                       | `solved`      | the fixed-step solve at that second |
 *
 * A panel that could not be simulated is never handed back as though it had
 * been. Returning the rest configuration under an `unsupported` status is the
 * whole difference between a frame a reviewer can act on and a still curtain
 * nobody knew was still because the solver gave up.
 *
 * @author Samchon
 */
export const lowerSoftFurnishing = (props: {
  furnishing: IAutoMovieSoftFurnishing;
  domain: IAutoMovieSoftBodyDomain;
  time: number;
}): IAutoMovieSoftFurnishingFrame => {
  const { furnishing, domain } = props;
  const analysis = (
    status: IAutoMovieSoftAnalysis["status"],
    reason: string | null,
    unsupported: string[] = [],
  ): IAutoMovieSoftAnalysis => ({
    domain: domain.id,
    kind: "soft-body",
    status,
    reason,
    unsupported,
  });
  const frame = (
    report: IAutoMovieSoftAnalysis,
    state: IAutoMovieSoftBodyState | null,
  ): IAutoMovieSoftFurnishingFrame => ({
    furnishing: furnishing.id,
    analysis: report,
    state,
    surface: state === null ? null : softBodySurfaceGeometry({ domain, state }),
  });

  const validation = validateSoftBodyDomain({ domain });
  if (validation.success === false)
    return frame(
      analysis(
        "not-run",
        `soft body "${domain.id}" did not validate, so no state was computed`,
      ),
      null,
    );
  if (
    furnishing.state !== null &&
    domain.states.every((state) => state.id !== furnishing.state)
  )
    return frame(
      analysis(
        "not-run",
        `soft body "${domain.id}" does not declare a named state "${furnishing.state}"`,
      ),
      null,
    );
  if (domain.selfCollision === true)
    return frame(
      analysis(
        "unsupported",
        `soft body "${domain.id}" asks for cloth-on-cloth contact, which this solver tier does not provide; the rest configuration is returned and no solve is claimed`,
        ["self-collision"],
      ),
      simulateSoftBody(domain, 0, furnishing.state),
    );
  if (furnishing.mode === "rest")
    return frame(
      analysis("rest", null),
      simulateSoftBody(domain, 0, furnishing.state),
    );
  return frame(
    analysis("solved", null),
    sampleSoftBody(domain, props.time, furnishing.state),
  );
};
