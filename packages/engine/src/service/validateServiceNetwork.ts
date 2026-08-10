import {
  AutoMovieServiceDiscipline,
  AutoMovieServiceMedium,
  AutoMovieServiceUnit,
  IAutoMovieBuiltEnvironment,
  IAutoMovieServiceNetwork,
  IAutoMovieServiceSegment,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { builtEnvironmentContainsPoint } from "../architecture/builtEnvironment";
import {
  propBoundsOverlap,
  propSpaceContainsBounds,
} from "../film/propPlacement";
import { ViolationCollector } from "../validation/violation";
import {
  portRecords,
  routeDistanceSquared,
  serviceMaintenanceBounds,
  serviceSegmentClashes,
  serviceSegmentSpanBounds,
  serviceSystemReach,
} from "./serviceNetwork";

/** Tolerance for fit and coincidence comparisons, in metres. */
const SERVICE_EPSILON = 1e-9;

/** Tolerance for a run's end standing on the port it joins, in metres. */
const ENDPOINT_EPSILON = 1e-6;

const DISCIPLINES: readonly AutoMovieServiceDiscipline[] = [
  "plumbing",
  "drainage",
  "electrical",
  "data",
  "hvac",
  "fire",
  "control",
];
const FLOWS = ["from-root", "to-root", "undirected"] as const;
const DIRECTIONS = ["in", "out", "bidirectional"] as const;
const NODE_KINDS = [
  "source",
  "fixture",
  "equipment",
  "terminal",
  "junction",
  "valve",
] as const;

/**
 * Which media each discipline is allowed to carry.
 *
 * `other` sits in every row on purpose: it is the escape a production carrying
 * medical gas, vacuum or compressed air takes, and it opts out of the unit
 * check with it rather than forcing this table to grow before the production
 * can be authored at all.
 */
const DISCIPLINE_MEDIA: Record<
  AutoMovieServiceDiscipline,
  readonly AutoMovieServiceMedium[]
> = {
  plumbing: ["cold-water", "hot-water", "other"],
  drainage: ["waste-water", "vent-air", "other"],
  electrical: ["electric-power", "other"],
  data: ["data-signal", "other"],
  hvac: ["supply-air", "return-air", "exhaust-air", "other"],
  fire: ["fire-water", "control-signal", "other"],
  control: ["control-signal", "other"],
};

/** Which units each medium may be measured in; `other` accepts any of them. */
const MEDIUM_UNITS: Record<
  AutoMovieServiceMedium,
  readonly AutoMovieServiceUnit[]
> = {
  "cold-water": ["cubic-meter-per-second"],
  "hot-water": ["cubic-meter-per-second"],
  "waste-water": ["cubic-meter-per-second"],
  "fire-water": ["cubic-meter-per-second"],
  "vent-air": ["cubic-meter-per-second"],
  "supply-air": ["cubic-meter-per-second"],
  "return-air": ["cubic-meter-per-second"],
  "exhaust-air": ["cubic-meter-per-second"],
  "electric-power": ["watt", "ampere"],
  "data-signal": ["bit-per-second"],
  "control-signal": ["dimensionless"],
  other: [
    "cubic-meter-per-second",
    "watt",
    "ampere",
    "bit-per-second",
    "dimensionless",
  ],
};

/**
 * Validate the distribution graph of a built environment: its structure, its
 * media, its geometry, and the space it needs to stay serviceable.
 *
 * A scene can be furnished with taps, sprinkler heads, diffusers and outlets
 * and still be a set: nothing in a frame distinguishes a basin joined to a
 * stack from a basin joined to nothing. This is the tier that tells them apart,
 * and it is deliberately structural rather than quantitative. It answers
 * whether the graph is whole — every port carrying a run, every node reached
 * from its system's root, every medium and unit repeated consistently, every
 * run leaving an emitter and arriving at a consumer, every wall crossing
 * declared, and nothing occupying another discipline's cubic metre or an
 * engineer's access space. It does not answer head loss, voltage drop or duct
 * pressure; `serviceAnalysisSupport` names those as `unsupported` rather than
 * letting a clean result imply they passed.
 *
 * The network is checked **against** an environment rather than nested inside
 * one. Every architectural name it repeats — a logical space, an element, a
 * boundary, an opening — is resolved here, which is the one place the two
 * records meet and therefore the only place they can be shown to agree.
 *
 * @author Samchon
 */
export const validateServiceNetwork = (props: {
  network: IAutoMovieServiceNetwork;
  environment: IAutoMovieBuiltEnvironment;
}): IAutoMovieValidation => {
  const { network, environment } = props;
  const out = new ViolationCollector();
  const root = "$input";

  nonEmpty(network.id, `${root}.id`, "service network id", out);
  if (network.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `service network schema version must be 1, but was ${network.version}`,
      network.version,
    );
  if (network.units !== "meter")
    out.push(
      "type",
      `${root}.units`,
      `service network units must be "meter", but was ${String(network.units)}`,
      network.units,
    );
  if (network.environment !== environment.id)
    out.push(
      "type",
      `${root}.environment`,
      `service network must cite its served built environment "${environment.id}"`,
      network.environment,
    );

  const spaceIds = new Set(environment.spaces.map((space) => space.id));
  const elementIds = new Set(environment.elements.map((item) => item.id));
  const boundaryIds = new Set(
    environment.boundaries.map((boundary) => boundary.id),
  );
  const openings = new Map(
    environment.openings.map((opening) => [opening.id, opening]),
  );

  collectIds(network.nodes, `${root}.nodes`, "service node", out);
  collectIds(network.systems, `${root}.systems`, "service system", out);
  collectIds(network.segments, `${root}.segments`, "service segment", out);
  const penetrationIds = collectIds(
    network.penetrations,
    `${root}.penetrations`,
    "service penetration",
    out,
  );
  const systems = new Map(
    network.systems.map((system) => [system.id, system] as const),
  );
  const ports = portRecords(network);

  network.systems.forEach((system, index) => {
    const path = `${root}.systems[${index}]`;
    if (!DISCIPLINES.includes(system.discipline))
      out.push(
        "type",
        `${path}.discipline`,
        `unknown service discipline "${String(system.discipline)}"`,
        system.discipline,
      );
    else if (!DISCIPLINE_MEDIA[system.discipline].includes(system.medium))
      out.push(
        "type",
        `${path}.medium`,
        `discipline "${system.discipline}" carries one of ${DISCIPLINE_MEDIA[
          system.discipline
        ].join(", ")}, but the system declared "${String(system.medium)}"`,
        system.medium,
      );
    const units = MEDIUM_UNITS[system.medium];
    if (units === undefined)
      out.push(
        "type",
        `${path}.medium`,
        `unknown service medium "${String(system.medium)}"`,
        system.medium,
      );
    else if (!units.includes(system.unit))
      out.push(
        "type",
        `${path}.unit`,
        `medium "${system.medium}" is measured in ${units.join(
          " or ",
        )}, but the system declared "${String(system.unit)}"`,
        system.unit,
      );
    if (!FLOWS.includes(system.flow))
      out.push(
        "type",
        `${path}.flow`,
        `unknown service flow "${String(system.flow)}"`,
        system.flow,
      );
    positive(system.capacity, `${path}.capacity`, "system capacity", out);

    const rootNode = network.nodes.find((node) => node.id === system.root);
    if (rootNode === undefined) {
      out.push(
        "type",
        `${path}.root`,
        `system root node "${system.root}" does not resolve`,
        system.root,
      );
      return;
    }
    const rootPorts = rootNode.ports.filter(
      (port) => port.system === system.id,
    );
    if (rootPorts.length === 0)
      out.push(
        "type",
        `${path}.root`,
        `system root node "${system.root}" carries no port on system "${system.id}"`,
        system.root,
      );
    else if (
      system.flow === "from-root" &&
      !rootPorts.some((port) => port.direction !== "in")
    )
      out.push(
        "type",
        `${path}.root`,
        `a "from-root" system must be rooted where the medium leaves, but "${system.root}" only receives on this system`,
        system.root,
      );
    else if (
      system.flow === "to-root" &&
      !rootPorts.some((port) => port.direction !== "out")
    )
      out.push(
        "type",
        `${path}.root`,
        `a "to-root" system must be rooted where the medium arrives, but "${system.root}" only emits on this system`,
        system.root,
      );
  });

  const portPaths = new Map<string, string>();
  const seenPorts = new Set<string>();
  network.nodes.forEach((node, index) => {
    const path = `${root}.nodes[${index}]`;
    if (!NODE_KINDS.includes(node.kind))
      out.push(
        "type",
        `${path}.kind`,
        `unknown service node kind "${String(node.kind)}"`,
        node.kind,
      );
    finiteVector(
      node.position,
      `${path}.position`,
      "service node position",
      out,
    );
    if (!spaceIds.has(node.space))
      out.push(
        "type",
        `${path}.space`,
        `service node space "${node.space}" does not resolve in built environment "${environment.id}"`,
        node.space,
      );
    else if (
      !propSpaceContainsBounds({
        environment,
        space: node.space,
        bounds: { min: node.position, max: node.position },
      })
    )
      out.push(
        "type",
        `${path}.position`,
        `service node "${node.id}" stands outside logical space "${node.space}"`,
        node.position,
      );
    if (node.element !== null && !elementIds.has(node.element))
      out.push(
        "type",
        `${path}.element`,
        `service node element "${node.element}" does not resolve in built environment "${environment.id}"`,
        node.element,
      );
    if (node.state !== null) {
      nonEmpty(
        node.state.name,
        `${path}.state.name`,
        "service state name",
        out,
      );
      out.range(
        `${path}.state.opening`,
        node.state.opening,
        0,
        1,
        "service state opening",
      );
    }
    if (node.maintenance !== null)
      for (const axis of ["x", "y", "z"] as const)
        if (
          !(
            Number.isFinite(node.maintenance.min[axis]) &&
            Number.isFinite(node.maintenance.max[axis]) &&
            node.maintenance.max[axis] > node.maintenance.min[axis]
          )
        )
          out.push(
            "range",
            `${path}.maintenance.max.${axis}`,
            `maintenance envelope must be positive on ${axis}, but spanned [${node.maintenance.min[axis]}, ${node.maintenance.max[axis]}]`,
            node.maintenance.max[axis],
          );

    node.ports.forEach((port, at) => {
      const portPath = `${path}.ports[${at}]`;
      nonEmpty(port.id, `${portPath}.id`, "service port id", out);
      if (seenPorts.has(port.id))
        out.push(
          "type",
          `${portPath}.id`,
          `service port id "${port.id}" must be unique across the network`,
          port.id,
        );
      seenPorts.add(port.id);
      portPaths.set(port.id, portPath);
      const system = systems.get(port.system);
      if (system === undefined)
        out.push(
          "type",
          `${portPath}.system`,
          `service port system "${port.system}" does not resolve`,
          port.system,
        );
      else {
        if (port.medium !== system.medium)
          out.push(
            "type",
            `${portPath}.medium`,
            `a port on system "${system.id}" must carry "${system.medium}", but declared "${String(port.medium)}"`,
            port.medium,
          );
        if (port.unit !== system.unit)
          out.push(
            "type",
            `${portPath}.unit`,
            `a port on system "${system.id}" must be measured in "${system.unit}", but declared "${String(port.unit)}"`,
            port.unit,
          );
      }
      if (!DIRECTIONS.includes(port.direction))
        out.push(
          "type",
          `${portPath}.direction`,
          `unknown service port direction "${String(port.direction)}"`,
          port.direction,
        );
      nonNegative(port.demand, `${portPath}.demand`, "port demand", out);
      if (port.section !== null)
        positive(port.section, `${portPath}.section`, "port section", out);
      finiteVector(
        port.position,
        `${portPath}.position`,
        "service port position",
        out,
      );
    });
  });

  const used = new Set<string>();
  for (const segment of network.segments) {
    used.add(segment.from);
    used.add(segment.to);
  }
  for (const [id, path] of portPaths)
    if (!used.has(id))
      out.push(
        "type",
        path,
        `service port "${id}" is joined to no run; a dangling port is a network that stops here`,
        id,
      );

  const citedPenetrations = new Set<string>();
  network.segments.forEach((segment, index) => {
    const path = `${root}.segments[${index}]`;
    if (!systems.has(segment.system))
      out.push(
        "type",
        `${path}.system`,
        `service segment system "${segment.system}" does not resolve`,
        segment.system,
      );
    positive(segment.radius, `${path}.radius`, "segment radius", out);
    positive(segment.section, `${path}.section`, "segment section", out);

    const from = ports.get(segment.from);
    const to = ports.get(segment.to);
    for (const end of ["from", "to"] as const)
      if (!ports.has(segment[end]))
        out.push(
          "type",
          `${path}.${end}`,
          `service segment ${end} port "${segment[end]}" does not resolve`,
          segment[end],
        );
    if (segment.from === segment.to)
      out.push(
        "type",
        `${path}.to`,
        "a service segment must join two different ports",
        segment.to,
      );
    if (from !== undefined && from.system !== segment.system)
      out.push(
        "type",
        `${path}.from`,
        `a run on system "${segment.system}" cites a from port on system "${from.system}"`,
        segment.from,
      );
    if (to !== undefined && to.system !== segment.system)
      out.push(
        "type",
        `${path}.to`,
        `a run on system "${segment.system}" cites a to port on system "${to.system}"`,
        segment.to,
      );
    if (from !== undefined && from.direction === "in")
      out.push(
        "type",
        `${path}.from`,
        `a run must leave an emitting port, but "${from.id}" faces "in"`,
        from.direction,
      );
    if (to !== undefined && to.direction === "out")
      out.push(
        "type",
        `${path}.to`,
        `a run must arrive at a consuming port, but "${to.id}" faces "out"`,
        to.direction,
      );
    for (const port of [from, to])
      if (
        port !== undefined &&
        port.section !== null &&
        Math.abs(port.section - segment.section) > SERVICE_EPSILON
      )
        out.push(
          "range",
          `${path}.section`,
          `a run must match the ${port.section} m² section of port "${port.id}", but was ${segment.section}`,
          segment.section,
          segment.section - port.section,
        );

    if (segment.route.length < 2)
      out.push(
        "range",
        `${path}.route`,
        `a run needs at least 2 route points, but had ${segment.route.length}`,
        segment.route.length,
      );
    segment.route.forEach((point, at) =>
      finiteVector(point, `${path}.route[${at}]`, "route point", out),
    );
    for (let at = 0; at + 1 < segment.route.length; ++at)
      if (
        distance(segment.route[at]!, segment.route[at + 1]!) <= SERVICE_EPSILON
      )
        out.push(
          "range",
          `${path}.route[${at + 1}]`,
          "consecutive route points must be distinct",
          segment.route[at + 1],
        );
    const head = segment.route[0];
    const tail = segment.route[segment.route.length - 1];
    if (from !== undefined && head !== undefined)
      coincident(head, from.position, `${path}.route[0]`, from.id, out);
    if (to !== undefined && tail !== undefined)
      coincident(
        tail,
        to.position,
        `${path}.route[${segment.route.length - 1}]`,
        to.id,
        out,
      );

    const seen = new Set<string>();
    segment.penetrations.forEach((id, at) => {
      const sleevePath = `${path}.penetrations[${at}]`;
      if (!penetrationIds.has(id)) {
        out.push(
          "type",
          sleevePath,
          `service penetration "${id}" does not resolve`,
          id,
        );
        return;
      }
      if (seen.has(id))
        out.push(
          "type",
          sleevePath,
          `service penetration "${id}" is cited twice by the same run`,
          id,
        );
      seen.add(id);
      citedPenetrations.add(id);
      const sleeve = network.penetrations.find(
        (candidate) => candidate.id === id,
      )!;
      if (segment.radius > sleeve.radius + SERVICE_EPSILON)
        out.push(
          "range",
          `${path}.radius`,
          `a ${segment.radius} m run does not pass through the ${sleeve.radius} m sleeve "${id}"`,
          segment.radius,
          segment.radius - sleeve.radius,
        );
      if (segment.route.length >= 2) {
        const reach = sleeve.radius + segment.radius;
        if (routeDistanceSquared(segment, sleeve.position) > reach * reach)
          out.push(
            "range",
            sleevePath,
            `service penetration "${id}" does not sit on the run that cites it`,
            sleeve.position,
          );
      }
    });

    appendCrossings(network, environment, segment, path, out);
  });

  network.penetrations.forEach((sleeve, index) => {
    const path = `${root}.penetrations[${index}]`;
    if (!boundaryIds.has(sleeve.boundary))
      out.push(
        "type",
        `${path}.boundary`,
        `penetration boundary "${sleeve.boundary}" does not resolve in built environment "${environment.id}"`,
        sleeve.boundary,
      );
    if (sleeve.opening !== null) {
      const opening = openings.get(sleeve.opening);
      if (opening === undefined)
        out.push(
          "type",
          `${path}.opening`,
          `penetration opening "${sleeve.opening}" does not resolve in built environment "${environment.id}"`,
          sleeve.opening,
        );
      else if (opening.boundary !== sleeve.boundary)
        out.push(
          "type",
          `${path}.opening`,
          `penetration opening "${sleeve.opening}" is cut through boundary "${opening.boundary}", not "${sleeve.boundary}"`,
          sleeve.opening,
        );
    }
    finiteVector(
      sleeve.position,
      `${path}.position`,
      "penetration position",
      out,
    );
    positive(sleeve.radius, `${path}.radius`, "penetration radius", out);
    if (!citedPenetrations.has(sleeve.id))
      out.warn(
        "coverage",
        path,
        `service penetration "${sleeve.id}" is cited by no run`,
        sleeve.id,
      );
    if (
      sleeve.sealed === false &&
      network.zones.some((zone) => zone.membrane.includes(sleeve.boundary))
    )
      out.push(
        "type",
        `${path}.sealed`,
        `a penetration through waterproofed boundary "${sleeve.boundary}" must be sealed`,
        sleeve.sealed,
      );
  });

  network.systems.forEach((system, index) => {
    // Load is summed over consuming ports alone. A junction passing the medium
    // on declares nothing, and counting a bidirectional tap on both sides would
    // inflate a ring by exactly the amount that makes the total useless. This
    // is a declaration check, not a hydraulic or electrical one: nothing here
    // diversifies, and `serviceAnalysisSupport` says so by name.
    const load = network.nodes.reduce(
      (sum, node) =>
        sum +
        node.ports
          .filter(
            (port) => port.system === system.id && port.direction === "in",
          )
          .reduce((total, port) => total + port.demand, 0),
      0,
    );
    if (Number.isFinite(system.capacity) && load > system.capacity)
      out.push(
        "range",
        `${root}.systems[${index}].capacity`,
        `system "${system.id}" carries ${load} of declared demand against a capacity of ${system.capacity}`,
        system.capacity,
        load - system.capacity,
      );
    if (!network.nodes.some((node) => node.id === system.root)) return;
    const reached = new Set(serviceSystemReach({ network, system: system.id }));
    network.nodes.forEach((node, at) => {
      if (!node.ports.some((port) => port.system === system.id)) return;
      if (reached.has(node.id)) return;
      out.push(
        "type",
        `${root}.nodes[${at}]`,
        `service node "${node.id}" is not reached from the root of system "${system.id}"`,
        node.id,
      );
    });
  });

  const segmentIndex = new Map(
    network.segments.map((segment, index) => [segment.id, index]),
  );
  for (const clash of serviceSegmentClashes(network))
    out.push(
      "physics",
      `${root}.segments[${segmentIndex.get(clash.left)!}].route`,
      `run "${clash.left}" occupies the same volume as run "${clash.right}"`,
      clash.right,
    );

  network.nodes.forEach((node, index) => {
    const envelope = serviceMaintenanceBounds(node);
    if (envelope === null) return;
    const own = new Set(node.ports.map((port) => port.id));
    for (const segment of network.segments) {
      if (own.has(segment.from) || own.has(segment.to)) continue;
      const spans = serviceSegmentSpanBounds(segment);
      if (!spans.some((span) => propBoundsOverlap(envelope, span))) continue;
      out.push(
        "physics",
        `${root}.nodes[${index}].maintenance`,
        `run "${segment.id}" obstructs the maintenance envelope of service node "${node.id}"`,
        segment.id,
      );
    }
  });

  return out.toValidation();
};

/**
 * Report a run that leaves the logical space it was in without a sleeve.
 *
 * The crossing is read off the logical space cells rather than off a wall,
 * because a boundary carries no surface geometry to intersect against. Losing
 * or gaining a space between two consecutive route points is exactly the moment
 * a run left one region for another, and the run is expected to name a sleeve
 * on a boundary of one of them. Where no space in the environment locates a
 * volume at all, nothing can be said and nothing is: a purely semantic
 * partition is a name, not a wall to drill.
 *
 * Only the first uncovered crossing of a run is reported. A riser that left its
 * chase undeclared crosses every floor it passes, and one located finding is
 * what the author fixes.
 */
const appendCrossings = (
  network: IAutoMovieServiceNetwork,
  environment: IAutoMovieBuiltEnvironment,
  segment: IAutoMovieServiceSegment,
  path: string,
  out: ViolationCollector,
): void => {
  const located = environment.spaces.filter((space) => space.cells.length > 0);
  if (located.length === 0) return;
  const covered = new Set<string>();
  for (const id of segment.penetrations) {
    const sleeve = network.penetrations.find(
      (candidate) => candidate.id === id,
    );
    if (sleeve === undefined) continue;
    const boundary = environment.boundaries.find(
      (candidate) => candidate.id === sleeve.boundary,
    );
    if (boundary === undefined) continue;
    for (const space of boundary.spaces) covered.add(space);
  }
  const at = (point: IAutoMovieVector3): Set<string> =>
    new Set(
      located
        .filter((space) =>
          builtEnvironmentContainsPoint(environment, space.id, point),
        )
        .map((space) => space.id),
    );
  for (let index = 0; index + 1 < segment.route.length; ++index) {
    const before = at(segment.route[index]!);
    const after = at(segment.route[index + 1]!);
    const changed = [
      ...[...before].filter((id) => !after.has(id)),
      ...[...after].filter((id) => !before.has(id)),
    ];
    if (changed.length === 0) continue;
    if (changed.some((id) => covered.has(id))) continue;
    out.push(
      "type",
      `${path}.penetrations`,
      `a run crossing between logical spaces ${changed.join(
        ", ",
      )} at route point ${index + 1} must cite a penetration on a boundary of one of them`,
      changed,
    );
    return;
  }
};

const collectIds = <T extends { id: string }>(
  records: readonly T[],
  path: string,
  label: string,
  out: ViolationCollector,
): Set<string> => {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    nonEmpty(record.id, `${path}[${index}].id`, `${label} id`, out);
    if (ids.has(record.id))
      out.push(
        "type",
        `${path}[${index}].id`,
        `${label} id "${record.id}" must be unique`,
        record.id,
      );
    ids.add(record.id);
  });
  return ids;
};

