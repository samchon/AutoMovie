import { IAutoMovieNamedId } from "../core/IAutoMovieNamedId";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieMountBinding } from "./IAutoMovieMountBinding";
import { IAutoMovieNodeTarget } from "./IAutoMovieNodeTarget";
import { IAutoMoviePointTarget } from "./IAutoMoviePointTarget";

/**
 * Stage 2 — **STAGING** (set up). Realise the script's cast as placed scene
 * nodes, rig the cameras and lights, and declare any persistent couplings —
 * i.e. build the `IAutoMovieScene` the shots render. The model chooses _what to
 * place and where_; the host instantiates the actual models (a generated rig,
 * or an imported VRM named by the cast's `modelRef`).
 *
 * Geometry is the whole job here: a duel needs the two at **striking range**
 * facing each other; a chase needs a **gap** with both facing the run; a wave
 * needs the actor facing the camera. Get the distances right now and the later
 * action reads; get them wrong and strikes mime at air (the classic failure).
 *
 * @author Samchon
 */
export interface IAutoMovieStagingApplication {
  process(props: IAutoMovieStagingApplication.IProps): void;
}
export namespace IAutoMovieStagingApplication {
  export interface IProps {
    /**
     * Think before you act. Lay out the ground: where does each character start
     * so every beat reads — measured from the rigs' reach/stride, not guessed
     * (two boxers ~0.7 m apart so a jab lands; a pursuer a few metres behind
     * the fleer). Who rides/holds what (a persistent coupling)? What must each
     * camera see? State the geometry and your reasoning before the placements.
     */
    thinking: string;

    request: IWrite;
  }

  export interface IWrite {
    type: "write";

    /** Stable id + name for the scene the shots will reference. */
    scene: IAutoMovieNamedId;

    /**
     * A compact plan: the ground layout, who stands where facing where (with
     * the distances), the persistent couplings, and how the cameras cover it —
     * written before the placements so they can be checked against it.
     */
    plan: string;

    /** Where each cast node starts (reuse the cast `node` ids from the script). */
    actors: IPlacement[];

    /**
     * Set pieces — the environment realised as static scene geometry (#1173). A
     * floor slab, a wall, a doorway, a backdrop: each placement drops a
     * skeleton-less model (typically a forged prop, `forgeProp`'s crude
     * primitive proxy) into the scene, so the guide passes describe a world
     * instead of actors floating in a void. Omit for a bare stage. A set piece
     * is scenery, not a performer: pair a walkable floor with the scene's
     * `space` surfaces — the surface is the meaning, this model is the visual.
     */
    set?: ISetPlacement[];

    /**
     * Camera placements; each becomes a camera node, its move authored in
     * performance.
     */
    cameras: ICameraPlacement[];

    /** Scene lights. */
    lights: ILightPlacement[];
  }

  export interface IPlacement {
    /** Cast node id. */
    node: string;

    /** Start position (world meters). */
    position: IAutoMovieVector3;

    /** Heading in degrees about +Y (0 = facing +Z). */
    facingDeg: number;

    /**
     * A persistent coupling fixed for the whole film — a rider on a mount, a
     * passenger in a cart. The node rides `parent`'s `bone` (e.g. a horse's
     * `spine` saddle). Declare it here rather than re-attaching every shot.
     */
    attach?: IAutoMovieMountBinding;
  }

  /**
   * One placed set piece — environment geometry as a static scene node (#1173).
   * The realising model is skeleton-less (a forged prop's primitive parts); the
   * node never performs, it only stands where the world needs structure.
   */
  export interface ISetPlacement {
    /**
     * Scene node id for this piece — distinct from every cast, camera, and
     * light id (and from sibling pieces).
     */
    node: string;

    /**
     * Model id realising the piece — a forged prop's node id (the `forgeProp`
     * join key), or a static model the host knows how to instantiate.
     */
    model: string;

    /** Position (world meters). */
    position: IAutoMovieVector3;

    /**
     * Yaw about +Y in degrees (0 = facing +Z). Omit for an unrotated piece — a
     * floor slab or a centered backdrop needs no heading.
     */
    facingDeg?: number;
  }

  export interface ICameraPlacement {
    /** Camera node id (reused by camera actions in performance). */
    node: string;

    position: IAutoMovieVector3;

    /** What the camera initially looks at. */
    lookAt: IAutoMovieNodeTarget | IAutoMoviePointTarget;

    /** Vertical field of view (degrees). */
    fovDeg: number;
  }

  export interface ILightPlacement {
    /** Light node id. */
    node: string;

    /** The role this light plays. */
    role: "key" | "fill" | "rim" | "ambient" | "sun";

    /** Direction the light points (world; for sun/key/rim). */
    direction: IAutoMovieVector3;

    /** Relative brightness `[0, ~2]`. */
    intensity: number;
  }
}
