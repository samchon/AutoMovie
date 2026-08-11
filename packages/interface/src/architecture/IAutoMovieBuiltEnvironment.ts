import { IAutoMovieQuaternion } from "../geometry/IAutoMovieQuaternion";
import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieModel } from "../model/IAutoMovieModel";
import { IAutoMovieSurface } from "../scene/IAutoMovieSurface";

/**
 * A complete code-authored building work containing one or more building units.
 *
 * The record deliberately separates the visible element hierarchy from the
 * logical space hierarchy. A continuous hall may therefore contain named rooms,
 * floors, an attic, and a double-height void without inventing walls, while a
 * stair, lift, ramp, or skybridge explicitly connects those spaces. The scope
 * ends at the building: facade ladders, rails, external stairs, balconies,
 * roofs, and helipads belong here, but surrounding land, parks, sky, and
 * natural water remain production-world concerns. Sun, sky, season,
 * orientation, reference ground, and neighbouring occluder masses are therefore
 * read-only inputs a daylight or shadow study reads from the world;
 * deliberately no field here can hold them, so they can never leak into a
 * building's own models, set pieces, or spaces. An indoor water feature
 * composes a separate engine fluid domain with a building space; fluid
 * simulation is not owned by this architecture record. Element kinds are open
 * strings: historical, vernacular, contemporary, and speculative architecture
 * all use the same transform and model primitives instead of being limited by a
 * catalogue of styles.
 *
 * This is an engine/interchange record produced by ordinary TypeScript. A
 * building class may use loops, parameters, and reusable parts, then lower the
 * resulting record to scene models, set pieces, and locomotion spaces.
 *
 * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `IAutoMovieBuiltEnvironment` as the portable data boundary for the building external multi building connection requirement.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `IAutoMovieBuiltEnvironment` for the building envelope multibuilding connector failures system contract.
 */
export interface IAutoMovieBuiltEnvironment {
  /**
   * Schema version.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `version` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `version` for the building envelope multibuilding connector failures system contract.
   */
  version: 1;
  /**
   * Stable identity of this environment.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `id` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `id` for the building envelope multibuilding connector failures system contract.
   */
  id: string;
  /**
   * All authored dimensions are measured in metres.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `units` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `units` for the building envelope multibuilding connector failures system contract.
   */
  units: "meter";
  /**
   * Independently owned and independently placed building units in this work.
   *
   * Ownership is total: every element and every logical space descends from
   * exactly one unit's roots, so nothing in the work is unattributed. A
   * skybridge is a work-owned relation between two units rather than a third
   * unit, so its connector may cross units even though its roots may not.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `buildings` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `buildings` for the building envelope multibuilding connector failures system contract.
   */
  buildings: IAutoMovieBuildingUnit[];
  /**
   * Models owned by the environment and cited by visible elements.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `models` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `models` for the building envelope multibuilding connector failures system contract.
   */
  models: IAutoMovieModel[];
  /**
   * Compiler-owned runtime model ids cited by elements, including imported
   * external assets whose bytes cannot be created inside source code.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `modelReferences` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `modelReferences` for the building envelope multibuilding connector failures system contract.
   */
  modelReferences: string[];
  /**
   * Parent-local full-TRS hierarchy of visible and grouping elements.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `elements` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `elements` for the building envelope multibuilding connector failures system contract.
   */
  elements: IAutoMovieBuiltElement[];
  /**
   * Independently nested semantic partitions inside/on the building envelope.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `spaces` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `spaces` for the building envelope multibuilding connector failures system contract.
   */
  spaces: IAutoMovieBuiltSpace[];
  /**
   * Physical or logical separations between spaces.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `boundaries` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `boundaries` for the building envelope multibuilding connector failures system contract.
   */
  boundaries: IAutoMovieBuiltBoundary[];
  /**
   * Passages cut through boundaries.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `openings` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `openings` for the building envelope multibuilding connector failures system contract.
   */
  openings: IAutoMovieBuiltOpening[];
  /**
   * Traversable relations such as stairs, lifts, ramps, and skybridges.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `connectors` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `connectors` for the building envelope multibuilding connector failures system contract.
   */
  connectors: IAutoMovieBuiltConnector[];
  /**
   * Ground/support patches assigned to logical spaces.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `surfaces` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `surfaces` for the building envelope multibuilding connector failures system contract.
   */
  surfaces: IAutoMovieBuiltSurface[];
  /**
   * Surface ids on which locomotion is permitted.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `walkable` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `walkable` for the building envelope multibuilding connector failures system contract.
   */
  walkable: string[];
}

/**
 * One building unit and the roots of its visible and logical hierarchies.
 *
 * The element root is also the unit's coordinate root, so one unit is moved,
 * turned, or tilted as a whole by its own root transform without touching the
 * others.
 *
 * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain Exposes `IAutoMovieBuildingUnit` as the portable data boundary for the building coordinate transform chain requirement.
 * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-input-output Types `IAutoMovieBuildingUnit` for the building envelope coordinate input output system contract.
 */
export interface IAutoMovieBuildingUnit {
  /**
   * Stable building identity within the work.
   *
   * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain Exposes `id` as the portable data boundary for the building coordinate transform chain requirement.
   * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-input-output Types `id` for the building envelope coordinate input output system contract.
   */
  id: string;
  /**
   * Root visible element. It must have no element parent.
   *
   * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain Exposes `element` as the portable data boundary for the building coordinate transform chain requirement.
   * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-input-output Types `element` for the building envelope coordinate input output system contract.
   */
  element: string;
  /**
   * Root logical space. It must have no logical-space parent.
   *
   * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain Exposes `space` as the portable data boundary for the building coordinate transform chain requirement.
   * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-input-output Types `space` for the building envelope coordinate input output system contract.
   */
  space: string;
}

/**
 * One transformable member of the visible building hierarchy.
 *
 * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `IAutoMovieBuiltElement` as the portable data boundary for the building external multi building connection requirement.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `IAutoMovieBuiltElement` for the building envelope multibuilding connector failures system contract.
 */
