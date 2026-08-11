import {
  IAutoMovieMaterialAssembly,
  IAutoMovieMaterialLayer,
  IAutoMovieMaterialSubstance,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

const AXES = ["x", "y", "z"] as const;
const SENSES = ["positive", "negative"] as const;
const SUBSTANCES = ["solid", "cavity", "membrane"] as const;
const EXPOSURES = ["exposed", "concealed"] as const;

/** Largest metre slack a summed build-up may differ from its host by. */
const THICKNESS_EPSILON = 1e-9;

/**
 * The host dimension a build-up is measured against.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `IAutoMovieAssemblyHost` represents the host dimension a build-up is measured against. This ensures each host region retains its ordered construction build-up and total thickness.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieAssemblyHost` structures the host dimension a build-up is measured against for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieAssemblyHost {
  /**
   * Nominal host thickness along the assembly's stacking axis, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `thickness` records `IAutoMovieAssemblyHost`'s nominal host thickness along the assembly's stacking axis, in metres. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `thickness` supplies `IAutoMovieAssemblyHost`'s nominal host thickness along the assembly's stacking axis, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  thickness: number;
}

/**
 * One layer placed on the host's own measuring line.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `IAutoMovieResolvedLayer` represents one layer placed on the host's own measuring line. This ensures each host region retains its ordered construction build-up and total thickness.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieResolvedLayer` structures one layer placed on the host's own measuring line for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieResolvedLayer {
  /**
   * The contributing {@link IAutoMovieMaterialLayer.id}.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `id` records `IAutoMovieResolvedLayer`'s contributing `IAutoMovieMaterialLayer.id`. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `id` supplies `IAutoMovieResolvedLayer`'s contributing `IAutoMovieMaterialLayer.id` when the engine resolves ordered construction layers into their host face regions.
   */
  id: string;
  /**
   * The layer's construction role.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `role` records `IAutoMovieResolvedLayer`'s layer's construction role. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `role` supplies `IAutoMovieResolvedLayer`'s layer's construction role when the engine resolves ordered construction layers into their host face regions.
   */
  role: string;
  /**
   * What occupies the layer.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `substance` records what occupies the layer for `IAutoMovieResolvedLayer`. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `substance` tells the engine what occupies the layer for `IAutoMovieResolvedLayer` as it resolves ordered construction layers into their host face regions.
   */
  substance: "solid" | "cavity" | "membrane";
  /**
   * Substance id, or `null` for a cavity.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `material` records `IAutoMovieResolvedLayer`'s substance id, or `null` for a cavity. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `material` supplies `IAutoMovieResolvedLayer`'s substance id, or `null` for a cavity when the engine resolves ordered construction layers into their host face regions.
   */
  material: string | null;
  /**
   * Authored layer thickness in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `thickness` records `IAutoMovieResolvedLayer`'s authored layer thickness in metres. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `thickness` supplies `IAutoMovieResolvedLayer`'s authored layer thickness in metres when the engine resolves ordered construction layers into their host face regions.
   */
  thickness: number;
  /**
   * Signed coordinate of the face nearer the reference plane.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `start` records `IAutoMovieResolvedLayer`'s signed coordinate of the face nearer the reference plane. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `start` supplies `IAutoMovieResolvedLayer`'s signed coordinate of the face nearer the reference plane when the engine resolves ordered construction layers into their host face regions.
   */
  start: number;
  /**
   * Signed coordinate of the face further from the reference plane.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `end` records `IAutoMovieResolvedLayer`'s signed coordinate of the face further from the reference plane. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `end` supplies `IAutoMovieResolvedLayer`'s signed coordinate of the face further from the reference plane when the engine resolves ordered construction layers into their host face regions.
   */
  end: number;
  /**
   * Signed coordinate of the layer's midplane.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `center` records `IAutoMovieResolvedLayer`'s signed coordinate of the layer's midplane. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `center` supplies `IAutoMovieResolvedLayer`'s signed coordinate of the layer's midplane when the engine resolves ordered construction layers into their host face regions.
   */
  center: number;
  /**
   * Whether the layer is a visible finish.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `finish` records whether the layer is a visible finish for `IAutoMovieResolvedLayer`. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `finish` tells the engine whether the layer is a visible finish for `IAutoMovieResolvedLayer` as it resolves ordered construction layers into their host face regions.
   */
  finish: boolean;
  /**
   * Whether the layer continues around an opening's reveal.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `wrapsOpening` records whether the layer continues around an opening's reveal for `IAutoMovieResolvedLayer`. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `wrapsOpening` tells the engine whether the layer continues around an opening's reveal for `IAutoMovieResolvedLayer` as it resolves ordered construction layers into their host face regions.
   */
  wrapsOpening: boolean;
}

