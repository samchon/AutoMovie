/**
 * The binding that makes an independent planting cluster a building's planting.
 *
 * This record, not the planting recipe, is the building-owned half. The recipe
 * and the cluster stay free-standing computational units; the installation says
 * _this building unit's logical space holds that cluster, it stands on this
 * support, and this is the port that waters it_. A production world with no
 * building at all places the same cluster by simply not writing one of these.
 *
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `IAutoMoviePlantingInstallation` as the portable data boundary for the map vegetation individual cluster requirement.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `IAutoMoviePlantingInstallation` for the world site vegetation layer form input system contract.
 */
export interface IAutoMoviePlantingInstallation {
  /**
   * Stable installation identity within the production.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `id` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `id` for the world site vegetation layer form input system contract.
   */
  id: string;

  /**
   * Id of the `IAutoMovieBuiltEnvironment` that owns the installation.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `environment` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `environment` for the world site vegetation layer form input system contract.
   */
  environment: string;

  /**
   * Id of the logical space inside that environment holding the planting.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `space` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `space` for the world site vegetation layer form input system contract.
   */
  space: string;

  /**
   * Id of the independent planting cluster this installation places.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `cluster` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `cluster` for the world site vegetation layer form input system contract.
   */
  cluster: string;

  /**
   * Semantic label; it selects nothing in the derivation.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `kind` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `kind` for the world site vegetation layer form input system contract.
   */
  kind: AutoMoviePlantingInstallationKind;

  /**
   * What the planting stands on, hangs from, or is trained against.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `support` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `support` for the world site vegetation layer form input system contract.
   */
  support: IAutoMoviePlantingSupport;

  /**
   * Id of the material every branch instance is drawn with, or `null` for the
   * renderer's default.
   *
   * Stated on the binding rather than on the recipe, exactly as a soft
   * furnishing states its own (see {@link IAutoMovieSoftFurnishing.material}):
   * the recipe is the parametric law, and the same law is a copper beech in one
   * production and a bare wire armature in another. It is also what lets a
   * render budget attribute texture bytes to the planting at all, instead of
   * reporting the whole fold as unmeasured.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `branchMaterial` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `branchMaterial` for the world site vegetation layer form input system contract.
   */
  branchMaterial: string | null;

  /**
   * Id of the material every leaf instance is drawn with, or `null` for the
   * renderer's default. Separate from {@link branchMaterial} because the two
   * batches are separate draws with separate textures, and one id for both
   * would make a budget count one of them twice or not at all.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `leafMaterial` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `leafMaterial` for the world site vegetation layer form input system contract.
   */
  leafMaterial: string | null;

  /**
   * How the planting is watered, or `null` for a planting nobody has bound a
   * supply to yet.
   *
   * `null` is a legitimate authoring state, not a silent pass: a dry binding is
   * exactly what a service-coordination pass needs to see.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `irrigation` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `irrigation` for the world site vegetation layer form input system contract.
   */
  irrigation: IAutoMoviePlantingIrrigation | null;
}

/**
 * Open-ended enough to name an installation, closed enough to validate.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `AutoMoviePlantingInstallationKind` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `AutoMoviePlantingInstallationKind` for the interior space soft furnishing planting system contract.
 */
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
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Exposes `IAutoMoviePlantingSupport` as the portable data boundary for the interior soft simulation bound requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingSupport` for the interior space soft furnishing planting system contract.
 */
export type IAutoMoviePlantingSupport =
  | IAutoMoviePlantingSupport.ISurface
  | IAutoMoviePlantingSupport.IElement
  | IAutoMoviePlantingSupport.IBoundary;
export namespace IAutoMoviePlantingSupport {
  /**
   * A support patch assigned to a logical space: a floor, a roof deck.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `ISurface` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `ISurface` for the interior space soft furnishing planting system contract.
   */
  export interface ISurface {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "surface";
    /**
     * Support-patch id inside the owning environment.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `surface` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `surface` for the interior space soft furnishing planting system contract.
     */
    surface: string;
  }

  /**
   * A visible element: a planter box, a shelf, a suspended basket rail.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IElement` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IElement` for the interior space soft furnishing planting system contract.
   */
  export interface IElement {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "element";
    /**
     * Element id inside the owning environment.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `element` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `element` for the interior space soft furnishing planting system contract.
     */
    element: string;
  }

  /**
   * A separation the planting is trained against: the wall of a green wall.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IBoundary` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IBoundary` for the interior space soft furnishing planting system contract.
   */
  export interface IBoundary {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "boundary";
    /**
     * Boundary id inside the owning environment.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `boundary` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `boundary` for the interior space soft furnishing planting system contract.
     */
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
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingIrrigation` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingIrrigation` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingIrrigation {
  /**
   * Id of the environment element acting as the supply port.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `port` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `port` for the interior space soft furnishing planting system contract.
   */
  port: string;

  /**
   * Water demand in litres per day; strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `demandLitresPerDay` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `demandLitresPerDay` for the interior space soft furnishing planting system contract.
   */
  demandLitresPerDay: number;

  /**
   * What the supply carries.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `medium` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `medium` for the interior space soft furnishing planting system contract.
   */
  medium: AutoMoviePlantingIrrigationMedium;

  /**
   * Id of the fluid domain the planting stands in, or `null` when it does not.
   *
   * Required exactly for `aquatic` planting and forbidden otherwise: a reed bed
   * with no water is not aquatic, and a potted fern citing a pond is a binding
   * error rather than a decorative note.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `fluidDomain` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `fluidDomain` for the interior space soft furnishing planting system contract.
   */
  fluidDomain: string | null;
}

/**
 * What an irrigation supply carries.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `AutoMoviePlantingIrrigationMedium` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `AutoMoviePlantingIrrigationMedium` for the interior space soft furnishing planting system contract.
 */
export type AutoMoviePlantingIrrigationMedium =
  | "potable"
  | "reclaimed"
  | "rainwater"
  | "pond";