export interface IAutoMovieBuiltElement {
  /**
   * Stable element identity.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `id` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `id` for the building envelope multibuilding connector failures system contract.
   */
  id: string;
  /**
   * Open semantic label such as `building`, `storey`, `wall`, `coffer`, `roof`,
   * or a production-specific term.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `kind` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `kind` for the building envelope multibuilding connector failures system contract.
   */
  kind: string;
  /**
   * Parent element id, or null for an environment root.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `parent` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `parent` for the building envelope multibuilding connector failures system contract.
   */
  parent: string | null;
  /**
   * Local transform in the parent element's frame.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `transform` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `transform` for the building envelope multibuilding connector failures system contract.
   */
  transform: IAutoMovieTransform;
  /**
   * Visible model id, or null for a transform-only group.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `model` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `model` for the building envelope multibuilding connector failures system contract.
   */
  model: string | null;
  /**
   * Primary logical space occupied by this element, or null.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `space` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `space` for the building envelope multibuilding connector failures system contract.
   */
  space: string | null;
}

/**
 * One named semantic region, independent of visible walls and slabs.
 *
 * **A space states its volume exactly one way**, in {@link cells} or in
 * {@link shell}, and stating both is refused for the same reason a support patch
 * may not state its ground twice: two spellings of one region are two regions
 * waiting to be edited apart, and the containment query would have to pick a
 * winner nobody authored. Stating neither is the third legitimate case, a
 * purely semantic container that locates nothing.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `IAutoMovieBuiltSpace` as the portable data boundary for the interior surface region composition requirement.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `IAutoMovieBuiltSpace` for the interior space surface assembly region system contract.
 */
export interface IAutoMovieBuiltSpace {
  /**
   * Stable logical-space identity.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `id` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `id` for the interior space surface assembly region system contract.
   */
  id: string;
  /**
   * Open semantic label such as `building`, `storey`, `room`, `attic`, `void`,
   * `roof-deck`, `facade-access`, or `bridge-deck`.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `kind` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `kind` for the interior space surface assembly region system contract.
   */
  kind: string;
  /**
   * Parent logical-space id, or null for a root partition.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `parent` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `parent` for the interior space surface assembly region system contract.
   */
  parent: string | null;
  /**
   * World-space convex cells whose union locates the region. Empty cells make a
   * purely semantic container; non-convex regions are split into cells.
   *
   * A union of convex cells says every polyhedral region exactly, however
   * concave, so this stays the ordinary spelling. What it cannot say is a
   * region whose boundary is not flat, and what it says awkwardly is a region
   * pierced by a void: see {@link shell} for the first and
   * {@link IAutoMovieBuiltSpace.fidelity} for what a faceted approximation owes
   * the reader.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `cells` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `cells` for the interior space surface assembly region system contract.
   */
  cells: IAutoMovieConvexSpaceCell[];
  /**
   * The region as its own closed boundary, when half-spaces cannot state it.
   *
   * This is the escape hatch IFC keeps open and this record did not have: a
   * space's body may be a swept solid or a clipping, and `Brep` is always
   * available as the fallback advanced representation, with
   * `IfcFacetedBrepWithVoids` for the pierced case. An atrium void through a
   * storey is not an exotic shape in that standard, it is a base assumption,
   * and decomposing one into half-space cells is a chore that produces a
   * different region every time somebody does it.
   *
   * A shell is authoritative for containment wherever it is stated. It is
   * mutually exclusive with {@link cells}, and it is flats: a dome authored here
   * is the facets it is written as, which is what
   * {@link IAutoMovieBuiltSpace.fidelity} exists to say out loud.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `shell` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `shell` for the interior space surface assembly region system contract.
   */
  shell?: IAutoMovieSpaceShell;
  /**
   * What the stated volume claims to be, when it claims less than the region.
   *
   * Absent, or `exact`, says the cells or the shell **are** the region: a
   * rectilinear room, a chamfered lobby, a slab with a rectangular void. There
   * is nothing left over.
   *
   * `faceted` says they only stand in for it. A dome, a barrel vault, and a
   * free-form soffit have curved boundaries, and this record carries no curved
   * primitive at all — no sweep, no surface of revolution, no NURBS — so the
   * only thing an author can write is flats, and the only honest thing the data
   * can do is say that is what they are. Every derived quantity, section and
   * containment answer over such a space is the facets' answer and not the
   * curve's; a take-off says so, rather than reporting a number to the
   * millimetre against a boundary nobody stated.
   *
   * It is a declaration, not a measurement: nothing here can look at flats and
   * tell whether a curve was meant. Declaring it on a space that states no
   * volume at all is refused, because there is nothing for it to be an
   * approximation of.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Exposes `fidelity` as the portable data boundary for the interior surface region composition requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `fidelity` for the interior space surface assembly region system contract.
   */
  fidelity?: "exact" | "faceted";
}

/**
 * A bounded convex cell represented by intersecting half-spaces.
 *
 * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `IAutoMovieConvexSpaceCell` as the portable data boundary for the interior space visibility culling requirement.
 * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `IAutoMovieConvexSpaceCell` for the interior space occupancy activity visibility system contract.
 */
export interface IAutoMovieConvexSpaceCell {
  /**
   * Stable cell identity within the environment.
   *
   * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `id` as the portable data boundary for the interior space visibility culling requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `id` for the interior space occupancy activity visibility system contract.
   */
  id: string;
  /**
   * Planes whose inside test is `dot(normal, point) <= offset`.
   *
   * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `planes` as the portable data boundary for the interior space visibility culling requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `planes` for the interior space occupancy activity visibility system contract.
   */
  planes: IAutoMovieHalfSpacePlane[];
}

