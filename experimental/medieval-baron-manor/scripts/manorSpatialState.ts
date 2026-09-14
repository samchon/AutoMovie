import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieOpeningOperation,
  IAutoMovieTransform,
  IAutoMovieTravelMotion,
} from "@automovie/interface";
import {
  Matrix4,
  Quaternion,
  builtSpaceContainsPoint,
  builtInstanceSetPlacementBounds,
  tessellateToMesh,
  transformAutoMovieMesh,
  triangulateAutoMovieRegion,
} from "@automovie/engine";

/**
 * Current authored geometry input, not a second simplified manor.
 *
 */
interface ManorSpatialInput {
  entries: {
    id: string; level: number; role: string; model: IAutoMovieModel;
    parent?: string;
    pose?: { pivot: number[]; closedAngle: number; angle: number };
    articulation?: { rest: IAutoMovieTransform; relativeToParent?: boolean; motion: IAutoMovieTravelMotion; closed: number; open: number; default: number };
  }[];
  rooms: { id: string; level: number; polygon: number[][] }[];
  boundaries: {
    id: string; a: number[]; b: number[]; level: number; exterior: boolean;
    openings: { id: string; at: number; w: number; h: number; sill?: number; operation?: IAutoMovieOpeningOperation }[];
  }[];
}

/**
 * Exact shared definitions and part-index identities produced by manor instances.
 *

 */
interface ManorSpatialInstances {
  prototypes: {
    id: string; model: IAutoMovieModel;
    bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  }[];
  sets: { entry: string; definition: IAutoMovieInstanceSetDesign }[];
  singletons: { entry: string; part: string; partIndex: number }[];
}

const identity = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 },
});

const CRITICAL_ARTIFACT = "automovie/derived/manor/instances-v23-critical.json";
type JsonObject = Record<string, unknown>;

