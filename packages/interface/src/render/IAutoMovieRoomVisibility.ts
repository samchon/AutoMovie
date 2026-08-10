/**
 * A conservative cell-and-portal culling hint over a building's logical space
 * graph.
 *
 * The rule this obeys, in one sentence: a space is hidden only when it is
 * PROVED unreachable from the camera through every opening, connector and
 * exterior route the design declares. Everything else stays drawn. Aggressive
 * culling trades a wrong frame for a faster one, and a wrong frame is not a
 * cheaper frame, it is a different film; so an exterior camera hides nothing,
 * an ambiguous camera position hides nothing, and a space whose extent the
 * design never stated hides nothing.
 *
 * The exterior is a node of the portal graph, not the absence of one. A room
 * with a window is reachable from outside, so from a sealed interior room the
 * other windowed rooms are still hidden, while from a windowed room they are
 * kept: light and geometry can travel out one opening and in another, and the
 * graph says so instead of the culler guessing.
 *
 * @author Samchon
 */
export interface IAutoMovieRoomVisibility {
  /** Hint format. */
  version: 1;

  /**
   * Logical space containing the camera, or `null` when it is outside every
   * declared space or inside more than one.
   */
  camera: string | null;

  /**
   * Why the camera resolved that way: `interior` when exactly one space
   * contains it, `exterior` when none does, `ambiguous` when several do.
   */
  cameraPlacement: "interior" | "exterior" | "ambiguous";

  /**
   * Space ids proved unreachable from the camera, ascending.
   *
   * Empty whenever the proof is incomplete, which is every case except an
   * unambiguous interior camera in a design whose spaces all declare cells.
   */
  hidden: string[];

  /** Space ids that must be drawn, ascending. Always the complement of `hidden`. */
  visible: string[];

  /**
   * Why nothing could be hidden, or `null` when the proof was complete.
   *
   * A hint that hides nothing and says nothing is indistinguishable from a hint
   * that proved everything visible, and those are different facts.
   */
  inconclusive: string | null;
}