/**
 * A closed triangulated boundary standing for one logical volume.
 *
 * The shell is a single triangle soup rather than a list of shells, because
 * "outer boundary plus voids" is a reading of one closed surface and not a
 * second kind of record: an atrium void is inner facets wound the other way in
 * the same list, so a point in the void is outside the volume by the same
 * arithmetic that puts a point in the room inside it. That is exactly how
 * `IfcFacetedBrepWithVoids` reads, and it is why the containment query needs no
 * case for holes.
 *
 * Nothing is inferred from the mesh. It must already be closed — every directed
 * edge appearing once and its reverse once — and wound counter-clockwise seen
 * from outside the solid, both of which `validateBuiltEnvironment` checks,
 * because a boundary with a gap in it has no inside and a boundary turned
 * inside out has the wrong one.
 *
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `IAutoMovieSpaceShell` as the portable data boundary for the interior wall boundary validation requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `IAutoMovieSpaceShell` for the interior space wall partition boundary system contract.
 */
export interface IAutoMovieSpaceShell {
  /**
   * World-space vertices the triangles index; at least four.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `vertices` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `vertices` for the interior space wall partition boundary system contract.
   */
  vertices: IAutoMovieVector3[];
  /**
   * Triangles as flat vertex-index triples, so `triangles[3i]`,
   * `triangles[3i+1]` and `triangles[3i+2]` are one face. At least four faces,
   * because nothing fewer closes a solid.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `triangles` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `triangles` for the interior space wall partition boundary system contract.
   */
  triangles: number[];
}

/**
 * One world-space half-space plane used by a logical volume.
 *
 * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-boundaries Exposes `IAutoMovieHalfSpacePlane` as the portable data boundary for the interior space boundaries requirement.
 * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-hierarchy-zone-overlay Types `IAutoMovieHalfSpacePlane` for the interior space hierarchy zone overlay system contract.
 */
export interface IAutoMovieHalfSpacePlane {
  /**
   * Non-zero plane normal; it need not be normalized.
   *
   * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-boundaries Exposes `normal` as the portable data boundary for the interior space boundaries requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-hierarchy-zone-overlay Types `normal` for the interior space hierarchy zone overlay system contract.
   */
  normal: IAutoMovieVector3;
  /**
   * Finite plane offset in the same scale as the normal.
   *
   * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-boundaries Exposes `offset` as the portable data boundary for the interior space boundaries requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-hierarchy-zone-overlay Types `offset` for the interior space hierarchy zone overlay system contract.
   */
  offset: number;
}

/**
 * A separation shared by one interior/exterior region or a pair of regions.
 *
 * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `IAutoMovieBuiltBoundary` as the portable data boundary for the building exterior interior shared validation requirement.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `IAutoMovieBuiltBoundary` for the interior space linked building shared facts system contract.
 */
export interface IAutoMovieBuiltBoundary {
  /**
   * Stable boundary identity.
   *
   * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `id` as the portable data boundary for the building exterior interior shared validation requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `id` for the interior space linked building shared facts system contract.
   */
  id: string;
  /**
   * Open semantic label such as `wall`, `floor`, `ceiling`, or `threshold`.
   *
   * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `kind` as the portable data boundary for the building exterior interior shared validation requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `kind` for the interior space linked building shared facts system contract.
   */
  kind: string;
  /**
   * One enclosing space, or the two spaces this boundary separates.
   *
   * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `spaces` as the portable data boundary for the building exterior interior shared validation requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `spaces` for the interior space linked building shared facts system contract.
   */
  spaces: string[];
  /**
   * Visible elements realizing the boundary; empty for a logical boundary.
   *
   * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `elements` as the portable data boundary for the building exterior interior shared validation requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `elements` for the interior space linked building shared facts system contract.
   */
  elements: string[];
  /**
   * Where the separation actually is, when it is somewhere at all.
   *
   * A boundary without a face stays the purely relational record it has always
   * been, so an environment written before this field keeps validating
   * unchanged. Stating a face is what lets an opening be placed on the
   * separation and checked against it, because there is finally a surface for
   * "on the wall" and "off the wall" to mean something.
   *
   * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Exposes `face` as the portable data boundary for the building exterior interior shared validation requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-linked-building-shared-facts Types `face` for the interior space linked building shared facts system contract.
   */
  face?: IAutoMovieBoundaryFace;
}

/**
 * The located planar face of a boundary and the frame openings are measured in.
 *
 * The frame is a full rigid placement, never a heading: local `+X` and `+Y`
 * span the face and local `+Z` is the outward normal, so a wall leaning out of
 * plumb or a sloping soffit is stated exactly rather than flattened to a
 * compass direction. Everything an opening says about itself is written in this
 * frame's metres, which is what makes "the door is inside the wall" a fact the
 * engine can settle instead of two unrelated coordinate systems.
 *
 * The patch is planar on purpose. A curved separation is authored as several
 * boundaries, each one flat, rather than as one face carrying a surface the
 * containment test would then have to approximate.
 *
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `IAutoMovieBoundaryFace` as the portable data boundary for the interior wall boundary validation requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `IAutoMovieBoundaryFace` for the interior space wall partition boundary system contract.
 */
export interface IAutoMovieBoundaryFace {
  /**
   * World-space origin of the boundary's own frame.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `origin` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `origin` for the interior space wall partition boundary system contract.
   */
  origin: IAutoMovieVector3;
  /**
   * Unit quaternion taking the boundary's local axes into world space.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `rotation` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `rotation` for the interior space wall partition boundary system contract.
   */
  rotation: IAutoMovieQuaternion;
  /**
   * Closed face outline in boundary-local XY metres, at least three points.
   *
   * The outline is a simple polygon: it may be concave, but it may not cross
   * itself, because a self-crossing outline has no inside for an opening to be
   * checked against.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `outline` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `outline` for the interior space wall partition boundary system contract.
   */
  outline: IAutoMoviePlanarPoint[];
  /**
   * Positive separation thickness along the boundary's local `+Z`, in metres.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Exposes `thickness` as the portable data boundary for the interior wall boundary validation requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `thickness` for the interior space wall partition boundary system contract.
   */
  thickness: number;
}

