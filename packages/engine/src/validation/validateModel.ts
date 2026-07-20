import {
  AutoMoviePrimitiveShape,
  IAutoMovieAffordance,
  IAutoMovieAngleRange,
  IAutoMovieBody,
  IAutoMovieColor,
  IAutoMovieJointConstraint,
  IAutoMovieMesh,
  IAutoMovieMeshSkin,
  IAutoMovieModel,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import { convexHull2D } from "../math/hull";
import { swingConeAngle } from "../rom/swingCone";
import { appendMeshTopology } from "./validateMeshTopology";
import { validateTransformScalars } from "./validateTransformScalars";
import { ViolationCollector } from "./violation";

/**
 * Validate an {@link IAutoMovieModel}: Tier-1 structural/range checks over its
 * geometry and material wiring, the constraints the rough types don't encode.
 *
 * Checks: at least one part; primitive extents are strictly positive; material
 * references and attached-bone references resolve; skeleton graphs have one
 * connected root; material coefficients (`metallic`/`roughness`/`opacity`) and
 * color components sit in `[0, 1]`.
 *
 * @author Samchon
 */
export const validateModel = (props: {
  model: IAutoMovieModel;
}): IAutoMovieValidation => {
  const path = "$input";
  const collector = new ViolationCollector();
  const { model } = props;

  validateNonEmptyId(model.id, `${path}.id`, "model id", collector);
  if (model.asset !== null)
    validateNonEmptyId(
      model.asset,
      `${path}.asset`,
      "model asset id",
      collector,
    );
  if (model.skeleton !== null) {
    validateNonEmptyId(
      model.skeleton.id,
      `${path}.skeleton.id`,
      "skeleton id",
      collector,
    );
    model.skeleton.bones.forEach((bone, i) => {
      validateNonEmptyId(
        bone.bone,
        `${path}.skeleton.bones[${i}].bone`,
        "skeleton bone",
        collector,
      );
      if (bone.parent !== null)
        validateNonEmptyId(
          bone.parent,
          `${path}.skeleton.bones[${i}].parent`,
          "skeleton bone parent",
          collector,
        );
    });
  }

  const materialIds = new Set(model.materials.map((m) => m.id));
  const boneNames = new Set((model.skeleton?.bones ?? []).map((b) => b.bone));

  validateUniqueValues(
    model.materials.map((m, i) => [m.id, `${path}.materials[${i}].id`]),
    "material id",
    collector,
  );
  validateUniqueValues(
    model.parts.map((p, i) => [p.id, `${path}.parts[${i}].id`]),
    "part id",
    collector,
  );
  validateUniqueValues(
    (model.skeleton?.bones ?? []).map((b, i) => [
      b.bone,
      `${path}.skeleton.bones[${i}].bone`,
    ]),
    "skeleton bone",
    collector,
  );
  if (model.skeleton !== null)
    validateSkeletonGraph(model.skeleton, `${path}.skeleton`, collector);

  if (model.parts.length === 0)
    collector.push(
      "type",
      `${path}.parts`,
      "a model needs at least one part",
      model.parts,
    );

  model.parts.forEach((part, i) => {
    const pp = `${path}.parts[${i}]`;
    validateNonEmptyId(part.id, `${pp}.id`, "model part id", collector);
    if (part.material !== null)
      validateNonEmptyId(
        part.material,
        `${pp}.material`,
        "model part material id",
        collector,
      );
    if (part.material !== null && !materialIds.has(part.material))
      collector.push(
        "type",
        `${pp}.material`,
        `material id "${part.material}" does not resolve to any of the model's materials`,
        part.material,
      );
    if (part.attachedBone !== null && !boneNames.has(part.attachedBone))
      collector.push(
        "type",
        `${pp}.attachedBone`,
        `attachedBone "${part.attachedBone}" is not a bone of this model's skeleton`,
        part.attachedBone,
      );
    switch (part.geometry.type) {
      case "primitive":
        validateExtents(part.geometry.shape, `${pp}.geometry.shape`, collector);
        break;
      case "mesh":
        validateMesh(
          part.geometry.mesh,
          `${pp}.geometry.mesh`,
          boneNames,
          collector,
        );
        break;
      default: {
        const unknown = part.geometry as { type: unknown };
        collector.push(
          "type",
          `${pp}.geometry.type`,
          `unknown geometry type "${String(unknown.type)}"`,
          unknown.type,
        );
        break;
      }
    }
    if (part.transform !== null)
      validateTransformScalars({
        transform: part.transform,
        path: `${pp}.transform`,
        label: "model part transform",
        collector,
      });
  });

  model.skeleton?.bones.forEach((bone, i) => {
    const bp = `${path}.skeleton.bones[${i}]`;
    validateTransformScalars({
      transform: bone.rest,
      path: `${bp}.rest`,
      label: "skeleton bone rest transform",
      collector,
    });
    if (bone.constraint !== null)
      validateJointConstraint(bone.constraint, `${bp}.constraint`, collector);
  });

  if (model.body !== null) validateBody(model.body, `${path}.body`, collector);

  const affordances = model.affordances ?? null;
  if (affordances !== null) {
    validateUniqueValues(
      affordances.map((a, i) => [a.id, `${path}.affordances[${i}].id`]),
      "affordance id",
      collector,
    );
    affordances.forEach((affordance, i) =>
      validateAffordance(affordance, `${path}.affordances[${i}]`, collector),
    );
  }

  model.materials.forEach((m, i) => {
    const mp = `${path}.materials[${i}]`;
    validateNonEmptyId(m.id, `${mp}.id`, "material id", collector);
    if (m.baseColorTexture !== null)
      validateNonEmptyId(
        m.baseColorTexture,
        `${mp}.baseColorTexture`,
        "base color texture id",
        collector,
      );
    collector.range(`${mp}.metallic`, m.metallic, 0, 1, "metallic");
    collector.range(`${mp}.roughness`, m.roughness, 0, 1, "roughness");
    collector.range(`${mp}.opacity`, m.opacity, 0, 1, "opacity");
    validateColor(m.baseColor, `${mp}.baseColor`, collector);
    if (m.emissive !== null)
      validateColor(m.emissive, `${mp}.emissive`, collector);
  });

  return collector.toValidation();
};

/**
 * Validate one {@link IAutoMovieAffordance}: a non-empty id, finite frame
 * scalars, and extent semantics by kind: a `stack-top` needs a well-formed
 * supporting face (>= 3 finite, non-collinear plan points), while point-like
 * kinds (`handle` / `socket` / `hook`) must leave `extent` null. The closed
 * kind union makes an unknown kind structurally impossible.
 */
const validateAffordance = (
  affordance: IAutoMovieAffordance,
  path: string,
  collector: ViolationCollector,
): void => {
  validateNonEmptyId(affordance.id, `${path}.id`, "affordance id", collector);
  validateTransformScalars({
    transform: affordance.frame,
    path: `${path}.frame`,
    label: "affordance frame",
    collector,
  });

  if (affordance.kind !== "stack-top") {
    if (affordance.extent !== null)
      collector.push(
        "type",
        `${path}.extent`,
        `a "${affordance.kind}" affordance is point-like and must have extent null`,
        affordance.extent,
      );
    return;
  }

  const extent = affordance.extent;
  if (extent === null) {
    collector.push(
      "type",
      `${path}.extent`,
      'a "stack-top" affordance needs an extent polygon (the supporting face)',
      extent,
    );
    return;
  }
  if (extent.length < 3)
    collector.push(
      "type",
      `${path}.extent`,
      `a stack-top extent needs at least 3 points, but had ${extent.length}`,
      extent.length,
    );
  let planFinite = true;
  extent.forEach((point, i) => {
    for (const axis of ["x", "z"] as const)
      if (!Number.isFinite(point[axis])) {
        planFinite = false;
        collector.push(
          "range",
          `${path}.extent[${i}].${axis}`,
          `extent ${axis} must be finite, but was ${point[axis]}`,
          point[axis],
        );
      }
  });
  if (planFinite && extent.length >= 3 && convexHull2D(extent).length < 3)
    collector.push(
      "type",
      `${path}.extent`,
      "stack-top extent points are collinear: they enclose no area",
      extent,
    );
};

/**
 * Validate an {@link IAutoMovieBody}'s rough scalars: mass must be finite and
 * strictly positive, `friction` and `restitution` sit in `[0, 1]`, and an
 * explicit `centerOfMass` must be finite on every axis.
 */
const validateBody = (
  body: IAutoMovieBody,
  path: string,
  collector: ViolationCollector,
): void => {
  if (!Number.isFinite(body.mass) || body.mass <= 0)
    collector.push(
      "range",
      `${path}.mass`,
      `mass must be a finite number > 0, but was ${body.mass}`,
      body.mass,
    );
  collector.range(`${path}.friction`, body.friction, 0, 1, "friction");
  collector.range(`${path}.restitution`, body.restitution, 0, 1, "restitution");
  if (body.centerOfMass !== null) {
    const com = body.centerOfMass;
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(com[axis]))
        collector.push(
          "range",
          `${path}.centerOfMass.${axis}`,
          `centerOfMass.${axis} must be finite, but was ${com[axis]}`,
          com[axis],
        );
  }
};

