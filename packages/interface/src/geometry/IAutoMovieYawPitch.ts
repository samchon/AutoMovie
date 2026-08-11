/**
 * A look direction as **yaw** and **pitch** in degrees: the two angles a head,
 * eye, or camera turns through to face a target, relative to its own forward
 * (yaw = turn off straight-ahead, +90 = its left; pitch = tilt up (+) / down
 * (−)). A rig maps these onto its joints (a neck's twist + flexion, a camera's
 * pan + tilt).
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `IAutoMovieYawPitch` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `IAutoMovieYawPitch` within the declared spatial transform chain.
 * @author Samchon
 */
export interface IAutoMovieYawPitch {
  /**
   * Turn off straight-ahead (degrees): 0 = dead ahead, +90 = the actor's left.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `yawDeg` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `yawDeg` within the declared spatial transform chain.
   */
  yawDeg: number;

  /**
   * Tilt (degrees): positive looks up, negative looks down.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `pitchDeg` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `pitchDeg` within the declared spatial transform chain.
   */
  pitchDeg: number;
}