/**
 * One point in a boundary's own local XY plane, measured in metres.
 *
 * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity Exposes `IAutoMoviePlanarPoint` as the portable data boundary for the building shared boundary identity requirement.
 * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-shared-boundary-identity Types `IAutoMoviePlanarPoint` for the building envelope coordinate shared boundary identity system contract.
 */
export interface IAutoMoviePlanarPoint {
  /**
   * Coordinate along the host frame's local X axis.
   *
   * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity Exposes `x` as the portable data boundary for the building shared boundary identity requirement.
   * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-shared-boundary-identity Types `x` for the building envelope coordinate shared boundary identity system contract.
   */
  x: number;
  /**
   * Coordinate along the host frame's local Y axis.
   *
   * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity Exposes `y` as the portable data boundary for the building shared boundary identity requirement.
   * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-shared-boundary-identity Types `y` for the building envelope coordinate shared boundary identity system contract.
   */
  y: number;
}

/**
 * One traversable or visible opening through a boundary.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `IAutoMovieBuiltOpening` as the portable data boundary for the building opening form layout requirement.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `IAutoMovieBuiltOpening` for the building envelope opening cut input output system contract.
 */
export interface IAutoMovieBuiltOpening {
  /**
   * Stable opening identity.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `id` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `id` for the building envelope opening cut input output system contract.
   */
  id: string;
  /**
   * Open semantic label such as `door`, `window`, `arch`, or `passage`.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `kind` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `kind` for the building envelope opening cut input output system contract.
   */
  kind: string;
  /**
   * Boundary containing this opening.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `boundary` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `boundary` for the building envelope opening cut input output system contract.
   */
  boundary: string;
  /**
   * Door, sash, gate, or other filling element; null for an open cut.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `fill` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `fill` for the building envelope opening cut input output system contract.
   */
  fill: string | null;
  /**
   * The void this opening actually cuts in its host boundary's face.
   *
   * Omitting it keeps the pre-geometry record: the opening is a declared
   * relation and nothing is checked about where it is. Stating it demands the
   * host carry a {@link IAutoMovieBuiltBoundary.face}, and the void is then held
   * inside that face and apart from every other void on it.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `profile` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `profile` for the building envelope opening cut input output system contract.
   */
  profile?: IAutoMovieOpeningProfile;
  /**
   * Movable panels and the named states they stand in, or nothing for a fixed
   * cut such as an arch or a permanently open passage.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `operation` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `operation` for the building envelope opening cut input output system contract.
   */
  operation?: IAutoMovieOpeningOperation;
}

/**
 * A closed outline in the host boundary's own frame, straight edges or arcs.
 *
 * Edge `i` runs from `outline[i]` to `outline[(i + 1) % outline.length]`. A
 * rectangular door is four points and no bulge at all; a semicircular oculus is
 * two points and two half-turn bulges; a round-headed arch is the jambs and the
 * head as one bulged edge. Nothing here names a door type: the outline is the
 * general shape and the rectangle is one of its cases.
 *
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-two-sided-ownership Exposes `IAutoMovieOpeningProfile` as the portable data boundary for the interior wall two sided ownership requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `IAutoMovieOpeningProfile` for the interior space wall partition boundary system contract.
 */
export interface IAutoMovieOpeningProfile {
  /**
   * Closed outline in host-boundary-local XY metres, at least two points.
   *
   * Two is the floor rather than three because a circle is two arcs, and
   * demanding a third corner would outlaw a round oculus for no geometric
   * reason. What must hold is that the outline encloses area once its arcs are
   * taken into account, so two points with no bulge between them are still
   * refused.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-two-sided-ownership Exposes `outline` as the portable data boundary for the interior wall two sided ownership requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `outline` for the interior space wall partition boundary system contract.
   */
  outline: IAutoMoviePlanarPoint[];
  /**
   * Per-edge circular bulge, one entry per edge when stated at all.
   *
   * The value is AutoCAD's polyline convention `tan(theta / 4)` for the arc's
   * included angle `theta`, so `0` is a straight edge and `1` is a half turn
   * bulging to the left of the edge's own direction. The magnitude may not
   * exceed `1`: an arc longer than a half turn is authored as two edges, which
   * is what keeps each arc's extent exactly boundable rather than sampled.
   *
   * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-two-sided-ownership Exposes `bulges` as the portable data boundary for the interior wall two sided ownership requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary Types `bulges` for the interior space wall partition boundary system contract.
   */
  bulges?: number[];
}

/**
 * The moving part of a door, sash, shutter, or blind, as states rather than a
 * word.
 *
 * A single `"open"` string cannot say how far open, cannot be interpolated, and
 * cannot be checked. Instead each travelling leaf declares one degree of
 * freedom with its own limits, and a named state gives every leaf a value on
 * it. `closed`, `open`, `vent`, and a production's own term are all the same
 * kind of record, so the vocabulary belongs to the author and the arithmetic
 * belongs to the engine.
 *
 * Swing, slide, and fold are not three contracts: a swing leaf is one revolute
 * panel, a slide leaf is one prismatic panel, and a folding leaf is a revolute
 * panel whose element is parented to another leaf's element, so the existing
 * element hierarchy carries the chaining without a second parent notion.
 *
 * An opening that declares an operation must name the element the panels belong
 * to in {@link IAutoMovieBuiltOpening.fill}: a moving leaf that fills nothing is
 * a leaf nobody can point at.
 *
 * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `IAutoMovieOpeningOperation` as the portable data boundary for the interior opening operable state requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `IAutoMovieOpeningOperation` for the interior space host opening operation system contract.
 */
