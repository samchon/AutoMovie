import {
  AutoMovieAffordanceKind,
  IAutoMovieBuiltConnector,
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMoviePropBox,
  IAutoMoviePropRelation,
  IAutoMoviePropRelationTarget,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
  IAutoMovieTransform,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  builtConnectorSection,
  builtEnvironmentContainsPoint,
} from "../architecture/builtEnvironment";
import { tessellate } from "../geometry/tessellate";
import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { convexHull2D, pointInHull } from "../math/hull";
import { IAutoMovieHeightSurface, surfaceHeightAt } from "../space/surfaces";
import { ViolationCollector } from "../validation/violation";
import { forgeProp } from "./forgeProp";

/** Tolerance for containment and fit comparisons, in metres. */
const PLACEMENT_EPSILON = 1e-9;

/** One passage a staged volume intrudes on. */
export interface IAutoMoviePassageBlockage {
  /** Which passage family the blocked id belongs to. */
  kind: "opening" | "connector";
  /** Stable opening or connector id inside the environment. */
  id: string;
}

/** One transformed keep-out volume, still carrying the id that declared it. */
export interface IAutoMoviePropClearanceBounds extends IAutoMoviePropBox {
  /** The clearance id this world volume came from. */
  id: string;
}

/**
 * The world-axis-aligned volume one staged prop occupies.
 *
 * A declared `footprint` wins because it is the prop's own statement of what it
 * takes up; otherwise the bound is derived from the visible parts, which is the
 * only honest answer a prop that says nothing can be given. Either way all
 * eight corners travel through the piece's full TRS (translation, unit
 * quaternion, per-axis scale) before the world bound is taken, so a rotated
 * prop widens rather than being silently re-fitted to its local box.
 *
 * A prop whose parts carry no vertices at all collapses to the staged origin
 * rather than to an empty bound, so a caller never has to special-case it.
 */
export const propOccupancyBounds = (props: {
  prop: IAutoMoviePropSpec;
  piece: IAutoMovieStageSetPiece;
}): IAutoMoviePropBox => {
  const matrix = stagedMatrix(props.piece);
  const footprint = props.prop.placement?.footprint ?? null;
  if (footprint !== null) return transformedBox(footprint, matrix);
  return transformedModelBounds(props.prop.model, matrix);
};

/**
 * The world-axis-aligned keep-out volumes one staged prop declares.
 *
 * Every declared box is transformed, including one whose bounds the validator
 * rejects: filtering here would hide a malformed volume from a source-side
 * search instead of letting the validator name it.
 */
export const propClearanceBounds = (props: {
  prop: IAutoMoviePropSpec;
  piece: IAutoMovieStageSetPiece;
}): IAutoMoviePropClearanceBounds[] => {
  const matrix = stagedMatrix(props.piece);
  return (props.prop.placement?.clearance ?? []).map((clearance) => ({
    id: clearance.id,
    ...transformedBox(clearance, matrix),
  }));
};

/**
 * Whether two axis-aligned volumes share interior space.
 *
 * Contact is not occupancy: two boxes that meet exactly on a face do not
 * overlap, which is what lets a lamp stand on a table top without the table
 * reporting that the lamp is inside it.
 */
export const propBoundsOverlap = (
  left: IAutoMoviePropBox,
  right: IAutoMoviePropBox,
): boolean =>
  left.min.x < right.max.x &&
  left.max.x > right.min.x &&
  left.min.y < right.max.y &&
  left.max.y > right.min.y &&
  left.min.z < right.max.z &&
  left.max.z > right.min.z;

/**
 * Whether a world volume lies inside a logical space or any space below it.
 *
 * A space whose subtree declares no convex cell locates nothing, so it excludes
 * nothing and the answer is `true`: a purely semantic container ("the west
 * wing") is a name, not a boundary, and refusing props inside it would invent a
 * geometric claim the author never made. Throws when the space is not declared,
 * exactly as {@link builtEnvironmentContainsPoint} does.
 */
export const propSpaceContainsBounds = (props: {
  environment: IAutoMovieBuiltEnvironment;
  space: string;
  bounds: IAutoMoviePropBox;
}): boolean => {
  const inside = boxCorners(props.bounds).map((point) =>
    builtEnvironmentContainsPoint(props.environment, props.space, point),
  );
  const included = descendantSpaces(props.environment, props.space);
  const locates = props.environment.spaces.some(
    (space) => included.has(space.id) && space.cells.length > 0,
  );
  if (!locates) return true;
  return inside.every((value) => value);
};

/**
 * Every opening and connector a world volume intrudes on.
 *
 * An opening is only measurable through the element that fills it, so an open
 * cut (`fill: null`) and a fill whose model lives outside the record are
 * reported by neither this predicate nor the validator: a passage nothing
 * describes cannot be proven blocked, and guessing where the hole is would be
 * worse than saying nothing. A connector is swept from its own route: each
 * segment widens by half the usable width horizontally and rises by the clear
 * height, which is the volume a body traversing it needs. A connector that
 * declares no section at all is skipped for the same reason as an open cut.
 */
export const propBlockedPassages = (props: {
  environment: IAutoMovieBuiltEnvironment;
  bounds: IAutoMoviePropBox;
}): IAutoMoviePassageBlockage[] => {
  const blocked: IAutoMoviePassageBlockage[] = [];
  for (const opening of props.environment.openings) {
    const reveal = openingRevealBounds(props.environment, opening.id);
    if (reveal !== null && propBoundsOverlap(props.bounds, reveal))
      blocked.push({ kind: "opening", id: opening.id });
  }
  for (const connector of props.environment.connectors)
    if (
      connectorCorridors(connector).some((corridor) =>
        propBoundsOverlap(props.bounds, corridor),
      )
    )
      blocked.push({ kind: "connector", id: connector.id });
  return blocked;
};

