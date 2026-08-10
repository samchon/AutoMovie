import { validateServiceNetwork } from "@automovie/engine";
import { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  nclose,
  validationHasWarning,
  validationHasWarningCount,
  violationCount,
} from "../internal/predicates";
import {
  serviceEnvironment,
  serviceNetwork,
  sleeve,
  withSegment,
  withSleeve,
} from "../internal/serviceFixtures";

const environment = serviceEnvironment();
const refuse = (network = serviceNetwork()) =>
  validateServiceNetwork({ network, environment });

/** The same building with every room reduced to a name and no volume. */
const semantic = (): IAutoMovieBuiltEnvironment => {
  const built = serviceEnvironment();
  return {
    ...built,
    spaces: built.spaces.map((space) => ({ ...space, cells: [] })),
  };
};

/**
 * A run that leaves the room it started in has been through a wall, and the
 * record has to say so.
 *
 * Boundaries carry no surface geometry yet, so the crossing cannot be found by
 * intersecting a wall. It is found in the logical spaces instead: the moment
 * two consecutive points of a centre line disagree about which rooms contain
 * them, the run has left one region for another and is expected to name a
 * sleeve on a boundary of one of them. That reading is exact where volumes are
 * declared and deliberately silent where they are not — a purely semantic
 * partition is a name on a plan, not a wall anybody drilled.
 *
 * The sleeve then answers for itself. It must be wide enough for what passes
 * through it, it must sit on the run that claims it, it must belong to a
 * boundary that exists, and where it cites a declared opening that opening must
 * be cut through the same boundary. A sleeve through waterproofing must be made
 * good, which is the one place this file and the wet zones meet.
 *
 * Scenarios:
 *
 * 1. A run stripped of its sleeves is refused for the crossing it makes, and the
 *    now-unused sleeves are reported as unused rather than silently forgiven.
 * 2. An extra sleeve nobody runs through is advice, not a failure: validation
 *    succeeds carrying exactly one warning.
 * 3. A sleeve narrower than the run through it is refused with the measured
 *    overshoot; one wide enough is not.
 * 4. A sleeve that does not sit on the run citing it is refused.
 * 5. A run citing an unknown sleeve, and one citing the same sleeve twice, are
 *    each refused on the citation rather than on the sleeve.
 * 6. A sleeve on a boundary that does not resolve is refused, and its crossing is
 *    still covered by the run's other sleeve rather than double-reported.
 * 7. The opening seam holds in both directions: an unknown opening and an opening
 *    cut through a different boundary are refused, while the fixture's chase is
 *    accepted.
 * 8. A sleeve through a waterproofed boundary must be sealed; the same sleeve
 *    through an untanked boundary need not be, which the clean fixture already
 *    carries unsealed.
 * 9. Where no space declares a volume, no crossing can be read and none is
 *    invented.
 * 10. Now that a boundary can carry a face, a sleeve is held on it: off the
 *     separation's own thickness, wider than the face it pierces, or outside
 *     the void it claims to pass through, each refused. A boundary with no face
 *     and an opening with no profile are skipped rather than guessed at.
 */