/**
 * A build-up placed on a signed measuring line, ready to be dimensioned.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `IAutoMovieResolvedAssembly` represents a build-up placed on a signed measuring line, ready to be dimensioned. This ensures each host region retains its ordered construction build-up and total thickness.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieResolvedAssembly` structures a build-up placed on a signed measuring line, ready to be dimensioned for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieResolvedAssembly {
  /**
   * The contributing {@link IAutoMovieMaterialAssembly.id}.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `id` records `IAutoMovieResolvedAssembly`'s contributing `IAutoMovieMaterialAssembly.id`. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `id` supplies `IAutoMovieResolvedAssembly`'s contributing `IAutoMovieMaterialAssembly.id` when the engine resolves ordered construction layers into their host face regions.
   */
  id: string;
  /**
   * Host-local axis the layers stack along.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `axis` records `IAutoMovieResolvedAssembly`'s host-local axis the layers stack along. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `axis` supplies `IAutoMovieResolvedAssembly`'s host-local axis the layers stack along when the engine resolves ordered construction layers into their host face regions.
   */
  axis: "x" | "y" | "z";
  /**
   * Summed layer thickness in metres: the build-up's overall dimension.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `total` records `IAutoMovieResolvedAssembly`'s summed layer thickness in metres: the build-up's overall dimension. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `total` supplies `IAutoMovieResolvedAssembly`'s summed layer thickness in metres: the build-up's overall dimension when the engine resolves ordered construction layers into their host face regions.
   */
  total: number;
  /**
   * Signed coordinate of the first layer's outer face.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `start` records `IAutoMovieResolvedAssembly`'s signed coordinate of the first layer's outer face. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `start` supplies `IAutoMovieResolvedAssembly`'s signed coordinate of the first layer's outer face when the engine resolves ordered construction layers into their host face regions.
   */
  start: number;
  /**
   * Signed coordinate of the last layer's outer face.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `end` records `IAutoMovieResolvedAssembly`'s signed coordinate of the last layer's outer face. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `end` supplies `IAutoMovieResolvedAssembly`'s signed coordinate of the last layer's outer face when the engine resolves ordered construction layers into their host face regions.
   */
  end: number;
  /**
   * Ordered signed span of the whole build-up, lowest coordinate first.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `extent` records `IAutoMovieResolvedAssembly`'s ordered signed span of the whole build-up, lowest coordinate first. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `extent` supplies `IAutoMovieResolvedAssembly`'s ordered signed span of the whole build-up, lowest coordinate first when the engine resolves ordered construction layers into their host face regions.
   */
  extent: {
    /** Lowest signed coordinate the build-up occupies. */
    min: number;
    /** Highest signed coordinate the build-up occupies. */
    max: number;
  };
  /**
   * Layers in authored order, each placed on the measuring line.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `layers` records `IAutoMovieResolvedAssembly`'s layers in authored order, each placed on the measuring line. This ensures each host region retains its ordered construction build-up and total thickness.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `layers` supplies `IAutoMovieResolvedAssembly`'s layers in authored order, each placed on the measuring line when the engine resolves ordered construction layers into their host face regions.
   */
  layers: IAutoMovieResolvedLayer[];
}

/**
 * What a build-up does to an opening cut through its host.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `IAutoMovieAssemblyReveal` defines what a build-up does to an opening cut through its host. This ensures opening and section cuts expose the actual hidden build-up.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieAssemblyReveal` structures what a build-up does to an opening cut through its host for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieAssemblyReveal {
  /**
   * Finished clear width in metres once the lining runs reach the jamb.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `width` records `IAutoMovieAssemblyReveal`'s finished clear width in metres once the lining runs reach the jamb. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `width` supplies `IAutoMovieAssemblyReveal`'s finished clear width in metres once the lining runs reach the jamb when the engine resolves ordered construction layers into their host face regions.
   */
  width: number;
  /**
   * Finished clear height in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `height` records `IAutoMovieAssemblyReveal`'s finished clear height in metres. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `height` supplies `IAutoMovieAssemblyReveal`'s finished clear height in metres when the engine resolves ordered construction layers into their host face regions.
   */
  height: number;
  /**
   * Lining thickness taken off each side of the opening, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `inset` records `IAutoMovieAssemblyReveal`'s lining thickness taken off each side of the opening, in metres. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `inset` supplies `IAutoMovieAssemblyReveal`'s lining thickness taken off each side of the opening, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  inset: number;
  /**
   * Lining depth measured inward from the first face, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `first` records `IAutoMovieAssemblyReveal`'s lining depth measured inward from the first face, in metres. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `first` supplies `IAutoMovieAssemblyReveal`'s lining depth measured inward from the first face, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  first: number;
  /**
   * Lining depth measured inward from the last face, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `last` records `IAutoMovieAssemblyReveal`'s lining depth measured inward from the last face, in metres. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `last` supplies `IAutoMovieAssemblyReveal`'s lining depth measured inward from the last face, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  last: number;
  /**
   * Jamb depth left bare between the two linings, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `bare` records `IAutoMovieAssemblyReveal`'s jamb depth left bare between the two linings, in metres. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `bare` supplies `IAutoMovieAssemblyReveal`'s jamb depth left bare between the two linings, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  bare: number;
  /**
   * Ids of the layers that line the jamb, in stack order.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `layers` records `IAutoMovieAssemblyReveal`'s ids of the layers that line the jamb, in stack order. This ensures opening and section cuts expose the actual hidden build-up.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `layers` supplies `IAutoMovieAssemblyReveal`'s ids of the layers that line the jamb, in stack order when the engine resolves ordered construction layers into their host face regions.
   */
  layers: string[];
}