/**
 * The world face a prop rests on, as one record both kinds of support answer.
 *
 * A building support patch and another prop's `stack-top` state their face in
 * different terms and are read here in one: a convex footprint on the ground
 * plan, and a rule saying how high the face stands over that footprint. The
 * patch already carries both. The affordance carries an extent in its host's
 * model frame, which becomes a face by travelling through the host's full
 * staged TRS, the same transform {@link propOccupancyBounds} measures the
 * resting prop through, so a scaled or turned host's top and the geometry that
 * shows it stay one surface rather than drifting apart.
 */
export interface IAutoMoviePropSupportFace {
  /** Convex hull of the face's footprint, in world XZ, counter-clockwise. */
  polygon: IAutoMovieVector3[];

  /** How high the face stands, in the spelling {@link surfaceHeightAt} reads. */
  height: IAutoMovieHeightSurface;
}

/**
 * The face one `on-support` relation resolves to, or `null` when the record
 * states none.
 *
 * Nothing is guessed. A citation that does not resolve, a contact of a kind
 * that carries no face at all (`handle`, `socket`, `hook`), a `stack-top`
 * missing its extent, a patch whose polygon encloses no area, and a top staged
 * edge-on to the ground each answer `null`, because a face nobody can measure
 * is not a face a prop can be proven off. The vertical top is the interesting
 * one of those: its height over the ground plan is not a function, so there is
 * no rule to read it by, and inventing one would refuse or excuse a prop for a
 * number the author never wrote.
 *
 * Lookups take the first record of a given id, exactly as
 * {@link propAnchorFrame} does and for the same reason: contradicting ids are
 * {@link validatePropPlacements}'s own refusal, by name.
 */
export const propSupportFace = (props: {
  /** The `on-support` relation's target: a patch, or another prop's contact. */
  target:
    | IAutoMoviePropRelationTarget.ISurface
    | IAutoMoviePropRelationTarget.IPropAffordance;

  /** Every built environment a patch citation may resolve against. */
  environments: readonly IAutoMovieBuiltEnvironment[];

  /** The prop registry a `prop-affordance` citation resolves against. */
  props?: readonly IAutoMoviePropSpec[];

  /** The staged set that gives a cited host prop its world transform. */
  set?: readonly IAutoMovieStageSetPiece[];
}): IAutoMoviePropSupportFace | null => {
  const target = props.target;
  if (target.kind === "surface") {
    const environment = props.environments.find(
      (candidate) => candidate.id === target.environment,
    );
    const entry = environment?.surfaces.find(
      (candidate) => candidate.surface.id === target.surface,
    );
    if (entry === undefined) return null;
    const polygon = convexHull2D(entry.surface.polygon);
    if (polygon.length < 3) return null;
    return { polygon, height: entry.surface };
  }
  const spec = (props.props ?? []).find((prop) => prop.node === target.prop);
  const piece = (props.set ?? []).find((item) => item.node === target.prop);
  const affordance = spec?.model.affordances?.find(
    (candidate) => candidate.id === target.affordance,
  );
  if (spec === undefined || piece === undefined || affordance === undefined)
    return null;
  if (affordance.kind !== "stack-top" || affordance.extent === null)
    return null;
  const matrix = Matrix4.multiply(
    stagedMatrix(piece),
    Matrix4.compose(
      affordance.frame.translation,
      affordance.frame.rotation,
      affordance.frame.scale,
    ),
  );
  const height = facePlane(matrix);
  if (height === null) return null;
  return {
    polygon: convexHull2D(
      affordance.extent.map((corner) =>
        transformPoint({ x: corner.x, y: 0, z: corner.z }, matrix),
      ),
    ),
    height,
  };
};

/**
 * How far a staged prop's underside stands above the face it rests on: negative
 * where it sinks into the support, zero where it touches it, positive where it
 * floats. `null` when no probe of the prop's footprint lies over the face at
 * all, which is the answer for a prop that does not stand over its support
 * rather than one standing at the wrong height on it.
 *
 * Contact is probed from both sides: at the footprint's four corners and its
 * centre where those land on the face, and at the face's own corners where
 * those land under the footprint. One side alone would be wrong in one
 * direction each. A prop standing on a patch smaller than itself covers none of
 * its own probes with the patch, and a patch wider than the prop is never
 * reached at its corners, so a bench on a plinth and a chair on a floor are the
 * same question asked from whichever side can answer it.
 *
 * The deepest of those probes answers, which is what lets a box resting along
 * one edge of a ramp still be resting on it while a box whose near corner has
 * gone through the ramp is not, and it is the same footprint sampling
 * {@link supportContactsFor} decides a scene's supports by. Relief between the
 * probes is not read: a support that rises and falls between them is answered
 * where they stand.
 */
export const propSupportGap = (props: {
  /** The face the prop claims to rest on. */
  face: IAutoMoviePropSupportFace;

  /** The prop's world occupancy, from {@link propOccupancyBounds}. */
  bounds: IAutoMoviePropBox;
}): number | null => {
  const bounds = props.bounds;
  const probes = [
    ...footprintProbes(bounds).filter((probe) =>
      pointInHull(probe, props.face.polygon),
    ),
    ...props.face.polygon.filter((corner) => underFootprint(corner, bounds)),
  ];
  let gap: number | null = null;
  for (const probe of probes) {
    const rise =
      bounds.min.y - surfaceHeightAt(props.face.height, probe.x, probe.z);
    gap = gap === null ? rise : Math.min(gap, rise);
  }
  return gap;
};

/**
 * The world frame a placement relation anchors to, or `null` when it has none.
 *
 * This is the relative-transform half of placement: a source that wants twelve
 * chairs around a table asks for the table's `stack-top` frame once and offsets
 * from it in a loop, instead of typing twelve world positions that stop being
 * right the moment the table moves. Regions have no frame, so a `space` target
 * answers `null`; a `boundary` answers with its first realizing element and an
 * `opening` with its filling element, because those are the only members of
 * those records that carry a transform.
 *
 * Lookups take the first record of a given id. Two buildings sharing one id is
 * a contradiction {@link validatePropPlacements} refuses by name, so resolving
 * it a second time here would report the same defect in a worse place.
 */