export interface IAutoMovieOpeningOperation {
  /**
   * Travelling leaves, sashes, or slats; at least one.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `panels` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `panels` for the interior space host opening operation system contract.
   */
  panels: IAutoMovieMovablePanel[];
  /**
   * Named states; at least one, and each gives every panel a value.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `states` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `states` for the interior space host opening operation system contract.
   */
  states: IAutoMovieOperationState[];
  /**
   * The state the design currently stands in; names one of {@link states}.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `state` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `state` for the interior space host opening operation system contract.
   */
  state: string;
  /**
   * Fixed members the opening carries, such as a frame, hinge, or handle.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `hardware` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `hardware` for the interior space host opening operation system contract.
   */
  hardware: IAutoMovieOpeningHardware[];
}

/**
 * One member that travels on a single degree of freedom.
 *
 * The panel drives a visible element, and that element's own local transform is
 * its rest pose, so a panel adds motion to the hierarchy rather than a second
 * way of placing the same thing. Both the axis and the pivot are written in the
 * element's own local frame, and the leaf occupies the element-local rectangle
 * from the origin to `(width, height)` in that frame's XY plane: a hinge at the
 * local origin with the leaf running along `+X` is therefore the natural way to
 * author a door, and the swept envelope is measured from exactly that
 * rectangle.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `IAutoMovieMovablePanel` as the portable data boundary for the building envelope continuity requirement.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `IAutoMovieMovablePanel` for the building envelope envelope continuity invariant system contract.
 */
export interface IAutoMovieMovablePanel {
  /**
   * Stable panel identity within the opening.
   *
   * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `id` as the portable data boundary for the building envelope continuity requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `id` for the building envelope envelope continuity invariant system contract.
   */
  id: string;
  /**
   * Visible element this panel drives; its local transform is the rest pose.
   *
   * It is the opening's own {@link IAutoMovieBuiltOpening.fill} or an element
   * below it, so a panel can only move part of the thing that fills the hole.
   *
   * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `element` as the portable data boundary for the building envelope continuity requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `element` for the building envelope envelope continuity invariant system contract.
   */
  element: string;
  /**
   * Positive leaf extent along the element's local X, in metres.
   *
   * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `width` as the portable data boundary for the building envelope continuity requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `width` for the building envelope envelope continuity invariant system contract.
   */
  width: number;
  /**
   * Positive leaf extent along the element's local Y, in metres.
   *
   * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `height` as the portable data boundary for the building envelope continuity requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `height` for the building envelope envelope continuity invariant system contract.
   */
  height: number;
  /**
   * The one degree of freedom this panel travels on.
   *
   * @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity Exposes `motion` as the portable data boundary for the building envelope continuity requirement.
   * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-envelope-continuity-invariant Types `motion` for the building envelope envelope continuity invariant system contract.
   */
  motion: IAutoMovieTravelMotion;
}

/**
 * The single degree of freedom one moving member travels on.
 *
 * A door leaf and a lift car are the same arithmetic under different names, so
 * they share one record rather than each growing a private one: the value a
 * named state gives is a displacement from the element's own rest pose, and the
 * engine composes it after that pose so it rides down the hierarchy.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `IAutoMovieTravelMotion` as the portable data boundary for the building opening operable state requirement.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `IAutoMovieTravelMotion` for the building envelope opening operable sweep invariant system contract.
 */
export type IAutoMovieTravelMotion =
  | IAutoMovieTravelMotion.IRevolute
  | IAutoMovieTravelMotion.IPrismatic;
export namespace IAutoMovieTravelMotion {
  /**
   * A hinge: the member turns about an axis through a pivot.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `IRevolute` as the portable data boundary for the building external circulation requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `IRevolute` for the building envelope exterior circulation input output system contract.
   */
  export interface IRevolute {
    /**
     * Discriminator.
     *
     * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `kind` as the portable data boundary for the building external circulation requirement.
     * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `kind` for the building envelope exterior circulation input output system contract.
     */
    kind: "revolute";
    /**
     * Non-zero turn axis in the moving element's own local frame.
     *
     * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `axis` as the portable data boundary for the building external circulation requirement.
     * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `axis` for the building envelope exterior circulation input output system contract.
     */
    axis: IAutoMovieVector3;
    /**
     * A point on that axis in the same local frame.
     *
     * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `pivot` as the portable data boundary for the building external circulation requirement.
     * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `pivot` for the building envelope exterior circulation input output system contract.
     */
    pivot: IAutoMovieVector3;
    /**
     * Lowest travel in radians; at most `0`, because rest is `0`.
     *
     * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `min` as the portable data boundary for the building external circulation requirement.
     * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `min` for the building envelope exterior circulation input output system contract.
     */
    min: number;
    /**
     * Highest travel in radians; at least `0`, and within a turn of `min`.
     *
     * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation Exposes `max` as the portable data boundary for the building external circulation requirement.
     * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output Types `max` for the building envelope exterior circulation input output system contract.
     */
    max: number;
  }

  /**
   * A slide: the member travels along an axis without turning.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Exposes `IPrismatic` as the portable data boundary for the interior without exterior requirement.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-independent-set-state Types `IPrismatic` for the interior space independent set state system contract.
   */
  export interface IPrismatic {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Exposes `kind` as the portable data boundary for the interior without exterior requirement.
     * @evidence specifications/interior-space/scope-and-host.md#interior-space-independent-set-state Types `kind` for the interior space independent set state system contract.
     */
    kind: "prismatic";
    /**
     * Non-zero travel axis in the moving element's own local frame.
     *
     * @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Exposes `axis` as the portable data boundary for the interior without exterior requirement.
     * @evidence specifications/interior-space/scope-and-host.md#interior-space-independent-set-state Types `axis` for the interior space independent set state system contract.
     */
    axis: IAutoMovieVector3;
    /**
     * Lowest travel in metres along the unit axis; at most `0`.
     *
     * @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Exposes `min` as the portable data boundary for the interior without exterior requirement.
     * @evidence specifications/interior-space/scope-and-host.md#interior-space-independent-set-state Types `min` for the interior space independent set state system contract.
     */
    min: number;
    /**
     * Highest travel in metres along the unit axis; at least `0`.
     *
     * @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Exposes `max` as the portable data boundary for the interior without exterior requirement.
     * @evidence specifications/interior-space/scope-and-host.md#interior-space-independent-set-state Types `max` for the interior space independent set state system contract.
     */
    max: number;
  }
}

