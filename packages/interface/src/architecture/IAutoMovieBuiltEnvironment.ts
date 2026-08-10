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
 * natural water remain production-world concerns. An indoor water feature
 * composes a separate engine fluid domain with a building space; fluid
 * simulation is not owned by this architecture record. Element kinds are open
 * strings: historical, vernacular, contemporary, and speculative architecture
 * all use the same transform and model primitives instead of being limited by a
 * catalogue of styles.
 *
 * This is an engine/interchange record produced by ordinary TypeScript. A
 * building class may use loops, parameters, and reusable parts, then lower the
 * resulting record to scene models, set pieces, and locomotion spaces.
 */
export interface IAutoMovieBuiltEnvironment {
  /** Schema version. */
  version: 1;
  /** Stable identity of this environment. */
  id: string;
  /** All authored dimensions are measured in metres. */
  units: "meter";
  /** Independently owned building units inside this work. */
  buildings: IAutoMovieBuildingUnit[];
  /** Models owned by the environment and cited by visible elements. */
  models: IAutoMovieModel[];
  /**
   * Compiler-owned runtime model ids cited by elements, including imported
   * external assets whose bytes cannot be created inside source code.
   */
  modelReferences: string[];
  /** Parent-local full-TRS hierarchy of visible and grouping elements. */
  elements: IAutoMovieBuiltElement[];
  /** Independently nested semantic partitions inside/on the building envelope. */
  spaces: IAutoMovieBuiltSpace[];
  /** Physical or logical separations between spaces. */
  boundaries: IAutoMovieBuiltBoundary[];
  /** Passages cut through boundaries. */
  openings: IAutoMovieBuiltOpening[];
  /** Traversable relations such as stairs, lifts, ramps, and skybridges. */
  connectors: IAutoMovieBuiltConnector[];
  /** Ground/support patches assigned to logical spaces. */
  surfaces: IAutoMovieBuiltSurface[];
  /** Surface ids on which locomotion is permitted. */
  walkable: string[];
}

/** One building unit and the roots of its visible and logical hierarchies. */
export interface IAutoMovieBuildingUnit {
  /** Stable building identity within the work. */
  id: string;
  /** Root visible element. It must have no element parent. */
  element: string;
  /** Root logical space. It must have no logical-space parent. */
  space: string;
}

/** One transformable member of the visible building hierarchy. */
export interface IAutoMovieBuiltElement {
  /** Stable element identity. */
  id: string;
  /**
   * Open semantic label such as `building`, `storey`, `wall`, `coffer`, `roof`,
   * or a production-specific term.
   */
  kind: string;
  /** Parent element id, or null for an environment root. */
  parent: string | null;
  /** Local transform in the parent element's frame. */
  transform: IAutoMovieTransform;
  /** Visible model id, or null for a transform-only group. */
  model: string | null;
  /** Primary logical space occupied by this element, or null. */
  space: string | null;
}

/** One named semantic region, independent of visible walls and slabs. */
export interface IAutoMovieBuiltSpace {
  /** Stable logical-space identity. */
  id: string;
  /**
   * Open semantic label such as `building`, `storey`, `room`, `attic`, `void`,
   * `roof-deck`, `facade-access`, or `bridge-deck`.
   */
  kind: string;
  /** Parent logical-space id, or null for a root partition. */
  parent: string | null;
  /**
   * World-space convex cells whose union locates the region. Empty cells make a
   * purely semantic container; non-convex regions are split into cells.
   */
  cells: IAutoMovieConvexSpaceCell[];
}

/** A bounded convex cell represented by intersecting half-spaces. */
export interface IAutoMovieConvexSpaceCell {
  /** Stable cell identity within the environment. */
  id: string;
  /** Planes whose inside test is `dot(normal, point) <= offset`. */
  planes: IAutoMovieHalfSpacePlane[];
}

/** One world-space half-space plane used by a logical volume. */
export interface IAutoMovieHalfSpacePlane {
  /** Non-zero plane normal; it need not be normalized. */
  normal: IAutoMovieVector3;
  /** Finite plane offset in the same scale as the normal. */
  offset: number;
}

/** A separation shared by one interior/exterior region or a pair of regions. */
export interface IAutoMovieBuiltBoundary {
  /** Stable boundary identity. */
  id: string;
  /** Open semantic label such as `wall`, `floor`, `ceiling`, or `threshold`. */
  kind: string;
  /** One enclosing space, or the two spaces this boundary separates. */
  spaces: string[];
  /** Visible elements realizing the boundary; empty for a logical boundary. */
  elements: string[];
}

/** One traversable or visible opening through a boundary. */
export interface IAutoMovieBuiltOpening {
  /** Stable opening identity. */
  id: string;
  /** Open semantic label such as `door`, `window`, `arch`, or `passage`. */
  kind: string;
  /** Boundary containing this opening. */
  boundary: string;
  /** Door, sash, gate, or other filling element; null for an open cut. */
  fill: string | null;
}

/** A navigable relation between two logical spaces. */
export interface IAutoMovieBuiltConnector {
  /** Stable connector identity. */
  id: string;
  /** Computational traversal family. */
  kind: "passage" | "stair" | "ramp" | "lift" | "ladder" | "bridge" | "other";
  /** Logical space at one end. */
  from: string;
  /** Logical space at the other end. */
  to: string;
  /** Whether traversal is permitted in both directions. */
  bidirectional: boolean;
  /** World-space center route, including both endpoints. */
  route: IAutoMovieVector3[];
  /** Positive usable width in metres. */
  width: number;
  /** Positive vertical clearance in metres. */
  clearHeight: number;
  /** Visible elements realizing the connector, such as steps or a lift car. */
  elements: string[];
}

/** A support surface and the logical space in which it can be used. */
export interface IAutoMovieBuiltSurface {
  /** Logical space containing the support patch. */
  space: string;
  /** Existing deterministic support/height representation. */
  surface: IAutoMovieSurface;
}
