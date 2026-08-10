import {
  AutoMovieServiceDiscipline,
  AutoMovieServiceMedium,
  AutoMovieServiceNodeKind,
  AutoMovieServiceUnit,
  IAutoMovieBuiltEnvironment,
  IAutoMoviePropBox,
  IAutoMovieServiceNetwork,
  IAutoMovieServiceNode,
  IAutoMovieServicePort,
  IAutoMovieServiceSegment,
  IAutoMovieServiceSystem,
} from "@automovie/interface";

import { propBoundsOverlap } from "../film/propPlacement";

/** One clashing pair of runs, in the order the network declares them. */
export interface IAutoMovieServiceClash {
  /** Id of the earlier-declared segment. */
  left: string;
  /** Id of the later-declared segment. */
  right: string;
}

/** One node in a plan schematic, projected onto the horizontal plane. */
export interface IAutoMovieServiceSchematicNode {
  /** Stable node identity. */
  id: string;
  /** Computational family the node was declared with. */
  kind: AutoMovieServiceNodeKind;
  /** World `x` in metres. */
  x: number;
  /** World `z` in metres, the schematic's vertical axis. */
  y: number;
}

/** One run in a plan schematic, projected onto the horizontal plane. */
export interface IAutoMovieServiceSchematicEdge {
  /** Stable segment identity. */
  id: string;
  /** Node the run leaves. */
  from: string;
  /** Node the run enters. */
  to: string;
  /** Projected centre line, in declaration order. */
  points: Array<{ x: number; y: number }>;
  /** Developed length of the **unprojected** centre line, in metres. */
  length: number;
}

/**
 * One system reduced to the drawing an operator can actually read.
 *
 * The schematic is derived, never authored: it is the evidence that the graph
 * the validator accepted is the graph the production meant, at a size a report
 * can carry.
 */
export interface IAutoMovieServiceSchematic {
  /** Identity of the system this schematic projects. */
  system: string;
  /** Discipline the system declared. */
  discipline: AutoMovieServiceDiscipline;
  /** Medium the system declared. */
  medium: AutoMovieServiceMedium;
  /** Unit every demand below is stated in. */
  unit: AutoMovieServiceUnit;
  /** Node the system is rooted at. */
  root: string;
  /** Every node carrying a port on the system, in declaration order. */
  nodes: IAutoMovieServiceSchematicNode[];
  /** Every run on the system, in declaration order. */
  edges: IAutoMovieServiceSchematicEdge[];
  /** Sum of every edge's developed length, in metres. */
  totalLength: number;
  /** Declared load of the system in {@link unit}; see {@link serviceSystemLoad}. */
  totalDemand: number;
  /** Nodes on the system the root does not reach, in declaration order. */
  unreachable: string[];
}

/** What an analysis of this network can and cannot answer today. */
export interface IAutoMovieServiceCheckReport {
  /** Stable rule identity. */
  check: string;
  /**
   * `supported` when the engine really performs the check on this input;
   * `unsupported` when nothing here can perform it. A supported check that was
   * simply not executed is never reported as either.
   */
  status: "supported" | "unsupported";
  /** Why it is or is not answerable, naming what is missing when it is not. */
  reason: string;
}

/**
 * The world volume one run occupies, span by span.
 *
 * Each straight leg of the centre line gets its own box grown by the run's
 * radius, because one box around a whole polyline is not a pipe: a run that
 * drops, turns and crosses a building would claim the entire cuboid those three
 * legs span and clash with everything inside it. Per-span boxes stay tight on
 * orthogonal routing, which is how distribution is actually run, and remain
 * conservative on a diagonal — a bias that reports a near miss rather than
 * missing a real interference.
 *
 * A route with fewer than two points has no span and yields nothing to compare;
 * the validator refuses that route on its own path.
 *
 * @author Samchon
 */