export const propAnchorFrame = (props: {
  target: IAutoMoviePropRelationTarget;
  environments: readonly IAutoMovieBuiltEnvironment[];
  props?: readonly IAutoMoviePropSpec[];
  set?: readonly IAutoMovieStageSetPiece[];
}): IAutoMovieTransform | null => {
  const target = props.target;
  if (target.kind === "prop-affordance") {
    const spec = (props.props ?? []).find((prop) => prop.node === target.prop);
    const piece = (props.set ?? []).find((item) => item.node === target.prop);
    const affordance = spec?.model.affordances?.find(
      (candidate) => candidate.id === target.affordance,
    );
    if (spec === undefined || piece === undefined || affordance === undefined)
      return null;
    return transformOf(
      Matrix4.multiply(
        stagedMatrix(piece),
        Matrix4.compose(
          affordance.frame.translation,
          affordance.frame.rotation,
          affordance.frame.scale,
        ),
      ),
    );
  }
  const environment = props.environments.find(
    (candidate) => candidate.id === target.environment,
  );
  if (environment === undefined) return null;
  switch (target.kind) {
    case "space":
      return null;
    case "element": {
      const matrix = elementWorldMatrix(environment, target.element);
      return matrix === null ? null : transformOf(matrix);
    }
    case "boundary": {
      const boundary = environment.boundaries.find(
        (candidate) => candidate.id === target.boundary,
      );
      const element = boundary?.elements[0];
      if (element === undefined) return null;
      const matrix = elementWorldMatrix(environment, element);
      return matrix === null ? null : transformOf(matrix);
    }
    case "opening": {
      const opening = environment.openings.find(
        (candidate) => candidate.id === target.opening,
      );
      const fill = opening?.fill ?? null;
      if (fill === null) return null;
      const matrix = elementWorldMatrix(environment, fill);
      return matrix === null ? null : transformOf(matrix);
    }
    case "surface": {
      const entry = environment.surfaces.find(
        (candidate) => candidate.surface.id === target.surface,
      );
      if (entry === undefined || entry.surface.polygon.length === 0)
        return null;
      const centroid = entry.surface.polygon.reduce(
        (sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }),
        { x: 0, z: 0 },
      );
      const count = entry.surface.polygon.length;
      const x = centroid.x / count;
      const z = centroid.z / count;
      return {
        translation: { x, y: surfaceHeightAt(entry.surface, x, z), z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      };
    }
  }
};

interface IIndexed<Value> {
  value: Value;
  index: number;
}

interface IResolvedProp extends IIndexed<IAutoMoviePropSpec> {
  forged: boolean;
  piece: IIndexed<IAutoMovieStageSetPiece> | undefined;
  unique: boolean;
}

type Environments = ReadonlyMap<
  string,
  readonly IIndexed<IAutoMovieBuiltEnvironment>[]
>;
type Props = ReadonlyMap<string, readonly IIndexed<IAutoMoviePropSpec>[]>;

/** Which target kinds each relation kind accepts. */
const RELATION_TARGETS: Readonly<
  Record<
    IAutoMoviePropRelation["kind"],
    readonly IAutoMoviePropRelationTarget["kind"][]
  >
> = {
  "in-space": ["space"],
  "on-support": ["surface", "prop-affordance"],
  "against-boundary": ["boundary"],
  "fill-opening": ["opening"],
  attached: ["element", "prop-affordance"],
  suspended: ["element", "prop-affordance"],
};

/**
 * Which affordance a prop-affordance target must declare.
 *
 * Only the three kinds whose {@link RELATION_TARGETS} entry admits a
 * prop-affordance target ever reach this, so every arm is live: resting is a
 * `stack-top`, plugging in is a `socket`, hanging is a `hook`.
 */
const requiredAffordance = (
  kind: IAutoMoviePropRelation["kind"],
): AutoMovieAffordanceKind => {
  if (kind === "attached") return "socket";
  if (kind === "suspended") return "hook";
  return "stack-top";
};

/**
 * Validate a source-owned prop registry, its unique staged join, its typed
 * building relations, its support graph, the bearing of every prop on the face
 * it says holds it up, and every transformed volume it claims.
 *
 * Registry construction is deliberately a separate first pass. A lamp may cite
 * a table declared later without changing the result, while duplicate prop,
 * set-piece, or building-environment identities stay explicit rather than being
 * hidden by `Map`'s last-write-wins behavior.
 *
 * Two silences are contractual. A prop that omits `placement` retains the
 * original forge-and-stage contract: it claims no relation and is claimed by
 * none, so it takes part in no containment, overlap, or passage judgment. And a
 * geometric judgment is only made where the record can answer it, so a
 * cell-less logical space, an opening whose fill has no model, and a prop whose
 * staged join is missing or ambiguous are reported as what they are rather than
 * silently failing a spatial test they cannot be measured against.
 */
export const validatePropPlacements = (props: {
  props: readonly IAutoMoviePropSpec[];
  set: readonly IAutoMovieStageSetPiece[];
  builtEnvironments: readonly IAutoMovieBuiltEnvironment[];
}): IAutoMovieValidation => {
  const out = new ViolationCollector();
  const byNode = indexBy(props.props, (prop) => prop.node);
  const setByNode = indexBy(props.set, (piece) => piece.node);
  const environments = indexBy(
    props.builtEnvironments,
    (environment) => environment.id,
  );

  reportDuplicates(byNode, "$input.props", "node", "prop node", out);
  reportDuplicates(setByNode, "$input.set", "node", "staged set node", out);
  reportDuplicates(
    environments,
    "$input.builtEnvironments",
    "id",
    "built environment id",
    out,
  );

  const resolved: IResolvedProp[] = props.props.map((prop, index) => {
    const path = `$input.props[${index}]`;
    const forged = forgeProp(prop);
    if (forged.success === false)
      for (const violation of forged.violations)
        out.items.push({
          ...violation,
          path: violation.path.replace("$input", path),
        });
    const pieces = setByNode.get(prop.node) ?? [];
    if (pieces.length === 0)
      out.push(
        "type",
        `${path}.node`,
        `prop "${prop.node}" needs one staged set placement`,
        prop.node,
      );
    else if (pieces.length === 1 && pieces[0]!.value.model !== prop.model.id)
      out.push(
        "type",
        `$input.set[${pieces[0]!.index}].model`,
        `staged prop "${prop.node}" uses model "${pieces[0]!.value.model}" instead of "${prop.model.id}"`,
        pieces[0]!.value.model,
      );
    return {
      value: prop,
      index,
      forged: forged.success,
      piece: pieces.length === 1 ? pieces[0] : undefined,
      // The prop indexed itself, so its own bucket always exists.
      unique: byNode.get(prop.node)!.length === 1,
    };
  });

  for (const entry of resolved)
    if (entry.value.placement !== undefined)
      validatePlacement(entry, environments, byNode, out);
  validateSupportCycles(byNode, out);
  validateGeometry(resolved, environments, out);
  return out.toValidation();
};

