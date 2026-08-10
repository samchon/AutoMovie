import {
  serviceNetworkSchematic,
  serviceSystemLoad,
  serviceSystemReach,
  validateServiceNetwork,
  validateWetZones,
} from "@automovie/engine";
import {
  AutoMovieServiceFlow,
  IAutoMovieServiceNetwork,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  nclose,
  validationHasNoWarnings,
  violationCount,
} from "../internal/predicates";
import {
  node,
  port,
  segment,
  serviceEnvironment,
  serviceNetwork,
  system,
  withPort,
} from "../internal/serviceFixtures";

const environment = serviceEnvironment();

/**
 * A recirculating hot water loop, wholly inside the plant room.
 *
 * Three fittings and three runs close on themselves: the heater emits, a riser
 * tee passes the medium on through a ring fitting, a tap draws from it, and the
 * return leg comes back into the heater. It stays in one logical space so that
 * nothing here answers for a wall crossing — the point under test is the cycle,
 * not the sleeve, and a fixture that needed both would not tell which one
 * failed.
 */
const circulation = (
  overrides: Partial<IAutoMovieServiceNetwork> = {},
): IAutoMovieServiceNetwork => ({
  version: 1,
  id: "plant-circulation",
  units: "meter",
  environment: "bathhouse",
  systems: [
    system({
      id: "loop",
      discipline: "plumbing",
      medium: "hot-water",
      unit: "cubic-meter-per-second",
      flow: "undirected",
      root: "heater",
      capacity: 0.01,
    }),
  ],
  nodes: [
    node({
      id: "heater",
      kind: "equipment",
      space: "plant",
      position: { x: 7.5, y: 1, z: 1 },
      ports: [
        port({
          id: "heater-flow",
          system: "loop",
          medium: "hot-water",
          direction: "out",
          section: 0.002,
          position: { x: 7.5, y: 1, z: 1 },
        }),
        port({
          id: "heater-return",
          system: "loop",
          medium: "hot-water",
          direction: "in",
          demand: 0.0005,
          section: 0.002,
          position: { x: 7.5, y: 1, z: 1 },
        }),
      ],
    }),
    node({
      id: "riser-tee",
      kind: "junction",
      space: "plant",
      position: { x: 7.5, y: 2.5, z: 1 },
      ports: [
        port({
          id: "riser-in",
          system: "loop",
          medium: "hot-water",
          direction: "in",
          section: 0.002,
          position: { x: 7.5, y: 2.5, z: 1 },
        }),
        port({
          id: "riser-ring",
          system: "loop",
          medium: "hot-water",
          direction: "bidirectional",
          section: 0.002,
          position: { x: 7.5, y: 2.5, z: 1 },
        }),
      ],
    }),
    node({
      id: "loop-tap",
      kind: "fixture",
      space: "plant",
      position: { x: 9, y: 2.5, z: 1 },
      state: { name: "throttled", opening: 0.5 },
      ports: [
        port({
          id: "tap-draw",
          system: "loop",
          medium: "hot-water",
          direction: "in",
          demand: 0.0002,
          section: 0.002,
          position: { x: 9, y: 2.5, z: 1 },
        }),
        port({
          id: "tap-return",
          system: "loop",
          medium: "hot-water",
          direction: "out",
          section: 0.002,
          position: { x: 9, y: 2.5, z: 1 },
        }),
      ],
    }),
  ],
  segments: [
    segment({
      id: "flow-riser",
      system: "loop",
      from: "heater-flow",
      to: "riser-in",
      route: [
        { x: 7.5, y: 1, z: 1 },
        { x: 7.5, y: 2.5, z: 1 },
      ],
      radius: 0.02,
      section: 0.002,
    }),
    segment({
      id: "flow-branch",
      system: "loop",
      from: "riser-ring",
      to: "tap-draw",
      route: [
        { x: 7.5, y: 2.5, z: 1 },
        { x: 9, y: 2.5, z: 1 },
      ],
      radius: 0.02,
      section: 0.002,
    }),
    segment({
      id: "return-leg",
      system: "loop",
      from: "tap-return",
      to: "heater-return",
      route: [
        { x: 9, y: 2.5, z: 1 },
        { x: 9, y: 1, z: 1 },
        { x: 7.5, y: 1, z: 1 },
      ],
      radius: 0.02,
      section: 0.002,
    }),
  ],
  penetrations: [],
  zones: [],
  ...overrides,
});

