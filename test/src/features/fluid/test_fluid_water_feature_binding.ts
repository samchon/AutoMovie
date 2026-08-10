import { lowerWaterFeature, validateWaterFeatures } from "@automovie/engine";
import { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  basinEnvironment,
  flatBasin,
  waterFeature,
} from "../internal/fluidFixtures";
import { hasViolation, namedFacts, nclose } from "../internal/predicates";

const pondDomain = (overrides = {}) =>
  flatBasin({
    columns: 4,
    rows: 4,
    depth: 0.25,
    overrides: {
      id: "basin",
      sprays: [
        {
          id: "mist",
          column: 1,
          row: 1,
          rate: 8,
          lifetime: 1,
          speed: 2,
          direction: { x: 0, y: 1, z: 0 },
          spread: 0,
          size: 0.05,
          seed: 3,
          maxParticles: 16,
          lodDistance: 10,
        },
      ],
      sources: [
        { id: "jet", column: 1, row: 1, flowRate: 0.05, start: 0, end: null },
      ],
      ...overrides,
    },
  });

const withoutCells = (): IAutoMovieBuiltEnvironment => {
  const environment = basinEnvironment();
  return {
    ...environment,
    spaces: environment.spaces.map((space) => ({ ...space, cells: [] })),
  };
};

/**
 * The water-feature binding is the one place a building and an independent
 * fluid domain meet, and it is the only place their agreement can be checked.
 *
 * The direction of the dependency is the design. The architecture record knows
 * nothing about fluid and the fluid record knows nothing about architecture, so
 * the same domain that fills an atrium pond here can be placed by a production
 * world with no building at all. What the binding owes in exchange is that
 * every name it repeats actually resolves, that a rim really bounds the basin
 * it claims to, and that the lattice sits inside the room it floods.
 *
 * Scenarios:
 *
 * 1. A pond bound to a real space, with a rim that really bounds it and a valid
 *    domain, validates clean.
 * 2. Every unresolved or mismatched name is refused: a foreign environment id, a
 *    space that does not exist, a domain that was not supplied, a rim that does
 *    not exist, and a rim that bounds some other room.
 * 3. Identity is enforced across features and domains: an empty feature id,
 *    duplicated feature ids, a duplicated rim, and duplicated domain ids.
 * 4. The closed vocabularies are closed: an unknown kind and an unknown mode.
 * 5. A domain that is invalid on its own terms fails the binding too, with its
 *    violations re-pathed onto the domain that carries them.
 * 6. Geometry: a lattice standing outside its basin is refused, and a basin
 *    declared as a purely semantic container — a space with no convex cells —
 *    is deliberately not geometrically checked.
 * 7. `lowerWaterFeature` gives a renderer the state, the surface and the spray in
 *    one frame; a `static` feature always reads step 0 while `flowing` and
 *    `simulated` read the fixed-step solve at that second.
 */