/**
 * One construction role carried through a junction by both build-ups.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `IAutoMovieAssemblyContinuity` represents one construction role carried through a junction by both build-ups. This ensures adjacent regions join, overlap, or break by declared construction rules.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieAssemblyContinuity` structures one construction role carried through a junction by both build-ups for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieAssemblyContinuity {
  /**
   * The role both sides declare.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `role` records `IAutoMovieAssemblyContinuity`'s role both sides declare. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `role` supplies `IAutoMovieAssemblyContinuity`'s role both sides declare when the engine resolves ordered construction layers into their host face regions.
   */
  role: string;
  /**
   * Signed span the role occupies on the left build-up.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `left` records `IAutoMovieAssemblyContinuity`'s signed span the role occupies on the left build-up. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `left` supplies `IAutoMovieAssemblyContinuity`'s signed span the role occupies on the left build-up when the engine resolves ordered construction layers into their host face regions.
   */
  left: {
    /** Lowest signed coordinate. */
    min: number;
    /** Highest signed coordinate. */
    max: number;
  };
  /**
   * Signed span the role occupies on the right build-up.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `right` records `IAutoMovieAssemblyContinuity`'s signed span the role occupies on the right build-up. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `right` supplies `IAutoMovieAssemblyContinuity`'s signed span the role occupies on the right build-up when the engine resolves ordered construction layers into their host face regions.
   */
  right: {
    /** Lowest signed coordinate. */
    min: number;
    /** Highest signed coordinate. */
    max: number;
  };
  /**
   * Shared signed length in metres; negative states the gap between spans.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `overlap` records `IAutoMovieAssemblyContinuity`'s shared signed length in metres; negative states the gap between spans. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `overlap` supplies `IAutoMovieAssemblyContinuity`'s shared signed length in metres; negative states the gap between spans when the engine resolves ordered construction layers into their host face regions.
   */
  overlap: number;
  /**
   * Whether the two spans meet or overlap within the caller's tolerance.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `aligned` records whether the two spans meet or overlap within the caller's tolerance for `IAutoMovieAssemblyContinuity`. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `aligned` tells the engine whether the two spans meet or overlap within the caller's tolerance for `IAutoMovieAssemblyContinuity` as it resolves ordered construction layers into their host face regions.
   */
  aligned: boolean;
}

/**
 * One construction role that stops at a junction.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `IAutoMovieAssemblyBreak` represents one construction role that stops at a junction. This ensures adjacent regions join, overlap, or break by declared construction rules.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieAssemblyBreak` structures one construction role that stops at a junction for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieAssemblyBreak {
  /**
   * The role only one side declares.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `role` records `IAutoMovieAssemblyBreak`'s role only one side declares. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `role` supplies `IAutoMovieAssemblyBreak`'s role only one side declares when the engine resolves ordered construction layers into their host face regions.
   */
  role: string;
  /**
   * Which build-up carries it.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `side` records `IAutoMovieAssemblyBreak`'s which build-up carries it. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `side` supplies `IAutoMovieAssemblyBreak`'s which build-up carries it when the engine resolves ordered construction layers into their host face regions.
   */
  side: "left" | "right";
  /**
   * Summed thickness the carrying side gives the role, in metres.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `thickness` records `IAutoMovieAssemblyBreak`'s summed thickness the carrying side gives the role, in metres. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `thickness` supplies `IAutoMovieAssemblyBreak`'s summed thickness the carrying side gives the role, in metres when the engine resolves ordered construction layers into their host face regions.
   */
  thickness: number;
}

/**
 * What survives a junction between two build-ups and what stops there.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `IAutoMovieAssemblyJunction` defines what survives a junction between two build-ups and what stops there. This ensures adjacent regions join, overlap, or break by declared construction rules.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `IAutoMovieAssemblyJunction` structures what survives a junction between two build-ups and what stops there for the system that resolves ordered construction layers into their host face regions.
 */