/** The single `in-space` relation a placement declares, when it has one. */
const occupiedSpace = (
  prop: IAutoMoviePropSpec,
): IAutoMoviePropRelationTarget.ISpace | null => {
  for (const relation of prop.placement?.relations ?? [])
    if (relation.kind === "in-space" && relation.target.kind === "space")
      return relation.target;
  return null;
};

/** The environment a prop is located in, when exactly one record declares it. */
const locatedEnvironment = (
  prop: IAutoMoviePropSpec,
  environments: Environments,
): IAutoMovieBuiltEnvironment | null => {
  const space = occupiedSpace(prop);
  if (space === null) return null;
  return uniqueEnvironment(space.environment, environments);
};

/**
 * The environment a prop's geometry is judged against.
 *
 * The occupied space answers first, because that is the prop's own statement of
 * where it is. A prop that names no space but cites one building anyway (a leaf
 * that only declares which opening it fills) is still judged there: refusing to
 * measure it would let the strongest claim a prop can make, that it fits a
 * passage, go unchecked because a weaker one was left out. Relations pointing
 * at two buildings at once name no single place, so nothing is measured and the
 * relation-level refusals stand on their own.
 */
const geometryEnvironment = (
  prop: IAutoMoviePropSpec,
  relations: readonly IAutoMoviePropRelation[],
  environments: Environments,
): IAutoMovieBuiltEnvironment | null => {
  const occupied = locatedEnvironment(prop, environments);
  if (occupied !== null) return occupied;
  const cited = new Set<string>();
  for (const relation of relations)
    if (relation.target.kind !== "prop-affordance")
      cited.add(relation.target.environment);
  if (cited.size !== 1) return null;
  return uniqueEnvironment([...cited][0]!, environments);
};

const uniqueEnvironment = (
  id: string,
  environments: Environments,
): IAutoMovieBuiltEnvironment | null => {
  const matches = environments.get(id) ?? [];
  return matches.length === 1 ? matches[0]!.value : null;
};

const validatePlacement = (
  entry: IIndexed<IAutoMoviePropSpec>,
  environments: Environments,
  props: Props,
  out: ViolationCollector,
): void => {
  const prop = entry.value;
  const path = `$input.props[${entry.index}]`;
  const placement = prop.placement!;
  const located = locatedEnvironment(prop, environments);
  const seen = new Set<string>();
  let spaces = 0;
  let openings = 0;

  placement.relations.forEach((relation, index) => {
    const rp = `${path}.placement.relations[${index}]`;
    const key = relationKey(relation);
    if (seen.has(key))
      out.push(
        "type",
        rp,
        `relation "${relation.kind}" is declared twice for the same target`,
        key,
      );
    seen.add(key);
    if (relation.kind === "in-space") {
      spaces += 1;
      if (spaces > 1)
        out.push(
          "type",
          `${rp}.kind`,
          "a prop occupies at most one logical space",
          relation.kind,
        );
    }
    if (relation.kind === "fill-opening") {
      openings += 1;
      if (openings > 1)
        out.push(
          "type",
          `${rp}.kind`,
          "a prop fills at most one opening",
          relation.kind,
        );
    }
    if (!RELATION_TARGETS[relation.kind].includes(relation.target.kind)) {
      out.push(
        "type",
        `${rp}.target.kind`,
        `relation "${relation.kind}" does not accept a "${relation.target.kind}" target`,
        relation.target.kind,
      );
      return;
    }
    const target = relation.target;
    if (target.kind !== "prop-affordance") {
      validateBuildingTarget(target, rp, environments, out);
      if (located !== null && target.environment !== located.id)
        out.push(
          "type",
          `${rp}.target.environment`,
          `relation environment "${target.environment}" differs from occupied space environment "${located.id}"`,
          target.environment,
        );
      return;
    }
    validatePropTarget(relation, target, rp, prop, props, out);
    const matches = props.get(target.prop) ?? [];
    if (matches.length !== 1 || located === null) return;
    const supporting = locatedEnvironment(matches[0]!.value, environments);
    if (supporting !== null && supporting.id !== located.id)
      out.push(
        "type",
        `${rp}.target.prop`,
        `prop "${target.prop}" occupies environment "${supporting.id}" instead of "${located.id}"`,
        target.prop,
      );
  });

  if (placement.footprint !== null)
    validateBox(placement.footprint, `${path}.placement.footprint`, out);
  const ids = new Set<string>();
  placement.clearance.forEach((clearance, index) => {
    const cp = `${path}.placement.clearance[${index}]`;
    if (clearance.id.trim().length === 0)
      out.push(
        "type",
        `${cp}.id`,
        "clearance id must be non-empty",
        clearance.id,
      );
    if (ids.has(clearance.id))
      out.push(
        "type",
        `${cp}.id`,
        `clearance id "${clearance.id}" is duplicated`,
        clearance.id,
      );
    ids.add(clearance.id);
    validateBox(clearance, cp, out);
  });
};

