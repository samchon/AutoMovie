import { validateServiceNetwork } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  nclose,
  violationCount,
} from "../internal/predicates";
import {
  serviceEnvironment,
  serviceNetwork,
  withPort,
  withSegment,
} from "../internal/serviceFixtures";

const environment = serviceEnvironment();
const refuse = (network = serviceNetwork()) =>
  validateServiceNetwork({ network, environment });

/**
 * What a run is allowed to be: two real ports on its own system, joined the way
 * the medium actually travels, along a line that starts and ends where it
 * says.
 *
 * A run is the only record that repeats geometry a port already stated, so it
 * is the only record that can contradict one. The centre line is what a clash,
 * a sleeve and a length are all measured on, so a line whose ends float away
 * from the fittings it claims to join silently invalidates every one of those,
 * and it does so without looking wrong in a frame.
 *
 * Direction is checked in the node's own terms. `out` means the node puts the
 * medium into the network and `in` means it takes it out, so a run always
 * leaves an `out` and arrives at an `in`, whatever the medium is.
 * `bidirectional` is the one port that satisfies both, which is what a ring tap
 * needs and what the negative twin below proves is not an accident.
 *
 * Scenarios:
 *
 * 1. A run on a system that does not resolve is refused, and so are its two ports
 *    for belonging to a different one.
 * 2. Ports that do not resolve are refused on the run, and the fittings they were
 *    meant to join are then reported as stubs.
 * 3. A run may not join a port to itself.
 * 4. A run may not join a port belonging to another system.
 * 5. A run must leave an emitting port and arrive at a consuming one; a
 *    bidirectional port satisfies either end and is not refused.
 * 6. A run's section must match every port that states one, with the measured
 *    difference carried; a port that states none imposes none.
 * 7. A route needs at least two points; a single point is refused for its length
 *    and again for not reaching the far fitting.
 * 8. Repeated and non-finite route points are refused where they stand.
 * 9. A run's own radius and section must be finite and positive.
 * 10. An endpoint that drifts off its fitting is refused with the gap in metres.
 */