export const serviceSegmentSpanBounds = (
  segment: IAutoMovieServiceSegment,
): IAutoMoviePropBox[] => {
  const spans: IAutoMoviePropBox[] = [];
  const pad = segment.radius;
  for (let index = 0; index + 1 < segment.route.length; ++index) {
    const one = segment.route[index]!;
    const next = segment.route[index + 1]!;
    spans.push({
      min: {
        x: Math.min(one.x, next.x) - pad,
        y: Math.min(one.y, next.y) - pad,
        z: Math.min(one.z, next.z) - pad,
      },
      max: {
        x: Math.max(one.x, next.x) + pad,
        y: Math.max(one.y, next.y) + pad,
        z: Math.max(one.z, next.z) + pad,
      },
    });
  }
  return spans;
};

/**
 * The single world volume a whole run is contained by.
 *
 * This is the broad-phase companion to {@link serviceSegmentSpanBounds}: one box
 * a caller can index, cull or draw a bounding volume from without walking every
 * leg. Interference is decided on the spans, never on this.
 *
 * @author Samchon
 */
export const serviceSegmentBounds = (
  segment: IAutoMovieServiceSegment,
): IAutoMoviePropBox => {
  const first = segment.route[0];
  if (first === undefined)
    throw new Error(
      `service segment "${segment.id}" has no route to take a bound from`,
    );
  const min = { x: first.x, y: first.y, z: first.z };
  const max = { x: first.x, y: first.y, z: first.z };
  for (const point of segment.route)
    for (const axis of ["x", "y", "z"] as const) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  return {
    min: {
      x: min.x - segment.radius,
      y: min.y - segment.radius,
      z: min.z - segment.radius,
    },
    max: {
      x: max.x + segment.radius,
      y: max.y + segment.radius,
      z: max.z + segment.radius,
    },
  };
};

/**
 * The world keep-out volume a node needs to be serviced, or `null`.
 *
 * The authored box is node-local so that moving the equipment moves the space
 * it is opened in; a world box authored beside a world position would let the
 * two drift apart with no way to tell which one was meant.
 *
 * @author Samchon
 */
export const serviceMaintenanceBounds = (
  node: IAutoMovieServiceNode,
): IAutoMoviePropBox | null =>
  node.maintenance === null
    ? null
    : {
        min: {
          x: node.position.x + node.maintenance.min.x,
          y: node.position.y + node.maintenance.min.y,
          z: node.position.z + node.maintenance.min.z,
        },
        max: {
          x: node.position.x + node.maintenance.max.x,
          y: node.position.y + node.maintenance.max.y,
          z: node.position.z + node.maintenance.max.z,
        },
      };

/**
 * Which nodes one system's root actually reaches.
 *
 * Reachability is what separates a drawn network from a working one, and its
 * direction is the system's own: a supply main is walked forward from the root,
 * a drainage stack backward into it, a ring either way. The answer is returned
 * in declaration order so two runs of the same design produce the same list.
 *
 * `closedValvesBlock` is the difference between the design question and the
 * operating one. Left off — the default — an isolating valve is walked straight
 * through, because a valve someone happened to shut is not a design defect.
 * Set, a node whose state passes nothing stops the walk at itself: it is still
 * reached, everything beyond it is not, and that is how a shut-off is shown to
 * isolate what it was installed to isolate.
 *
 * A system whose root does not resolve reaches nothing rather than reaching a
 * name; the validator owns reporting the dangling root itself.
 *
 * @author Samchon
 */
export const serviceSystemReach = (props: {
  network: IAutoMovieServiceNetwork;
  system: string;
  closedValvesBlock?: boolean;
}): string[] => {
  const system = requireSystem(props.network, props.system);
  const nodes = new Map(props.network.nodes.map((node) => [node.id, node]));
  if (!nodes.has(system.root)) return [];

  const owner = portOwners(props.network);
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const segment of props.network.segments) {
    if (segment.system !== system.id) continue;
    const from = owner.get(segment.from);
    const to = owner.get(segment.to);
    if (from === undefined || to === undefined) continue;
    push(forward, from.id, to.id);
    push(backward, to.id, from.id);
  }

  const blocks = props.closedValvesBlock === true;
  const reached = new Set<string>([system.root]);
  const queue: string[] = [system.root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodes.get(current)!;
    if (blocks && node.state !== null && node.state.opening === 0) continue;
    const next =
      system.flow === "from-root"
        ? (forward.get(current) ?? [])
        : system.flow === "to-root"
          ? (backward.get(current) ?? [])
          : [...(forward.get(current) ?? []), ...(backward.get(current) ?? [])];
    for (const candidate of next)
      if (!reached.has(candidate)) {
        reached.add(candidate);
        queue.push(candidate);
      }
  }
  return props.network.nodes
    .filter((node) => reached.has(node.id))
    .map((node) => node.id);
};

