/**
 * A parametric primitive shape — the **LLM-authored** path to geometry.
 *
 * Where a raw {@link IMoticaMesh} is bulk vertex data (imported, not emittable
 * by a model), a primitive is a handful of named, bounded dimensions an LLM
 * _can_ emit: "a 0.4 m sphere", "a 1.8 m tall capsule". Assembling a character
 * or prop from primitives is how motica generates geometry inside the
 * dimensionality where structured output is reliable — the same "named scalar"
 * bet the skeleton and expression layers make.
 *
 * Discriminated on `type`; each variant carries only the dimensions its shape
 * needs. All dimensions are in meters and expected to be strictly positive (the
 * engine rejects a zero/negative extent).
 *
 * @author Samchon
 */
export type MoticaPrimitiveShape =
  | IMoticaBoxShape
  | IMoticaSphereShape
  | IMoticaCapsuleShape
  | IMoticaCylinderShape
  | IMoticaConeShape
  | IMoticaPlaneShape;

/** Axis-aligned rectangular box. */
export interface IMoticaBoxShape {
  /** Discriminator. */
  type: "box";
  /** Full size along local X, meters. */
  width: number;
  /** Full size along local Y, meters. */
  height: number;
  /** Full size along local Z, meters. */
  depth: number;
}

/** Sphere. */
export interface IMoticaSphereShape {
  /** Discriminator. */
  type: "sphere";
  /** Radius, meters. */
  radius: number;
}

/** Capsule (cylinder capped by hemispheres) aligned to local Y. */
export interface IMoticaCapsuleShape {
  /** Discriminator. */
  type: "capsule";
  /** Radius of the body and end caps, meters. */
  radius: number;
  /** Length of the cylindrical body between the caps, meters. */
  height: number;
}

/** Cylinder aligned to local Y. */
export interface IMoticaCylinderShape {
  /** Discriminator. */
  type: "cylinder";
  /** Radius, meters. */
  radius: number;
  /** Height along local Y, meters. */
  height: number;
}

/** Cone aligned to local Y (apex toward +Y). */
export interface IMoticaConeShape {
  /** Discriminator. */
  type: "cone";
  /** Base radius, meters. */
  radius: number;
  /** Height along local Y, meters. */
  height: number;
}

/** Flat rectangle in the local XZ plane. */
export interface IMoticaPlaneShape {
  /** Discriminator. */
  type: "plane";
  /** Size along local X, meters. */
  width: number;
  /** Size along local Z, meters. */
  depth: number;
}
