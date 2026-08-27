import type { IAutoMovieRestFrame } from "@automovie/engine";
import type {
  AutoMovieEasing,
  AutoMovieHumanoidBone,
  IAutoMovieAimDriver,
  IAutoMovieBeatEndState,
  IAutoMovieChannelLimit,
  IAutoMovieCopyDriver,
  IAutoMovieDrivenDriver,
  IAutoMovieDriver,
  IAutoMovieExpression,
  IAutoMovieGait,
  IAutoMovieGaitCycle,
  IAutoMovieGaitRootBob,
  IAutoMovieIKDriver,
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMovieParentDriver,
  IAutoMoviePose,
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
  IAutoMovieProfileControl,
  IAutoMoviePropSpec,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieSpringDriver,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Records the v1 legacy project store reads and writes.
 *
 * These were part of a protocol payload module that no longer exists. Only the
 * legacy import path reads them, so they live beside it rather than in a
 * package-wide surface nothing else consumes.
 */

/**
 * The committed slices a READ tool needs: everything but the assembled film.
 *
 * `film` is declared here as optional rather than omitted, because every
 * producer of a slate emits the writable form and the documented loop is
 * commit-then-read: `commitScene`'s echoed slate goes straight back into
 * `getScene`. Tool inputs are validated with `validateEquals` (#1340), so a
 * property the parameter does not declare is refused, and leaving `film`
 * undeclared would have broken that round trip at the boundary. Declaring it
 * optional accepts both forms and states the truth: a read of the script, the
 * scene, a shot, the notes, or a beat end does not consult the film.
 */
export interface IAutoMovieLegacyStoredSlate {
  /**
   * Committed script, or null before SCRIPT exists.
   */
  script: IAutoMovieScript | null;

  /**
   * Committed staged scenes, keyed by their own `id`, empty before STAGING.
   *
   * Plural because a film is not one location. The script tree already authors
   * several `scene` nodes with their own INT/EXT and location, and every shot
   * already names the scene it renders through {@link IAutoMovieShot.scene},
   * which `validateShotArtifact` enforces. The slate held one scene, so the
   * production layer collapsed a screenplay to a single set (#1171).
   */
  scenes: IAutoMovieScene[];

  /**
   * Shots built so far.
   */
  shots: IAutoMovieShot[];

  /**
   * Resolved end-state snapshots for built beats.
   */
  beatEnds: IAutoMovieBeatEndState[];

  /**
   * Open review notes.
   */
  notes: IAutoMovieReviewNote[];

  /**
   * Assembled film, or null before CUT has committed. Carried so a slate
   * returned by any tool can be passed straight back to a read tool; the reads
   * themselves never consult it.
   */
  film?: IAutoMovieSequence | null;
}

/**
 * Writable slate the v1 store committed.
 */
export interface IAutoMovieLegacyWritableSlate extends IAutoMovieLegacyStoredSlate {
  /**
   * Assembled film, or null before CUT has committed.
   */
  film: IAutoMovieSequence | null;
}

/**
 * Actor context the v1 store performed against.
 *
 * This is the JSON-safe subset of the engine's actor context. Gait cubic-bezier
 * tuple fields are intentionally omitted; use named easing curves for
 * Gait limbs as the v1 record carried them.
 */
export interface IAutoMovieLegacyActorContext {
  /**
   * Skeleton id every synthesized clip targets.
   */
  skeleton: string;

  /**
   * Gaits this actor can perform, without tuple-valued bezier controls.
   */
  gaits: IAutoMovieLegacyGait[];

  /**
   * Where the actor stands at the start of the shot (world meters). A RESIDENT
   * `perform` may omit it (#1176): the previous beat's committed end-state
   * seeds it, so a walking character resumes exactly where it stopped. An
   * explicit call (or a beat with no committed predecessor) must pass it.
   */
  position?: IAutoMovieVector3;

  /**
   * Locomotion speed (m/s): how fast a `locomote` carries the actor.
   */
  speed: number;

  /**
   * Heading the actor faces, degrees about +Y (0 = +Z). Omittable in a RESIDENT
   * `perform` exactly like `position` (#1176), seeded from the previous beat's
   * committed end-state facing.
   */
  facingDeg?: number;

  /**
   * Seconds into the looping gait cycle at the shot's start, a beat that opens
   * mid-stride resumes the walk at this phase instead of restarting it.
   * Omittable in a RESIDENT `perform` exactly like `position` (#1176): seeded
   * from the previous beat's committed end-state `gaitPhase` when it recorded
   * one. `null` (or omission with nothing recorded) starts the cycle at zero.
   */
  gaitPhase?: number | null;

  /**
   * Eye height above the actor's position (meters): where a `lookAt` aims from.
   */
  eyeHeight: number;

  /**
   * The pose the actor settles into for a `hold`.
   */
  restPose: IAutoMoviePose;

  /**
   * The actor's resolved skeleton geometry: the rig bones and their ROM
   * constraints. Required by the physics/IK verbs that measure or clamp against
   * the body (`react` folds a flinch bounded by each joint's ROM) and by
   * `enact`; one of those without a `rig` synthesises nothing. `lookAt` reads
   * it too, spreading a steep aim across the `neck` and `head` ranges you
   * declare instead of putting the whole angle on the head.
   */
  rig?: IAutoMovieSkeleton;

  /**
   * Per-bone rest frames that let the IK/arm verbs (`reach`/`point`/`strike`)
   * emit their arm angles in **clinical** space, lifted by `sign·r + neutral`
   * so a downstream renderer reads them up through the same frames (abduction
   * `180` raises either arm overhead regardless of side). Omission uses the
   * canonical humanoid clinical frame; supply `{}` only for raw rig-space
   * angles. A custom table must be paired with the same frames on the player.
   */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}

/**
 * A stored actor context as `actors/<node>.json` holds it (#1176): the
 * beat-invariant half of {@link IAutoMovieLegacyActorContext}, everything but
 * `position`/`facingDeg`/`gaitPhase`, which are per-beat openings the
 * continuity seed (or the caller) supplies. A resident `perform` with explicit
 * `actors` writes these through; later resident performs omit `actors` and read
 * them back.
 */
export interface IAutoMovieLegacyActorSpec extends Omit<
  IAutoMovieLegacyActorContext,
  "position" | "facingDeg" | "gaitPhase"
> {
  /**
   * The scene node / cast id this context belongs to (the storage key).
   */
  node: string;
}

/**
 * A prop spec as the `forgeProp` tool accepts it, a crude primitive proxy with
 * rich meaning: body, affordances, self-declared articulation.
 */
export interface IAutoMovieLegacyPropSpec {
  /**
   * The scene node this prop will occupy (the staging join key).
   */
  node: string;

  /**
   * The prop model: generated, skeleton-less, primitive parts.
   */
  model: IAutoMovieModel;

  /**
   * Self-declared moving parts, or `null` for a rigid prop.
   */
  articulation: IAutoMovieLegacyPropArticulation | null;
}

/**
 * What a resident project holds, which slate slices exist as files and which
 * binary assets the manifest tracks (#614: the project folder is the memory).
 */
export interface IAutoMovieLegacyProjectSummary {
  /**
   * Absolute project root directory.
   */
  root: string;

  /**
   * Whether `script.json` exists.
   */
  script: boolean;

  /**
   * Whether `scene.json` exists.
   */
  scene: boolean;

  /**
   * Committed shot ids (`shots/<beat>.json`).
   */
  shots: string[];

  /**
   * Committed beat-end beats (`beatEnds/<beat>.json`).
   */
  beatEnds: string[];

  /**
   * Open review note count.
   */
  notes: number;

  /**
   * Whether `film.json` exists.
   */
  film: boolean;

  /**
   * Stored forged prop nodes (`props/<node>.json`).
   */
  props: string[];

  /**
   * Stored actor context nodes (`actors/<node>.json`, #1176).
   */
  actors: string[];

  /**
   * Render outputs the committed truth no longer owns (#1130): top-level
   * `renders/` entries whose name matches neither the committed film's stem
   * family, nor any committed shot's, nor a registered asset. Re-committing
   * upstream clears the film while its rendered frames and videos linger; the
   * server NEVER deletes user-visible files, so detection is the server's and
   * the corrective action (delete the strays, or register them deliberately) is
   * the agent's. Empty when the directory matches the committed truth, and
   * always empty while no film is committed (a film mid-rework owns nothing
   * yet).
   */
  staleRenders: string[];

  /**
   * Tracked binary asset paths, project-relative, in registration order.
   */
  assets: string[];
}

/**
 * Records and conversion the v1 legacy project store reads and writes.
 *
 * These were part of a protocol payload module and a protocol converter that
 * no longer exist. Only the legacy import path reads them, so they live beside
 * it rather than in a package-wide surface nothing else consumes.
 */

/**
 * A prop profile driver as the v1 record wrote it, tuple-free.
 */
export type IAutoMovieLegacyPropDriver =
  | IAutoMovieCopyDriver
  | IAutoMovieAimDriver
  | IAutoMovieIKDriver
  | IAutoMovieParentDriver
  | IAutoMovieLegacyDrivenDriver
  | IAutoMovieSpringDriver;

/**
 * A prop's profile as the v1 record wrote it: the declared controls,
 * limits, and (tuple-free) drivers. Gaits are omitted, a prop does not locomote
 * (`IAutoMovieProfile.gaits` is for bodies); the humanoid gait path rides the
 * `perform` tool's actor contexts instead.
 */
export interface IAutoMovieLegacyPropProfile {
  /**
   * Stable profile id.
   */
  id: string;

  /**
   * Profile name (e.g. `"hinge"`).
   */
  name: string;

  /**
   * The named controls this profile exposes.
   */
  controls: IAutoMovieProfileControl[];

  /**
   * Drivers coupling the prop's joints, tuple-free.
   */
  drivers: IAutoMovieLegacyPropDriver[];

  /**
   * Value constraints over the prop's joints (the hinge's 0..110°).
   */
  limits: IAutoMovieChannelLimit[];
}

/**
 * A prop spec as the `forgeProp` tool accepts it, a crude primitive proxy with
 * rich meaning: body, affordances, self-declared articulation.
 */
export interface IAutoMovieLegacyPropSpec {
  /**
   * The scene node this prop will occupy (the staging join key).
   */
  node: string;

  /**
   * The prop model: generated, skeleton-less, primitive parts.
   */
  model: IAutoMovieModel;

  /**
   * Self-declared moving parts, or `null` for a rigid prop.
   */
  articulation: IAutoMovieLegacyPropArticulation | null;
}

/**
 * Convert one stored legacy prop spec into the engine's own shape.
 *
 * The stored form keeps ranges as objects because the payload it came from
 * could not express tuples, so the engine pair is rebuilt here rather than
 * stored twice.
 */
export const toEnginePropSpec = (
  spec: IAutoMovieLegacyPropSpec,
): IAutoMoviePropSpec => ({
  node: spec.node,
  model: spec.model,
  articulation:
    spec.articulation === null
      ? null
      : {
          nodes: spec.articulation.nodes,
          profile: toEnginePropProfile(spec.articulation.profile),
          binding: spec.articulation.binding,
        },
});

const toEnginePropProfile = (
  profile: IAutoMovieLegacyPropProfile,
): IAutoMovieProfile => ({
  id: profile.id,
  name: profile.name,
  controls: profile.controls,
  drivers: profile.drivers.map(toEnginePropDriver),
  limits: profile.limits,
});

const toEnginePropDriver = (
  driver: IAutoMovieLegacyPropDriver,
): IAutoMovieDriver => {
  if (driver.type !== "driven") return driver;
  // Strip the v1-form ranges and re-add engine tuples only when present, a
  // curve-driven driver omits both, so it must not carry a dead range (#724).
  const { inRange, outRange, ...rest } = driver;
  return {
    ...rest,
    ...(inRange !== undefined
      ? { inRange: [inRange.from, inRange.to] as [number, number] }
      : {}),
    ...(outRange !== undefined
      ? { outRange: [outRange.from, outRange.to] as [number, number] }
      : {}),
  };
};

/**
 * A driven driver whose tuple-valued `inRange`/`outRange` cross the v1
 * boundary as named {@link IAutoMovieLegacyRange} objects (the LLM JSON schema
 * cannot express tuples), converted to the engine's pairs in `convert.ts`.
 */
export interface IAutoMovieLegacyDrivenDriver extends Omit<
  IAutoMovieDrivenDriver,
  "inRange" | "outRange"
> {
  /**
   * Source value range mapped onto {@link outRange}. Omit when `curve` is set.
   */
  inRange?: IAutoMovieLegacyRange;

  /**
   * Output value range. Omit when `curve` is set.
   */
  outRange?: IAutoMovieLegacyRange;
}

/**
 * JSON-safe gait definition the v1 store performed against, mirroring
 * {@link IAutoMovieGait} minus the tuple-valued bezier controls its limbs cannot
 * express here.
 */
export interface IAutoMovieLegacyGait {
  /**
   * Stable name (`"walk"`, `"trot"`, `"gallop"`, `"stalk"`).
   */
  name: string;

  /**
   * Stride period (one full cycle) in seconds.
   */
  period: number;

  /**
   * Optional vertical root bob for the body mass during the cycle. When
   * present, the synthesiser emits a root transform whose `translation.y`
   * follows `center + amplitude * sin(2 * PI * (t / period + phase))`. Omit it
   * to leave root placement entirely to travel/staging.
   */
  rootBob?: IAutoMovieGaitRootBob;

  /**
   * Each limb's contribution to the cycle. The limbs differ only in **when**
   * they swing (`phase`) and **how**: a horse walk is its four legs at phase
   * offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0, 0.5, 0.5, 0`
   * (diagonal pairs).
   */
  limbs: IAutoMovieLegacyGaitLimb[];
}

/**
 * A prop's self-declared moving parts as the v1 record wrote them.
 */
export interface IAutoMovieLegacyPropArticulation {
  /**
   * The prop's internal joint nodes.
   */
  nodes: IAutoMovieNode[];

  /**
   * The declared capability over those nodes.
   */
  profile: IAutoMovieLegacyPropProfile;

  /**
   * The application of the profile onto the nodes (`boneMap`).
   */
  binding: IAutoMovieProfileBinding;
}

/**
 * JSON-safe gait limb channel the v1 store performed against.
 */
export interface IAutoMovieLegacyGaitLimb {
  /**
   * The bone this limb's swing drives (a leg's upper bone).
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Joint axis this gait channel writes. Omitted means `"flexion"` (the
   * sagittal swing); set `"abduction"` for side-to-side sway/spread or
   * `"twist"` for axial gait details.
   */
  axis?: "flexion" | "abduction" | "twist";

  /**
   * Where in the stride this limb's cycle starts, in `[0, 1)`: the phase offset
   * that distinguishes one gait's footfall sequence from another's.
   */
  phase: number;

  /**
   * Fraction of the stride the limb spends in **stance** (planted, pushing the
   * body back) versus **swing** (lifted, recovering forward), in `(0, 1)`. A
   * walk has a high duty (long ground contact); a gallop a low one.
   */
  duty: number;

  /**
   * Peak swing on `axis` (degrees) about the limb's neutral.
   */
  amplitude: number;

  /**
   * Easing used while the limb is in stance (planted, pushing back). Omitted
   * means `"linear"`.
   */
  stanceEasing?: AutoMovieEasing;

  /**
   * Easing used while the limb is in swing (recovering forward). Omitted means
   * `"linear"`.
   */
  swingEasing?: AutoMovieEasing;

  /**
   * Center the swing oscillates around (degrees), default `0`. A symmetric limb
   * (a hip, a shoulder) leaves this unset and swings `±amplitude` about zero; a
   * limb that only bends one way needs a nonzero center to keep the whole swing
   * on the anatomical side. A knee, whose flexion ROM is `[0, 150]°` and cannot
   * hyperextend, walks with e.g. `{ neutral: 25, amplitude: 18 }` so its swing
   * stays in `[7, 43]°` instead of crossing zero: the offset the ROM validator
   * forces once you try to bend a knee at all.
   */
  neutral?: number;
}

/**
 * A source-to-output value range, the JSON-safe form of a `[from, to]` pair.
 */
export interface IAutoMovieLegacyRange {
  /**
   * Range start.
   */
  from: number;

  /**
   * Range end.
   */
  to: number;
}

/**
 * Minimal model geometry lookup the v1 store answered with.
 */
export interface IAutoMovieLegacyGeometryModel {
  /**
   * Model id referenced by scene nodes.
   */
  id: string;

  /**
   * Skeleton used for FK and reach queries; null for props.
   */
  skeleton: IAutoMovieSkeleton | null;
}

/**
 * JSON-safe motion clip crossing the v1 `perform` boundary, returned as the
 * compiled per-actor clips, and supplied by the caller as the authored clips an
 * `enact` action plays (#1148).
 */
export interface IAutoMovieLegacyMotion {
  /**
   * Stable id so scenes and exports can cite this clip.
   */
  id: string;

  /**
   * Which skeleton this clip animates. Every keyframe pose targets this rig.
   */
  skeleton: string;

  /**
   * Total clip length, seconds. Every keyframe `time` must be `<= duration`.
   */
  duration: number;

  /**
   * Whether the clip loops seamlessly. When `true`, the engine expects the last
   * keyframe to be continuous with the first.
   */
  loop: boolean;

  /**
   * Keyframes in strictly increasing `time` order. At least two are required: a
   * clip needs a start and an end to interpolate between.
   */
  keyframes: IAutoMovieLegacyKeyframe[];

  /**
   * The gait cycle the motion carries ({@link IAutoMovieGaitCycle}), how a
   * non-looping compiled performance still reports a stride phase at the beat
   * end. Absent/null = no cycle to resume.
   */
  gaitCycle?: IAutoMovieGaitCycle | null;
}

/**
 * JSON-safe keyframe the v1 store returned.
 */
export interface IAutoMovieLegacyKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time`; both enforced by the
   * engine's temporal verifier.
   */
  time: number;

  /**
   * The body pose held at this instant.
   */
  pose: IAutoMoviePose;

  /**
   * Facial expression at this instant, or `null` for the neutral (rest) face.
   * `null` is the unauthored/neutral side, blended toward like a resting joint
   * axis: an expression authored only at the far keyframe ramps in from neutral
   * across the segment, and one authored only at the near keyframe fades out.
   */
  expression: IAutoMovieExpression | null;

  /**
   * How to interpolate from this keyframe toward the next.
   */
  easing: AutoMovieEasing;

  /**
   * Control points for `easing: "cubicBezier"`, `null` for all other easings.
   * The engine's own keyframe carries these as the tuple `[x1, y1, x2, y2]`;
   * the LLM schema cannot express a tuple, so the v1 boundary names the four
   * numbers instead. Same values, same order.
   */
  bezier: IAutoMovieLegacyBezier | null;
}

/**
 * Cubic-bezier control points as named fields, not a tuple: the v1 form of the
 * engine's `[x1, y1, x2, y2]`, in the unit square (CSS `cubic-bezier`
 * convention).
 */
export interface IAutoMovieLegacyBezier {
  /**
   * First control point x, in `[0, 1]`.
   */
  x1: number;

  /**
   * First control point y.
   */
  y1: number;

  /**
   * Second control point x, in `[0, 1]`.
   */
  x2: number;

  /**
   * Second control point y.
   */
  y2: number;
}