export const test_service_run_defects = (): void => {
  const clean = serviceNetwork();

  const foreignSystem = refuse(
    withSegment(clean, "cold-run", (run) => ({ ...run, system: "steam" })),
  );
  TestValidator.equals(
    "a run on an unknown system takes its ports down with it",
    namedFacts([
      [
        "system",
        () => hasViolation(foreignSystem, "type", "$input.segments[0].system"),
      ],
      [
        "from",
        () => hasViolation(foreignSystem, "type", "$input.segments[0].from"),
      ],
      [
        "to",
        () => hasViolation(foreignSystem, "type", "$input.segments[0].to"),
      ],
      [
        "valveOrphaned",
        () => hasViolation(foreignSystem, "type", "$input.nodes[8]"),
      ],
      [
        "basinOrphaned",
        () => hasViolation(foreignSystem, "type", "$input.nodes[9]"),
      ],
      ["exactly", () => violationCount(foreignSystem) === 5],
    ]),
    {
      system: true,
      from: true,
      to: true,
      valveOrphaned: true,
      basinOrphaned: true,
      exactly: true,
    },
  );

  const ghostPorts = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      from: "ghost",
      to: "phantom",
    })),
  );
  TestValidator.equals(
    "ports that do not resolve are refused, and their fittings become stubs",
    namedFacts([
      [
        "from",
        () => hasViolation(ghostPorts, "type", "$input.segments[0].from"),
      ],
      ["to", () => hasViolation(ghostPorts, "type", "$input.segments[0].to")],
      [
        "emitterStub",
        () => hasViolation(ghostPorts, "type", "$input.nodes[0].ports[0]"),
      ],
      [
        "consumerStub",
        () => hasViolation(ghostPorts, "type", "$input.nodes[8].ports[0]"),
      ],
    ]),
    { from: true, to: true, emitterStub: true, consumerStub: true },
  );

  const loop = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      to: "cold-main-out",
    })),
  );
  const foreignPort = refuse(
    withSegment(clean, "cold-branch", (run) => ({ ...run, to: "basin-hot" })),
  );
  TestValidator.equals(
    "a run joins two different ports of its own system",
    namedFacts([
      ["loop", () => hasViolation(loop, "type", "$input.segments[0].to")],
      [
        "foreign",
        () => hasViolation(foreignPort, "type", "$input.segments[1].to"),
      ],
    ]),
    { loop: true, foreign: true },
  );

  const reversedEmitter = refuse(
    withPort(clean, "cold-main-out", (entry) => ({
      ...entry,
      direction: "in",
    })),
  );
  const reversedConsumer = refuse(
    withPort(clean, "bath-valve-in", (entry) => ({
      ...entry,
      direction: "out",
    })),
  );
  const ringTap = refuse(
    withPort(clean, "bath-valve-in", (entry) => ({
      ...entry,
      direction: "bidirectional",
    })),
  );
  TestValidator.equals(
    "a run leaves an emitter and arrives at a consumer, and a ring tap is both",
    namedFacts([
      [
        "emitter",
        () => hasViolation(reversedEmitter, "type", "$input.segments[0].from"),
      ],
      [
        "rootToo",
        () => hasViolation(reversedEmitter, "type", "$input.systems[0].root"),
      ],
      [
        "consumer",
        () =>
          hasViolation(reversedConsumer, "type", "$input.segments[0].to") &&
          violationCount(reversedConsumer) === 1,
      ],
      ["bidirectional", () => ringTap.success === true],
    ]),
    { emitter: true, rootToo: true, consumer: true, bidirectional: true },
  );

  const section = refuse(
    withSegment(clean, "cold-run", (run) => ({ ...run, section: 0.003 })),
  );
  TestValidator.equals(
    "a run's section answers to every port that states one",
    namedFacts([
      [
        "refused",
        () => hasViolation(section, "range", "$input.segments[0].section"),
      ],
      ["bothEnds", () => violationCount(section) === 2],
      [
        "difference",
        () =>
          section.success === false &&
          section.violations.every((item) =>
            nclose(item.overshoot ?? -1, 0.001, 1e-12),
          ),
      ],
      [
        "sectionlessPortImposesNothing",
        () => clean.nodes[9]!.ports[3]!.section === null && refuse().success,
      ],
    ]),
    {
      refused: true,
      bothEnds: true,
      difference: true,
      sectionlessPortImposesNothing: true,
    },
  );

  const empty = refuse(
    withSegment(clean, "cold-run", (run) => ({ ...run, route: [] })),
  );
  const single = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      route: [{ x: 8, y: 2.5, z: 1 }],
    })),
  );
  TestValidator.equals(
    "a route needs two points before it can be a line at all",
    namedFacts([
      [
        "empty",
        () =>
          hasViolation(empty, "range", "$input.segments[0].route") &&
          violationCount(empty) === 1,
      ],
      [
        "singleLength",
        () => hasViolation(single, "range", "$input.segments[0].route"),
      ],
      [
        "singleGap",
        () => hasViolation(single, "range", "$input.segments[0].route[0]"),
      ],
      ["singleExactly", () => violationCount(single) === 2],
    ]),
    {
      empty: true,
      singleLength: true,
      singleGap: true,
      singleExactly: true,
    },
  );

  const repeated = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      route: [
        { x: 8, y: 2.5, z: 1 },
        { x: 8, y: 2.5, z: 1 },
        { x: 3.5, y: 2.5, z: 1 },
      ],
    })),
  );
  const infinite = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      route: [
        { x: 8, y: 2.5, z: 1 },
        { x: Number.NaN, y: 2.5, z: 1 },
        { x: 3.5, y: 2.5, z: 1 },
      ],
    })),
  );
  TestValidator.equals(
    "repeated and non-finite route points are refused where they stand",
    namedFacts([
      [
        "repeated",
        () =>
          hasViolation(repeated, "range", "$input.segments[0].route[1]") &&
          violationCount(repeated) === 1,
      ],
      [
        "nonFinite",
        () =>
          hasViolation(infinite, "range", "$input.segments[0].route[1].x") &&
          violationCount(infinite) === 1,
      ],
    ]),
    { repeated: true, nonFinite: true },
  );

  const shapeless = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      radius: 0,
      section: Number.NaN,
    })),
  );
  const drifted = refuse(
    withSegment(clean, "cold-run", (run) => ({
      ...run,
      route: [
        { x: 8, y: 2.5, z: 1 },
        { x: 3.5, y: 2.5, z: 1.25 },
      ],
    })),
  );
  TestValidator.equals(
    "a run states a real radius and section, and ends where it says it does",
    namedFacts([
      [
        "radius",
        () => hasViolation(shapeless, "range", "$input.segments[0].radius"),
      ],
      [
        "section",
        () => hasViolation(shapeless, "range", "$input.segments[0].section"),
      ],
      [
        "gap",
        () => hasViolation(drifted, "range", "$input.segments[0].route[1]"),
      ],
      [
        "gapMeasured",
        () =>
          drifted.success === false &&
          drifted.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.25, 1e-12),
          ),
      ],
    ]),
    { radius: true, section: true, gap: true, gapMeasured: true },
  );
};