export interface IAutoMovieAssemblyJunction {
  /**
   * Roles both sides carry, in the left build-up's declaration order.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `continuous` records `IAutoMovieAssemblyJunction`'s roles both sides carry, in the left build-up's declaration order. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `continuous` supplies `IAutoMovieAssemblyJunction`'s roles both sides carry, in the left build-up's declaration order when the engine resolves ordered construction layers into their host face regions.
   */
  continuous: IAutoMovieAssemblyContinuity[];
  /**
   * Roles only one side carries, left-hand ones first.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `broken` records `IAutoMovieAssemblyJunction`'s roles only one side carries, left-hand ones first. This ensures adjacent regions join, overlap, or break by declared construction rules.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `broken` supplies `IAutoMovieAssemblyJunction`'s roles only one side carries, left-hand ones first when the engine resolves ordered construction layers into their host face regions.
   */
  broken: IAutoMovieAssemblyBreak[];
}

/**
 * Range-check one substance record.
 *
 * The engine ships no substances, so every value here is the production's own
 * and every one of them is optional. What the engine owns is the refusal: a
 * negative density, an absorption above one, or a vapour resistance below still
 * air are not measurements a later study can use, and a study that silently
 * consumes them reports a number nobody can trace back to a defect.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product `validateAutoMovieMaterialSubstance` range-checks one physical substance record. This ensures visual appearance remains distinct from physical substance and product build-up.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `validateAutoMovieMaterialSubstance` validates density and thermal, acoustic, and environmental properties before a substance enters an assembly layer.
 * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-surface-properties `validateAutoMovieMaterialSubstance` separates surface identity from density, thermal, heat-capacity, acoustic, vapour, and service-life facts and rejects each fact outside its declared physical range.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-layer-input `validateAutoMovieMaterialSubstance` admits the bounded physical facts consumed by an ordered envelope layer without claiming renderer optical behavior.
 * @evidence requirements/interior/materials-and-physical-properties.md#interior-material-visual-physical `validateAutoMovieMaterialSubstance` validates the material's surface identity and physical analysis facts as distinct fields rather than using appearance as a substitute for substance data.
 * @evidence specifications/interior-space/materials-style-and-art.md#interior-space-material-facts-analysis-boundary `validateAutoMovieMaterialSubstance` enforces the supported physical-fact ranges at the analysis boundary while leaving visual judgment outside it.
 */
export const validateAutoMovieMaterialSubstance = (props: {
  substance: IAutoMovieMaterialSubstance;
}): IAutoMovieValidation => {
  const { substance } = props;
  const collector = new ViolationCollector();
  const root = "$input";
  nonEmpty(substance.id, `${root}.id`, "substance id", collector);
  nonEmpty(
    substance.classification,
    `${root}.classification`,
    "substance classification",
    collector,
  );
  if (substance.name !== null)
    nonEmpty(substance.name, `${root}.name`, "substance name", collector);
  if (substance.surface !== null)
    nonEmpty(
      substance.surface,
      `${root}.surface`,
      "substance surface id",
      collector,
    );
  above(
    substance.density,
    0,
    `${root}.density`,
    "substance density",
    collector,
  );
  atLeast(
    substance.thermalConductivity,
    0,
    `${root}.thermalConductivity`,
    "substance thermal conductivity",
    collector,
  );
  above(
    substance.specificHeat,
    0,
    `${root}.specificHeat`,
    "substance specific heat",
    collector,
  );
  if (
    substance.soundAbsorption !== null &&
    (!Number.isFinite(substance.soundAbsorption) ||
      substance.soundAbsorption < 0 ||
      substance.soundAbsorption > 1)
  )
    collector.push(
      "range",
      `${root}.soundAbsorption`,
      `substance sound absorption must be a finite number within [0, 1], but was ${substance.soundAbsorption}`,
      substance.soundAbsorption,
    );
  atLeast(
    substance.vapourResistance,
    1,
    `${root}.vapourResistance`,
    "substance vapour resistance",
    collector,
  );
  above(
    substance.serviceLife,
    0,
    `${root}.serviceLife`,
    "substance service life",
    collector,
  );
  return collector.toValidation();
};