/**
 * Total demand one system is declared to carry, in the system's own unit.
 *
 * The load is read at the ports facing **opposite to the root**, because that
 * is the end a system is loaded from. A supply main, a lighting circuit and a
 * supply air trunk are loaded by what their `in` ports draw; a drainage stack,
 * a return riser and an exhaust are loaded by what their `out` ports discharge.
 * Summing `in` ports for every system would leave every `to-root` system
 * measured against a load of zero — a capacity check that cannot fail is worse
 * than none, because it reads as one that passed.
 *
 * A fitting merely passing the medium on — a tee, a valve, a damper — declares
 * `0` and contributes nothing, so the water that reaches a basin through a
 * shut-off is counted where the basin draws it and not again at the valve. A
 * `bidirectional` port is counted at neither end: it is the fitting on a ring
 * that may be fed from either side, and a tap's draw is stated on the port that
 * draws it rather than on the ring it hangs off.
 *
 * This is a declaration check and nothing more. No diversity, no simultaneity
 * and no head loss enter it; `serviceAnalysisSupport` names the solver that
 * would as `unsupported`.
 *
 * @author Samchon
 */
export const serviceSystemLoad = (props: {
  network: IAutoMovieServiceNetwork;
  system: IAutoMovieServiceSystem;
}): number => {
  const facing = props.system.flow === "to-root" ? "out" : "in";
  return props.network.nodes.reduce(
    (sum, node) =>
      sum +
      node.ports
        .filter(
          (port) =>
            port.system === props.system.id && port.direction === facing,
        )
        .reduce((total, port) => total + port.demand, 0),
    0,
  );
};

/**
 * Every pair of runs whose occupied volumes overlap.
 *
 * Two runs that meet at a node are exempt, and only there: a tee and its branch
 * share a fitting by construction, so reporting them would bury the pair that
 * matters under the pairs that always happen. Everything else is a clash
 * whether or not the two belong to the same discipline, because a duct and a
 * cable tray cannot share a cubic metre any more than two ducts can.
 *
 * @author Samchon
 */
export const serviceSegmentClashes = (
  network: IAutoMovieServiceNetwork,
): IAutoMovieServiceClash[] => {
  const owner = portOwners(network);
  const measurable = network.segments.filter(
    (segment) => segment.route.length > 1,
  );
  const spans = measurable.map((segment) => serviceSegmentSpanBounds(segment));
  const touched = measurable.map(
    (segment) =>
      new Set(
        [owner.get(segment.from), owner.get(segment.to)]
          .filter((node): node is IAutoMovieServiceNode => node !== undefined)
          .map((node) => node.id),
      ),
  );
  const clashes: IAutoMovieServiceClash[] = [];
  for (let left = 0; left < measurable.length; ++left)
    for (let right = left + 1; right < measurable.length; ++right) {
      if ([...touched[left]!].some((id) => touched[right]!.has(id))) continue;
      const hit = spans[left]!.some((one) =>
        spans[right]!.some((other) => propBoundsOverlap(one, other)),
      );
      if (hit)
        clashes.push({
          left: measurable[left]!.id,
          right: measurable[right]!.id,
        });
    }
  return clashes;
};

/**
 * Which nodes' maintenance envelopes a world volume intrudes on.
 *
 * This is the seam a prop, a piece of furniture or a second discipline is
 * compared through: hand it any axis-aligned world box — a staged prop's
 * occupancy bound, for instance — and it names the equipment that could no
 * longer be serviced. Contact alone is not intrusion, so a cabinet standing
 * exactly on the edge of an access zone is left alone.
 *
 * @author Samchon
 */
export const serviceEnvelopeObstructions = (props: {
  network: IAutoMovieServiceNetwork;
  bounds: IAutoMoviePropBox;
}): string[] =>
  props.network.nodes
    .filter((node) => {
      const envelope = serviceMaintenanceBounds(node);
      return envelope !== null && propBoundsOverlap(props.bounds, envelope);
    })
    .map((node) => node.id);

