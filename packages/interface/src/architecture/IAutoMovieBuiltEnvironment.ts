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
 */
export interface IAutoMovieBuiltEnvironment {
  /** Schema version. */
  version: 1;
  /** Stable identity of this environment. */
  id: string;
  /** All authored dimensions are measured in metres. */
  units: "meter";
  /**
   * Independently owned and independently placed building units in this work.
   *
   * Ownership is total: every element and every logical space descends from
   * exactly one unit's roots, so nothing in the work is unattributed. A
   * skybridge is a work-owned relation between two units rather than a third
   * unit, so its connector may cross units even though its roots may not.
   */
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

/**
 * One building unit and the roots of its visible and logical hierarchies.
 *
 * The element root is also the unit's coordinate root, so one unit is moved,
 * turned, or tilted as a whole by its own root transform without touching the
 * others.
 */
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
  /**
   * Where the separation actually is, when it is somewhere at all.
   *
   * A boundary without a face stays the purely relational record it has always
   * been, so an environment written before this field keeps validating
   * unchanged. Stating a face is what lets an opening be placed on the
   * separation and checked against it, because there is finally a surface for
   * "on the wall" and "off the wall" to mean something.
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
 */
export interface IAutoMovieBoundaryFace {
  /** World-space origin of the boundary's own frame. */
  origin: IAutoMovieVector3;
  /** Unit quaternion taking the boundary's local axes into world space. */
  rotation: IAutoMovieQuaternion;
  /**
   * Closed face outline in boundary-local XY metres, at least three points.
   *
   * The outline is a simple polygon: it may be concave, but it may not cross
   * itself, because a self-crossing outline has no inside for an opening to be
   * checked against.
   */
  outline: IAutoMoviePlanarPoint[];
  /** Positive separation thickness along the boundary's local `+Z`, in metres. */
  thickness: number;
}

/** One point in a boundary's own local XY plane, measured in metres. */
export interface IAutoMoviePlanarPoint {
  /** Coordinate along the host frame's local X axis. */
  x: number;
  /** Coordinate along the host frame's local Y axis. */
  y: number;
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
  /**
   * The void this opening actually cuts in its host boundary's face.
   *
   * Omitting it keeps the pre-geometry record: the opening is a declared
   * relation and nothing is checked about where it is. Stating it demands the
   * host carry a {@link IAutoMovieBuiltBoundary.face}, and the void is then held
   * inside that face and apart from every other void on it.
   */
  profile?: IAutoMovieOpeningProfile;
  /**
   * Movable panels and the named states they stand in, or nothing for a fixed
   * cut such as an arch or a permanently open passage.
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
 */
export interface IAutoMovieOpeningProfile {
  /** Closed outline in host-boundary-local XY metres, at least three points. */
  outline: IAutoMoviePlanarPoint[];
  /**
   * Per-edge circular bulge, one entry per edge when stated at all.
   *
   * The value is AutoCAD's polyline convention `tan(theta / 4)` for the arc's
   * included angle `theta`, so `0` is a straight edge and `1` is a half turn
   * bulging to the left of the edge's own direction. The magnitude may not
   * exceed `1`: an arc longer than a half turn is authored as two edges, which
   * is what keeps each arc's extent exactly boundable rather than sampled.
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
 */
export interface IAutoMovieOpeningOperation {
  /** Travelling leaves, sashes, or slats; at least one. */
  panels: IAutoMovieMovablePanel[];
  /** Named states; at least one, and each gives every panel a value. */
  states: IAutoMovieOperationState[];
  /** The state the design currently stands in; names one of {@link states}. */
  state: string;
  /** Fixed members the opening carries, such as a frame, hinge, or handle. */
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
 */
export interface IAutoMovieMovablePanel {
  /** Stable panel identity within the opening. */
  id: string;
  /**
   * Visible element this panel drives; its local transform is the rest pose.
   *
   * It is the opening's own {@link IAutoMovieBuiltOpening.fill} or an element
   * below it, so a panel can only move part of the thing that fills the hole.
   */
  element: string;
  /** Positive leaf extent along the element's local X, in metres. */
  width: number;
  /** Positive leaf extent along the element's local Y, in metres. */
  height: number;
  /** The one degree of freedom this panel travels on. */
  motion: IAutoMoviePanelMotion;
}

/** The single degree of freedom a movable panel travels on. */
export type IAutoMoviePanelMotion =
  | IAutoMoviePanelMotion.IRevolute
  | IAutoMoviePanelMotion.IPrismatic;
export namespace IAutoMoviePanelMotion {
  /** A hinge: the leaf turns about an axis through a pivot. */
  export interface IRevolute {
    /** Discriminator. */
    kind: "revolute";
    /** Non-zero turn axis in the panel element's own local frame. */
    axis: IAutoMovieVector3;
    /** A point on that axis in the same local frame. */
    pivot: IAutoMovieVector3;
    /** Lowest travel in radians; at most `0`, because rest is `0`. */
    min: number;
    /** Highest travel in radians; at least `0`, and within a turn of `min`. */
    max: number;
  }