function objectOf(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function vector(value: unknown): value is { x: number; y: number; z: number } {
  const record = objectOf(value);
  return record !== null && finite(record.x) && finite(record.y) && finite(record.z);
}

function transform(value: unknown): value is IAutoMovieTransform {
  const record = objectOf(value);
  const rotation = objectOf(record?.rotation);
  return record !== null && vector(record.translation) && vector(record.scale) &&
    rotation !== null && finite(rotation.x) && finite(rotation.y) && finite(rotation.z) && finite(rotation.w);
}

function model(value: unknown): value is IAutoMovieModel {
  const record = objectOf(value);
  return record !== null && typeof record.id === "string" &&
    (typeof record.name === "string" || record.name === null) &&
    typeof record.origin === "string" && Array.isArray(record.parts) &&
    Array.isArray(record.materials);
}

function instanceSet(value: unknown): value is IAutoMovieInstanceSetDesign {
  const record = objectOf(value);
  return record !== null && typeof record.id === "string" &&
    typeof record.modelRecipe === "string" && finite(record.count) &&
    objectOf(record.layout) !== null && vector(record.anchor) &&
    finite(record.facingDeg) && Number.isSafeInteger(record.seed) &&
    objectOf(record.variation) !== null;
}

function spatialInput(value: unknown): value is ManorSpatialInput {
  const record = objectOf(value);
  return record !== null && Array.isArray(record.entries) && record.entries.every(entry => {
    const item = objectOf(entry);
    return item !== null && typeof item.id === "string" && finite(item.level) &&
      typeof item.role === "string" && model(item.model);
  }) && Array.isArray(record.rooms) && record.rooms.every(room => {
    const item = objectOf(room);
    return item !== null && typeof item.id === "string" && finite(item.level) &&
      Array.isArray(item.polygon) && item.polygon.every(point => Array.isArray(point) && point.every(finite));
  }) && Array.isArray(record.boundaries) && record.boundaries.every(boundary => {
    const item = objectOf(boundary);
    return item !== null && typeof item.id === "string" && finite(item.level) &&
      Array.isArray(item.a) && item.a.every(finite) && Array.isArray(item.b) && item.b.every(finite) &&
      Array.isArray(item.openings);
  });
}

function spatialInstances(value: unknown): value is ManorSpatialInstances {
  const record = objectOf(value);
  return record !== null && Array.isArray(record.prototypes) && record.prototypes.every(prototype => {
    const item = objectOf(prototype), bounds = objectOf(item?.bounds);
    return item !== null && typeof item.id === "string" && model(item.model) &&
      bounds !== null && vector(bounds.min) && vector(bounds.max);
  }) && Array.isArray(record.sets) && record.sets.every(set => {
    const item = objectOf(set);
    return item !== null && typeof item.entry === "string" && instanceSet(item.definition);
  }) && Array.isArray(record.singletons) && record.singletons.every(singleton => {
    const item = objectOf(singleton);
    return item !== null && typeof item.entry === "string" && typeof item.part === "string" &&
      Number.isSafeInteger(item.partIndex);
  });
}

function authoredSpatialContext(content: string, spatial: unknown): {
  source: ManorSpatialInput;
  inventory: ManorSpatialInstances;
  transforms: ReadonlyMap<string, IAutoMovieTransform>;
} {
  const parsed: unknown = JSON.parse(content);
  const record = objectOf(parsed), inventory = record;
  const transformsRecord = objectOf(record?.transforms);
  if (!spatialInput(spatial) || !spatialInstances(inventory) || transformsRecord === null) {
    throw new Error("Malformed authored manor spatial artifact: " + CRITICAL_ARTIFACT);
  }
  const transforms = new Map<string, IAutoMovieTransform>();
  for (const [id, value] of Object.entries(transformsRecord)) {
    if (!transform(value)) throw new Error("Malformed manor transform: " + id);
    transforms.set(id, value);
  }
  return { source: spatial, inventory, transforms };
}

function roomSpace(room: ManorSpatialInput["rooms"][number]): IAutoMovieBuiltSpace {
  const bottom = room.level === 0 ? 0.45 : 3.33;
  const region = triangulateAutoMovieRegion({ outer: room.polygon.map(([x, y]) => ({ x, y })) });
  const cells = [];
  for (let i = 0; i < region.triangles.length; i += 3) {
    const triangle = region.triangles.slice(i, i + 3).map(index => region.points[index]);
    const center = { x: triangle.reduce((n, p) => n + p.x, 0) / 3, y: triangle.reduce((n, p) => n + p.y, 0) / 3 };
    const planes = triangle.map((a, j) => {
      const b = triangle[(j + 1) % 3];
      let nx = b.y - a.y, nz = a.x - b.x;
      if (nx * (center.x - a.x) + nz * (center.y - a.y) > 0) { nx = -nx; nz = -nz; }
      const length = Math.hypot(nx, nz);
      return { normal: { x: nx / length, y: 0, z: nz / length }, offset: (nx * a.x + nz * a.y) / length };
    });
    planes.push({ normal: { x: 0, y: -1, z: 0 }, offset: -bottom }, { normal: { x: 0, y: 1, z: 0 }, offset: bottom + 2.66 });
    cells.push({ id: room.id + "/cell-" + i / 3, planes });
  }
  return { id: room.id, kind: "room", parent: room.level === 0 ? "ground-storey" : "upper-storey", cells, fidelity: "exact" };
}

/**
 * A state-specific spatial carrier of the SAME rendered definitions.
 * World transforms must be supplied from the current source state, including
 * parent-relative bolts and hinges. No animation is guessed from an origin.
 * This is an authored source adapter, not compiler admission or physical PASS.
 * Operated panels retain their authored rest frames and complete local models;
 * named opening states drive those elements. Static compact populations are in
 * world coordinates because the public population DTO has no element parent.
 * Attached non-panel hardware retains its current source-local pose.
 */
/**
 * Builds the authored spatial state from the verified manor source.
 *

 */
function manorSpatialState(
  source: ManorSpatialInput,
  inventory: ManorSpatialInstances,
  transforms: ReadonlyMap<string, IAutoMovieTransform>,
): { environment: IAutoMovieBuiltEnvironment; exteriorGround: ManorSpatialInput["entries"]; bindings: { set: string; entry: string }[] } {
  const rooms = source.rooms.map(roomSpace);
  const environment: IAutoMovieBuiltEnvironment = {
    version: 1, id: "medieval-baron-manor", units: "meter",
    buildings: [{ id: "manor", element: "manor-root", space: "manor-space" }],
    models: [], modelReferences: [],
    elements: [{ id: "manor-root", kind: "building", parent: null, transform: identity(), model: null, space: "manor-space" }],
    populations: [],
    spaces: [
      { id: "manor-space", kind: "building", parent: null, cells: [] },
      { id: "ground-storey", kind: "storey", parent: "manor-space", cells: [] },
      { id: "upper-storey", kind: "storey", parent: "manor-space", cells: [] },
      { id: "courtyard", kind: "courtyard", parent: "manor-space", cells: [] },
      ...rooms,
    ],
    boundaries: [], openings: [], connectors: [], surfaces: [], walkable: [],
  };
  const exteriorGround = source.entries.filter(entry => entry.role === "site");
  const operated = new Map<string, { fill: string; entry: ManorSpatialInput["entries"][number] }>();
  const openingFills = new Map<string, string>();
  for (const boundary of source.boundaries) for (const opening of boundary.openings) {
    if (opening.operation === undefined) continue;
    const leaf = source.entries.find(entry => entry.id === opening.id + "-leaf");
    const fill = leaf?.id ?? opening.id + "-fill";
    openingFills.set(opening.id, fill);
    if (leaf === undefined) environment.elements.push({ id: fill, kind: "window-fill", parent: "manor-root", transform: identity(), model: null, space: "manor-space" });
    for (const panel of opening.operation.panels) {
      const entry = source.entries.find(candidate => candidate.id === panel.element);
      if (entry === undefined) throw new Error("Missing authored opening panel: " + opening.id + "/" + panel.element);
      if (operated.has(entry.id)) throw new Error("Opening panel has multiple owners: " + entry.id);
      operated.set(entry.id, { fill, entry });
    }
  }
  const attached = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of source.entries) if (!operated.has(entry.id) && !attached.has(entry.id) && entry.articulation?.relativeToParent && entry.parent !== undefined && (operated.has(entry.parent) || attached.has(entry.parent))) {
      attached.add(entry.id);
      changed = true;
    }
  }
  const prototypes = new Map(inventory.prototypes.map(prototype => [prototype.id, prototype]));
  const singletons = new Map<string, Set<number>>();
  for (const part of inventory.singletons) {
    if (!singletons.has(part.entry)) singletons.set(part.entry, new Set());
    singletons.get(part.entry)?.add(part.partIndex);
  }
  for (const entry of source.entries) {
    const world = transforms.get(entry.id);
    if (world === undefined) throw new Error("Missing actual source transform: " + entry.id);
    const panel = operated.get(entry.id);
    // A moving leaf keeps all its authored parts under the driven element.
    // World-space compact populations have no element parent and cannot follow it.
    const parts = panel === undefined && !attached.has(entry.id) ? entry.model.parts.filter((_, index) => singletons.get(entry.id)?.has(index)) : entry.model.parts;
    const model = parts.length ? { ...entry.model, id: entry.id + "/unique-parts", parts } : null;
    if (model !== null) environment.models.push(model);
    let transform = world, parent = "manor-root";
    if (panel !== undefined) {
      if (entry.articulation !== undefined) {
        transform = entry.articulation.rest;
        if (entry.articulation.relativeToParent) {
          if (entry.parent === undefined || !operated.has(entry.parent)) throw new Error("Unbound opening-panel parent: " + entry.id);
          parent = entry.parent;
        } else parent = panel.fill === entry.id ? "manor-root" : panel.fill;
      } else if (entry.pose !== undefined) {
        transform = { translation: { x: entry.pose.pivot[0], y: entry.pose.pivot[1], z: entry.pose.pivot[2] }, rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, entry.pose.closedAngle * 180 / Math.PI), scale: { x: 1, y: 1, z: 1 } };
        parent = panel.fill === entry.id ? "manor-root" : panel.fill;
      } else throw new Error("Opening panel has no authored rest frame: " + entry.id);
    } else if (attached.has(entry.id)) {
      const articulation = entry.articulation!;
      const value = articulation.closed + (articulation.open - articulation.closed) * articulation.default;
      const motion = articulation.motion;
      const rotation = motion.kind === "revolute" ? Quaternion.fromAxisAngle(motion.axis, value * 180 / Math.PI) : identity().rotation;
      const movedPivot = motion.kind === "revolute" ? Quaternion.rotateVector(rotation, motion.pivot) : { x: 0, y: 0, z: 0 };
      const translation = motion.kind === "prismatic" ? { x: motion.axis.x * value, y: motion.axis.y * value, z: motion.axis.z * value } : { x: motion.pivot.x - movedPivot.x, y: motion.pivot.y - movedPivot.y, z: motion.pivot.z - movedPivot.z };
      const rest = articulation.rest;
      const local = Matrix4.decompose(Matrix4.multiply(Matrix4.compose(rest.translation, rest.rotation, rest.scale), Matrix4.compose(translation, rotation, { x: 1, y: 1, z: 1 })));
      transform = { translation: local.position, rotation: Quaternion.normalize(local.rotation), scale: local.scale };
      parent = entry.parent!;
    }
    environment.elements.push({ id: entry.id, kind: entry.role, parent, transform, model: model?.id ?? null, space: "manor-space" });
  }
  const usedPrototypes = new Set<string>(), bindings = [];
  for (const item of inventory.sets) {
    if (operated.has(item.entry) || attached.has(item.entry)) continue;
    const prototype = prototypes.get(item.definition.modelRecipe), root = transforms.get(item.entry);
    if (prototype === undefined || root === undefined) throw new Error("Unbound spatial population: " + item.definition.id);
    const layout = item.definition.layout;
    if (layout.kind !== "explicit") throw new Error("Manor source requires its authored explicit placements: " + item.definition.id);
    const parent = Matrix4.compose(root.translation, root.rotation, root.scale);
    const set: IAutoMovieInstanceSetDesign = {
      ...item.definition,
      layout: { kind: "explicit", transforms: layout.transforms.map(member => {
        const posed = Matrix4.decompose(Matrix4.multiply(parent, Matrix4.compose(member.translation, member.rotation, member.scale)));
        return { ...member, translation: posed.position, rotation: Quaternion.normalize(posed.rotation), scale: posed.scale };
      }) },
    };
    const bounds = builtInstanceSetPlacementBounds(set, prototype.bounds);
    const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => ({ x, y, z }))));
    const containing = rooms.find(room => corners.every(point => builtSpaceContainsPoint(room, point)));
    environment.populations?.push({ space: containing?.id ?? "manor-space", prototypeBounds: prototype.bounds, set });
    usedPrototypes.add(prototype.id); bindings.push({ set: set.id, entry: item.entry });
  }
  // Actual prototype meshes accompany their bounds; bounds alone are not a model.
  for (const id of usedPrototypes) {
    const prototype = prototypes.get(id);
    if (prototype === undefined) throw new Error("Missing used prototype " + id);
    environment.models.push(prototype.model);
  }
  for (const boundary of source.boundaries) {
    const [ax, az] = boundary.a, [bx, bz] = boundary.b;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), bottom = boundary.level === 0 ? 0.45 : 3.33;
    const at = (u: number, depth: number) => ({ x: ax + dx * u / length - dz * depth / length, y: bottom + 1, z: az + dz * u / length + dx * depth / length });
    const adjacent = new Set<string>();
    for (const u of [length / 2, ...boundary.openings.map(opening => opening.at)]) {
      for (const depth of [-0.14, 0.14]) for (const room of rooms) if (builtSpaceContainsPoint(room, at(u, depth))) adjacent.add(room.id);
    }
    // The audited threshold route reaches 0.5 m into each occupied side.
    // Resolve through the wall/finish margin instead of dropping doorways when
    // a near-face point falls in the small gap between a wall and a room cell.
    for (const opening of boundary.openings.filter(opening => !opening.sill))
      for (const depth of [-0.5, 0.5]) for (const room of rooms)
        if (builtSpaceContainsPoint(room, at(opening.at, depth))) adjacent.add(room.id);
    // A continuous exterior facade encloses its storey across several rooms.
    // Interior partitions retain their measured room adjacency.
    const boundarySpaces = boundary.exterior
      ? [boundary.level === 0 ? "ground-storey" : "upper-storey"] : [...adjacent];
    environment.boundaries.push({ id: boundary.id, kind: "wall", spaces: boundarySpaces, elements: [boundary.id], face: {
      origin: { x: ax, y: bottom, z: az }, rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, -Math.atan2(dz, dx) * 180 / Math.PI),
      outline: [{ x: 0, y: 0 }, { x: length, y: 0 }, { x: length, y: 2.66 }, { x: 0, y: 2.66 }], thickness: 0.24,
    } });
    for (const opening of boundary.openings) {
      const sill = opening.sill ?? 0, leaf = opening.id + "-leaf";
      environment.openings.push({ id: opening.id, kind: sill > 0 ? "window" : "door", boundary: boundary.id,
        fill: openingFills.get(opening.id) ?? (environment.elements.some(element => element.id === leaf) ? leaf : null),
        profile: { outline: [{ x: opening.at - opening.w / 2, y: sill }, { x: opening.at + opening.w / 2, y: sill }, { x: opening.at + opening.w / 2, y: sill + opening.h }, { x: opening.at - opening.w / 2, y: sill + opening.h }] },
        ...(opening.operation === undefined ? {} : { operation: opening.operation }),
      });
      if (sill === 0) {
        const front = at(opening.at, -0.5), back = at(opening.at, 0.5);
        const from = rooms.find(room => builtSpaceContainsPoint(room, front));
        const to = rooms.find(room => builtSpaceContainsPoint(room, back));
        if (from === undefined || to === undefined)
          throw new Error(`Unresolved manor door connection: ${opening.id} on ${boundary.id} (from=${from?.id ?? "missing"}, to=${to?.id ?? "missing"})`);
        if (from.id === to.id)
          throw new Error(`Self-connected manor door: ${opening.id} on ${boundary.id} (room=${from.id})`);
        environment.connectors.push({
          id: opening.id + "/passage", kind: "passage", from: from.id, to: to.id, bidirectional: true,
          route: [{ ...front, y: bottom }, { ...back, y: bottom }], elements: [boundary.id],
          width: opening.w, clearHeight: opening.h,
        });
      }
    }
  }
  // Ground facts come from actual upward-facing horizontal triangles, not room
  // union boxes. Slab/stair voids therefore cannot acquire fictitious support.
  for (const entry of source.entries) {
    if (!["ground-floor", "upper-floor", "central-stair", "entry-steps"].includes(entry.id)) continue;
    const root = transforms.get(entry.id);
    if (root === undefined) throw new Error("Missing support source transform " + entry.id);
    for (const [partIndex, part] of entry.model.parts.entries()) {
      if (entry.id === "central-stair" && !/^(lower-tread-|upper-tread-|turn-landing$)/.test(part.id)) continue;
      const mesh = part.geometry.type === "primitive" ? tessellateToMesh(part.geometry.shape) : part.geometry.mesh;
      const world = transformAutoMovieMesh(transformAutoMovieMesh(mesh, part.transform ?? identity()), root);
      const indices = world.indices ?? Array.from({ length: world.positions.length / 3 }, (_, i) => i);
      for (let i = 0; i < indices.length; i += 3) {
        const points = indices.slice(i, i + 3).map(index => ({ x: world.positions[index * 3], y: world.positions[index * 3 + 1], z: world.positions[index * 3 + 2] }));
        const [a, b, c] = points;
        const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
        if (normalY <= 0 || Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) > 1e-9) continue;
        const center = { x: (a.x + b.x + c.x) / 3, y: a.y + 1e-7, z: (a.z + b.z + c.z) / 3 };
        const owner = rooms.find(room => builtSpaceContainsPoint(room, center));
        const id = entry.id + "/" + partIndex + "/triangle-" + i / 3;
        environment.surfaces.push({ space: owner?.id ?? "manor-space", surface: { id, kind: "floor", polygon: points.map(p => ({ x: p.x, y: 0, z: p.z })), height: { kind: "constant", value: a.y } } });
        environment.walkable.push(id);
      }
    }
  }
  const stairRoute = [{ x: -0.66, y: 0.45, z: -1.95 }];
  for (let i = 0; i < 7; i++) stairRoute.push({ x: -0.66, y: 0.63 + i * 0.18, z: -2.30 - i * 0.26 });
  stairRoute.push({ x: -0.66, y: 1.89, z: -4.61 });
  for (let i = 0; i < 7; i++) stairRoute.push({ x: -0.04 + 0.26 * (i + 0.5) + (i === 6 ? 0.01 : 0), y: 2.07 + i * 0.18, z: -4.61 });
  stairRoute.push({ x: 1.98, y: 3.33, z: -4.61 });
  // The usable envelope preserves the audited 0.65 m by 1.85 m traversal body;
  // it is not a claim of maximum available clearance or an accessibility code.
  environment.connectors.push({ id: "central-stair/access", kind: "stair", from: "entrance", to: "landing", bidirectional: true, route: stairRoute, elements: ["central-stair"], width: 0.65, clearHeight: 1.85 });
  for (const [from, to, route] of [
    ["gallery-west", "gallery-rear", [{ x: -3.85, y: 0.45, z: 0.25 }, { x: -3.85, y: 0.45, z: -0.65 }]],
    ["gallery-rear", "gallery-east", [{ x: 3.85, y: 0.45, z: -0.65 }, { x: 3.85, y: 0.45, z: 0.25 }]],
    ["landing", "corridor", [{ x: 2.4, y: 3.33, z: -2.0 }, { x: 2.4, y: 3.33, z: -0.9 }]],
  ] satisfies [string, string, { x: number; y: number; z: number }[]][]) environment.connectors.push({ id: from + "/" + to, kind: "passage", from, to, bidirectional: true, route, elements: [], width: 0.65, clearHeight: 1.85 });
  return { environment, exteriorGround, bindings };
}


// Ordinary Node derivation: the sandbox consumes the verified result only.
export function deriveManorSpatialArtifact(content: string, source: unknown) {
  const authored = authoredSpatialContext(content, source);
  const built = manorSpatialState(authored.source, authored.inventory, authored.transforms);
  return { environments: [built.environment], models: [] };
}
