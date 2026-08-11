/**
 * A parametric primitive shape: the **LLM-authored** path to geometry.
 *
 * Where a raw {@link IAutoMovieMesh} is bulk vertex data (imported, not
 * emittable by a model), a primitive is a handful of named, bounded dimensions
 * an LLM _can_ emit: "a 0.4 m sphere", "a 1.8 m tall capsule". Assembling a
 * character or prop from primitives is how automovie generates geometry inside
 * the dimensionality where structured output is reliable: the same "named
 * scalar" bet the skeleton and expression layers make.
 *
 * Discriminated on `type`; each variant carries only the dimensions its shape
 * needs. All dimensions are in meters and expected to be strictly positive (the
 * engine rejects a zero/negative extent).
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `AutoMoviePrimitiveShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `AutoMoviePrimitiveShape` for the asset spec geometry inputs system contract.
 * @author Samchon
 */
export type AutoMoviePrimitiveShape =
  | IAutoMovieBoxShape
  | IAutoMovieSphereShape
  | IAutoMovieCapsuleShape
  | IAutoMovieCylinderShape
  | IAutoMovieConeShape
  | IAutoMoviePlaneShape;

/**
 * Axis-aligned rectangular box.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieBoxShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieBoxShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieBoxShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "box";
  /**
   * Full size along local X, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `width` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `width` for the asset spec geometry inputs system contract.
   */
  width: number;
  /**
   * Full size along local Y, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `height` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `height` for the asset spec geometry inputs system contract.
   */
  height: number;
  /**
   * Full size along local Z, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `depth` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `depth` for the asset spec geometry inputs system contract.
   */
  depth: number;
}

/**
 * Sphere.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieSphereShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieSphereShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieSphereShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "sphere";
  /**
   * Radius, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `radius` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `radius` for the asset spec geometry inputs system contract.
   */
  radius: number;
}

/**
 * Capsule (cylinder capped by hemispheres) aligned to local Y.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieCapsuleShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieCapsuleShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieCapsuleShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "capsule";
  /**
   * Radius of the body and end caps, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `radius` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `radius` for the asset spec geometry inputs system contract.
   */
  radius: number;
  /**
   * Length of the cylindrical body between the caps, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `height` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `height` for the asset spec geometry inputs system contract.
   */
  height: number;
}

/**
 * Cylinder aligned to local Y.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieCylinderShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieCylinderShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieCylinderShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "cylinder";
  /**
   * Radius, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `radius` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `radius` for the asset spec geometry inputs system contract.
   */
  radius: number;
  /**
   * Height along local Y, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `height` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `height` for the asset spec geometry inputs system contract.
   */
  height: number;
}

/**
 * Cone aligned to local Y (wide base at +Y, tapering to the apex at -Y).
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieConeShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieConeShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieConeShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "cone";
  /**
   * Base radius, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `radius` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `radius` for the asset spec geometry inputs system contract.
   */
  radius: number;
  /**
   * Height along local Y, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `height` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `height` for the asset spec geometry inputs system contract.
   */
  height: number;
}

/**
 * Flat rectangle in the local XZ plane.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMoviePlaneShape` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMoviePlaneShape` for the asset spec geometry inputs system contract.
 */
export interface IAutoMoviePlaneShape {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "plane";
  /**
   * Size along local X, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `width` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `width` for the asset spec geometry inputs system contract.
   */
  width: number;
  /**
   * Size along local Z, meters.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `depth` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `depth` for the asset spec geometry inputs system contract.
   */
  depth: number;
}