/** The same loop declared to be traversed in one named direction. */
const flowing = (flow: AutoMovieServiceFlow): IAutoMovieServiceNetwork =>
  circulation({
    systems: circulation().systems.map((entry) => ({ ...entry, flow })),
  });

/**
 * A circulation network closes on itself, and every rule that walks the graph
 * has to survive that.
 *
 * Supply, drainage, vent, power, air and fire suppression are all trees: one
 * root, one path to each fitting, and a walk that ends because it runs out of
 * edges. A recirculating leg is the case that is not — the medium leaves the
 * plant, is drawn from on the way round, and comes back into the machine it
 * left. That is a cycle in the node graph, so reachability has to terminate on
 * its own rather than on the shape of the data, the ring fitting has to be a
 * port a run may both leave and arrive at, and the load has to be counted once
 * however many times the walk passes the tap.
 *
 * The loop is deliberately its own network rather than another branch of the
 * bathhouse: a cycle mixed into a tree would be validated alongside nine runs
 * that could each explain a failure, and this file would stop naming the thing
 * it is about.
 *
 * Scenarios:
 *
 * 1. The closed loop validates clean on both the graph and its (empty) wet zones,
 *    carrying no warnings.
 * 2. The walk terminates and reaches all three fittings whichever direction the
 *    system declares — a ring reads the same forwards, backwards and either
 *    way, which is what makes it a circulation rather than a dead leg.
 * 3. The ring fitting is a port a run leaves, which no other case in this suite
 *    exercises; turning it into a consumer refuses that run and nothing else.
 * 4. A bidirectional consumer is accepted at the far end too, and is counted at
 *    neither end of the load, so the ring's declared total drops by the tap's
 *    own draw.
 * 5. The load is the 0.0007 m³/s its two inlets declare, and a capacity below it
 *    is refused with the measured overshoot.
 * 6. The schematic reports the ring as three nodes, three edges and 6 m of pipe,
 *    with nothing unreached.
 * 7. Breaking the return leg leaves exactly the two stubs it orphans; the walk
 *    still reaches every fitting, which is precisely why a stub and an orphan
 *    are separate findings.
 * 8. The tree the rest of the suite is built on has no cycle at all, so the ring
 *    is a case this fixture could not have been standing in for.
 */
