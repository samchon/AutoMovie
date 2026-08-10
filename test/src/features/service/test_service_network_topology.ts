import {
  serviceAnalysisSupport,
  serviceNetworkSchematic,
  serviceSystemReach,
  validateServiceNetwork,
  validateWetZones,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  throwsError,
  validationHasNoWarnings,
} from "../internal/predicates";
import {
  serviceEnvironment,
  serviceNetwork,
  withNode,
  withSystem,
} from "../internal/serviceFixtures";

/**
 * Water, drainage, vent, power, air and fire suppression are one graph, and the
 * question that graph exists to answer is "does the root reach everything".
 *
 * A rendered bathhouse cannot distinguish a basin joined to a stack from a
 * basin joined to nothing, so the evidence has to come from the topology
 * instead. This case pins that a network authored across seven systems and six
 * disciplines validates as one object, that each system's reach is walked in
 * its own direction — forward from a supply main, backward into a drainage
 * stack, both ways on a ring — and that the derived schematic reports the same
 * graph with hand-checkable totals.
 *
 * The valve is the point where a design question and an operating question
 * separate. Shutting one must not fail validation, because a closed valve is
 * not a defect, and it must still isolate exactly what stands beyond it when
 * the caller asks the operating question.
 *
 * Scenarios:
 *
 * 1. The multi-discipline fixture validates clean on both the graph and its wet
 *    zones, with no warnings riding along.
 * 2. Every system's reach is exactly the nodes carrying its ports, in declaration
 *    order, for all three flow directions.
 * 3. An undirected system reaches through a run in the direction opposite to the
 *    one it was authored in, which a `from-root` system does not.
 * 4. A shut valve leaves validation clean, is walked straight through by default,
 *    and isolates the basin when the operating question is asked.
 * 5. A system whose root does not resolve reaches nothing rather than reaching a
 *    name, and reach and schematic both refuse an unknown system id.
 * 6. The cold schematic reproduces the graph with hand-computed totals: three
 *    nodes, two edges, 8.6 m of run, 0.0002 m³/s of demand, nothing unreached.
 * 7. Support is reported honestly: the structural rules are `supported`, the
 *    boundary-face placement of a sleeve is `unsupported`, one performance
 *    entry per declared discipline is `unsupported` rather than absent, and the
 *    crossing check drops to `unsupported` for a building whose partitions
 *    declare no volume for a run to be seen leaving.
 */