/**
 * One named operating state and the travel it gives each panel.
 *
 * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `IAutoMovieOperationState` as the portable data boundary for the interior opening operable state requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `IAutoMovieOperationState` for the interior space host opening operation system contract.
 */
export interface IAutoMovieOperationState {
  /**
   * Stable state name such as `closed`, `open`, or a production term.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `id` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `id` for the interior space host opening operation system contract.
   */
  id: string;
  /**
   * One value per panel; every panel of the operation must appear exactly once.
   *
   * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Exposes `panels` as the portable data boundary for the interior opening operable state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `panels` for the interior space host opening operation system contract.
   */
  panels: IAutoMoviePanelValue[];
}

/**
 * The travel one named state gives one panel.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `IAutoMoviePanelValue` as the portable data boundary for the building opening operable state requirement.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `IAutoMoviePanelValue` for the building envelope opening operable sweep invariant system contract.
 */
export interface IAutoMoviePanelValue {
  /**
   * Panel id inside the same operation.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `panel` as the portable data boundary for the building opening operable state requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `panel` for the building envelope opening operable sweep invariant system contract.
   */
  panel: string;
  /**
   * Radians for a revolute panel, metres for a prismatic one.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `value` as the portable data boundary for the building opening operable state requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `value` for the building envelope opening operable sweep invariant system contract.
   */
  value: number;
}

/**
 * One fixed, non-travelling member an opening carries.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `IAutoMovieOpeningHardware` as the portable data boundary for the building opening form layout requirement.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `IAutoMovieOpeningHardware` for the building envelope opening cut input output system contract.
 */
export interface IAutoMovieOpeningHardware {
  /**
   * Stable hardware identity within the opening.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `id` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `id` for the building envelope opening cut input output system contract.
   */
  id: string;
  /**
   * Open semantic label such as `frame`, `hinge`, `handle`, or `track`.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `kind` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `kind` for the building envelope opening cut input output system contract.
   */
  kind: string;
  /**
   * Visible element realizing it, or null when it is only declared.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout Exposes `element` as the portable data boundary for the building opening form layout requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output Types `element` for the building envelope opening cut input output system contract.
   */
  element: string | null;
}

/**
 * A navigable relation between logical spaces, and the shape it has.
 *
 * The record is deliberately the traversal geometry a later analysis reads, not
 * a verdict about that analysis: whether a person can actually pass, how they
 * would route, and how a building evacuates are separate work. What lives here
 * is the measurable shape — where the route runs, which way each station faces,
 * how wide and how clear it is there, how steeply it climbs, what one step is,
 * which further spaces it stops at, and where its car stands — so that later
 * work has something exact to read instead of re-deriving it from whatever
 * happened to be modelled.
 *
 * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `IAutoMovieBuiltConnector` as the portable data boundary for the building external multi building connection requirement.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `IAutoMovieBuiltConnector` for the building envelope multibuilding connector failures system contract.
 */
