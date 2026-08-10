import {
  AutoMovieWetGrade,
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMovieFluidDrain,
  IAutoMovieFluidSource,
  IAutoMovieServiceNetwork,
  IAutoMovieServiceNode,
  IAutoMovieServiceSystem,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * How much water each grade expects, as the order a handover is measured in.
 *
 * The numbers are ordinal only: they say a shower is wetter than a lobby, which
 * is the entire question a threshold answers, and nothing about litres.
 */
const GRADE_ORDER = new Map<string, number>([
  ["dry", 0],
  ["damp", 1],
  ["wet", 2],
  ["immersed", 3],
]);

/** Grades whose full waterproofing obligations apply. */
const TANKED: readonly AutoMovieWetGrade[] = ["wet", "immersed"];

/** Media a floor drain is allowed to discharge into. */
const WASTE_MEDIUM = "waste-water";

/**
 * Validate the wet and waterproofed regions a network declares.
 *
 * This is the half of building services a frame is worst at showing. A tiled
 * room with a gully in it renders identically whether the membrane reaches the
 * walls or stops at the screed, whether the floor falls toward the gully or
 * away from it, and whether the sleeve carrying a pipe through the tanking was
 * made good. Those are the facts a leak is found in, so they are stated and
 * checked here rather than inferred from a look.
 *
 * The zone owns no geometry of its own on purpose. Its extent is the
 * architecture's logical space, its membrane is that space's own boundaries,
 * and its drains are the service network's nodes, so a zone can disagree with
 * neither. What it adds is the obligations those three cannot state alone: that
 * a wet region is covered everywhere water can reach, that every handover to a
 * drier region is declared, that the floor actually falls, and that it falls to
 * a drain that really discharges waste.
 *
 * @author Samchon
 */
export const validateWetZones = (props: {
  network: IAutoMovieServiceNetwork;
  environment: IAutoMovieBuiltEnvironment;
}): IAutoMovieValidation => {
  const { network, environment } = props;
  const out = new ViolationCollector();
  const root = "$input";

  const spaceIds = new Set(environment.spaces.map((space) => space.id));
  const boundaries = new Map(
    environment.boundaries.map((boundary) => [boundary.id, boundary]),
  );
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const systems = new Map(
    network.systems.map((system) => [system.id, system] as const),
  );

  // One space, one grade. A second zone over the same room would make "is the
  // far side of this wall drier" have two answers, so the first declaration
  // wins here and the contradiction is reported on the space that carries it.
  const gradeOf = new Map<string, AutoMovieWetGrade>();
  const zoneOf = new Map<string, string>();
  for (const zone of network.zones)
    if (!zoneOf.has(zone.space)) {
      zoneOf.set(zone.space, zone.id);
      if (GRADE_ORDER.has(zone.grade)) gradeOf.set(zone.space, zone.grade);
    }

  const seen = new Set<string>();
  network.zones.forEach((zone, index) => {
    const path = `${root}.zones[${index}]`;
    if (zone.id.trim().length === 0)
      out.push("type", `${path}.id`, "wet zone id must be non-empty", zone.id);
    else if (seen.has(zone.id))
      out.push(
        "type",
        `${path}.id`,
        `wet zone id "${zone.id}" must be unique`,
        zone.id,
      );
    seen.add(zone.id);

    const order = GRADE_ORDER.get(zone.grade);
    if (order === undefined)
      out.push(
        "type",
        `${path}.grade`,
        `unknown wet grade "${String(zone.grade)}"`,
        zone.grade,
      );
    if (!Number.isFinite(zone.upturn) || zone.upturn < 0)
      out.push(
        "range",
        `${path}.upturn`,
        `membrane upturn must be a finite number >= 0, but was ${zone.upturn}`,
        zone.upturn,
      );
    if (!Number.isFinite(zone.slope) || zone.slope < 0)
      out.push(
        "range",
        `${path}.slope`,
        `floor slope must be a finite number >= 0, but was ${zone.slope}`,
        zone.slope,
      );

    if (zoneOf.get(zone.space) !== zone.id)
      out.push(
        "type",
        `${path}.space`,
        `logical space "${zone.space}" already carries wet zone "${zoneOf.get(zone.space)}"`,
        zone.space,
      );
    if (!spaceIds.has(zone.space)) {
      out.push(
        "type",
        `${path}.space`,
        `wet zone space "${zone.space}" does not resolve in built environment "${environment.id}"`,
        zone.space,
      );
      return;
    }

    const bounding = environment.boundaries.filter((boundary) =>
      boundary.spaces.includes(zone.space),
    );
    const membrane = citedBoundaries({
      cited: zone.membrane,
      zoneSpace: zone.space,
      boundaries,
      path: `${path}.membrane`,
      label: "membrane boundary",
      out,
    });
    const thresholds = citedBoundaries({
      cited: zone.thresholds,
      zoneSpace: zone.space,
      boundaries,
      path: `${path}.thresholds`,
      label: "threshold boundary",
      out,
    });

    const tanked = TANKED.includes(zone.grade);
    if (tanked)
      for (const boundary of bounding)
        if (!membrane.has(boundary.id))
          out.push(
            "coverage",
            `${path}.membrane`,
            `a "${zone.grade}" zone must waterproof every boundary of space "${zone.space}", but "${boundary.id}" is uncovered`,
            boundary.id,
          );

    for (const boundary of bounding) {
      // A boundary enclosing one region hands over to nothing this record
      // names, so an external wall of a wet room is covered by the membrane
      // rule above and is not a threshold. Only a separation between two
      // regions can be one, and the far side is read off whichever of the two
      // is not this zone's own space.
      if (boundary.spaces.length !== 2) continue;
      for (const other of boundary.spaces.filter((id) => id !== zone.space)) {
        const otherOrder = GRADE_ORDER.get(gradeOf.get(other) ?? "dry")!;
        if (otherOrder >= (order ?? 0)) continue;
        if (thresholds.has(boundary.id)) continue;
        out.push(
          "coverage",
          `${path}.thresholds`,
          `boundary "${boundary.id}" hands a "${zone.grade}" zone over to drier space "${other}" and must be declared a threshold`,
          boundary.id,
        );
      }
    }

    const drains = new Set<string>();
    zone.drains.forEach((id, at) => {
      const drainPath = `${path}.drains[${at}]`;
      const node = nodes.get(id);
      if (node === undefined) {
        out.push(
          "type",
          drainPath,
          `wet zone drain "${id}" does not resolve to a service node`,
          id,
        );
        return;
      }
      if (drains.has(id))
        out.push(
          "type",
          drainPath,
          `wet zone drain "${id}" is declared twice`,
          id,
        );
      drains.add(id);
      if (node.space !== zone.space)
        out.push(
          "type",
          drainPath,
          `wet zone drain "${id}" stands in space "${node.space}", not in "${zone.space}"`,
          node.space,
        );
      if (wastePortsOf(node, systems).length === 0)
        out.push(
          "type",
          drainPath,
          `wet zone drain "${id}" carries no outgoing ${WASTE_MEDIUM} port, so the floor falls to nothing`,
          id,
        );
    });

    if (!tanked) return;
    if (zone.drains.length === 0)
      out.push(
        "coverage",
        `${path}.drains`,
        `a "${zone.grade}" zone must fall to at least one drain`,
        zone.drains,
      );
    if (Number.isFinite(zone.slope) && zone.slope <= 0)
      out.push(
        "range",
        `${path}.slope`,
        `a "${zone.grade}" zone must fall toward its drains, but its slope was ${zone.slope}`,
        zone.slope,
      );
  });

  return out.toValidation();
};

/**
 * Compose a wet zone's plumbing into an independent fluid domain.
 *
 * This is the seam that keeps one model of moving water. The service graph
 * states where water is delivered and where it is taken away; the shallow-water
 * domain states how it then moves. Rather than inventing a second, weaker
 * account of flow inside the building record, the zone's supply ports become
 * the domain's declared sources and its drains become the domain's declared
 * drains, at the lattice cells they actually stand over. A basin that fills,
 * overflows and empties is then the fluid solver's ordinary business, and its
 * mass ledger is the same one every other domain is checked with.
 *
 * The sill of a derived drain is the bed elevation of its own cell, which is
 * what a plain floor gully is: it opens the moment water stands on the floor
 * above it. A weir with a raised sill is a different fixture and is authored on
 * the domain directly.
 *
 * The network is expected to have been validated already; this lowering answers
 * only for the placement it performs, not for the graph it reads.
 *
 * Refuses rather than repairs. An unknown zone, an unknown drain node, a node
 * standing off the lattice and a derived id that collides with an authored one
 * each raise, because every one of them would otherwise produce a domain that
 * silently conserves the wrong amount of water.
 *
 * @author Samchon
 */
export const lowerWetZoneDrainage = (props: {
  network: IAutoMovieServiceNetwork;
  zone: string;
  domain: IAutoMovieFluidDomain;
}): IAutoMovieFluidDomain => {
  const { network, domain } = props;
  const zone = network.zones.find((candidate) => candidate.id === props.zone);
  if (zone === undefined)
    throw new Error(
      `service network "${network.id}" has no wet zone "${props.zone}"`,
    );
  const systems = new Map(
    network.systems.map((system) => [system.id, system] as const),
  );

  const sources: IAutoMovieFluidSource[] = [];
  for (const node of network.nodes) {
    if (node.space !== zone.space) continue;
    for (const port of node.ports) {
      if (port.direction !== "in") continue;
      const system = systems.get(port.system);
      if (system === undefined || system.discipline !== "plumbing") continue;
      const cell = cellOf(domain, node, zone.id);
      sources.push({
        id: derivedId(zone.id, port.id, domain, "source"),
        column: cell.column,
        row: cell.row,
        flowRate: port.demand,
        start: 0,
        end: null,
      });
    }
  }

  const drains: IAutoMovieFluidDrain[] = [];
  for (const id of zone.drains) {
    const node = network.nodes.find((candidate) => candidate.id === id);
    if (node === undefined)
      throw new Error(
        `wet zone "${zone.id}" cites drain node "${id}", which the network does not declare`,
      );
    const cell = cellOf(domain, node, zone.id);
    for (const port of wastePortsOf(node, systems))
      drains.push({
        id: derivedId(zone.id, port.id, domain, "drain"),
        column: cell.column,
        row: cell.row,
        flowRate: port.demand,
        sillLevel: domain.bed[cell.row * domain.grid.columns + cell.column]!,
        start: 0,
        end: null,
      });
  }

  return {
    ...domain,
    sources: [...domain.sources, ...sources],
    drains: [...domain.drains, ...drains],
  };
};

/** The outgoing waste-water ports a node carries, in declaration order. */
const wastePortsOf = (
  node: IAutoMovieServiceNode,
  systems: ReadonlyMap<string, IAutoMovieServiceSystem>,
): IAutoMovieServiceNode["ports"] =>
  node.ports.filter((port) => {
    const system = systems.get(port.system);
    return (
      port.direction === "out" &&
      system !== undefined &&
      system.discipline === "drainage" &&
      system.medium === WASTE_MEDIUM
    );
  });

/** Resolve the lattice cell a node stands over, refusing one that stands off it. */
const cellOf = (
  domain: IAutoMovieFluidDomain,
  node: IAutoMovieServiceNode,
  zone: string,
): { column: number; row: number } => {
  const column = Math.floor(
    (node.position.x - domain.grid.origin.x) / domain.grid.cellX,
  );
  const row = Math.floor(
    (node.position.z - domain.grid.origin.z) / domain.grid.cellZ,
  );
  if (
    !(
      Number.isFinite(column) &&
      Number.isFinite(row) &&
      column >= 0 &&
      row >= 0 &&
      column < domain.grid.columns &&
      row < domain.grid.rows
    )
  )
    throw new Error(
      `wet zone "${zone}" node "${node.id}" stands off the lattice of fluid domain "${domain.id}"`,
    );
  return { column, row };
};

/** Name a derived inflow or outflow, refusing to shadow an authored one. */
const derivedId = (
  zone: string,
  port: string,
  domain: IAutoMovieFluidDomain,
  kind: "source" | "drain",
): string => {
  const id = `${zone}/${port}`;
  const taken =
    kind === "source"
      ? domain.sources.some((entry) => entry.id === id)
      : domain.drains.some((entry) => entry.id === id);
  if (taken)
    throw new Error(
      `fluid domain "${domain.id}" already declares a ${kind} named "${id}"`,
    );
  return id;
};

/** Resolve cited boundary ids, reporting unknown, duplicated and foreign ones. */
const citedBoundaries = (props: {
  cited: readonly string[];
  zoneSpace: string;
  boundaries: ReadonlyMap<string, IAutoMovieBuiltBoundary>;
  path: string;
  label: string;
  out: ViolationCollector;
}): Set<string> => {
  const resolved = new Set<string>();
  props.cited.forEach((id, at) => {
    const where = `${props.path}[${at}]`;
    const boundary = props.boundaries.get(id);
    if (boundary === undefined) {
      props.out.push(
        "type",
        where,
        `${props.label} "${id}" does not resolve`,
        id,
      );
      return;
    }
    if (resolved.has(id))
      props.out.push(
        "type",
        where,
        `${props.label} "${id}" is declared twice`,
        id,
      );
    resolved.add(id);
    if (!boundary.spaces.includes(props.zoneSpace))
      props.out.push(
        "type",
        where,
        `${props.label} "${id}" does not bound zone space "${props.zoneSpace}"`,
        boundary.spaces,
      );
  });
  return resolved;
};
