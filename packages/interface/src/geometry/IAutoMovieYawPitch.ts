/**
 * A look direction as **yaw** and **pitch** in degrees ??the two angles a head,
 * eye, or camera turns through to face a target, relative to its own forward
 * (yaw = turn off straight-ahead, +90 = its left; pitch = tilt up (+) / down
 * (??). A rig maps these onto its joints (a neck's twist + flexion, a camera's
 * pan + tilt).
 *
 * @author Samchon
 */
export interface IautomovieYawPitch {
  /** Turn off straight-ahead (degrees): 0 = dead ahead, +90 = the actor's left. */
  yawDeg: number;

  /** Tilt (degrees): positive looks up, negative looks down. */
  pitchDeg: number;
}
