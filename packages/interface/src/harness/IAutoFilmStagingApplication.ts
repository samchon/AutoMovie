import { IAutoFilmVector3 } from "../geometry/IAutoFilmVector3";

/**
 * Stage 2 — **STAGING** (set up). Realise the script's cast as placed scene
 * nodes, build the set, and rig the cameras and lights. Output feeds the
 * blocking stage as a concrete world to act in.
 *
 * The model chooses _what to place and where_; the engine/host instantiates the
 * actual models (a generated stick rig, or an imported VRM referenced by the
 * cast). Camera nodes are ordinary scene nodes, so a camera is just a placement
 * here and gets its move in performance.
 *
 * @author Samchon
 */
export interface IAutoFilmStagingApplication {
  process(props: IAutoFilmStagingApplication.IProps): void;
}
export namespace IAutoFilmStagingApplication {
  export interface IProps {
    /**
     * Think before you act. Where does each character start so the beats read
     * (a chase needs a gap; a duel needs facing pairs at striking range)? What
     * does the camera need to see? Note the geometry you are setting up.
     */
    thinking: string;
    request: IWrite;
  }

  export interface IWrite {
    type: "write";
    /**
     * A compact plan: the ground layout, who stands where and facing where, and
     * how the camera covers it. Written before the placements so the placements
     * can be checked against it.
     */
    plan: string;
    /** Where each cast node starts (id from the script's cast). */
    actors: IPlacement[];
    /** Camera placements (each becomes a camera node; its move comes later). */
    cameras: ICameraPlacement[];
  }

  export interface IPlacement {
    /** Cast node id. */
    node: string;
    /** Start position (world meters). */
    position: IAutoFilmVector3;
    /** Heading in degrees about +Y (0 = facing +Z). */
    facingDeg: number;
  }

  export interface ICameraPlacement {
    /** Camera node id. */
    node: string;
    position: IAutoFilmVector3;
    /** What the camera initially looks at (a node id or a point). */
    lookAt:
      | { kind: "node"; node: string }
      | { kind: "point"; point: IAutoFilmVector3 };
    /** Vertical field of view (degrees). */
    fovDeg: number;
  }
}
