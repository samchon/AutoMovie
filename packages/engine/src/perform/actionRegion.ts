import {
  AutoMovieBodyRegion,
  AutoMovieGestureKind,
  IAutoMovieActionCall,
} from "@automovie/interface";

/**
 * The body region a verb drives by default, when an action sets none.
 *
 * `locomote` stays `lowerBody` deliberately, and that is what lets a walk layer
 * under a wave: the gait's arm rows yield to whatever `upperBody` action shares
 * the actor, which `test_perform_layer` pins as the designed behavior. The
 * shipped gaits counter-swing the arms, so a plain walk does lose that swing to
 * the mask; the loss is reported rather than refused (#1359), because a masked
 * gait is a quality note about a structurally valid shot, not a contradiction.
 */
const REGION_BY_VERB: Partial<
  Record<IAutoMovieActionCall["verb"], AutoMovieBodyRegion>
> = {
  locomote: "lowerBody",
  gesture: "upperBody",
  reach: "upperBody",
  lookAt: "head",
  emote: "face",
};

/**
 * Per-kind gesture defaults, matching what {@link gestureMotion} actually
 * authors: `nod`/`shake` drive only head joints, and the whole-body kinds
 * (trunk+legs, or the jump's ballistic root) span regions, so the generic
 * `upperBody` verb default would silently strip their content in
 * `maskMotionToRegion`. Kinds absent here (the arm gestures: wave, celebrate,
 * throw, point, strike, whose spine/arm joints all live in `upperBody`) fall
 * through to the verb default.
 */
const REGION_BY_GESTURE: Partial<
  Record<AutoMovieGestureKind, AutoMovieBodyRegion>
> = {
  nod: "head",
  shake: "head",
  bow: "fullBody",
  crouch: "fullBody",
  kick: "fullBody",
  stagger: "fullBody",
  jump: "fullBody",
  draw: "fullBody",
};

/** Which region an action owns: its explicit `region`, else the verb default. */
export const actionRegion = (
  action: IAutoMovieActionCall,
): AutoMovieBodyRegion =>
  action.region ??
  (action.verb === "gesture" ? REGION_BY_GESTURE[action.kind] : undefined) ??
  REGION_BY_VERB[action.verb] ??
  "fullBody";