const coincident = (
  point: IAutoMovieVector3,
  target: IAutoMovieVector3,
  path: string,
  portId: string,
  out: ViolationCollector,
): void => {
  const gap = distance(point, target);
  if (gap > ENDPOINT_EPSILON)
    out.push(
      "range",
      path,
      `a run must start and end on the ports it joins, but this end stood ${gap} m from port "${portId}"`,
      point,
      gap,
    );
};

const distance = (one: IAutoMovieVector3, other: IAutoMovieVector3): number =>
  Math.hypot(other.x - one.x, other.y - one.y, other.z - one.z);

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    out.push("type", path, `${label} must be non-empty`, value);
};

const finiteVector = (
  value: IAutoMovieVector3,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(value[axis]))
      out.push(
        "range",
        `${path}.${axis}`,
        `${label} ${axis} must be finite, but was ${value[axis]}`,
        value[axis],
      );
};

const positive = (
  value: number,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (!Number.isFinite(value) || value <= 0)
    out.push(
      "range",
      path,
      `${label} must be a finite number > 0, but was ${value}`,
      value,
    );
};

const nonNegative = (
  value: number,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (!Number.isFinite(value) || value < 0)
    out.push(
      "range",
      path,
      `${label} must be a finite number >= 0, but was ${value}`,
      value,
    );
};