export const test_service_network_topology = (): void => {
  const environment = serviceEnvironment();
  const network = serviceNetwork();

  TestValidator.predicate(
    "a seven-system network validates clean",
    validationHasNoWarnings(
      "service network",
      validateServiceNetwork({ network, environment }),
    ),
  );
  TestValidator.predicate(
    "its wet zones validate clean",
    validationHasNoWarnings(
      "wet zones",
      validateWetZones({ network, environment }),
    ),
  );

  TestValidator.equals(
    "each system reaches exactly the nodes carrying its ports",
    Object.fromEntries(
      network.systems.map((system) => [
        system.id,
        serviceSystemReach({ network, system: system.id }),
      ]),
    ),
    {
      cold: ["cold-main", "bath-valve", "basin"],
      hot: ["hot-main", "basin"],
      waste: ["stack", "basin", "waste-tee", "floor-gully"],
      vent: ["vent-head", "basin"],
      lighting: ["panel", "bath-light"],
      air: ["ahu", "hall-diffuser"],
      fire: ["fire-main", "sprinkler-head"],
    },
  );

  const ring = withSystem(network, "hot", (system) => ({
    ...system,
    flow: "undirected",
    root: "basin",
  }));
  const backwards = withSystem(network, "hot", (system) => ({
    ...system,
    root: "basin",
  }));
  TestValidator.equals(
    "an undirected system walks a run either way, a directed one does not",
    namedFacts([
      [
        "ring",
        () =>
          serviceSystemReach({ network: ring, system: "hot" }).join() ===
          "hot-main,basin",
      ],
      [
        "directed",
        () =>
          serviceSystemReach({ network: backwards, system: "hot" }).join() ===
          "basin",
      ],
    ]),
    { ring: true, directed: true },
  );

  const shut = withNode(network, "bath-valve", (node) => ({
    ...node,
    state: { name: "closed", opening: 0 },
  }));
  TestValidator.equals(
    "a shut valve is a design fact by default and an isolation on request",
    namedFacts([
      [
        "stillValid",
        () => validateServiceNetwork({ network: shut, environment }).success,
      ],
      [
        "designReach",
        () =>
          serviceSystemReach({ network: shut, system: "cold" }).join() ===
          "cold-main,bath-valve,basin",
      ],
      [
        "operatingReach",
        () =>
          serviceSystemReach({
            network: shut,
            system: "cold",
            closedValvesBlock: true,
          }).join() === "cold-main,bath-valve",
      ],
      [
        "openValvePasses",
        () =>
          serviceSystemReach({
            network,
            system: "cold",
            closedValvesBlock: true,
          }).join() === "cold-main,bath-valve,basin",
      ],
    ]),
    {
      stillValid: true,
      designReach: true,
      operatingReach: true,
      openValvePasses: true,
    },
  );

  const rootless = withSystem(network, "cold", (system) => ({
    ...system,
    root: "no-such-node",
  }));
  TestValidator.equals(
    "an unresolved root reaches nothing and an unknown system is refused",
    namedFacts([
      [
        "rootless",
        () =>
          serviceSystemReach({ network: rootless, system: "cold" }).length ===
          0,
      ],
      [
        "reachRefuses",
        () =>
          throwsError(
            () => serviceSystemReach({ network, system: "steam" }),
            ['has no system "steam"'],
          ),
      ],
      [
        "schematicRefuses",
        () =>
          throwsError(
            () => serviceNetworkSchematic({ network, system: "steam" }),
            ['has no system "steam"'],
          ),
      ],
    ]),
    { rootless: true, reachRefuses: true, schematicRefuses: true },
  );

  const schematic = serviceNetworkSchematic({ network, system: "cold" });
  TestValidator.equals(
    "the cold schematic is the same graph in plan, with its own totals",
    namedFacts([
      ["discipline", () => schematic.discipline === "plumbing"],
      ["unit", () => schematic.unit === "cubic-meter-per-second"],
      ["root", () => schematic.root === "cold-main"],
      [
        "nodes",
        () =>
          schematic.nodes.map((entry) => entry.id).join() ===
          "cold-main,bath-valve,basin",
      ],
      [
        "plan",
        () =>
          schematic.nodes[0]!.x === 8 &&
          schematic.nodes[0]!.y === 1 &&
          schematic.nodes[0]!.kind === "source",
      ],
      [
        "edges",
        () =>
          schematic.edges.map((edge) => edge.id).join() ===
          "cold-run,cold-branch",
      ],
      [
        "endpoints",
        () =>
          schematic.edges[1]!.from === "bath-valve" &&
          schematic.edges[1]!.to === "basin",
      ],
      ["projected", () => schematic.edges[1]!.points.length === 3],
      ["runLength", () => nclose(schematic.edges[0]!.length, 4.5, 1e-12)],
      ["branchLength", () => nclose(schematic.edges[1]!.length, 4.1, 1e-12)],
      ["totalLength", () => nclose(schematic.totalLength, 8.6, 1e-12)],
      ["totalDemand", () => nclose(schematic.totalDemand, 0.0002, 1e-15)],
      ["unreachable", () => schematic.unreachable.length === 0],
    ]),
    {
      discipline: true,
      unit: true,
      root: true,
      nodes: true,
      plan: true,
      edges: true,
      endpoints: true,
      projected: true,
      runLength: true,
      branchLength: true,
      totalLength: true,
      totalDemand: true,
      unreachable: true,
    },
  );

  const broken = serviceNetworkSchematic({
    network: {
      ...network,
      segments: network.segments.map((entry) =>
        entry.id === "cold-run"
          ? { ...entry, from: "ghost", to: "phantom" }
          : entry,
      ),
    },
    system: "cold",
  });
  TestValidator.equals(
    "a schematic over a broken graph names the port it could not resolve",
    namedFacts([
      ["from", () => broken.edges[0]!.from === "ghost"],
      ["to", () => broken.edges[0]!.to === "phantom"],
      ["orphaned", () => broken.unreachable.join() === "bath-valve,basin"],
    ]),
    { from: true, to: true, orphaned: true },
  );

  const support = serviceAnalysisSupport({ network, environment });
  TestValidator.equals(
    "what cannot be answered is named rather than implied",
    namedFacts([
      ["count", () => support.length === 12],
      [
        "structural",
        () =>
          support
            .filter((entry) => entry.status === "supported")
            .map((entry) => entry.check)
            .join() ===
          "port-connectivity,medium-direction-unit,segment-clash,maintenance-envelope,boundary-penetration,waterproof-coverage",
      ],
      [
        "crossingUnsupportedWithoutVolumes",
        () =>
          serviceAnalysisSupport({
            network,
            environment: {
              ...environment,
              spaces: environment.spaces.map((space) => ({
                ...space,
                cells: [],
              })),
            },
          }).some(
            (entry) =>
              entry.check === "boundary-penetration" &&
              entry.status === "unsupported",
          ),
      ],
      [
        "boundaryFace",
        () =>
          support.some(
            (entry) =>
              entry.check === "penetration-on-boundary-face" &&
              entry.status === "unsupported" &&
              entry.reason.includes("no surface geometry"),
          ),
      ],
      [
        "perDiscipline",
        () =>
          support
            .filter((entry) => entry.check.endsWith("-performance"))
            .map((entry) => entry.check)
            .join() ===
          "plumbing-performance,drainage-performance,electrical-performance,hvac-performance,fire-performance",
      ],
      [
        "noSolver",
        () =>
          support
            .filter((entry) => entry.check.endsWith("-performance"))
            .every((entry) => entry.status === "unsupported"),
      ],
    ]),
    {
      count: true,
      structural: true,
      crossingUnsupportedWithoutVolumes: true,
      boundaryFace: true,
      perDiscipline: true,
      noSolver: true,
    },
  );
};
