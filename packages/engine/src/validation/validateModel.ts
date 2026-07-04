import {
  AutoMoviePrimitiveShape,
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
    if (part.transform !== null)
      validateTransformScalars({
        transform: part.transform,
        path: `${pp}.transform`,
        label: "model part transform",
        collector,
      });
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