export interface IAutoMovieBuiltConnector {
  /**
   * Stable connector identity.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `id` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `id` for the building envelope multibuilding connector failures system contract.
   */
  id: string;
  /**
   * Computational traversal family.
   *
   * `escalator` and `moving-walk` are named because a powered run is not a
   * stair with a different label: it has a direction of drive and a running
   * state a stair does not have, and {@link operation} is where it states them.
   * Anything the set does not cover is `other` plus the visible elements, never
   * a mislabelled neighbour.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `kind` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `kind` for the building envelope multibuilding connector failures system contract.
   */
  kind:
    | "passage"
    | "stair"
    | "ramp"
    | "lift"
    | "escalator"
    | "moving-walk"
    | "ladder"
    | "bridge"
    | "other";
  /**
   * Logical space at the start of the route.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `from` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `from` for the building envelope multibuilding connector failures system contract.
   */
  from: string;
  /**
   * Logical space at the end of the route.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `to` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `to` for the building envelope multibuilding connector failures system contract.
   */
  to: string;
  /**
   * Whether traversal is permitted in both directions.
   *
   * It also orders what the run reaches: a one-way run carries somebody only to
   * the stops ahead of where they boarded, and it may not declare a state
   * driven against its own direction.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `bidirectional` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `bidirectional` for the building envelope multibuilding connector failures system contract.
   */
  bidirectional: boolean;
  /**
   * Further spaces this one run serves between its two endpoints.
   *
   * A lift passing five floors is one shaft, not five relations, and a stair
   * with a half-landing stops somewhere its two ends do not name. Stating those
   * stops here is what keeps them in the graph: an adjacency or connector query
   * answers with them, so the floors a run reaches cannot quietly become floors
   * only its geometry knows about.
   *
   * Omitting the field leaves the run the two-ended relation it has always
   * been. Landings are ordered by strictly increasing
   * {@link IAutoMovieConnectorLanding.at}, and neither endpoint is restated as
   * one, because a stop stated twice is two stops that can disagree.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `landings` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `landings` for the building envelope multibuilding connector failures system contract.
   */
  landings?: IAutoMovieConnectorLanding[];
  /**
   * World-space center route, including both endpoints.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `route` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `route` for the building envelope multibuilding connector failures system contract.
   */
  route: IAutoMovieVector3[];
  /**
   * Per-station facing, one unit quaternion per {@link route} point.
   *
   * Omitting it leaves the route the bare position polyline it has always been.
   * Stating it is what makes a spiral stair expressible at all: its centre
   * route is nearly a vertical line, so consecutive treads differ only by the
   * turn between them, and a position sequence cannot tell them apart. The
   * facing is a full quaternion rather than a heading because a tread is also
   * pitched and a helical ramp is also banked.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `orientations` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `orientations` for the building envelope multibuilding connector failures system contract.
   */
  orientations?: IAutoMovieQuaternion[];
  /**
   * Constant usable width in metres.
   *
   * State the constant pair ({@link width} and {@link clearHeight}) or the
   * varying {@link sections}, never both and never neither. This mirrors how
   * {@link IAutoMovieSurface} refuses a height rule stated twice: two spellings
   * of one fact are two facts that can disagree.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `width` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `width` for the building envelope multibuilding connector failures system contract.
   */
  width?: number;
  /**
   * Constant vertical clearance in metres; see {@link width} for the rule.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `clearHeight` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `clearHeight` for the building envelope multibuilding connector failures system contract.
   */
  clearHeight?: number;
  /**
   * Usable section sampled along the route, for a passage that changes shape.
   *
   * At least two entries ordered by strictly increasing
   * {@link IAutoMovieConnectorSection.at}, the first at `0` and the last at `1`,
   * so every point of the route has a section on both sides of it.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `sections` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `sections` for the building envelope multibuilding connector failures system contract.
   */
  sections?: IAutoMovieConnectorSection[];
  /**
   * Slope of the travelled surface in radians, measured from horizontal.
   *
   * It is the climb taken against the horizontal length **of the route**, not
   * of the straight line between its endpoints, so a switchback's stated slope
   * is the gradient actually walked rather than a chord that never existed.
   *
   * The route already implies it, so stating it is a claim the engine checks
   * rather than a second source of truth: a declared slope that disagrees with
   * the route is refused instead of quietly winning.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `slope` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `slope` for the building envelope multibuilding connector failures system contract.
   */
  slope?: number;
  /**
   * The repeated step of a stepped run, or nothing for a smooth one.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `steps` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `steps` for the building envelope multibuilding connector failures system contract.
   */
  steps?: IAutoMovieConnectorSteps;
  /**
   * Travelling cars and the named states they stand in, or nothing for a run
   * that never moves.
   *
   * A stair is the whole of itself at all times; a lift, escalator, moving
   * walk, or turning gate is not. Omitting the field keeps the static record a
   * stair, ramp, bridge, or ladder has always been, so an environment written
   * before this field lowers and validates byte-for-byte as it did.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `operation` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `operation` for the building envelope multibuilding connector failures system contract.
   */
  operation?: IAutoMovieConnectorOperation;
  /**
   * Visible elements realizing the connector, such as steps or a lift car.
   *
   * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection Exposes `elements` as the portable data boundary for the building external multi building connection requirement.
   * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures Types `elements` for the building envelope multibuilding connector failures system contract.
   */
  elements: string[];
}

/**
 * One further space a run serves at a point along its own route.
 *
 * Where the stop is on the route is stated; whether that point falls inside the
 * space it serves is not checked, because a run may legitimately serve a space
 * it only reaches the edge of — a facade ladder leaves a storey from outside
 * the storey's own volume. Where a **carriage** stands is checked, because a
 * carriage is a body with a place rather than a station on a centreline.
 *
 * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `IAutoMovieConnectorLanding` as the portable data boundary for the interior route refusal requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `IAutoMovieConnectorLanding` for the interior space connector route topology system contract.
 */
export interface IAutoMovieConnectorLanding {
  /**
   * Logical space served here; neither of the run's own endpoints.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `space` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `space` for the interior space connector route topology system contract.
   */
  space: string;
  /**
   * Arc-length fraction of the 3D route polyline where the run serves it,
   * strictly between `0` (the {@link IAutoMovieBuiltConnector.from} end) and `1`
   * (the {@link IAutoMovieBuiltConnector.to} end).
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `at` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `at` for the interior space connector route topology system contract.
   */
  at: number;
}

/**
 * The moving part of a lift, escalator, moving walk, or turning gate.
 *
 * This is the connector's counterpart to {@link IAutoMovieOpeningOperation}, and
 * deliberately the same shape: a member that travels on one degree of freedom,
 * named states that place every member at once, and the one state the design
 * currently stands in. What a run adds is where the travel leaves somebody —
 * the space a car stands at, and which way the run is driven — since that is
 * the part a stair answers by standing still and a lift cannot.
 *
 * What it does not carry is hardware, because a run's landing doors and their
 * frames, handles, and call plates are openings in their own right and already
 * carry theirs. Restating them here would put one door in two places.
 *
 * Nothing here judges traversal. Whether a person can board, how long they
 * wait, and how a building empties are separate work; this is the measurable
 * configuration such work would read.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency Exposes `IAutoMovieConnectorOperation` as the portable data boundary for the building opening interior consistency requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `IAutoMovieConnectorOperation` for the interior space host opening operation system contract.
 */
export interface IAutoMovieConnectorOperation {
  /**
   * Travelling cars, carriages, or step bands; at least one.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency Exposes `carriages` as the portable data boundary for the building opening interior consistency requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `carriages` for the interior space host opening operation system contract.
   */
  carriages: IAutoMovieConnectorCarriage[];
  /**
   * Named states; at least one, and each gives every carriage a value.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency Exposes `states` as the portable data boundary for the building opening interior consistency requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `states` for the interior space host opening operation system contract.
   */
  states: IAutoMovieConnectorState[];
  /**
   * The state the design currently stands in; names one of {@link states}.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency Exposes `state` as the portable data boundary for the building opening interior consistency requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation Types `state` for the interior space host opening operation system contract.
   */
  state: string;
}

/**
 * One member of a run that travels on a single degree of freedom.
 *
 * The carriage drives a visible element whose own local transform is its rest
 * pose, exactly as a door panel does, so a lift car is placed once and moved by
 * its states rather than being placed again per state. The element is one the
 * run already declares in {@link IAutoMovieBuiltConnector.elements}, or one
 * below it: a car that belongs to no run is a car nobody can point at.
 *
 * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `IAutoMovieConnectorCarriage` as the portable data boundary for the interior access state requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `IAutoMovieConnectorCarriage` for the interior space connector route topology system contract.
 */
