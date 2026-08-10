import { serviceSystemLoad, validateServiceNetwork } from "@automovie/engine";
import {
  AutoMovieServiceDiscipline,
  AutoMovieServiceMedium,
  AutoMovieServiceUnit,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  nclose,
  violationCount,
} from "../internal/predicates";
import {
  node,
  port,
  segment,
  serviceEnvironment,
  serviceNetwork,
  sleeve,
  system,
  withNode,
  withPort,
  withSegment,
  withSystem,
} from "../internal/serviceFixtures";

const environment = serviceEnvironment();
const refuse = (network = serviceNetwork()) =>
  validateServiceNetwork({ network, environment });

/**
 * Every way a distribution graph can be wrong about itself, one property at a
 * time.
 *
 * The clean fixture is the adjacent case for all of it: each network below
 * differs from a validated one by exactly the property under test, so a rule
 * that over-matches shows up as a defect reported where nothing changed, and
 * one that under-matches shows up as silence. That is why the counts are
 * asserted next to the paths — a validator that fires twice for one mistake
 * sends an author looking for a second one that does not exist.
 *
 * Dangling and unreachable are deliberately different findings. A port nothing
 * joins is a stub the author forgot to run; a node the root cannot get to is a
 * branch that was run and then orphaned. Reporting either as the other would
 * point at the wrong end of the mistake.
 *
 * Scenarios:
 *
 * 1. The record's own header is checked: schema version, units, the environment it
 *    claims to serve, and a blank identity.
 * 2. Identity is enforced separately for systems, nodes, ports, runs and sleeves,
 *    with ports unique across the whole network rather than per node.
 * 3. Closed vocabularies stay closed: discipline, medium, flow, node kind and port
 *    direction each refuse a word outside their union.
 * 4. A discipline refuses a medium it does not carry, and a medium refuses a unit
 *    it is not measured in — at the system, and again at every port repeating
 *    it.
 * 5. The two disciplines the bathhouse itself does not carry answer to the same
 *    table: a data circuit is legal as a bit rate and refused as a control
 *    signal, and a control circuit is the mirror of it.
 * 6. A port carrying the wrong medium or the wrong unit is caught on its own, with
 *    the system left alone.
 * 7. A port no run joins is refused as a stub, and nothing else is.
 * 8. Declared demand beyond declared capacity is refused with the measured
 *    overshoot.
 * 9. A system is loaded at the end facing away from its root, so a drainage stack
 *    is measured by what discharges into it rather than by the zero a
 *    supply-shaped reading would hand it.
 * 10. A port standing outside the logical space its own node stands in is refused,
 *     without accusing the node that did stand in it.
 * 11. Deleting one branch produces exactly the three findings it causes: two stubs
 *     and one orphan.
 * 12. A root is refused when it does not resolve, when it carries no port on its
 *     own system, when a supply is rooted where the medium only arrives, and
 *     when a drain is rooted where it only leaves.
 * 13. A node is refused when its space does not resolve, when its element does not,
 *     and when it stands outside the space it claims.
 * 14. Operating state and access volumes are range-checked: a blank state name, an
 *     opening past 1, a collapsed envelope and a non-finite one.
 * 15. Non-finite and negative numbers are refused wherever a position, a demand or
 *     a section is required, and a point nobody can read is not additionally
 *     accused of standing in the wrong room.
 */