/**
 * Project one system to a plan schematic with its totals.
 *
 * Lengths are measured on the authored 3D centre line and only the drawing is
 * flattened, so a riser does not silently become a point of zero pipe. Demand
 * is the system's own declared load, read in the direction the system flows by
 * {@link serviceSystemLoad}, so a drainage stack reports what it carries rather
 * than the zero a supply-shaped reading would give it.
 *
 * @author Samchon
 */
export const serviceNetworkSchematic = (props: {
  network: IAutoMovieServiceNetwork;
  system: string;
}): IAutoMovieServiceSchematic => {
  const system = requireSystem(props.network, props.system);
  const owner = portOwners(props.network);
  const nodes = props.network.nodes.filter((node) =>
    node.ports.some((port) => port.system === system.id),
  );
  const edges = props.network.segments
    .filter((segment) => segment.system === system.id)
    .map((segment) => ({
      id: segment.id,
      from: owner.get(segment.from)?.id ?? segment.from,
      to: owner.get(segment.to)?.id ?? segment.to,
      points: segment.route.map((point) => ({ x: point.x, y: point.z })),
      length: routeLength(segment),
    }));
  const reached = new Set(
    serviceSystemReach({ network: props.network, system: system.id }),
  );
  return {
    system: system.id,
    discipline: system.discipline,
    medium: system.medium,
    unit: system.unit,
    root: system.root,
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      x: node.position.x,
      y: node.position.z,
    })),
    edges,
    totalLength: edges.reduce((sum, edge) => sum + edge.length, 0),
    totalDemand: serviceSystemLoad({ network: props.network, system }),
    unreachable: nodes
      .filter((node) => !reached.has(node.id))
      .map((node) => node.id),
  };
};

/**
 * State plainly which analyses this network and this building can answer.
 *
 * A record existing is not an analysis, and the honest way to say so is to say
 * so. The structural rules below are the ones the engine really performs; the
 * per-discipline entries are the quantitative questions nothing here solves,
 * listed once for each discipline the network actually declares so a report
 * names the missing solver rather than implying a pass.
 *
 * The building is required rather than optional because two of these answers
 * depend on it. A crossing is read off logical space volumes, so a building
 * whose partitions are names with no cells cannot be asked where a run left a
 * room; a sleeve is placed on its boundary's own face, so a boundary written
 * before faces existed cannot be asked where its holes are. Saying `supported`
 * in either case would be the dressing-up this report exists to prevent.
 *
 * @author Samchon
 */
export const serviceAnalysisSupport = (props: {
  network: IAutoMovieServiceNetwork;
  environment: IAutoMovieBuiltEnvironment;
}): IAutoMovieServiceCheckReport[] => {
  const disciplines: AutoMovieServiceDiscipline[] = [];
  for (const system of props.network.systems)
    if (!disciplines.includes(system.discipline))
      disciplines.push(system.discipline);
  const located = props.environment.spaces.some(
    (space) => space.cells.length > 0,
  );
  // A boundary that does not resolve is faceless too, and naming the boundary
  // the sleeve claimed is more use than naming nothing; the validator reports
  // the dangling reference itself, on its own path.
  const faceless = props.network.penetrations.find(
    (sleeve) =>
      props.environment.boundaries.find(
        (boundary) => boundary.id === sleeve.boundary,
      )?.face === undefined,
  )?.boundary;
  return [
    {
      check: "port-connectivity",
      status: "supported",
      reason:
        "every port is required to carry a run and every node to be reached from its system root",
    },
    {
      check: "medium-direction-unit",
      status: "supported",
      reason:
        "a port must repeat its system's medium and unit, and a run must leave an out port and enter an in port",
    },
    {
      check: "segment-clash",
      status: "supported",
      reason:
        "runs are compared as axis-aligned swept volumes, exempt only where they meet at a shared node",
    },
    {
      check: "maintenance-envelope",
      status: "supported",
      reason:
        "a node's access volume is checked against every run that does not terminate on it",
    },
    located
      ? {
          check: "fixture-placement",
          status: "supported",
          reason:
            "every node whose logical space declares a volume, and every port that node offers a run, is held inside it",
        }
      : {
          check: "fixture-placement",
          status: "unsupported",
          reason:
            "no logical space of this building declares a volume, so nothing can be shown to stand inside or outside one",
        },
    located
      ? {
          check: "boundary-penetration",
          status: "supported",
          reason:
            "a run leaving the logical space it was in must cite a sleeve on a boundary of one of those spaces",
        }
      : {
          check: "boundary-penetration",
          status: "unsupported",
          reason:
            "no logical space of this building declares a volume, so there is nothing a run can be seen to leave",
        },
    faceless === undefined
      ? {
          check: "penetration-on-boundary-face",
          status: "supported",
          reason:
            "every boundary a sleeve pierces carries a face, so each sleeve is held inside that face's outline and thickness",
        }
      : {
          check: "penetration-on-boundary-face",
          status: "unsupported",
          reason: `boundary "${faceless}" declares no face, so the sleeves through it can only be placed on the runs that cite them`,
        },
    {
      check: "waterproof-coverage",
      status: "supported",
      reason:
        "a wet zone must cover every boundary of its space and declare every handover to a drier one",
    },
    ...disciplines.map((discipline) => ({
      check: `${discipline}-performance`,
      status: "unsupported" as const,
      reason: `no ${discipline} solver runs here; capacity is compared against declared demand only, and pressure, head, voltage drop and throw are not computed`,
    })),
  ];
};