  /** A slide: the leaf travels along an axis without turning. */
  export interface IPrismatic {
    /** Discriminator. */
    kind: "prismatic";
    /** Non-zero travel axis in the panel element's own local frame. */
    axis: IAutoMovieVector3;
    /** Lowest travel in metres along the unit axis; at most `0`. */
    min: number;
    /** Highest travel in metres along the unit axis; at least `0`. */
    max: number;
  }
}

/** One named operating state and the travel it gives each panel. */
export interface IAutoMovieOperationState {
  /** Stable state name such as `closed`, `open`, or a production term. */
  id: string;
  /** One value per panel; every panel of the operation must appear exactly once. */
  panels: IAutoMoviePanelValue[];
}

/** The travel one named state gives one panel. */
export interface IAutoMoviePanelValue {
  /** Panel id inside the same operation. */
  panel: string;
  /** Radians for a revolute panel, metres for a prismatic one. */
  value: number;
}

/** One fixed, non-travelling member an opening carries. */
export interface IAutoMovieOpeningHardware {
  /** Stable hardware identity within the opening. */
  id: string;
  /** Open semantic label such as `frame`, `hinge`, `handle`, or `track`. */
  kind: string;
  /** Visible element realizing it, or null when it is only declared. */
  element: string | null;
}

/**
 * A navigable relation between two logical spaces, and the shape it has.
 *
 * The record is deliberately the traversal geometry a later analysis reads, not
 * a verdict about that analysis: whether a person can actually pass, how they
 * would route, and how a building evacuates are separate work. What lives here
 * is the measurable shape — where the route runs, which way each station faces,
 * how wide and how clear it is there, how steeply it climbs, and what one step
 * is — so that later work has something exact to read instead of re-deriving it
 * from whatever happened to be modelled.
 */
export interface IAutoMovieBuiltConnector {
  /** Stable connector identity. */
  id: string;
  /**
   * Computational traversal family.
   *
   * `escalator` and `moving-walk` are named because a powered run is not a
   * stair with a different label: it has a direction of drive and a running
   * state a stair does not have. Anything the set does not cover is `other`
   * plus the visible elements, never a mislabelled neighbour.
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
  /** Logical space at one end. */
  from: string;
  /** Logical space at the other end. */
  to: string;
  /** Whether traversal is permitted in both directions. */
  bidirectional: boolean;
  /** World-space center route, including both endpoints. */
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
   */
  orientations?: IAutoMovieQuaternion[];
  /**
   * Constant usable width in metres.
   *
   * State the constant pair ({@link width} and {@link clearHeight}) or the
   * varying {@link sections}, never both and never neither. This mirrors how
   * {@link IAutoMovieSurface} refuses a height rule stated twice: two spellings
   * of one fact are two facts that can disagree.
   */
  width?: number;
  /** Constant vertical clearance in metres; see {@link width} for the rule. */
  clearHeight?: number;
  /**
   * Usable section sampled along the route, for a passage that changes shape.
   *
   * At least two entries ordered by strictly increasing
   * {@link IAutoMovieConnectorSection.at}, the first at `0` and the last at `1`,
   * so every point of the route has a section on both sides of it.
   */
  sections?: IAutoMovieConnectorSection[];
  /**
   * Slope of the travelled surface in radians, measured from horizontal.
   *
   * The route already implies it, so stating it is a claim the engine checks
   * rather than a second source of truth: a declared slope that disagrees with
   * the route is refused instead of quietly winning.
   */
  slope?: number;
  /** The repeated step of a stepped run, or nothing for a smooth one. */
  steps?: IAutoMovieConnectorSteps;
  /** Visible elements realizing the connector, such as steps or a lift car. */
  elements: string[];
}

/** The usable section of a connector at one point along its route. */
export interface IAutoMovieConnectorSection {
  /**
   * Arc-length fraction of the 3D route polyline, `0` at the first point and
   * `1` at the last. Measuring along the route rather than by point index is
   * what keeps a station on an unevenly spaced route where it was put.
   */
  at: number;
  /** Positive usable width in metres here. */
  width: number;
  /** Positive vertical clearance in metres here. */
  clearHeight: number;
}

/**
 * The repeated step of a stepped connector.
 *
 * The three numbers are checked against the route they describe: the flight's
 * risers must add up to the route's own climb and its goings to the route's own
 * horizontal run, within a millimetre. A stair whose steps do not reach its own
 * landing is a design defect, not a rendering detail.
 */
export interface IAutoMovieConnectorSteps {
  /** How many steps the run has; a safe integer of at least `1`. */
  count: number;
  /** Positive vertical rise of one step, in metres. */
  rise: number;
  /** Positive horizontal going of one step, in metres. */
  run: number;
}

/** A support surface and the logical space in which it can be used. */
export interface IAutoMovieBuiltSurface {
  /** Logical space containing the support patch. */
  space: string;
  /** Existing deterministic support/height representation. */
  surface: IAutoMovieSurface;
}