/** Gate a relation that cites another prop's declared contact point. */
const validatePropTarget = (
  relation: IAutoMoviePropRelation,
  target: IAutoMoviePropRelationTarget.IPropAffordance,
  rp: string,
  prop: IAutoMoviePropSpec,
  props: Props,
  out: ViolationCollector,
): void => {
  if (target.prop === prop.node) {
    out.push(
      "type",
      `${rp}.target.prop`,
      "a prop cannot rest on, plug into, or hang from itself",
      target.prop,
    );
    return;
  }
  const matches = props.get(target.prop) ?? [];
  if (matches.length !== 1) {
    out.push(
      "type",
      `${rp}.target.prop`,
      matches.length === 0
        ? `prop "${target.prop}" does not resolve`
        : `prop "${target.prop}" is ambiguous`,
      target.prop,
    );
    return;
  }
  const affordance = matches[0]!.value.model.affordances?.find(
    (candidate) => candidate.id === target.affordance,
  );
  if (affordance === undefined) {
    out.push(
      "type",
      `${rp}.target.affordance`,
      `affordance "${target.affordance}" does not resolve on prop "${target.prop}"`,
      target.affordance,
    );
    return;
  }
  const expected = requiredAffordance(relation.kind);
  if (affordance.kind !== expected)
    out.push(
      "type",
      `${rp}.target.affordance`,
      `relation "${relation.kind}" needs a "${expected}" affordance, but "${target.affordance}" is a "${affordance.kind}"`,
      affordance.kind,
    );
};

/** Gate a relation that cites the architecture graph. */
const validateBuildingTarget = (
  target: Exclude<
    IAutoMoviePropRelationTarget,
    IAutoMoviePropRelationTarget.IPropAffordance
  >,
  rp: string,
  environments: Environments,
  out: ViolationCollector,
): void => {
  const environment = resolveUnique(
    environments,
    target.environment,
    `${rp}.target.environment`,
    "built environment",
    out,
  );
  if (environment === undefined) return;
  switch (target.kind) {
    case "space":
      if (!environment.spaces.some((space) => space.id === target.space))
        out.push(
          "type",
          `${rp}.target.space`,
          `logical space "${target.space}" does not resolve`,
          target.space,
        );
      return;
    case "element":
      if (!environment.elements.some((item) => item.id === target.element))
        out.push(
          "type",
          `${rp}.target.element`,
          `building element "${target.element}" does not resolve`,
          target.element,
        );
      return;
    case "boundary":
      if (!environment.boundaries.some((item) => item.id === target.boundary))
        out.push(
          "type",
          `${rp}.target.boundary`,
          `boundary "${target.boundary}" does not resolve`,
          target.boundary,
        );
      return;
    case "opening":
      if (!environment.openings.some((item) => item.id === target.opening))
        out.push(
          "type",
          `${rp}.target.opening`,
          `opening "${target.opening}" does not resolve`,
          target.opening,
        );
      return;
    case "surface":
      if (!environment.surfaces.some((e) => e.surface.id === target.surface))
        out.push(
          "type",
          `${rp}.target.surface`,
          `support surface "${target.surface}" does not resolve`,
          target.surface,
        );
      return;
  }
};

/** Refuse a prop that transitively rests on, plugs into, or hangs from itself. */
const validateSupportCycles = (props: Props, out: ViolationCollector): void => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: IIndexed<IAutoMoviePropSpec>): void => {
    if (visited.has(entry.value.node)) return;
    visiting.add(entry.value.node);
    (entry.value.placement?.relations ?? []).forEach((relation, index) => {
      const target = relation.target;
      if (target.kind !== "prop-affordance" || target.prop === entry.value.node)
        return;
      const matches = props.get(target.prop) ?? [];
      if (matches.length !== 1) return;
      if (visiting.has(target.prop))
        out.push(
          "type",
          `$input.props[${entry.index}].placement.relations[${index}].target.prop`,
          `prop contact relation forms a cycle through "${target.prop}"`,
          target.prop,
        );
      else visit(matches[0]!);
    });
    visiting.delete(entry.value.node);
    visited.add(entry.value.node);
  };
  for (const matches of props.values())
    if (matches.length === 1) visit(matches[0]!);
};

/**
 * Judge every volume the sound part of the registry can be measured against.
 *
 * "Sound" is deliberately narrow: a prop is only measured when it forged, when
 * its node is declared once, when exactly one staged piece places it, and when
 * any footprint it declares is a real volume. Measuring an ambiguous, unforged,
 * or degenerate prop would report a second failure caused by the first, and the
 * author would correct the wrong line.
 */
const validateGeometry = (
  resolved: readonly IResolvedProp[],
  environments: Environments,
  out: ViolationCollector,
): void => {
  const staged = resolved.filter((entry) => {
    if (!entry.forged || !entry.unique || entry.piece === undefined)
      return false;
    const footprint = entry.value.placement?.footprint ?? null;
    return footprint === null || finiteBox(footprint);
  });
  const occupancy = new Map<number, IAutoMoviePropBox>(
    staged.map((entry) => [
      entry.index,
      propOccupancyBounds({ prop: entry.value, piece: entry.piece!.value }),
    ]),
  );

  for (const entry of staged) {
    const placement = entry.value.placement;
    if (placement === undefined) continue;
    const path = `$input.props[${entry.index}]`;
    propClearanceBounds({
      prop: entry.value,
      piece: entry.piece!.value,
    }).forEach((clearance, index) => {
      if (!finiteBox(placement.clearance[index]!)) return;
      for (const candidate of staged)
        if (
          candidate.index !== entry.index &&
          propBoundsOverlap(clearance, occupancy.get(candidate.index)!)
        )
          out.push(
            "range",
            `${path}.placement.clearance[${index}]`,
            `clearance "${clearance.id}" intersects staged prop "${candidate.value.node}"`,
            candidate.value.node,
          );
    });
  }

  const contacts = contactPairs(staged);
  for (let left = 0; left < staged.length; ++left)
    for (let right = left + 1; right < staged.length; ++right) {
      const a = staged[left]!;
      const b = staged[right]!;
      if (a.value.placement === undefined || b.value.placement === undefined)
        continue;
      if (contacts.has(pairKey(a.value.node, b.value.node))) continue;
      if (!propBoundsOverlap(occupancy.get(a.index)!, occupancy.get(b.index)!))
        continue;
      out.push(
        "range",
        `$input.props[${b.index}].placement.footprint`,
        `staged occupancy overlaps prop "${a.value.node}", which declares no contact with it`,
        a.value.node,
      );
    }

  validateSupports(staged, occupancy, environments, out);

  for (const entry of staged) {
    const placement = entry.value.placement;
    if (placement === undefined) continue;
    const environment = geometryEnvironment(
      entry.value,
      placement.relations,
      environments,
    );
    if (environment === null) continue;
    validateOccupancy(entry, environment, occupancy.get(entry.index)!, out);
  }
};