export interface IAutoMovieConnectorCarriage {
  /**
   * Stable carriage identity within the connector.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `id` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `id` for the interior space connector route topology system contract.
   */
  id: string;
  /**
   * Visible element this carriage drives; its transform is the rest pose.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `element` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `element` for the interior space connector route topology system contract.
   */
  element: string;
  /**
   * The one degree of freedom this carriage travels on.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `motion` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `motion` for the interior space connector route topology system contract.
   */
  motion: IAutoMovieTravelMotion;
}

/**
 * One named operating state of a run and the travel it gives each carriage.
 *
 * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `IAutoMovieConnectorState` as the portable data boundary for the interior access state requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `IAutoMovieConnectorState` for the interior space connector route topology system contract.
 */
export interface IAutoMovieConnectorState {
  /**
   * Stable state name such as `level-3`, `ascending`, or a production term.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `id` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `id` for the interior space connector route topology system contract.
   */
  id: string;
  /**
   * One value per carriage; every carriage of the operation appears once.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `carriages` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `carriages` for the interior space connector route topology system contract.
   */
  carriages: IAutoMovieCarriageValue[];
  /**
   * Which way the run is driven while it stands in this state.
   *
   * `forward` runs from {@link IAutoMovieBuiltConnector.from} towards
   * {@link IAutoMovieBuiltConnector.to} and `reverse` the other way, so a
   * one-way run may not declare a state driven against its own direction.
   * `still` is a run that is not being driven at all, which is what a stopped
   * car and a switched-off escalator have in common.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-access-state Exposes `drive` as the portable data boundary for the interior access state requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `drive` for the interior space connector route topology system contract.
   */
  drive: "forward" | "reverse" | "still";
}

/**
 * The travel one named state gives one carriage.
 *
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `IAutoMovieCarriageValue` as the portable data boundary for the building opening operable state requirement.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `IAutoMovieCarriageValue` for the building envelope opening operable sweep invariant system contract.
 */
export interface IAutoMovieCarriageValue {
  /**
   * Carriage id inside the same operation.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `carriage` as the portable data boundary for the building opening operable state requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `carriage` for the building envelope opening operable sweep invariant system contract.
   */
  carriage: string;
  /**
   * Radians for a revolute carriage, metres for a prismatic one.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `value` as the portable data boundary for the building opening operable state requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `value` for the building envelope opening operable sweep invariant system contract.
   */
  value: number;
  /**
   * Logical space this carriage stands at under this state, or null.
   *
   * It names an endpoint of the run or one of its
   * {@link IAutoMovieBuiltConnector.landings}, and the element the carriage
   * drives must actually be inside that space once the state is applied. That
   * is what makes "the car is at level three" a fact the engine settles rather
   * than a label beside a number: a counterweight travelling the other way
   * simply serves nothing and says so.
   *
   * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state Exposes `serves` as the portable data boundary for the building opening operable state requirement.
   * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant Types `serves` for the building envelope opening operable sweep invariant system contract.
   */
  serves: string | null;
}

/**
 * The usable section of a connector at one point along its route.
 *
 * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `IAutoMovieConnectorSection` as the portable data boundary for the interior route refusal requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `IAutoMovieConnectorSection` for the interior space connector route topology system contract.
 */
export interface IAutoMovieConnectorSection {
  /**
   * Arc-length fraction of the 3D route polyline, `0` at the first point and
   * `1` at the last. Measuring along the route rather than by point index is
   * what keeps a station on an unevenly spaced route where it was put.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `at` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `at` for the interior space connector route topology system contract.
   */
  at: number;
  /**
   * Positive usable width in metres here.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `width` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `width` for the interior space connector route topology system contract.
   */
  width: number;
  /**
   * Positive vertical clearance in metres here.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `clearHeight` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `clearHeight` for the interior space connector route topology system contract.
   */
  clearHeight: number;
}

/**
 * The repeated step of a stepped connector.
 *
 * The three numbers are checked against the route they describe: the flight's
 * risers must add up to the route's own climb and its goings to the route's own
 * horizontal run, within a millimetre. A stair whose steps do not reach its own
 * landing is a design defect, not a rendering detail.
 *
 * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `IAutoMovieConnectorSteps` as the portable data boundary for the interior route refusal requirement.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `IAutoMovieConnectorSteps` for the interior space connector route topology system contract.
 */
export interface IAutoMovieConnectorSteps {
  /**
   * How many steps the run has; a safe integer of at least `1`.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `count` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `count` for the interior space connector route topology system contract.
   */
  count: number;
  /**
   * Positive vertical rise of one step, in metres.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `rise` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `rise` for the interior space connector route topology system contract.
   */
  rise: number;
  /**
   * Positive horizontal going of one step, in metres.
   *
   * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Exposes `run` as the portable data boundary for the interior route refusal requirement.
   * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology Types `run` for the interior space connector route topology system contract.
   */
  run: number;
}

/**
 * A support surface and the logical space in which it can be used.
 *
 * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `IAutoMovieBuiltSurface` as the portable data boundary for the interior surface substance product requirement.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `IAutoMovieBuiltSurface` for the interior space surface assembly region system contract.
 */
export interface IAutoMovieBuiltSurface {
  /**
   * Logical space containing the support patch.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `space` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `space` for the interior space surface assembly region system contract.
   */
  space: string;
  /**
   * Existing deterministic support/height representation.
   *
   * @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Exposes `surface` as the portable data boundary for the interior surface substance product requirement.
   * @evidence specifications/interior-space/surface-assemblies.md#interior-space-surface-assembly-region Types `surface` for the interior space surface assembly region system contract.
   */
  surface: IAutoMovieSurface;
}