/** Developed length of a run's authored centre line, in metres. */
export const routeLength = (segment: IAutoMovieServiceSegment): number => {
  let total = 0;
  for (let index = 0; index + 1 < segment.route.length; ++index) {
    const one = segment.route[index]!;
    const next = segment.route[index + 1]!;
    total += Math.hypot(next.x - one.x, next.y - one.y, next.z - one.z);
  }
  return total;
};

/** Map every port id to the node that declares it, first declaration winning. */
export const portOwners = (
  network: IAutoMovieServiceNetwork,
): Map<string, IAutoMovieServiceNode> => {
  const owners = new Map<string, IAutoMovieServiceNode>();
  for (const node of network.nodes)
    for (const port of node.ports)
      if (!owners.has(port.id)) owners.set(port.id, node);
  return owners;
};

/** Map every port id to the port record itself, first declaration winning. */
export const portRecords = (
  network: IAutoMovieServiceNetwork,
): Map<string, IAutoMovieServicePort> => {
  const ports = new Map<string, IAutoMovieServicePort>();
  for (const node of network.nodes)
    for (const port of node.ports)
      if (!ports.has(port.id)) ports.set(port.id, port);
  return ports;
};

/**
 * Squared distance from a point to a run's centre line, in square metres.
 *
 * Squared because every caller compares it against a squared radius, and taking
 * the root first would only add a rounding step to a comparison that does not
 * need one.
 */
export const routeDistanceSquared = (
  segment: IAutoMovieServiceSegment,
  point: { x: number; y: number; z: number },
): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index + 1 < segment.route.length; ++index) {
    const one = segment.route[index]!;
    const next = segment.route[index + 1]!;
    const dx = next.x - one.x;
    const dy = next.y - one.y;
    const dz = next.z - one.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const t =
      lengthSquared === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              ((point.x - one.x) * dx +
                (point.y - one.y) * dy +
                (point.z - one.z) * dz) /
                lengthSquared,
            ),
          );
    const ex = one.x + dx * t - point.x;
    const ey = one.y + dy * t - point.y;
    const ez = one.z + dz * t - point.z;
    best = Math.min(best, ex * ex + ey * ey + ez * ez);
  }
  return best;
};

const requireSystem = (
  network: IAutoMovieServiceNetwork,
  id: string,
): IAutoMovieServiceSystem => {
  const system = network.systems.find((candidate) => candidate.id === id);
  if (system === undefined)
    throw new Error(`service network "${network.id}" has no system "${id}"`);
  return system;
};

const push = (map: Map<string, string[]>, key: string, value: string): void => {
  const bucket = map.get(key);
  if (bucket === undefined) map.set(key, [value]);
  else bucket.push(value);
};