export const test_service_network_defects = (): void => {
  const clean = serviceNetwork();

  const header = refuse({
    ...clean,
    id: "  ",
    version: 2 as unknown as 1,
    units: "centimeter" as unknown as "meter",
    environment: "somewhere-else",
  });
  TestValidator.equals(
    "the record's own header is checked before anything it cites",
    namedFacts([
      ["id", () => hasViolation(header, "type", "$input.id")],
      ["version", () => hasViolation(header, "type", "$input.version")],
      ["units", () => hasViolation(header, "type", "$input.units")],
      ["environment", () => hasViolation(header, "type", "$input.environment")],
    ]),
    { id: true, version: true, units: true, environment: true },
  );

  const identity = refuse({
    ...clean,
    systems: [...clean.systems, system({ id: "cold" })],
    nodes: [
      ...clean.nodes.map((entry) =>
        entry.id === "floor-gully"
          ? {
              ...entry,
              ports: [
                ...entry.ports,
                port({
                  id: "basin-cold",
                  system: "cold",
                  position: { x: 2.5, y: 0.1, z: 3 },
                }),
              ],
            }
          : entry,
      ),
      node({ id: "basin", position: { x: 1, y: 1, z: 1 } }),
      node({ id: "  ", position: { x: 1, y: 1, z: 1 } }),
    ],
    segments: [...clean.segments, segment({ id: "cold-run" })],
    penetrations: [...clean.penetrations, sleeve({ id: "cold-bath-hall" })],
  });
  TestValidator.equals(
    "identity is enforced per record kind, and per network for ports",
    namedFacts([
      ["system", () => hasViolation(identity, "type", "$input.systems[7].id")],
      ["node", () => hasViolation(identity, "type", "$input.nodes[14].id")],
      ["blank", () => hasViolation(identity, "type", "$input.nodes[15].id")],
      [
        "port",
        () => hasViolation(identity, "type", "$input.nodes[11].ports[1].id"),
      ],
      [
        "segment",
        () => hasViolation(identity, "type", "$input.segments[10].id"),
      ],
      [
        "penetration",
        () => hasViolation(identity, "type", "$input.penetrations[13].id"),
      ],
    ]),
    {
      system: true,
      node: true,
      blank: true,
      port: true,
      segment: true,
      penetration: true,
    },
  );

  const vocabulary = refuse(
    withPort(
      withNode(
        withSystem(clean, "cold", (entry) => ({
          ...entry,
          discipline: "acoustics" as unknown as "plumbing",
          medium: "steam" as unknown as "cold-water",
          flow: "sideways" as unknown as "from-root",
          capacity: 0,
        })),
        "cold-main",
        (entry) => ({ ...entry, kind: "gizmo" as unknown as "source" }),
      ),
      "basin-cold",
      (entry) => ({
        ...entry,
        direction: "sideways" as unknown as "in",
      }),
    ),
  );
  TestValidator.equals(
    "closed vocabularies stay closed at every level",
    namedFacts([
      [
        "discipline",
        () => hasViolation(vocabulary, "type", "$input.systems[0].discipline"),
      ],
      [
        "medium",
        () => hasViolation(vocabulary, "type", "$input.systems[0].medium"),
      ],
      [
        "flow",
        () => hasViolation(vocabulary, "type", "$input.systems[0].flow"),
      ],
      [
        "capacity",
        () => hasViolation(vocabulary, "range", "$input.systems[0].capacity"),
      ],
      ["kind", () => hasViolation(vocabulary, "type", "$input.nodes[0].kind")],
      [
        "direction",
        () =>
          hasViolation(
            vocabulary,
            "type",
            "$input.nodes[9].ports[0].direction",
          ),
      ],
    ]),
    {
      discipline: true,
      medium: true,
      flow: true,
      capacity: true,
      kind: true,
      direction: true,
    },
  );

  const mismatch = refuse(
    withSystem(clean, "cold", (entry) => ({
      ...entry,
      medium: "supply-air",
      unit: "watt",
    })),
  );
  const wrongUnit = refuse(
    withSystem(clean, "lighting", (entry) => ({
      ...entry,
      unit: "bit-per-second",
    })),
  );
  TestValidator.equals(
    "a discipline refuses a medium, a medium refuses a unit, and ports repeat both",
    namedFacts([
      [
        "disciplineMedium",
        () => hasViolation(mismatch, "type", "$input.systems[0].medium"),
      ],
      [
        "portMedium",
        () => hasViolation(mismatch, "type", "$input.nodes[9].ports[0].medium"),
      ],
      [
        "mediumUnit",
        () => hasViolation(wrongUnit, "type", "$input.systems[4].unit"),
      ],
      [
        "portUnit",
        () => hasViolation(wrongUnit, "type", "$input.nodes[13].ports[0].unit"),
      ],
    ]),
    {
      disciplineMedium: true,
      portMedium: true,
      mediumUnit: true,
      portUnit: true,
    },
  );

  const circuit = (
    discipline: AutoMovieServiceDiscipline,
    medium: AutoMovieServiceMedium,
    unit: AutoMovieServiceUnit,
  ) =>
    refuse(
      withPort(
        withPort(
          withSystem(clean, "lighting", (entry) => ({
            ...entry,
            discipline,
            medium,
            unit,
          })),
          "panel-out",
          (entry) => ({ ...entry, medium, unit }),
        ),
        "bath-light-in",
        (entry) => ({ ...entry, medium, unit }),
      ),
    );
  TestValidator.equals(
    "the two disciplines this building never carries answer to the same table",
    namedFacts([
      [
        "dataCarriesABitRate",
        () => circuit("data", "data-signal", "bit-per-second").success === true,
      ],
      [
        "controlCarriesADimensionlessSignal",
        () =>
          circuit("control", "control-signal", "dimensionless").success ===
          true,
      ],
      [
        "dataRefusesAControlSignal",
        () => {
          const wrong = circuit("data", "control-signal", "dimensionless");
          return (
            hasViolation(wrong, "type", "$input.systems[4].medium") &&
            violationCount(wrong) === 1
          );
        },
      ],
      [
        "controlRefusesABitRate",
        () => {
          const wrong = circuit("control", "control-signal", "bit-per-second");
          return (
            hasViolation(wrong, "type", "$input.systems[4].unit") &&
            violationCount(wrong) === 1
          );
        },
      ],
    ]),
    {
      dataCarriesABitRate: true,
      controlCarriesADimensionlessSignal: true,
      dataRefusesAControlSignal: true,
      controlRefusesABitRate: true,
    },
  );

  const portMedium = refuse(
    withPort(clean, "basin-cold", (entry) => ({
      ...entry,
      medium: "hot-water",
    })),
  );
  const portUnit = refuse(
    withPort(clean, "basin-cold", (entry) => ({ ...entry, unit: "watt" })),
  );
  TestValidator.equals(
    "one port disagreeing with its system is caught without accusing the system",
    namedFacts([
      [
        "medium",
        () =>
          hasViolation(portMedium, "type", "$input.nodes[9].ports[0].medium") &&
          portMedium.success === false &&
          portMedium.violations.length === 1,
      ],
      [
        "unit",
        () =>
          hasViolation(portUnit, "type", "$input.nodes[9].ports[0].unit") &&
          portUnit.success === false &&
          portUnit.violations.length === 1,
      ],
    ]),
    { medium: true, unit: true },
  );

  const stub = refuse(
    withNode(clean, "bath-valve", (entry) => ({
      ...entry,
      ports: [
        ...entry.ports,
        port({
          id: "bath-valve-drain",
          system: "cold",
          direction: "out",
          position: { x: 3.5, y: 2.5, z: 1 },
        }),
      ],
    })),
  );
  TestValidator.equals(
    "a port no run joins is a stub, and the only finding",
    namedFacts([
      ["stub", () => hasViolation(stub, "type", "$input.nodes[8].ports[2]")],
      ["alone", () => stub.success === false && stub.violations.length === 1],
    ]),
    { stub: true, alone: true },
  );

  const overloaded = refuse(
    withPort(clean, "basin-cold", (entry) => ({ ...entry, demand: 0.02 })),
  );
  TestValidator.equals(
    "declared demand beyond declared capacity is refused with its overshoot",
    namedFacts([
      [
        "reported",
        () => hasViolation(overloaded, "range", "$input.systems[0].capacity"),
      ],
      [
        "overshoot",
        () =>
          overloaded.success === false &&
          overloaded.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.01, 1e-12),
          ),
      ],
      [
        "alone",
        () =>
          overloaded.success === false && overloaded.violations.length === 1,
      ],
    ]),
    { reported: true, overshoot: true, alone: true },
  );

  const discharging = refuse(
    withSystem(clean, "waste", (entry) => ({ ...entry, capacity: 0.0005 })),
  );
  TestValidator.equals(
    "a stack is loaded by what discharges into it, not by what it receives",
    namedFacts([
      [
        "supplyReadsItsInlets",
        () =>
          nclose(
            serviceSystemLoad({ network: clean, system: clean.systems[0]! }),
            0.0002,
            1e-15,
          ),
      ],
      [
        "stackReadsItsOutlets",
        () =>
          nclose(
            serviceSystemLoad({ network: clean, system: clean.systems[2]! }),
            0.001,
            1e-15,
          ),
      ],
      [
        "refused",
        () => hasViolation(discharging, "range", "$input.systems[2].capacity"),
      ],
      [
        "overshoot",
        () =>
          discharging.success === false &&
          discharging.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.0005, 1e-15),
          ),
      ],
      ["alone", () => violationCount(discharging) === 1],
    ]),
    {
      supplyReadsItsInlets: true,
      stackReadsItsOutlets: true,
      refused: true,
      overshoot: true,
      alone: true,
    },
  );

  const strayPort = refuse(
    withSegment(
      withPort(clean, "bath-light-in", (entry) => ({
        ...entry,
        position: { x: 8.2, y: 2.95, z: 3 },
      })),
      "lighting-run",
      (run) => ({
        ...run,
        route: [
          { x: 8.5, y: 2.95, z: 3 },
          { x: 8.2, y: 2.95, z: 3 },
        ],
        penetrations: [],
      }),
    ),
  );
  TestValidator.equals(
    "a port may not stand in a room its own fitting is not in",
    namedFacts([
      [
        "refused",
        () =>
          hasViolation(strayPort, "type", "$input.nodes[13].ports[0].position"),
      ],
      [
        "named",
        () =>
          strayPort.success === false &&
          strayPort.violations.some((item) =>
            item.expected.includes(
              'service port "bath-light-in" of node "bath-light" stands outside logical space "bath"',
            ),
          ),
      ],
      [
        "nodeUnaccused",
        () =>
          strayPort.success === false &&
          strayPort.violations.every(
            (item) => item.path !== "$input.nodes[13].position",
          ),
      ],
      [
        "onlyDefect",
        () =>
          strayPort.success === false &&
          strayPort.violations.filter((item) => item.severity === "error")
            .length === 1,
      ],
    ]),
    { refused: true, named: true, nodeUnaccused: true, onlyDefect: true },
  );

  const orphan = refuse({
    ...clean,
    segments: clean.segments.filter((entry) => entry.id !== "cold-branch"),
  });
  TestValidator.equals(
    "deleting one branch leaves two stubs and one orphan, and nothing else",
    namedFacts([
      [
        "emitterStub",
        () => hasViolation(orphan, "type", "$input.nodes[8].ports[1]"),
      ],
      [
        "consumerStub",
        () => hasViolation(orphan, "type", "$input.nodes[9].ports[0]"),
      ],
      ["orphan", () => hasViolation(orphan, "type", "$input.nodes[9]")],
      [
        "exactly",
        () => orphan.success === false && orphan.violations.length === 3,
      ],
    ]),
    { emitterStub: true, consumerStub: true, orphan: true, exactly: true },
  );

  const missingRoot = refuse(
    withSystem(clean, "cold", (entry) => ({ ...entry, root: "nowhere" })),
  );
  const foreignRoot = refuse(
    withSystem(clean, "cold", (entry) => ({ ...entry, root: "floor-gully" })),
  );
  const receivingRoot = refuse(
    withSystem(clean, "cold", (entry) => ({ ...entry, root: "basin" })),
  );
  const emittingRoot = refuse(
    withSystem(clean, "waste", (entry) => ({ ...entry, root: "floor-gully" })),
  );
  TestValidator.equals(
    "a root must exist, belong to its system, and face the way the flow does",
    namedFacts([
      [
        "missing",
        () => hasViolation(missingRoot, "type", "$input.systems[0].root"),
      ],
      [
        "foreign",
        () => hasViolation(foreignRoot, "type", "$input.systems[0].root"),
      ],
      [
        "receiving",
        () => hasViolation(receivingRoot, "type", "$input.systems[0].root"),
      ],
      [
        "emitting",
        () => hasViolation(emittingRoot, "type", "$input.systems[2].root"),
      ],
    ]),
    { missing: true, foreign: true, receiving: true, emitting: true },
  );

  const placement = refuse(
    withNode(clean, "basin", (entry) => ({
      ...entry,
      space: "attic",
      element: "ghost",
    })),
  );
  const outside = refuse(
    withNode(clean, "basin", (entry) => ({
      ...entry,
      position: { x: 9, y: 0.9, z: 1 },
    })),
  );
  TestValidator.equals(
    "a node must name a real space and element, and stand inside that space",
    namedFacts([
      ["space", () => hasViolation(placement, "type", "$input.nodes[9].space")],
      [
        "element",
        () => hasViolation(placement, "type", "$input.nodes[9].element"),
      ],
      [
        "outside",
        () => hasViolation(outside, "type", "$input.nodes[9].position"),
      ],
      [
        "outsideAlone",
        () => outside.success === false && outside.violations.length === 1,
      ],
    ]),
    { space: true, element: true, outside: true, outsideAlone: true },
  );

  const state = refuse(
    withNode(
      withNode(clean, "bath-valve", (entry) => ({
        ...entry,
        state: { name: "   ", opening: 1.5 },
      })),
      "ahu",
      (entry) => ({
        ...entry,
        maintenance: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: Number.NaN, z: 1 },
        },
      }),
    ),
  );
  TestValidator.equals(
    "operating state and access volumes are range-checked",
    namedFacts([
      ["name", () => hasViolation(state, "type", "$input.nodes[8].state.name")],
      [
        "opening",
        () => hasViolation(state, "range", "$input.nodes[8].state.opening"),
      ],
      [
        "collapsed",
        () => hasViolation(state, "range", "$input.nodes[5].maintenance.max.x"),
      ],
      [
        "nonFinite",
        () => hasViolation(state, "range", "$input.nodes[5].maintenance.max.y"),
      ],
    ]),
    { name: true, opening: true, collapsed: true, nonFinite: true },
  );

  const numbers = refuse(
    withPort(
      withNode(clean, "basin", (entry) => ({
        ...entry,
        position: { x: Number.NaN, y: 0.9, z: 1 },
      })),
      "basin-cold",
      (entry) => ({
        ...entry,
        demand: -1,
        section: 0,
        position: { x: 1, y: Number.POSITIVE_INFINITY, z: 1 },
      }),
    ),
  );
  TestValidator.equals(
    "non-finite and negative numbers are refused wherever a real one is required",
    namedFacts([
      [
        "nodePosition",
        () => hasViolation(numbers, "range", "$input.nodes[9].position.x"),
      ],
      [
        "demand",
        () => hasViolation(numbers, "range", "$input.nodes[9].ports[0].demand"),
      ],
      [
        "section",
        () =>
          hasViolation(numbers, "range", "$input.nodes[9].ports[0].section"),
      ],
      [
        "portPosition",
        () =>
          hasViolation(numbers, "range", "$input.nodes[9].ports[0].position.y"),
      ],
      [
        "nodeNotAlsoEvicted",
        () => !hasViolation(numbers, "type", "$input.nodes[9].position"),
      ],
      [
        "portNotAlsoEvicted",
        () =>
          !hasViolation(numbers, "type", "$input.nodes[9].ports[0].position"),
      ],
    ]),
    {
      nodePosition: true,
      demand: true,
      section: true,
      portPosition: true,
      nodeNotAlsoEvicted: true,
      portNotAlsoEvicted: true,
    },
  );

  const orphanPort = refuse(
    withPort(clean, "basin-cold", (entry) => ({
      ...entry,
      id: "   ",
      system: "steam",
      demand: Number.NaN,
    })),
  );
  const sleeveShape = refuse({
    ...clean,
    penetrations: clean.penetrations.map((entry, index) =>
      index === 0
        ? { ...entry, position: { x: Number.NaN, y: 2.5, z: 1 } }
        : index === 2
          ? { ...entry, radius: 0 }
          : entry,
    ),
  });
  const unmeasurable = refuse(
    withSystem(clean, "cold", (entry) => ({
      ...entry,
      capacity: Number.NaN,
    })),
  );
  TestValidator.equals(
    "a port on no system, a shapeless sleeve and an unmeasurable capacity",
    namedFacts([
      [
        "portSystem",
        () =>
          hasViolation(orphanPort, "type", "$input.nodes[9].ports[0].system"),
      ],
      [
        "portId",
        () => hasViolation(orphanPort, "type", "$input.nodes[9].ports[0].id"),
      ],
      [
        "nonFiniteDemand",
        () =>
          hasViolation(orphanPort, "range", "$input.nodes[9].ports[0].demand"),
      ],
      [
        "sleevePosition",
        () =>
          hasViolation(
            sleeveShape,
            "range",
            "$input.penetrations[0].position.x",
          ),
      ],
      [
        "sleeveRadius",
        () =>
          hasViolation(sleeveShape, "range", "$input.penetrations[2].radius"),
      ],
      [
        "capacityRefused",
        () =>
          hasViolation(unmeasurable, "range", "$input.systems[0].capacity") &&
          unmeasurable.success === false &&
          unmeasurable.violations.every(
            (item) => !item.expected.includes("of declared demand against"),
          ),
      ],
    ]),
    {
      portSystem: true,
      portId: true,
      nonFiniteDemand: true,
      sleevePosition: true,
      sleeveRadius: true,
      capacityRefused: true,
    },
  );
};