export const test_fluid_water_feature_binding = (): void => {
  const environment = basinEnvironment();
  const domain = pondDomain();

  TestValidator.equals(
    "a well-formed binding validates clean",
    validateWaterFeatures({
      environment,
      features: [waterFeature()],
      domains: [domain],
    }).success,
    true,
  );

  const names = validateWaterFeatures({
    environment,
    features: [
      waterFeature({ id: "foreign", environment: "somewhere-else" }),
      waterFeature({ id: "ghost-space", space: "no-such-room" }),
      waterFeature({ id: "ghost-domain", domain: "no-such-domain" }),
      waterFeature({ id: "ghost-rim", boundaries: ["no-such-rim"] }),
      waterFeature({ id: "wrong-rim", boundaries: ["elsewhere"] }),
    ],
    domains: [domain],
  });
  TestValidator.equals(
    "every repeated name must resolve to the thing it claims",
    namedFacts([
      [
        "environment",
        () => hasViolation(names, "type", "$input.features[0].environment"),
      ],
      ["space", () => hasViolation(names, "type", "$input.features[1].space")],
      [
        "domain",
        () => hasViolation(names, "type", "$input.features[2].domain"),
      ],
      [
        "rimMissing",
        () => hasViolation(names, "type", "$input.features[3].boundaries[0]"),
      ],
      [
        "rimElsewhere",
        () => hasViolation(names, "type", "$input.features[4].boundaries[0]"),
      ],
    ]),
    {
      environment: true,
      space: true,
      domain: true,
      rimMissing: true,
      rimElsewhere: true,
    },
  );

  const identity = validateWaterFeatures({
    environment,
    features: [
      waterFeature({ id: "  " }),
      waterFeature({ id: "twin" }),
      waterFeature({ id: "twin" }),
      waterFeature({ id: "double-rim", boundaries: ["coping", "coping"] }),
    ],
    domains: [domain, { ...domain }],
  });
  TestValidator.equals(
    "identity is enforced across features, rims and domains",
    namedFacts([
      [
        "emptyId",
        () => hasViolation(identity, "type", "$input.features[0].id"),
      ],
      [
        "duplicateFeature",
        () => hasViolation(identity, "type", "$input.features[2].id"),
      ],
      [
        "duplicateRim",
        () =>
          hasViolation(identity, "type", "$input.features[3].boundaries[1]"),
      ],
      [
        "duplicateDomain",
        () => hasViolation(identity, "type", "$input.domains[1].id"),
      ],
    ]),
    {
      emptyId: true,
      duplicateFeature: true,
      duplicateRim: true,
      duplicateDomain: true,
    },
  );

  const vocabulary = validateWaterFeatures({
    environment,
    features: [
      waterFeature({
        kind: "lava" as unknown as "pond",
        mode: "boiling" as unknown as "static",
      }),
    ],
    domains: [domain],
  });
  const broken = validateWaterFeatures({
    environment,
    features: [waterFeature()],
    domains: [pondDomain({ depth: new Array(16).fill(-1) })],
  });
  TestValidator.equals(
    "closed vocabularies stay closed and a broken domain breaks its binding",
    namedFacts([
      [
        "kind",
        () => hasViolation(vocabulary, "type", "$input.features[0].kind"),
      ],
      [
        "mode",
        () => hasViolation(vocabulary, "type", "$input.features[0].mode"),
      ],
      [
        "domainViolations",
        () => hasViolation(broken, "range", "$input.domains[0].depth[0]"),
      ],
    ]),
    { kind: true, mode: true, domainViolations: true },
  );

  const outside = validateWaterFeatures({
    environment,
    features: [waterFeature()],
    domains: [
      pondDomain({
        grid: {
          columns: 4,
          rows: 4,
          cellX: 0.5,
          cellZ: 0.5,
          origin: { x: 100, y: 0, z: 0 },
        },
      }),
    ],
  });
  const semantic = validateWaterFeatures({
    environment: withoutCells(),
    features: [waterFeature()],
    domains: [
      pondDomain({
        grid: {
          columns: 4,
          rows: 4,
          cellX: 0.5,
          cellZ: 0.5,
          origin: { x: 100, y: 0, z: 0 },
        },
      }),
    ],
  });
  TestValidator.equals(
    "a lattice must sit in its basin, unless the basin states no volume",
    namedFacts([
      [
        "outside",
        () => hasViolation(outside, "type", "$input.features[0].domain"),
      ],
      ["semanticContainer", () => semantic.success === true],
    ]),
    { outside: true, semanticContainer: true },
  );

  const still = lowerWaterFeature({
    feature: waterFeature({ mode: "static" }),
    domain,
    time: 4,
  });
  const solved = lowerWaterFeature({
    feature: waterFeature({ mode: "simulated" }),
    domain,
    time: 4,
    cameraDistance: 0,
  });
  const flowing = lowerWaterFeature({
    feature: waterFeature({ mode: "flowing" }),
    domain,
    time: 4,
  });
  TestValidator.equals(
    "one frame carries the state, the surface and the spray together",
    namedFacts([
      ["staticStep", () => still.state.step === 0],
      ["staticNoInflow", () => Object.is(still.state.sourceVolume, 0)],
      [
        "simulatedStep",
        () =>
          solved.state.step === Math.round(4 / domain.solver.fixedStepSeconds),
      ],
      ["simulatedInflow", () => solved.state.sourceVolume > 0],
      [
        "flowingMatchesSimulated",
        () => flowing.state.step === solved.state.step,
      ],
      ["feature", () => solved.feature === "atrium-pond"],
      ["surfaceStep", () => solved.surface.step === solved.state.step],
      [
        "surfaceHeight",
        () =>
          solved.surface.bounds !== null &&
          nclose(
            solved.surface.bounds.max.y,
            Math.max(...solved.state.depth),
            1e-12,
          ),
      ],
      ["sprayLive", () => solved.spray.particles.length > 0],
      ["spraySameStep", () => solved.spray.step === solved.state.step],
    ]),
    {
      staticStep: true,
      staticNoInflow: true,
      simulatedStep: true,
      simulatedInflow: true,
      flowingMatchesSimulated: true,
      feature: true,
      surfaceStep: true,
      surfaceHeight: true,
      sprayLive: true,
      spraySameStep: true,
    },
  );
};