export const test_service_penetration_seal = (): void => {
  const clean = serviceNetwork();

  const bare = refuse(
    withSegment(clean, "cold-run", (run) => ({ ...run, penetrations: [] })),
  );
  TestValidator.equals(
    "a run that leaves its room without a sleeve is refused",
    namedFacts([
      [
        "crossing",
        () => hasViolation(bare, "type", "$input.segments[0].penetrations"),
      ],
      [
        "message",
        () =>
          bare.success === false &&
          bare.violations.some((item) =>
            item.expected.includes("crossing between logical spaces"),
          ),
      ],
      [
        "orphanedPlantSleeve",
        () => hasViolation(bare, "coverage", "$input.penetrations[0]"),
      ],
      [
        "orphanedBathSleeve",
        () => hasViolation(bare, "coverage", "$input.penetrations[1]"),
      ],
      ["exactly", () => violationCount(bare) === 3],
    ]),
    {
      crossing: true,
      message: true,
      orphanedPlantSleeve: true,
      orphanedBathSleeve: true,
      exactly: true,
    },
  );

  const spare = validateServiceNetwork({
    network: {
      ...clean,
      penetrations: [
        ...clean.penetrations,
        sleeve({
          id: "spare",
          boundary: "hall-plant",
          position: { x: 7, y: 1, z: 2 },
        }),
      ],
    },
    environment,
  });
  TestValidator.equals(
    "a sleeve nobody runs through is advice, not a failure",
    namedFacts([
      [
        "warned",
        () =>
          validationHasWarning(
            "spare sleeve",
            spare,
            "coverage",
            "$input.penetrations[13]",
          ),
      ],
      [
        "onlyWarning",
        () => validationHasWarningCount("spare sleeve", spare, 1),
      ],
    ]),
    { warned: true, onlyWarning: true },
  );

  const tight = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      radius: 0.01,
    })),
  );
  TestValidator.equals(
    "a run does not pass through a sleeve narrower than itself",
    namedFacts([
      [
        "refused",
        () => hasViolation(tight, "range", "$input.segments[0].radius"),
      ],
      [
        "overshoot",
        () =>
          tight.success === false &&
          tight.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.015, 1e-12),
          ),
      ],
      ["alone", () => violationCount(tight) === 1],
    ]),
    { refused: true, overshoot: true, alone: true },
  );

  const adrift = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      position: { x: 4, y: 1, z: 1 },
    })),
  );
  const unknown = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      penetrations: ["ghost", "cold-plant-hall", "cold-bath-hall"],
    })),
  );
  const twice = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      penetrations: ["cold-plant-hall", "cold-plant-hall", "cold-bath-hall"],
    })),
  );
  TestValidator.equals(
    "a citation is checked as a citation, not as the sleeve it names",
    namedFacts([
      [
        "adrift",
        () =>
          hasViolation(adrift, "range", "$input.segments[0].penetrations[1]") &&
          violationCount(adrift) === 1,
      ],
      [
        "unknown",
        () =>
          hasViolation(unknown, "type", "$input.segments[0].penetrations[0]") &&
          violationCount(unknown) === 1,
      ],
      [
        "twice",
        () =>
          hasViolation(twice, "type", "$input.segments[0].penetrations[1]") &&
          violationCount(twice) === 1,
      ],
    ]),
    { adrift: true, unknown: true, twice: true },
  );

  const homeless = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      boundary: "nowhere",
    })),
  );
  TestValidator.equals(
    "a sleeve on a boundary that does not exist is refused exactly once",
    namedFacts([
      [
        "refused",
        () => hasViolation(homeless, "type", "$input.penetrations[1].boundary"),
      ],
      ["alone", () => violationCount(homeless) === 1],
    ]),
    { refused: true, alone: true },
  );

  const ghostOpening = refuse(
    withSleeve(clean, "waste-bath-hall", (entry) => ({
      ...entry,
      opening: "no-such-opening",
    })),
  );
  const wrongOpening = refuse(
    withSleeve(clean, "waste-bath-hall", (entry) => ({
      ...entry,
      opening: "plant-hatch",
    })),
  );
  TestValidator.equals(
    "a sleeve may only cite an opening cut through its own boundary",
    namedFacts([
      [
        "ghost",
        () =>
          hasViolation(
            ghostOpening,
            "type",
            "$input.penetrations[5].opening",
          ) && violationCount(ghostOpening) === 1,
      ],
      [
        "wrongBoundary",
        () =>
          hasViolation(
            wrongOpening,
            "type",
            "$input.penetrations[5].opening",
          ) && violationCount(wrongOpening) === 1,
      ],
    ]),
    { ghost: true, wrongBoundary: true },
  );

  const leaking = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      sealed: false,
    })),
  );
  TestValidator.equals(
    "waterproofing is only waterproof where the sleeves through it were made good",
    namedFacts([
      [
        "refused",
        () => hasViolation(leaking, "type", "$input.penetrations[1].sealed"),
      ],
      ["alone", () => violationCount(leaking) === 1],
      [
        "untankedBoundaryUnaffected",
        () => clean.penetrations[12]!.sealed === false && refuse().success,
      ],
    ]),
    { refused: true, alone: true, untankedBoundaryUnaffected: true },
  );

  const offPlane = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      position: { x: 4.5, y: 2.5, z: 1 },
    })),
  );
  const oversize = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({ ...entry, radius: 3 })),
  );
  const offVoid = refuse(
    withSleeve(clean, "waste-bath-hall", (entry) => ({
      ...entry,
      position: { x: 4, y: 1.5, z: 1 },
    })),
  );
  const faceless = refuse(
    withSleeve(clean, "cold-bath-hall", (entry) => ({
      ...entry,
      boundary: "bath-shell",
    })),
  );
  const plainHatch = refuse(
    withSleeve(clean, "air-hall-plant", (entry) => ({
      ...entry,
      opening: "plant-hatch",
    })),
  );
  TestValidator.equals(
    "a sleeve is held inside the face it pierces, and inside the void it cites",
    namedFacts([
      [
        "offPlane",
        () =>
          hasViolation(offPlane, "range", "$input.penetrations[1].position") &&
          offPlane.success === false &&
          offPlane.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.4, 1e-12),
          ) &&
          violationCount(offPlane) === 1,
      ],
      [
        "oversize",
        () =>
          hasViolation(oversize, "type", "$input.penetrations[1].position") &&
          violationCount(oversize) === 1,
      ],
      [
        "offVoid",
        () => hasViolation(offVoid, "type", "$input.penetrations[5].opening"),
      ],
      [
        "offVoidLeftItsRunToo",
        () =>
          hasViolation(offVoid, "range", "$input.segments[5].penetrations[0]"),
      ],
      ["facelessBoundarySkipped", () => faceless.success === true],
      ["profilelessOpeningSkipped", () => plainHatch.success === true],
    ]),
    {
      offPlane: true,
      oversize: true,
      offVoid: true,
      offVoidLeftItsRunToo: true,
      facelessBoundarySkipped: true,
      profilelessOpeningSkipped: true,
    },
  );

  const nowhere = validateServiceNetwork({
    network: withSegment(clean, "cold-run", (run) => ({
      ...run,
      penetrations: [],
    })),
    environment: semantic(),
  });
  TestValidator.equals(
    "where no room declares a volume, no crossing is invented",
    namedFacts([
      ["accepted", () => nowhere.success === true],
      [
        "warningCount",
        () =>
          // The `success` comparison is restated only to narrow the union
          // inside this closure.
          nowhere.success === true && (nowhere.warnings ?? []).length === 2,
      ],
    ]),
    { accepted: true, warningCount: true },
  );
};