/**
 * Push a `type` violation for an unknown primitive shape, or a `range`
 * violation for any non-finite or non-positive primitive dimension.
 */
const validateExtents = (
  shape: AutoMoviePrimitiveShape,
  path: string,
  collector: ViolationCollector,
): void => {
  let dims: ReadonlyArray<readonly [string, number]>;
  switch (shape.type) {
    case "box":
      dims = [
        ["width", shape.width],
        ["height", shape.height],
        ["depth", shape.depth],
      ];
      break;
    case "sphere":
      dims = [["radius", shape.radius]];
      break;
    case "plane":
      dims = [
        ["width", shape.width],
        ["depth", shape.depth],
      ];
      break;
    case "cylinder":
    case "cone":
    case "capsule":
      dims = [
        ["radius", shape.radius],
        ["height", shape.height],
      ];
      break;
    default: {
      const unknown = shape as { type: unknown };
      collector.push(
        "type",
        `${path}.type`,
        `unknown primitive shape "${String(unknown.type)}"`,
        unknown.type,
      );
      return;
    }
  }
  for (const [name, value] of dims)
    if (!Number.isFinite(value) || value <= 0)
      collector.push(
        "range",
        `${path}.${name}`,
        `${name} must be a finite number > 0, but was ${value}`,
        value,
      );
};