/**
 * Judge every `on-support` relation whose face the record can state.
 *
 * A prop that says it rests on something is making the one placement claim
 * geometry can settle outright, and until this ran a source could stage a chair
 * a metre above the floor it cites and be told nothing. Support is judged apart
 * from the containment pass because it needs no logical space: a lamp that only
 * says which table top it stands on has named a face, and that face is
 * measurable whether or not the lamp also says which room it is in. Each
 * relation is judged on its own, so a plank across two tables answers for both
 * of them.
 *
 * A relation whose host is not itself soundly staged, and one citing a face the
 * record cannot state, are passed over rather than guessed at. So is a prop
 * citing itself, which {@link validatePropTarget} already refuses by name:
 * measuring a prop against its own top would answer for that fault twice.
 */
const validateSupports = (
  staged: readonly IResolvedProp[],
  occupancy: ReadonlyMap<number, IAutoMoviePropBox>,
  environments: Environments,
  out: ViolationCollector,
): void => {
  const hosts = new Map(staged.map((entry) => [entry.value.node, entry]));
  for (const entry of staged)
    (entry.value.placement?.relations ?? []).forEach((relation, index) => {
      const target = relation.target;
      if (relation.kind !== "on-support") return;
      if (target.kind !== "surface" && target.kind !== "prop-affordance")
        return;
      if (target.kind === "prop-affordance" && target.prop === entry.value.node)
        return;
      const host =
        target.kind === "prop-affordance" ? hosts.get(target.prop) : undefined;
      const environment =
        target.kind === "surface"
          ? uniqueEnvironment(target.environment, environments)
          : null;
      const face = propSupportFace({
        target,
        environments: environment === null ? [] : [environment],
        props: host === undefined ? [] : [host.value],
        set: host === undefined ? [] : [host.piece!.value],
      });
      if (face === null) return;
      const gap = propSupportGap({ face, bounds: occupancy.get(entry.index)! });
      const path =
        `$input.props[${entry.index}].placement.relations[${index}].target.` +
        (target.kind === "surface" ? "surface" : "affordance");
      const label =
        target.kind === "surface"
          ? `support surface "${target.surface}"`
          : `prop "${target.prop}" affordance "${target.affordance}"`;
      if (gap === null)
        out.push(
          "range",
          path,
          `staged occupancy does not stand over ${label}`,
          target.kind === "surface" ? target.surface : target.affordance,
        );
      else if (gap < -PLACEMENT_EPSILON)
        out.push("range", path, `staged occupancy sinks into ${label}`, gap);
      else if (gap > PLACEMENT_EPSILON)
        out.push("range", path, `staged occupancy floats above ${label}`, gap);
    });
};

/** Containment, opening fit, and passage intrusion for one located prop. */
const validateOccupancy = (
  entry: IResolvedProp,
  environment: IAutoMovieBuiltEnvironment,
  bounds: IAutoMoviePropBox,
  out: ViolationCollector,
): void => {
  const path = `$input.props[${entry.index}]`;
  const relations = entry.value.placement!.relations;
  const filled = new Set<string>();
  relations.forEach((relation, index) => {
    const rp = `${path}.placement.relations[${index}]`;
    const target = relation.target;
    if (
      relation.kind === "in-space" &&
      target.kind === "space" &&
      target.environment === environment.id
    ) {
      if (!environment.spaces.some((space) => space.id === target.space))
        return;
      if (
        !propSpaceContainsBounds({ environment, space: target.space, bounds })
      )
        out.push(
          "range",
          `${rp}.target.space`,
          `staged occupancy leaves logical space "${target.space}"`,
          target.space,
        );
      return;
    }
    if (relation.kind !== "fill-opening" || target.kind !== "opening") return;
    if (target.environment !== environment.id) return;
    filled.add(target.opening);
    const reveal = openingRevealBounds(environment, target.opening);
    if (reveal === null) return;
    if (!boxContains(reveal, bounds))
      out.push(
        "range",
        `${rp}.target.opening`,
        `staged occupancy does not fit the fill element of opening "${target.opening}"`,
        target.opening,
      );
  });

  for (const blockage of propBlockedPassages({ environment, bounds })) {
    if (blockage.kind === "opening" && filled.has(blockage.id)) continue;
    out.push(
      "range",
      `${path}.placement`,
      `staged occupancy blocks ${blockage.kind} "${blockage.id}"`,
      blockage.id,
    );
  }
};

/** Unordered node pairs that declare a contact and may therefore touch. */
const contactPairs = (staged: readonly IResolvedProp[]): Set<string> => {
  const pairs = new Set<string>();
  for (const entry of staged)
    for (const relation of entry.value.placement?.relations ?? [])
      if (relation.target.kind === "prop-affordance")
        pairs.add(pairKey(entry.value.node, relation.target.prop));
  return pairs;
};

const pairKey = (left: string, right: string): string =>
  left < right ? `${left}\0${right}` : `${right}\0${left}`;

const relationKey = (relation: IAutoMoviePropRelation): string => {
  const target = relation.target;
  const tail =
    target.kind === "prop-affordance"
      ? `${target.prop}\0${target.affordance}`
      : `${target.environment}\0${targetId(target)}`;
  return `${relation.kind}\0${target.kind}\0${tail}`;
};

const targetId = (
  target: Exclude<
    IAutoMoviePropRelationTarget,
    IAutoMoviePropRelationTarget.IPropAffordance
  >,
): string => {
  switch (target.kind) {
    case "space":
      return target.space;
    case "element":
      return target.element;
    case "boundary":
      return target.boundary;
    case "opening":
      return target.opening;
    case "surface":
      return target.surface;
  }
};