/**
 * Judge one layered build-up: its layers, its finishes, and its total.
 *
 * The checks fall into three groups the requirement names separately. Layer
 * conflicts are contradictions inside a layer — a cavity that carries a
 * substance, a solid with no thickness, a substance id that resolves to
 * nothing. Finish defects are contradictions between the stack and the faces it
 * presents — an exposed face with nothing finishing it, a finish laid over
 * another finish, a finish buried where it will never be seen, a finish spent
 * on a concealed face. Dimension conflicts are contradictions with the host — a
 * build-up whose layers do not sum to the thickness the host was drawn at.
 *
 * A single-layer stack presents both faces with the same layer, so its finish
 * answers for whichever of them is exposed rather than being demanded twice.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-assembly-conflicts `validateAutoMovieMaterialAssembly` judges one layered build-up: its layers, its finishes, and its total. This ensures contradictory layer stacks fail before they can produce plausible geometry.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `validateAutoMovieMaterialAssembly` performs auto movie material assembly validation when the engine resolves ordered construction layers into their host face regions.
 */
export const validateAutoMovieMaterialAssembly = (props: {
  assembly: IAutoMovieMaterialAssembly;
  /** Substances the layers may cite; omitted skips reference resolution. */
  substances?: readonly IAutoMovieMaterialSubstance[];
  /** Host dimension the layers must sum to; omitted skips the comparison. */
  host?: IAutoMovieAssemblyHost;
}): IAutoMovieValidation => {
  const { assembly } = props;
  const collector = new ViolationCollector();
  const root = "$input";
  const layers = assembly.layers;

  nonEmpty(assembly.id, `${root}.id`, "material assembly id", collector);
  if (!AXES.includes(assembly.axis))
    collector.push(
      "type",
      `${root}.axis`,
      `material assembly axis must be one of ${AXES.join(", ")}, but was "${String(assembly.axis)}"`,
      assembly.axis,
    );
  if (!SENSES.includes(assembly.sense))
    collector.push(
      "type",
      `${root}.sense`,
      `material assembly sense must be one of ${SENSES.join(", ")}, but was "${String(assembly.sense)}"`,
      assembly.sense,
    );
  if (!Number.isFinite(assembly.offset))
    collector.push(
      "range",
      `${root}.offset`,
      `material assembly offset must be finite, but was ${assembly.offset}`,
      assembly.offset,
    );
  for (const face of ["first", "last"] as const)
    if (!EXPOSURES.includes(assembly.faces[face]))
      collector.push(
        "type",
        `${root}.faces.${face}`,
        `material assembly face exposure must be one of ${EXPOSURES.join(", ")}, but was "${String(assembly.faces[face])}"`,
        assembly.faces[face],
      );
  if (layers.length === 0)
    collector.push(
      "range",
      `${root}.layers`,
      "a material assembly needs at least one layer",
      layers.length,
    );

  const substanceIds =
    props.substances === undefined
      ? null
      : new Set(props.substances.map((substance) => substance.id));
  const ids = new Set<string>();
  layers.forEach((layer, index) => {
    const path = `${root}.layers[${index}]`;
    nonEmpty(layer.id, `${path}.id`, "material layer id", collector);
    if (ids.has(layer.id))
      collector.push(
        "type",
        `${path}.id`,
        `material layer id "${layer.id}" must be unique within assembly "${assembly.id}"`,
        layer.id,
      );
    ids.add(layer.id);
    nonEmpty(layer.role, `${path}.role`, "material layer role", collector);
    if (!SUBSTANCES.includes(layer.substance))
      collector.push(
        "type",
        `${path}.substance`,
        `material layer substance must be one of ${SUBSTANCES.join(", ")}, but was "${String(layer.substance)}"`,
        layer.substance,
      );
    if (!Number.isFinite(layer.thickness) || layer.thickness < 0)
      collector.push(
        "range",
        `${path}.thickness`,
        `material layer thickness must be a finite number >= 0, but was ${layer.thickness}`,
        layer.thickness,
      );
    else if (layer.substance !== "membrane" && layer.thickness === 0)
      collector.push(
        "range",
        `${path}.thickness`,
        `a ${layer.substance} layer must be thicker than zero; only a membrane may measure nothing`,
        layer.thickness,
      );
    if (layer.substance === "cavity") {
      if (layer.material !== null)
        collector.push(
          "type",
          `${path}.material`,
          "a cavity layer is an air gap and carries no substance",
          layer.material,
        );
      if (layer.finish)
        collector.push(
          "type",
          `${path}.finish`,
          "a cavity layer has no surface and cannot be a finish",
          layer.finish,
        );
    } else if (layer.material === null)
      collector.push(
        "type",
        `${path}.material`,
        `a ${layer.substance} layer must cite a substance`,
        layer.material,
      );
    else if (substanceIds !== null && !substanceIds.has(layer.material))
      collector.push(
        "type",
        `${path}.material`,
        `material layer substance "${layer.material}" does not resolve`,
        layer.material,
      );
  });

  appendFinishDefects(assembly, collector, root);
  appendWrapDefects(layers, collector, root);

  if (props.host !== undefined) {
    const total = layers.reduce((sum, layer) => sum + layer.thickness, 0);
    if (
      Number.isFinite(props.host.thickness) === false ||
      props.host.thickness <= 0
    )
      collector.push(
        "range",
        `${root}.layers`,
        `host thickness must be a finite number > 0, but was ${props.host.thickness}`,
        props.host.thickness,
      );
    else if (Math.abs(total - props.host.thickness) > THICKNESS_EPSILON)
      collector.push(
        "range",
        `${root}.layers`,
        `layer thicknesses must sum to the host thickness ${props.host.thickness} m, but summed to ${total} m`,
        total,
        total - props.host.thickness,
      );
  }

  return collector.toValidation();
};

