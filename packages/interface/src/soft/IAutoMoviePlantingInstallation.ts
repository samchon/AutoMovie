/**
 * The binding that makes an independent planting cluster a building's planting.
 *
 * This record, not the planting recipe, is the building-owned half. The recipe
 * and the cluster stay free-standing computational units; the installation says
 * _this building unit's logical space holds that cluster, it stands on this
 * support, and this is the port that waters it_. A production world with no
 * building at all places the same cluster by simply not writing one of these.
 */
export interface IAutoMoviePlantingInstallation {
  /** Stable installation identity within the production. */
  id: string;

  /** Id of the `IAutoMovieBuiltEnvironment` that owns the installation. */
  environment: string;

  /** Id of the logical space inside that environment holding the planting. */
  space: string;

  /** Id of the independent planting cluster this installation places. */
  cluster: string;

  /** Semantic label; it selects nothing in the derivation. */
  kind: AutoMoviePlantingInstallationKind;

  /** What the planting stands on, hangs from, or is trained against. */
  support: IAutoMoviePlantingSupport;

  /**
   * How the planting is watered, or `null` for a planting nobody has bound a
   * supply to yet.
   *
   * `null` is a legitimate authoring state, not a silent pass: a dry binding is
   * exactly what a service-coordination pass needs to see.
   */
  irrigation: IAutoMoviePlantingIrrigation | null;
}

/** Open-ended enough to name an installation, closed enough to validate. */
export type AutoMoviePlantingInstallationKind =
  | "potted"
  | "planter"
  | "green-wall"
  | "aquatic"
  | "other";

/**
 * What a planting is carried by.
 *
 * Every arm cites an existing stable id of the built environment rather than
 * restating geometry: the building graph owns spaces, elements, boundaries and
 * support patches, and moving one of them must invalidate the planting bound to
 * it.
 */
export type IAutoMoviePlantingSupport =
  | IAutoMoviePlantingSupport.ISurface
  | IAutoMoviePlantingSupport.IElement
  | IAutoMoviePlantingSupport.IBoundary;
export namespace IAutoMoviePlantingSupport {
  /** A support patch assigned to a logical space: a floor, a roof deck. */
  export interface ISurface {
    /** Discriminator. */
    kind: "surface";
    /** Support-patch id inside the owning environment. */
    surface: string;
  }

  /** A visible element: a planter box, a shelf, a suspended basket rail. */
  export interface IElement {
    /** Discriminator. */
    kind: "element";
    /** Element id inside the owning environment. */
    element: string;
  }

  /** A separation the planting is trained against: the wall of a green wall. */
  export interface IBoundary {
    /** Discriminator. */
    kind: "boundary";
    /** Boundary id inside the owning environment. */
    boundary: string;
  }
}

/**
 * How a planting is watered.
 *
 * The supply is named as a building element acting as the port, because that is
 * what exists today; a full typed service network is a separate concern and
 * this record must not pretend to be one. What it does state completely is the
 * demand, the medium, and — for aquatic planting — the fluid domain the roots
 * actually stand in, which the engine checks rather than trusts.
 */
export interface IAutoMoviePlantingIrrigation {
  /** Id of the environment element acting as the supply port. */
  port: string;

  /** Water demand in litres per day; strictly positive. */
  demandLitresPerDay: number;

  /** What the supply carries. */
  medium: AutoMoviePlantingIrrigationMedium;

  /**
   * Id of the fluid domain the planting stands in, or `null` when it does not.
   *
   * Required exactly for `aquatic` planting and forbidden otherwise: a reed bed
   * with no water is not aquatic, and a potted fern citing a pond is a binding
   * error rather than a decorative note.
   */
  fluidDomain: string | null;
}

/** What an irrigation supply carries. */
export type AutoMoviePlantingIrrigationMedium =
  | "potable"
  | "reclaimed"
  | "rainwater"
  | "pond";