const validateBox = (
  box: IAutoMoviePropBox,
  path: string,
  out: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (
      !Number.isFinite(box.min[axis]) ||
      !Number.isFinite(box.max[axis]) ||
      box.min[axis] >= box.max[axis]
    )
      out.push(
        "range",
        `${path}.${axis}`,
        `${axis} bounds must be finite and min < max`,
        { min: box.min[axis], max: box.max[axis] },
      );
};

const finiteBox = (box: IAutoMoviePropBox): boolean =>
  (["x", "y", "z"] as const).every(
    (axis) =>
      Number.isFinite(box.min[axis]) &&
      Number.isFinite(box.max[axis]) &&
      box.min[axis] < box.max[axis],
  );

const indexBy = <Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): Map<string, IIndexed<Value>[]> => {
  const indexed = new Map<string, IIndexed<Value>[]>();
  values.forEach((value, index) => {
    const id = key(value);
    const matches = indexed.get(id);
    if (matches === undefined) indexed.set(id, [{ value, index }]);
    else matches.push({ value, index });
  });
  return indexed;
};

const reportDuplicates = <Value>(
  indexed: ReadonlyMap<string, readonly IIndexed<Value>[]>,
  path: string,
  field: string,
  label: string,
  out: ViolationCollector,
): void => {
  for (const [id, matches] of indexed)
    for (const match of matches.slice(1))
      out.push(
        "type",
        `${path}[${match.index}].${field}`,
        `${label} "${id}" is duplicated`,
        id,
      );
};

const resolveUnique = <Value>(
  indexed: ReadonlyMap<string, readonly IIndexed<Value>[]>,
  id: string,
  path: string,
  label: string,
  out: ViolationCollector,
): Value | undefined => {
  const matches = indexed.get(id) ?? [];
  if (matches.length === 1) return matches[0]!.value;
  out.push(
    "type",
    path,
    matches.length === 0
      ? `${label} "${id}" does not resolve`
      : `${label} "${id}" is ambiguous`,
    id,
  );
  return undefined;
};

/** Every logical space at or below `root`, by declared parent links. */
const descendantSpaces = (
  environment: IAutoMovieBuiltEnvironment,
  root: string,
): Set<string> => {
  const included = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const space of environment.spaces)
      if (
        space.parent !== null &&
        included.has(space.parent) &&
        !included.has(space.id)
      ) {
        included.add(space.id);
        changed = true;
      }
  }
  return included;
};

/**
 * The world matrix of one element, or `null` when it or an ancestor is missing
 * or its parent chain closes on itself. A cyclic record is refused by
 * `validateBuiltEnvironment`, and answering `null` here rather than recursing
 * forever is what lets both gates report their own defect in one run.
 */
const elementWorldMatrix = (
  environment: IAutoMovieBuiltEnvironment,
  id: string,
): number[] | null => {
  const byId = new Map(
    environment.elements.map((element) => [element.id, element]),
  );
  const trail = new Set<string>();
  const read = (current: string): number[] | null => {
    if (trail.has(current)) return null;
    trail.add(current);
    const element = byId.get(current);
    if (element === undefined) return null;
    const local = Matrix4.compose(
      element.transform.translation,
      element.transform.rotation,
      element.transform.scale,
    );
    if (element.parent === null) return local;
    const parent = read(element.parent);
    return parent === null ? null : Matrix4.multiply(parent, local);
  };
  return read(id);
};

/** World bounds of the element filling an opening, or `null` when unmeasurable. */
const openingRevealBounds = (
  environment: IAutoMovieBuiltEnvironment,
  id: string,
): IAutoMoviePropBox | null => {
  const opening = environment.openings.find((candidate) => candidate.id === id);
  const fill = opening?.fill ?? null;
  if (fill === null) return null;
  const element = environment.elements.find(
    (candidate) => candidate.id === fill,
  );
  const model = environment.models.find(
    (candidate) => candidate.id === element?.model,
  );
  if (model === undefined) return null;
  const matrix = elementWorldMatrix(environment, fill);
  return matrix === null ? null : transformedModelBounds(model, matrix);
};

/**
 * Axis-aligned volumes a connector's route sweeps at its usable size.
 *
 * A connector that states no section at all sweeps nothing here, and a prop
 * standing in it is therefore reported by neither this predicate nor the
 * validator, for the same reason an open cut is: an unstated width is not a
 * width of zero, and a passage whose size nobody declared cannot be proven
 * blocked. `validateBuiltEnvironment` refuses that record on its own path, so
 * the missing declaration is reported where it can be fixed rather than guessed
 * at here.
 *
 * A varying section is read where the segment actually is, and each segment
 * takes the widest section it spans. The box is already an outer bound of the
 * segment it sweeps, so widening it to the segment's most generous station
 * keeps the answer on the conservative side rather than letting a prop hide in
 * the narrow half of a tapering corridor.
 */
const connectorCorridors = (
  connector: IAutoMovieBuiltConnector,
): IAutoMoviePropBox[] => {
  const cumulative = [0];
  for (let index = 0; index + 1 < connector.route.length; ++index) {
    const from = connector.route[index]!;
    const to = connector.route[index + 1]!;
    cumulative.push(
      cumulative[index]! +
        Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z),
    );
  }
  const total = cumulative[cumulative.length - 1]!;
  // Whether a section is stated is a property of the record alone, so one probe
  // settles it for every station read below.
  if (total <= 0 || builtConnectorSection(connector, 0) === null) return [];
  const boxes: IAutoMoviePropBox[] = [];
  for (let index = 0; index + 1 < connector.route.length; ++index) {
    const from = connector.route[index]!;
    const to = connector.route[index + 1]!;
    const start = cumulative[index]! / total;
    const end = cumulative[index + 1]! / total;
    const samples = [start, end];
    for (const section of connector.sections ?? [])
      if (section.at > start && section.at < end) samples.push(section.at);
    const sections = samples.map((at) => builtConnectorSection(connector, at)!);
    const half = Math.max(...sections.map((section) => section.width)) / 2;
    const clearHeight = Math.max(
      ...sections.map((section) => section.clearHeight),
    );
    boxes.push({
      min: {
        x: Math.min(from.x, to.x) - half,
        y: Math.min(from.y, to.y),
        z: Math.min(from.z, to.z) - half,
      },
      max: {
        x: Math.max(from.x, to.x) + half,
        y: Math.max(from.y, to.y) + clearHeight,
        z: Math.max(from.z, to.z) + half,
      },
    });
  }
  return boxes;
};