/**
 * Place a validated build-up on the host's own signed measuring line.
 *
 * This is the step that makes a build-up a dimension rather than a list. The
 * first layer's outer face starts at {@link IAutoMovieMaterialAssembly.offset},
 * each layer advances along the stacking axis in the declared sense, and the
 * summed thickness is the overall dimension the host must be drawn at. A caller
 * that sizes a wall from `total` and cuts an opening through it can then ask
 * {@link autoMovieAssemblyOpeningReveal} what the opening finishes at.
 *
 * An invalid build-up is refused here rather than resolved into numbers that
 * look usable, the same way a built environment refuses to lower.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers `resolveAutoMovieMaterialAssembly` places a validated build-up on the host's own signed measuring line. This ensures each host region retains its ordered construction build-up and total thickness.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `resolveAutoMovieMaterialAssembly` performs auto movie material assembly resolution when the engine resolves ordered construction layers into their host face regions.
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-layers `resolveAutoMovieMaterialAssembly` resolves the ordered physical substance, cavity, thickness, construction role, and render-material identity of every declared envelope layer.
 * @evidence specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-material-layer-representation `resolveAutoMovieMaterialAssembly` keeps physical layer role and thickness separate from render material identity without claiming pattern or texture-map ownership.
 */
export const resolveAutoMovieMaterialAssembly = (props: {
  assembly: IAutoMovieMaterialAssembly;
  /** Substances the layers may cite; omitted skips reference resolution. */
  substances?: readonly IAutoMovieMaterialSubstance[];
  /** Host dimension the layers must sum to; omitted skips the comparison. */
  host?: IAutoMovieAssemblyHost;
}): IAutoMovieResolvedAssembly => {
  const validated = validateAutoMovieMaterialAssembly(props);
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `material assembly "${props.assembly.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const { assembly } = props;
  const direction = assembly.sense === "positive" ? 1 : -1;
  let cursor = assembly.offset;
  const resolved: IAutoMovieResolvedLayer[] = assembly.layers.map((layer) => {
    const start = cursor;
    const end = cursor + direction * layer.thickness;
    cursor = end;
    return {
      id: layer.id,
      role: layer.role,
      substance: layer.substance,
      material: layer.material,
      thickness: layer.thickness,
      start,
      end,
      center: (start + end) / 2,
      finish: layer.finish,
      wrapsOpening: layer.wrapsOpening,
    };
  });
  const total = assembly.layers.reduce(
    (sum, layer) => sum + layer.thickness,
    0,
  );
  const end = assembly.offset + direction * total;
  return {
    id: assembly.id,
    axis: assembly.axis,
    total,
    start: assembly.offset,
    end,
    extent: {
      min: Math.min(assembly.offset, end),
      max: Math.max(assembly.offset, end),
    },
    layers: resolved,
  };
};

/**
 * Report what a build-up finishes an opening at.
 *
 * An opening is cut at a structural size and used at a finished one. Every
 * layer that continues around the jamb lines both sides of the opening, so the
 * clear width loses twice the wrapping thickness and the clear height the same;
 * the depth each lining reaches is the run of wrapping layers measured inward
 * from that face, and whatever the two linings do not reach is bare jamb.
 *
 * A lining that would consume the opening is refused rather than reported as a
 * negative dimension: a door 0.6 m wide lined by 0.4 m on each side is not a
 * narrow door, it is a wall. The refusal is written as "not above zero" rather
 * than "at or below zero", so a build-up carrying a non-finite thickness is
 * refused here too instead of returning a `NaN` width that every later
 * comparison would read as acceptable.
 *
 * Only wrapping layers reachable from a face line the jamb. A layer that claims
 * to wrap from behind one that stops there cannot turn the corner, which is why
 * validation refuses it; measuring the runs rather than the flags means it also
 * cannot narrow an opening here if one ever reaches this function unvalidated.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces `autoMovieAssemblyOpeningReveal` reports what a build-up finishes an opening at. This ensures opening and section cuts expose the actual hidden build-up.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `autoMovieAssemblyOpeningReveal` resolves which material layer and depth finish each side of an assembly opening.
 */
export const autoMovieAssemblyOpeningReveal = (props: {
  resolved: IAutoMovieResolvedAssembly;
  /** Structural opening width in metres before lining, strictly above zero. */
  width: number;
  /** Structural opening height in metres before lining, strictly above zero. */
  height: number;
}): IAutoMovieAssemblyReveal => {
  positive(props.width, "opening width");
  positive(props.height, "opening height");
  const layers = props.resolved.layers;
  const lead = leadingRun(layers, (layer) => layer.wrapsOpening);
  const tail = Math.min(
    trailingRun(layers, (layer) => layer.wrapsOpening),
    layers.length - lead,
  );
  const lining = [
    ...layers.slice(0, lead),
    ...layers.slice(layers.length - tail),
  ];
  const first = layers
    .slice(0, lead)
    .reduce((sum, layer) => sum + layer.thickness, 0);
  const last = layers
    .slice(layers.length - tail)
    .reduce((sum, layer) => sum + layer.thickness, 0);
  const inset = first + last;
  const width = props.width - 2 * inset;
  const height = props.height - 2 * inset;
  if (!(width > 0) || !(height > 0))
    throw new Error(
      `material assembly "${props.resolved.id}" lines ${inset} m on each side, which leaves no usable opening in ${props.width} x ${props.height} m`,
    );
  return {
    width,
    height,
    inset,
    first,
    last,
    bare: props.resolved.total - first - last,
    layers: lining.map((layer) => layer.id),
  };
};

/**
 * Report which construction roles survive a junction between two build-ups.
 *
 * Two walls meeting at a corner are two build-ups on one measuring line, and
 * the question a junction asks is not whether they look alike but whether each
 * role reaches across. A role both sides declare is continuous, and the signed
 * spans say whether it actually lines up or merely exists on both sides — an
 * insulation layer that ends where the next one begins is a thermal bridge, and
 * a barrier that stops at a corner is a leak.
 *
 * Roles are matched as declared: the caller decides what a role name means, and
 * a build-up that spends the same role over several layers has those layers
 * summed and spanned together rather than silently reduced to the first one.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition `matchAutoMovieAssemblyJunction` reports which construction roles survive a junction between two build-ups. This ensures adjacent regions join, overlap, or break by declared construction rules.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region `matchAutoMovieAssemblyJunction` performs auto movie assembly junction matching when the engine resolves ordered construction layers into their host face regions.
 * @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-joints-drainage `matchAutoMovieAssemblyJunction` measures aligned and broken construction-role spans at an assembly junction as its layer-joint contribution without claiming flashing or rainwater drainage.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-material-joint-opening-wrap `matchAutoMovieAssemblyJunction` reports the exact role-span alignment and break state used by the envelope joint and opening-wrap contract.
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity `matchAutoMovieAssemblyJunction` determines which adjacent envelope-layer roles remain continuous and which break across the validated junction.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant `matchAutoMovieAssemblyJunction` contributes the deterministic layer-junction continuity measurement without claiming an exterior-only open-edge policy.
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-intersections `matchAutoMovieAssemblyJunction` measures aligned construction-role spans and explicit breaks where two wall assemblies meet.
 * @evidence requirements/building-exterior/facades-and-walls.md#building-facade-interior-boundary `matchAutoMovieAssemblyJunction` compares the declared layer-role depths shared by room-side and exterior-side assemblies without claiming facade completeness.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-facade-interior-failures The junction result contributes the shared assembly-thickness and broken-role subset of facade/interior compatibility failures.
 */
export const matchAutoMovieAssemblyJunction = (props: {
  left: IAutoMovieResolvedAssembly;
  right: IAutoMovieResolvedAssembly;
  /** Greatest metre gap between two spans still counted as aligned. */
  tolerance: number;
}): IAutoMovieAssemblyJunction => {
  if (!Number.isFinite(props.tolerance) || props.tolerance < 0)
    throw new Error("junction tolerance must be a finite number >= 0");
  const left = rolesOf(props.left);
  const right = rolesOf(props.right);
  const continuous: IAutoMovieAssemblyContinuity[] = [];
  const broken: IAutoMovieAssemblyBreak[] = [];
  for (const [role, span] of left) {
    const other = right.get(role);
    if (other === undefined) {
      broken.push({ role, side: "left", thickness: span.thickness });
      continue;
    }
    const overlap =
      Math.min(span.max, other.max) - Math.max(span.min, other.min);
    continuous.push({
      role,
      left: { min: span.min, max: span.max },
      right: { min: other.min, max: other.max },
      overlap,
      aligned: overlap >= -props.tolerance,
    });
  }
  for (const [role, span] of right)
    if (!left.has(role))
      broken.push({ role, side: "right", thickness: span.thickness });
  return { continuous, broken };
};

/**
 * Report every finish contradiction between a stack and the faces it presents.
 *
 * A finish is only a finish where it can be seen. Index zero presents the first
 * face and the final index the last one, so a finish anywhere else is either a
 * second coat over the finish beside it or a layer buried where nothing reaches
 * it; both are defects, and naming them apart is what tells the author whether
 * to delete a layer or move it.
 */
const appendFinishDefects = (
  assembly: IAutoMovieMaterialAssembly,
  collector: ViolationCollector,
  root: string,
): void => {
  const layers = assembly.layers;
  if (layers.length === 0) return;
  const last = layers.length - 1;
  layers.forEach((layer, index) => {
    if (!layer.finish || index === 0 || index === last) return;
    const doubled = layers[index - 1]!.finish || layers[index + 1]!.finish;
    collector.push(
      "type",
      `${root}.layers[${index}].finish`,
      doubled
        ? `material layer "${layer.id}" lays a finish over the finish beside it`
        : `material layer "${layer.id}" is a finish buried between layers and reaches no exposed face`,
      layer.finish,
    );
  });
  const terminals = new Map<number, Array<"first" | "last">>();
  terminals.set(0, ["first"]);
  terminals.set(last, [...(terminals.get(last) ?? []), "last"]);
  for (const [index, faces] of terminals) {
    const layer = layers[index]!;
    const exposed = faces.filter((face) => assembly.faces[face] === "exposed");
    if (exposed.length > 0 && !layer.finish)
      collector.push(
        "type",
        `${root}.layers[${index}].finish`,
        `no finish presents the exposed ${exposed.join(" and ")} face; material layer "${layer.id}" is the layer that reaches it`,
        layer.finish,
      );
    if (exposed.length === 0 && layer.finish)
      collector.push(
        "type",
        `${root}.layers[${index}].finish`,
        `material layer "${layer.id}" spends a finish on the concealed ${faces.join(" and ")} face`,
        layer.finish,
      );
  }
};

/**
 * Refuse a wrapping layer that sits behind a layer stopping at the jamb.
 *
 * Lining an opening is a run that starts at a face: a layer cannot turn the
 * corner into the reveal if the layer in front of it already ended there. A
 * buried wrap would otherwise be counted into the finished opening size and
 * quietly narrow a door nothing actually lines.
 */
const appendWrapDefects = (
  layers: readonly IAutoMovieMaterialLayer[],
  collector: ViolationCollector,
  root: string,
): void => {
  const lead = leadingRun(layers, (layer) => layer.wrapsOpening);
  const tail = Math.min(
    trailingRun(layers, (layer) => layer.wrapsOpening),
    layers.length - lead,
  );
  layers.forEach((layer, index) => {
    if (!layer.wrapsOpening) return;
    if (index < lead || index >= layers.length - tail) return;
    collector.push(
      "type",
      `${root}.layers[${index}].wrapsOpening`,
      `material layer "${layer.id}" wraps an opening from behind a layer that stops at the jamb`,
      layer.wrapsOpening,
    );
  });
};

const leadingRun = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
): number => {
  let count = 0;
  while (count < items.length && match(items[count]!)) count += 1;
  return count;
};

const trailingRun = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
): number => {
  let count = 0;
  while (count < items.length && match(items[items.length - 1 - count]!))
    count += 1;
  return count;
};

const rolesOf = (
  assembly: IAutoMovieResolvedAssembly,
): Map<string, { min: number; max: number; thickness: number }> => {
  const roles = new Map<
    string,
    { min: number; max: number; thickness: number }
  >([]);
  for (const layer of assembly.layers) {
    const min = Math.min(layer.start, layer.end);
    const max = Math.max(layer.start, layer.end);
    const previous = roles.get(layer.role);
    if (previous === undefined)
      roles.set(layer.role, { min, max, thickness: layer.thickness });
    else
      roles.set(layer.role, {
        min: Math.min(previous.min, min),
        max: Math.max(previous.max, max),
        thickness: previous.thickness + layer.thickness,
      });
  }
  return roles;
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be non-empty`, value);
};

const above = (
  value: number | null,
  limit: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value !== null && (!Number.isFinite(value) || value <= limit))
    collector.push(
      "range",
      path,
      `${label} must be a finite number > ${limit}, but was ${value}`,
      value,
    );
};

const atLeast = (
  value: number | null,
  limit: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value !== null && (!Number.isFinite(value) || value < limit))
    collector.push(
      "range",
      path,
      `${label} must be a finite number >= ${limit}, but was ${value}`,
      value,
    );
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a finite number > 0`);
};