const validateUniqueValues = (
  entries: ReadonlyArray<readonly [string, string]>,
  label: string,
  collector: ViolationCollector,
): void => {
  const seen = new Set<string>();
  for (const [value, entryPath] of entries) {
    if (seen.has(value))
      collector.push(
        "type",
        entryPath,
        `${label} "${value}" must be unique within the model`,
        value,
      );
    seen.add(value);
  }
};

const validateNonEmptyId = (
  value: unknown,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (typeof value !== "string") {
    collector.push("type", path, `${label} must be a string`, value);
    return;
  }
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be a non-empty id`, value);
};

const validateSkeletonGraph = (
  skeleton: IAutoMovieSkeleton,
  path: string,
  collector: ViolationCollector,
): void => {
  const names = new Set(skeleton.bones.map((bone) => bone.bone));
  const roots: string[] = [];
  skeleton.bones.forEach((bone, i) => {
    if (bone.parent === null) roots.push(bone.bone);
    else if (!names.has(bone.parent))
      collector.push(
        "type",
        `${path}.bones[${i}].parent`,
        `parent "${bone.parent}" is not a bone of this skeleton`,
        bone.parent,
      );
  });
  if (roots.length !== 1) {
    collector.push(
      "type",
      `${path}.bones`,
      `a skeleton needs exactly one root bone (parent: null), but found ${roots.length}`,
      roots,
    );
    return;
  }

  const children = new Map<string, string[]>();
  for (const bone of skeleton.bones) {
    if (bone.parent === null) continue;
    const list = children.get(bone.parent) ?? [];
    list.push(bone.bone);
    children.set(bone.parent, list);
  }
  const reached = new Set<string>();
  const queue = [roots[0]!];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (reached.has(name)) continue;
    reached.add(name);
    queue.push(...(children.get(name) ?? []));
  }
  skeleton.bones.forEach((bone, i) => {
    if (!reached.has(bone.bone))
      collector.push(
        "type",
        `${path}.bones[${i}]`,
        `bone "${bone.bone}" is not reachable from the root "${roots[0]}" (a detached cycle cannot be posed)`,
        bone.bone,
      );
  });
};

const validateMesh = (
  mesh: IAutoMovieMesh,
  path: string,
  boneNames: ReadonlySet<string>,
  collector: ViolationCollector,
): void => {
  validateTupleBuffer(mesh.positions, 3, `${path}.positions`, collector);
  // An empty buffer is a multiple of 3, so validateTupleBuffer accepts it; a
  // mesh with no vertices is degenerate geometry (empty GLB export, empty
  // collision proxy) and belongs in the correction round, not at render time,
  // the mesh mirror of a primitive's strictly-positive extents.
  if (mesh.positions.length === 0)
    collector.push(
      "type",
      `${path}.positions`,
      "a mesh must contain at least one vertex",
      mesh.positions.length,
    );
  const vertexCount = mesh.positions.length / 3;

  if (mesh.normals !== null) {
    validateTupleBuffer(mesh.normals, 3, `${path}.normals`, collector);
    validateBufferLength(
      mesh.normals,
      vertexCount * 3,
      `${path}.normals`,
      "normals must contain one xyz triple per position vertex",
      collector,
    );
  }

  if (mesh.uvs !== null) {
    validateTupleBuffer(mesh.uvs, 2, `${path}.uvs`, collector);
    validateBufferLength(
      mesh.uvs,
      vertexCount * 2,
      `${path}.uvs`,
      "uvs must contain one uv pair per position vertex",
      collector,
    );
  }

  if (mesh.indices !== null) {
    validateTupleBuffer(mesh.indices, 3, `${path}.indices`, collector);
    mesh.indices.forEach((index, i) => {
      const valid =
        Number.isInteger(index) && index >= 0 && index < vertexCount;
      if (!valid)
        collector.push(
          "range",
          `${path}.indices[${i}]`,
          `index must be an integer vertex reference in [0, ${vertexCount - 1}], but was ${index}`,
          index,
        );
    });
  }

  if (mesh.skin !== null)
    validateMeshSkin(
      mesh.skin,
      vertexCount,
      `${path}.skin`,
      boneNames,
      collector,
    );

  // Tier-5 topology (#1183): 2-manifold + consistent winding over the welded
  // surface. Self-guards on the buffers this function already reports, so it
  // never reads a malformed index. Watertightness is not demanded here: an
  // open mesh (plane, decal) is a valid model geometry.
  appendMeshTopology(mesh, path, collector, false);
};

const validateTupleBuffer = (
  buffer: number[],
  tupleSize: number,
  path: string,
  collector: ViolationCollector,
): void => {
  if (buffer.length % tupleSize !== 0)
    collector.push(
      "type",
      path,
      `buffer length must be a multiple of ${tupleSize}, but was ${buffer.length}`,
      buffer.length,
    );

  buffer.forEach((value, i) => {
    if (!Number.isFinite(value))
      collector.push(
        "range",
        `${path}[${i}]`,
        `value must be finite, but was ${value}`,
        value,
      );
  });
};

const validateBufferLength = (
  buffer: number[],
  expected: number,
  path: string,
  message: string,
  collector: ViolationCollector,
): void => {
  if (buffer.length !== expected)
    collector.push(
      "type",
      path,
      `${message}; expected length ${expected}, but was ${buffer.length}`,
      buffer.length,
    );
};

const validateColor = (
  color: IAutoMovieColor,
  path: string,
  collector: ViolationCollector,
): void => {
  for (const ch of ["r", "g", "b"] as const)
    collector.range(`${path}.${ch}`, color[ch], 0, 1, ch);
  if (color.a !== null) collector.range(`${path}.a`, color.a, 0, 1, "a");
  if (color.hex !== null && !HEX_COLOR_PATTERN.test(color.hex))
    collector.push(
      "type",
      `${path}.hex`,
      `hex must be null or a #RRGGBB color label, but was "${color.hex}"`,
      color.hex,
    );
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const validateMeshSkin = (
  skin: IAutoMovieMeshSkin,
  vertexCount: number,
  path: string,
  boneNames: ReadonlySet<string>,
  collector: ViolationCollector,
): void => {
  const expectedInfluences = vertexCount * 4;
  validateBufferLength(
    skin.boneIndices,
    expectedInfluences,
    `${path}.boneIndices`,
    "boneIndices must contain four joint references per position vertex",
    collector,
  );
  validateBufferLength(
    skin.weights,
    expectedInfluences,
    `${path}.weights`,
    "weights must contain four influence values per position vertex",
    collector,
  );

  const seen = new Set<string>();
  skin.joints.forEach((joint, i) => {
    if (!boneNames.has(joint))
      collector.push(
        "type",
        `${path}.joints[${i}]`,
        `skin joint "${joint}" is not a bone of this model's skeleton`,
        joint,
      );
    if (seen.has(joint))
      collector.push(
        "type",
        `${path}.joints[${i}]`,
        `skin joint "${joint}" is duplicated`,
        joint,
      );
    seen.add(joint);
  });

  skin.boneIndices.forEach((index, i) => {
    const valid =
      Number.isInteger(index) && index >= 0 && index < skin.joints.length;
    if (!valid)
      collector.push(
        "range",
        `${path}.boneIndices[${i}]`,
        `bone index must be an integer skin joint reference in [0, ${skin.joints.length - 1}], but was ${index}`,
        index,
      );
  });

  skin.weights.forEach((weight, i) =>
    collector.range(`${path}.weights[${i}]`, weight, 0, 1, "weight"),
  );

  for (let vertex = 0; vertex < vertexCount; ++vertex) {
    const offset = vertex * 4;
    const weights = skin.weights.slice(offset, offset + 4);
    if (weights.length === 4 && weights.every(Number.isFinite)) {
      const sum = weights.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 1e-6)
        collector.push(
          "range",
          `${path}.weights[${offset}]`,
          `vertex ${vertex} skin weights must sum to 1, but summed to ${sum}`,
          weights,
        );
    }
  }
};

