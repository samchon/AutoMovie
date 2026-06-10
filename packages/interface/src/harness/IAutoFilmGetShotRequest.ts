/**
 * Query tool: pull an already-built sibling shot, to match its ending
 * pose/position/energy.
 *
 * @author Samchon
 */
export interface IAutoFilmGetShotRequest {
  type: "getShot";

  /** Beat id of the sibling shot to pull. */
  beat: string;
}
