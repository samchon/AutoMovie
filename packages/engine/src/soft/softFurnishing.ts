import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieSoftAnalysis,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftBodyState,
  IAutoMovieSoftBodySurface,
  IAutoMovieSoftFurnishing,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  builtEnvironmentContainsPoint,
  builtSpaceStatesVolume,
} from "../architecture/builtEnvironment";
import { ViolationCollector } from "../validation/violation";
import {
  simulateSoftBody,
  softBodyRestConfiguration,
  softBodyStepAt,
} from "./softBody";
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
 * element of it, that the cited domain exists and is itself valid, that no
 * second furnishing draws a panel one already draws, that the named state the
 * furnishing asks to hold is one the domain declares, and that the panel in the
 * configuration it is actually held in hangs inside the room instead of through
 * the wall behind it.
 *
 * A room declared as a purely semantic container (a logical space that states
 * no volume at all) is not geometrically checked: there is no volume to check
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
  const drawnDomains = new Map<string, string>();
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

    // A domain is a world-space panel, so a second furnishing drawing it does
    // not hang a second curtain anywhere: it draws the same cloth twice, at the
    // same coordinates, and charges a render budget for both.
    const drawnBy = drawnDomains.get(furnishing.domain);
    if (drawnBy !== undefined)
      out.push(
        "type",
        `${path}.domain`,
        `soft body domain "${furnishing.domain}" is already drawn by furnishing "${drawnBy}"`,
        furnishing.domain,
      );
    else drawnDomains.set(furnishing.domain, furnishing.id);

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
    const holds =
      furnishing.state !== null &&
      domain.states.some((state) => state.id === furnishing.state);
    if (furnishing.state !== null && holds === false)
      out.push(
        "type",
        `${path}.state`,
        `soft body domain "${domain.id}" does not declare a named state "${furnishing.state}"`,
        furnishing.state,
      );
    if (space === undefined || builtSpaceStatesVolume(space) === false) return;
    const particles = domain.lattice.columns * domain.lattice.rows;
    if (domain.rest.length !== particles * 3) return;
    // The configuration is checked, not the rest array. An anchor holds its
    // particle at its own target and the held named state moves it again, both
    // before the first step is integrated, so a curtain whose every ring is on
    // the far side of the wall would read as hanging inside the room if only
    // the authored mesh were walked.
    const configuration = softBodyRestConfiguration(
      domain,
      holds ? furnishing.state : null,
    );
    for (let particle = 0; particle < particles; ++particle) {
      const point = {
        x: configuration[particle * 3],
        y: configuration[particle * 3 + 1],
        z: configuration[particle * 3 + 2],
      };
      if (
        builtEnvironmentContainsPoint(environment, furnishing.space, point) ===
        false
      ) {
        out.push(
          "type",
          `${path}.domain`,
          `particle ${particle} of "${domain.id}" is held outside space "${furnishing.space}"`,
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
 * | the furnishing draws a domain other than the supplied one       | `not-run`     | none                                |
 * | the domain does not validate                                    | `not-run`     | none                                |
 * | the furnishing asks to hold a state the domain does not declare | `not-run`     | none                                |
 * | the domain asks for self-collision                              | `unsupported` | the rest configuration              |
 * | `mode` is `rest`                                                | `rest`        | the rest configuration              |
 * | `mode` is neither `rest` nor `simulated`                        | `not-run`     | none                                |
 * | the shot second is not a real number                            | `not-run`     | none                                |
 * | the shot second lands past the declared `maxSteps`              | `not-run`     | none                                |
 * | `mode` is `simulated`                                           | `solved`      | the fixed-step solve at that second |
 *
 * A panel that could not be simulated is never handed back as though it had
 * been. Returning the rest configuration under an `unsupported` status is the
 * whole difference between a frame a reviewer can act on and a still curtain
 * nobody knew was still because the solver gave up.
 *
 * Nothing here throws. This is the call a compiler makes once per furnishing
 * per shot second, so a curtain whose declared step budget stops before the cut
 * does must come back reported rather than take the whole render down with it —
 * and that budget is the author's own declaration, which is exactly the kind of
 * refusal this record exists to carry.
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

  // The two records arrive separately, so the pairing is checked rather than
  // trusted: solving one panel under another furnishing's identity would
  // produce a frame that looks solved and answers for nothing that was bound.
  if (furnishing.domain !== domain.id)
    return frame(
      analysis(
        "not-run",
        `soft furnishing "${furnishing.id}" draws soft body "${furnishing.domain}", not the supplied "${domain.id}"`,
      ),
      null,
    );
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
  // Every remaining mode is checked by name rather than assumed. Falling
  // through to a solve would let a mode nobody recognises claim to have been
  // simulated, which is the same silent success this whole record exists to
  // refuse — and the one an `else` is cheapest to write.
  if (furnishing.mode !== "simulated")
    return frame(
      analysis(
        "not-run",
        `soft furnishing "${furnishing.id}" asks for mode "${String(furnishing.mode)}", which is not a mode this tier evaluates`,
      ),
      null,
    );
  const step = softBodyStepAt(domain, props.time);
  if (step === null)
    return frame(
      analysis(
        "not-run",
        `soft furnishing "${furnishing.id}" was asked for a shot second that is not a real number`,
      ),
      null,
    );
  if (step > domain.solver.maxSteps)
    return frame(
      analysis(
        "not-run",
        `shot second ${props.time} lands on step ${step} of soft body "${domain.id}", past the ${domain.solver.maxSteps} steps its own budget declares`,
      ),
      null,
    );
  return frame(
    analysis("solved", null),
    simulateSoftBody(domain, step, furnishing.state),
  );
};
