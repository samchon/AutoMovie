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

/** The `y`/`z` walls both halves of the notched basin share. */
const SIDES = [
  { normal: { x: 0, y: -1, z: 0 }, offset: 1 },
  { normal: { x: 0, y: 1, z: 0 }, offset: 4 },
  { normal: { x: 0, y: 0, z: -1 }, offset: 2 },
  { normal: { x: 0, y: 0, z: 1 }, offset: 2 },
];

/**
 * The same basin written as the two convex cells a non-convex room splits into:
 * a west half over `x ∈ [-2, -0.5]`, an east half over `x ∈ [0.5, 2]`, and the
 * notch between them belonging to neither.
 */
const notchedEnvironment = (): IAutoMovieBuiltEnvironment => {
  const environment = basinEnvironment();
  return {
    ...environment,
    spaces: environment.spaces.map((space) => ({
      ...space,
      cells: [
        {
          id: "west-half",
          planes: [
            { normal: { x: -1, y: 0, z: 0 }, offset: 2 },
            { normal: { x: 1, y: 0, z: 0 }, offset: -0.5 },
            ...SIDES,
          ],
        },
        {
          id: "east-half",
          planes: [
            { normal: { x: -1, y: 0, z: 0 }, offset: -0.5 },
            { normal: { x: 1, y: 0, z: 0 }, offset: 2 },
            ...SIDES,
          ],
        },
      ],
    })),
  };
};

/** A 4×4 lattice of the given cell size, cornered on the given origin. */
const placed = (props: { cell: number; x: number }) =>
  pondDomain({
    grid: {
      columns: 4,
      rows: 4,
      cellX: props.cell,
      cellZ: 0.5,
      origin: { x: props.x, y: 0, z: -1 },
    },
  });

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
 *    violations re-pathed onto the domain that carries them and its kind,
 *    severity and measured overshoot carried through unchanged.
 * 6. Geometry: a lattice standing outside its basin is refused, and a basin
 *    declared as a purely semantic container — a space with no convex cells —
 *    is deliberately not geometrically checked.
 * 7. A basin written as several convex cells is not convex, so it is checked cell
 *    by cell rather than at the lattice's corners: a lattice bridging the notch
 *    between two halves is refused even though all four of its corners stand in
 *    the room, while a lattice wholly inside one half is accepted. An unsound
 *    domain is not measured at all — a grid that failed its own validation has
 *    no placement to answer for, and a second verdict derived from the first
 *    bad one would be a finding about nothing.
 * 8. `lowerWaterFeature` gives a renderer the state, the surface and the spray in
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
      waterFeature({ id: "blank-material", material: "  " }),
      waterFeature({ id: "named-material", material: "water-glass" }),
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
      [
        "blankMaterial",
        () => hasViolation(identity, "type", "$input.features[4].material"),
      ],
      [
        "namedMaterial",
        () =>
          hasViolation(identity, "type", "$input.features[5].material") ===
          false,
      ],
    ]),
    {
      emptyId: true,
      duplicateFeature: true,
      duplicateRim: true,
      duplicateDomain: true,
      blankMaterial: true,
      namedMaterial: true,
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
  const unstable = validateWaterFeatures({
    environment,
    features: [waterFeature()],
    domains: [
      pondDomain({
        solver: {
          fixedStepSeconds: 1,
          gravity: 8,
          drag: 0,
          dryDepth: 0,
          referenceDepth: 2,
          maxSteps: 100,
        },
      }),
    ],
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
      [
        "overshootSurvives",
        () =>
          unstable.success === false &&
          unstable.violations.some(
            (item) =>
              item.path === "$input.domains[0].solver.fixedStepSeconds" &&
              item.severity === "error" &&
              nclose(item.overshoot ?? -1, 1 * 4 * Math.sqrt(8) - 1, 1e-9),
          ),
      ],
    ]),
    {
      kind: true,
      mode: true,
      domainViolations: true,
      overshootSurvives: true,
    },
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

  // Cell centres −0.75, −0.25, 0.25, 0.75: the two ends stand in the two halves
  // of the notched basin while the middle two stand over the notch, so the
  // lattice's own corners say nothing about where its water is.
  const notched = notchedEnvironment();
  const bridging = validateWaterFeatures({
    environment: notched,
    features: [waterFeature()],
    domains: [placed({ cell: 0.5, x: -1 })],
  });
  // Centres −1.75, −1.5, −1.25, −1: wholly inside the west half.
  const seated = validateWaterFeatures({
    environment: notched,
    features: [waterFeature()],
    domains: [placed({ cell: 0.25, x: -1.875 })],
  });
  const unsound = validateWaterFeatures({
    environment,
    features: [waterFeature()],
    domains: [
      pondDomain({
        depth: new Array(16).fill(-1),
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
    "a basin split into convex cells is measured cell by cell",
    namedFacts([
      [
        "bridgesTheNotch",
        () => hasViolation(bridging, "type", "$input.features[0].domain"),
      ],
      ["seatedInOneHalf", () => seated.success === true],
      [
        "unsoundDomainReported",
        () => hasViolation(unsound, "range", "$input.domains[0].depth[0]"),
      ],
      [
        "unsoundDomainNotPlaced",
        () =>
          hasViolation(unsound, "type", "$input.features[0].domain") === false,
      ],
    ]),
    {
      bridgesTheNotch: true,
      seatedInOneHalf: true,
      unsoundDomainReported: true,
      unsoundDomainNotPlaced: true,
    },
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
