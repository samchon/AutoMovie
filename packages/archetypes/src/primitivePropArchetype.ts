import { IAutoMovieModelPart } from "@automovie/interface";

import {
  IAutoMovieArchetypeBuildInput,
  IAutoMovieArchetypeGeometry,
  IAutoMovieModelArchetype,
} from "./IAutoMovieModelArchetype";
import {
  AutoMovieArchetypeParameters,
  numberOf,
  numberParameter,
  stringParameter,
} from "./parameterValues";

/** Dimension keys each supported shape consumes, and no others. */
const DIMENSIONS: Readonly<Record<string, readonly string[]>> = {
  box: ["width", "height", "depth"],
  sphere: ["radius"],
  capsule: ["radius", "height"],
  cylinder: ["radius", "height"],
  cone: ["radius", "height"],
  plane: ["width", "depth"],
};

/**
 * The catalogue's static single primitive: one shape and its own dimensions.
 *
 * `shape` discriminates the parameter map, so the plan below narrows both the
 * required and the accepted keys to the ones that shape actually consumes. A
 * dimension the selected shape ignores is refused rather than stored, because a
 * stored value nothing reads is a claim the render never honours.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Implements the primitive half of the open geometry contract with six parameterized blocking shapes.
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Builds every supported shape from explicit bounded metric dimensions.
 * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Refuses an unsupported shape discriminator instead of substituting a catalogue default.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Maps each shape to exactly the dimensions it consumes.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Reports an unsupported shape before model output is built.
 */
export const PRIMITIVE_PROP_ARCHETYPE: IAutoMovieModelArchetype = {
  id: "primitive-prop",
  capabilities: [],
  bones: [],
  parameters: {
    shape: { kind: "string" },
    width: { kind: "number", minimum: 0.001, maximum: 100 },
    height: { kind: "number", minimum: 0.001, maximum: 100 },
    depth: { kind: "number", minimum: 0.001, maximum: 100 },
    radius: { kind: "number", minimum: 0.001, maximum: 50 },
  },
  plan: (parameters) => {
    const shape =
      typeof parameters.shape === "string" ? parameters.shape : null;
    const dimensions = shape === null ? undefined : DIMENSIONS[shape];
    return {
      required: ["shape", ...(dimensions ?? [])],
      accepted: dimensions === undefined ? null : ["shape", ...dimensions],
      refusals:
        shape !== null && dimensions === undefined
          ? [
              {
                code: "model-parameter-invalid",
                message: `Primitive-prop shape "${shape}" is unsupported. Use box, sphere, capsule, cylinder, cone, or plane in the tracked model recipe record.`,
              },
            ]
          : [],
    };
  },
  projectionRadius: (parameters) => projectionRadius(parameters),
  build: (input) => build(input),
};

const projectionRadius = (parameters: AutoMovieArchetypeParameters): number => {
  const shape = parameters.shape;
  const number = (key: string): number => numberOf(parameters, key);
  if (shape === "sphere") return number("radius");
  if (shape === "capsule") return number("radius") + number("height") / 2;
  if (shape === "cylinder" || shape === "cone")
    return Math.hypot(number("radius"), number("height") / 2);
  if (shape === "plane")
    return Math.hypot(number("width"), number("depth")) / 2;
  return Math.hypot(number("width"), number("height"), number("depth")) / 2;
};

const build = (
  input: IAutoMovieArchetypeBuildInput,
): IAutoMovieArchetypeGeometry => ({
  skeleton: null,
  parts: [
    {
      id: "primitive",
      name: "primitive",
      geometry: {
        type: "primitive",
        shape: shapeOf(
          input.parameters,
          stringParameter(input.parameters, "shape"),
        ),
      },
      material: input.material,
      attachedBone: null,
      transform: null,
    },
  ],
});

const shapeOf = (
  parameters: AutoMovieArchetypeParameters,
  shape: string,
): Extract<IAutoMovieModelPart["geometry"], { type: "primitive" }>["shape"] => {
  if (shape === "box")
    return {
      type: "box",
      width: numberParameter(parameters, "width"),
      height: numberParameter(parameters, "height"),
      depth: numberParameter(parameters, "depth"),
    };
  if (shape === "sphere")
    return { type: "sphere", radius: numberParameter(parameters, "radius") };
  if (shape === "capsule")
    return {
      type: "capsule",
      radius: numberParameter(parameters, "radius"),
      height: numberParameter(parameters, "height"),
    };
  if (shape === "cylinder")
    return {
      type: "cylinder",
      radius: numberParameter(parameters, "radius"),
      height: numberParameter(parameters, "height"),
    };
  if (shape === "cone")
    return {
      type: "cone",
      radius: numberParameter(parameters, "radius"),
      height: numberParameter(parameters, "height"),
    };
  return {
    type: "plane",
    width: numberParameter(parameters, "width"),
    depth: numberParameter(parameters, "depth"),
  };
};