export const test_service_circulation_loop = (): void => {
  const loop = circulation();

  TestValidator.predicate(
    "a loop that returns to the machine it left validates clean",
    validationHasNoWarnings(
      "circulation graph",
      validateServiceNetwork({ network: loop, environment }),
    ) &&
      validationHasNoWarnings(
        "circulation zones",
        validateWetZones({ network: loop, environment }),
      ),
  );

  TestValidator.equals(
    "the walk closes rather than running, whichever way the ring is read",
    namedFacts([
      [
        "undirected",
        () =>
          serviceSystemReach({ network: loop, system: "loop" }).join() ===
          "heater,riser-tee,loop-tap",
      ],
      [
        "fromRoot",
        () =>
          serviceSystemReach({
            network: flowing("from-root"),
            system: "loop",
          }).join() === "heater,riser-tee,loop-tap",
      ],
      [
        "toRoot",
        () =>
          serviceSystemReach({
            network: flowing("to-root"),
            system: "loop",
          }).join() === "heater,riser-tee,loop-tap",
      ],
      [
        "everyDirectionValidates",
        () =>
          (["from-root", "to-root", "undirected"] as const).every(
            (flow) =>
              validateServiceNetwork({ network: flowing(flow), environment })
                .success,
          ),
      ],
    ]),
    {
      undirected: true,
      fromRoot: true,
      toRoot: true,
      everyDirectionValidates: true,
    },
  );

  const consumingRing = validateServiceNetwork({
    network: withPort(loop, "riser-ring", (entry) => ({
      ...entry,
      direction: "in",
    })),
    environment,
  });
  const ringConsumer = withPort(loop, "tap-draw", (entry) => ({
    ...entry,
    direction: "bidirectional",
  }));
  TestValidator.equals(
    "a ring fitting is a port a run may leave and a port a run may enter",
    namedFacts([
      [
        "leavingRefused",
        () =>
          hasViolation(consumingRing, "type", "$input.segments[1].from") &&
          violationCount(consumingRing) === 1,
      ],
      [
        "enteringAccepted",
        () =>
          validateServiceNetwork({ network: ringConsumer, environment })
            .success,
      ],
      [
        "countedAtNeitherEnd",
        () =>
          nclose(
            serviceSystemLoad({
              network: ringConsumer,
              system: ringConsumer.systems[0]!,
            }),
            0.0005,
            1e-15,
          ),
      ],
    ]),
    {
      leavingRefused: true,
      enteringAccepted: true,
      countedAtNeitherEnd: true,
    },
  );

  const starved = validateServiceNetwork({
    network: circulation({
      systems: circulation().systems.map((entry) => ({
        ...entry,
        capacity: 0.0004,
      })),
    }),
    environment,
  });
  TestValidator.equals(
    "the ring is loaded once by each inlet, however often the walk passes it",
    namedFacts([
      [
        "load",
        () =>
          nclose(
            serviceSystemLoad({ network: loop, system: loop.systems[0]! }),
            0.0007,
            1e-15,
          ),
      ],
      [
        "refused",
        () => hasViolation(starved, "range", "$input.systems[0].capacity"),
      ],
      [
        "overshoot",
        () =>
          starved.success === false &&
          starved.violations.some((item) =>
            nclose(item.overshoot ?? -1, 0.0003, 1e-15),
          ),
      ],
      ["alone", () => violationCount(starved) === 1],
    ]),
    { load: true, refused: true, overshoot: true, alone: true },
  );

  const schematic = serviceNetworkSchematic({ network: loop, system: "loop" });
  TestValidator.equals(
    "the ring draws as a ring, with its own hand-computed totals",
    namedFacts([
      [
        "nodes",
        () =>
          schematic.nodes.map((entry) => entry.id).join() ===
          "heater,riser-tee,loop-tap",
      ],
      [
        "edges",
        () =>
          schematic.edges.map((edge) => edge.id).join() ===
          "flow-riser,flow-branch,return-leg",
      ],
      [
        "closes",
        () =>
          schematic.edges[2]!.from === "loop-tap" &&
          schematic.edges[2]!.to === "heater",
      ],
      ["totalLength", () => nclose(schematic.totalLength, 6, 1e-12)],
      ["totalDemand", () => nclose(schematic.totalDemand, 0.0007, 1e-15)],
      ["unreachable", () => schematic.unreachable.length === 0],
    ]),
    {
      nodes: true,
      edges: true,
      closes: true,
      totalLength: true,
      totalDemand: true,
      unreachable: true,
    },
  );

  const opened = circulation({
    segments: circulation().segments.filter(
      (entry) => entry.id !== "return-leg",
    ),
  });
  const broken = validateServiceNetwork({ network: opened, environment });
  TestValidator.equals(
    "breaking the return leaves stubs, not orphans, because the walk still arrives",
    namedFacts([
      [
        "heaterStub",
        () => hasViolation(broken, "type", "$input.nodes[0].ports[1]"),
      ],
      [
        "tapStub",
        () => hasViolation(broken, "type", "$input.nodes[2].ports[1]"),
      ],
      ["exactly", () => violationCount(broken) === 2],
      [
        "stillReached",
        () =>
          serviceSystemReach({ network: opened, system: "loop" }).join() ===
          "heater,riser-tee,loop-tap",
      ],
    ]),
    { heaterStub: true, tapStub: true, exactly: true, stillReached: true },
  );

  const spanning = (network: IAutoMovieServiceNetwork, id: string): boolean =>
    network.segments.filter((run) => run.system === id).length ===
    serviceSystemReach({ network, system: id }).length - 1;
  TestValidator.equals(
    "the tree this suite is otherwise built on could not have stood in for a ring",
    namedFacts([
      [
        "bathhouseIsATree",
        () =>
          serviceNetwork().systems.every((entry) =>
            spanning(serviceNetwork(), entry.id),
          ),
      ],
      ["ringIsNot", () => !spanning(loop, "loop")],
    ]),
    { bathhouseIsATree: true, ringIsNot: true },
  );
};