const CONSTRAINT_AXES = ["flexion", "abduction", "twist"] as const;

const validateJointConstraint = (
  constraint: IAutoMovieJointConstraint,
  path: string,
  collector: ViolationCollector,
): void => {
  for (const axis of CONSTRAINT_AXES) {
    const range = constraint[axis];
    if (range !== null) validateAngleRange(range, `${path}.${axis}`, collector);
  }

  if (constraint.swingDeg !== undefined && constraint.swingDeg !== null) {
    const swingDeg = constraint.swingDeg;
    if (!Number.isFinite(swingDeg) || swingDeg <= 0)
      collector.push(
        "range",
        `${path}.swingDeg`,
        `swingDeg must be a finite number > 0, but was ${swingDeg}`,
        swingDeg,
      );
    else {
      // A swing-coned constraint is unsatisfiable exactly when its box and its
      // cone do not intersect, NOT merely when the box excludes neutral (#1245).
      // The box point nearest neutral is each axis clamped toward 0, and the
      // cone grows monotonically away from neutral, so that point has the
      // smallest swing the box can reach: if even IT exceeds `swingDeg`, no pose
      // satisfies both. A box that excludes neutral but sits inside a wide cone
      // is perfectly sound (e.g. flexion [10, 90] with a 95° cone admits
      // (10, 0) at 10° of swing), and rejecting it refused rigs the per-bone
      // override exists to express (a limb that cannot fully extend).
      const nearest = (range: IAutoMovieAngleRange | null): number =>
        range === null ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max)
          ? 0
          : range.min > 0
            ? range.min
            : range.max < 0
              ? range.max
              : 0;
      const minimumSwing = swingConeAngle(
        nearest(constraint.flexion),
        nearest(constraint.abduction),
      );
      if (minimumSwing > swingDeg)
        collector.push(
          "range",
          `${path}.swingDeg`,
          `a swing-coned joint must admit at least one pose: the most-retracted articulation its flexion/abduction ranges allow already swings ${minimumSwing.toFixed(1)}°, past this ${swingDeg}° cone, so no pose satisfies both the ranges and the cone`,
          swingDeg,
        );
    }
  }
};

const validateAngleRange = (
  range: IAutoMovieAngleRange,
  path: string,
  collector: ViolationCollector,
): void => {
  const fields: ReadonlyArray<readonly [string, number]> = [
    ["min", range.min],
    ["max", range.max],
  ];
  for (const [field, value] of fields)
    if (!Number.isFinite(value))
      collector.push(
        "range",
        `${path}.${field}`,
        `${field} must be finite, but was ${value}`,
        value,
      );

  if (
    Number.isFinite(range.min) &&
    Number.isFinite(range.max) &&
    range.min > range.max
  )
    collector.push(
      "range",
      path,
      `range min must be <= max, but was [${range.min}, ${range.max}]`,
      range,
    );
};