const stagedMatrix = (piece: IAutoMovieStageSetPiece): number[] => {
  const scale =
    piece.scale === undefined
      ? { x: 1, y: 1, z: 1 }
      : typeof piece.scale === "number"
        ? { x: piece.scale, y: piece.scale, z: piece.scale }
        : piece.scale;
  return Matrix4.compose(
    piece.position,
    piece.rotation ??
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, piece.facingDeg ?? 0),
    scale,
  );
};

const transformOf = (matrix: number[]): IAutoMovieTransform => {
  const world = Matrix4.decompose(matrix);
  return {
    translation: world.position,
    rotation: Quaternion.normalize(world.rotation),
    scale: world.scale,
  };
};

const transformedModelBounds = (
  model: IAutoMovieModel,
  world: number[],
): IAutoMoviePropBox => {
  const points: IAutoMovieVector3[] = [];
  for (const part of model.parts) {
    const positions =
      part.geometry.type === "primitive"
        ? tessellate(part.geometry.shape).positions
        : part.geometry.mesh.positions;
    const matrix =
      part.transform === null
        ? world
        : Matrix4.multiply(
            world,
            Matrix4.compose(
              part.transform.translation,
              part.transform.rotation,
              part.transform.scale,
            ),
          );
    for (let index = 0; index < positions.length; index += 3)
      points.push(
        transformPoint(
          {
            x: positions[index]!,
            y: positions[index + 1]!,
            z: positions[index + 2]!,
          },
          matrix,
        ),
      );
  }
  if (points.length === 0) {
    const origin = Matrix4.position(world);
    return { min: { ...origin }, max: { ...origin } };
  }
  return boundsOf(points);
};

const transformedBox = (
  box: IAutoMoviePropBox,
  matrix: number[],
): IAutoMoviePropBox =>
  boundsOf(boxCorners(box).map((point) => transformPoint(point, matrix)));

/**
 * The plane a transform carries its local XZ plane onto, spelled as the height
 * rule {@link surfaceHeightAt} reads, or `null` when that image stands edge-on
 * to the ground.
 *
 * The face is spanned by the images of local `+X` and `+Z`, so its normal is
 * their cross product and it passes through the transform's own origin. A
 * normal with no vertical component of its own is the vertical face, and a
 * transform that collapses the face to a line or a point answers with the zero
 * normal, which the same comparison catches: in both, the height over `(x, z)`
 * is not a function, so there is no rule to read it by. The test is taken
 * against the normal's own length rather than against a length in metres, so a
 * face states its tilt the same way at whatever size it was staged.
 */
const facePlane = (matrix: number[]): IAutoMovieHeightSurface | null => {
  const ax = { x: matrix[0]!, y: matrix[1]!, z: matrix[2]! };
  const az = { x: matrix[8]!, y: matrix[9]!, z: matrix[10]! };
  const normal = {
    x: ax.y * az.z - ax.z * az.y,
    y: ax.z * az.x - ax.x * az.z,
    z: ax.x * az.y - ax.y * az.x,
  };
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (Math.abs(normal.y) <= PLACEMENT_EPSILON * length) return null;
  const slopeX = -normal.x / normal.y;
  const slopeZ = -normal.z / normal.y;
  return {
    height: {
      kind: "plane",
      originHeight: matrix[13]! - slopeX * matrix[12]! - slopeZ * matrix[14]!,
      slopeX,
      slopeZ,
    },
  };
};

/** Whether a ground-plan point stands under a staged prop's own footprint. */
const underFootprint = (
  point: IAutoMovieVector3,
  bounds: IAutoMoviePropBox,
): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.z >= bounds.min.z &&
  point.z <= bounds.max.z;

/** The five ground-plan points a footprint is judged to bear on. */
const footprintProbes = (bounds: IAutoMoviePropBox): IAutoMovieVector3[] => [
  { x: bounds.min.x, y: 0, z: bounds.min.z },
  { x: bounds.max.x, y: 0, z: bounds.min.z },
  { x: bounds.max.x, y: 0, z: bounds.max.z },
  { x: bounds.min.x, y: 0, z: bounds.max.z },
  {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: 0,
    z: (bounds.min.z + bounds.max.z) / 2,
  },
];

const boxCorners = (box: IAutoMoviePropBox): IAutoMovieVector3[] =>
  [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) =>
      [box.min.z, box.max.z].map((z) => ({ x, y, z })),
    ),
  );

const boxContains = (
  outer: IAutoMoviePropBox,
  inner: IAutoMoviePropBox,
): boolean =>
  (["x", "y", "z"] as const).every(
    (axis) =>
      inner.min[axis] >= outer.min[axis] - PLACEMENT_EPSILON &&
      inner.max[axis] <= outer.max[axis] + PLACEMENT_EPSILON,
  );

const transformPoint = (
  point: IAutoMovieVector3,
  matrix: number[],
): IAutoMovieVector3 => ({
  x:
    matrix[0]! * point.x +
    matrix[4]! * point.y +
    matrix[8]! * point.z +
    matrix[12]!,
  y:
    matrix[1]! * point.x +
    matrix[5]! * point.y +
    matrix[9]! * point.z +
    matrix[13]!,
  z:
    matrix[2]! * point.x +
    matrix[6]! * point.y +
    matrix[10]! * point.z +
    matrix[14]!,
});

const boundsOf = (points: readonly IAutoMovieVector3[]): IAutoMoviePropBox => {
  const first = points[0]!;
  const bounds: IAutoMoviePropBox = {
    min: { ...first },
    max: { ...first },
  };
  for (const point of points.slice(1)) {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
  }
  return bounds;
};
