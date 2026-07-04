import {
  AutoMoviePrimitiveShape,
  IAutoMovieAngleRange,
  IAutoMovieJointConstraint,
  IAutoMovieMesh,
  IAutoMovieModel,
  IAutoMovieValidation,
} from "@automovie/interface";

import { validateTransformScalars } from "./validateTransformScalars";
import { ViolationCollector } from "./violation";

/**
 * Validate an {@link IAutoMovieModel} — Tier-1 structural/range checks over its
 * geometry and material wiring, the constraints the rough types don't encode.
 *
 * Checks: at least one part; primitive extents are strictly positive; material
 * references and attached-bone references resolve; material coefficients
 * (`metallic`/`roughness`/`opacity`) and color components sit in `[0, 1]`.
 *
 * @author Samchon
 */
export const validateModel = (props: {
  model: IAutoMovieModel;
}): IAutoMovieValidation => {
  const path = "$input";
  const collector = new ViolationCollector();
  const { model } = props;

  const materialIds = new Set(model.materials.map((m) => m.id));
  const boneNames = new Set((model.skeleton?.bones ?? []).map((b) => b.bone));

  if (model.parts.length === 0)
    collector.push(
      "type",
      `${path}.parts`,
      "a model needs at least one part",
      model.parts,
    );

  model.parts.forEach((part, i) => {
    const pp = `${path}.parts[${i}]`;
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
    if (part.geometry.type === "primitive")
      validateExtents(part.geometry.shape, `${pp}.geometry.shape`, collector);
    if (part.geometry.type === "mesh")
      validateMesh(part.geometry.mesh, `${pp}.geometry.mesh`, collector);
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

  model.materials.forEach((m, i) => {
    const mp = `${path}.materials[${i}]`;
    collector.range(`${mp}.metallic`, m.metallic, 0, 1, "metallic");
    collector.range(`${mp}.roughness`, m.roughness, 0, 1, "roughness");
    collector.range(`${mp}.opacity`, m.opacity, 0, 1, "opacity");
    for (const ch of ["r", "g", "b"] as const)
      collector.range(`${mp}.baseColor.${ch}`, m.baseColor[ch], 0, 1, ch);
  });

  return collector.toValidation();
};

/**
 * Push a `range` violation for any non-finite or non-positive primitive
 * dimension.
 */
const validateExtents = (
  shape: AutoMoviePrimitiveShape,
  path: string,
  collector: ViolationCollector,
): void => {
  const dims: ReadonlyArray<readonly [string, number]> =
    shape.type === "box"
      ? [
          ["width", shape.width],
          ["height", shape.height],
          ["depth", shape.depth],
        ]
      : shape.type === "sphere"
        ? [["radius", shape.radius]]
        : shape.type === "plane"
          ? [
              ["width", shape.width],
              ["depth", shape.depth],
            ]
          : [
              ["radius", shape.radius],
              ["height", shape.height],
            ];
  for (const [name, value] of dims)
    if (!Number.isFinite(value) || value <= 0)
      collector.push(
        "range",
        `${path}.${name}`,
        `${name} must be a finite number > 0, but was ${value}`,
        value,
      );
};

const validateMesh = (
  mesh: IAutoMovieMesh,
  path: string,
  collector: ViolationCollector,
): void => {
  validateTupleBuffer(mesh.positions, 3, `${path}.positions`, collector);
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
