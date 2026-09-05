import * as THREE from "three";

import {
  type IAutoMovieViewerSnapshot,
  type IAutoMovieViewerSnapshotOptions,
  type IAutoMovieViewerSnapshotRenderer,
  captureViewerSnapshot,
} from "./snapshot";

/**
 * Kind of authored thing one subject inspection opens.
 *
 * The list is the viewable tree read as node kinds rather than as a path: a
 * space decomposes into elements, an element into parts, a model into meshes,
 * a population into its members. Naming the kind beside the id is what keeps
 * two identical strings apart when a placed element and the model it places
 * were authored under the same name, which is the prototype-placement
 * distinction the requirement refuses to collapse.
 *
 * No member of this union is a shot, a frame or a take. That absence is the
 * point: a subject is named by what it is, never by the delivered picture that
 * happens to contain it.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity `AutoMovieViewerSubjectKind` enumerates the authored kinds a subject identity may name, keeping prototype and placement apart.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `AutoMovieViewerSubjectKind` types the kind field of the subject record the inspection surface resolves.
 * @author Samchon
 */
export type AutoMovieViewerSubjectKind =
  | "built-environment"
  | "building"
  | "storey"
  | "space"
  | "element"
  | "part"
  | "model"
  | "prototype"
  | "mesh"
  | "primitive"
  | "formation"
  | "slot"
  | "instance-set"
  | "instance";

/**
 * Stable identity of one thing under inspection.
 *
 * This is the currency two agents working one production exchange instead of
 * screenshots. A reviewer that reports `element:hall-oriel-2` names something
 * the authoring agent can open, and both open the same thing; a reviewer that
 * reports a pixel names something only it can see.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity `IAutoMovieViewerSubject` carries the stable identity and revision by which a subject is pointed at and opened alone.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `IAutoMovieViewerSubject` structures the subject record's identity fields for the inspection surface.
 * @author Samchon
 */
export interface IAutoMovieViewerSubject {
  /**
   * Which authored kind the id names.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-identity `kind` distinguishes a prototype subject from a placement subject that reuses the same authored name.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `kind` types the subject record's kind field.
   */
  kind: AutoMovieViewerSubjectKind;
  /**
   * Authored id, unique within its kind.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-identity `id` is the stable identity, not the display name, by which the subject is pointed at.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `id` types the subject record's identity field.
   */
  id: string;
  /**
   * Revision the observation was taken against, or `null` when the caller has
   * none to state.
   *
   * A revision is what makes an observation reopenable rather than merely
   * repeatable: the same id at a later revision is a different thing to judge.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-identity `revision` keeps one identity's successive states apart so an observation names which state it saw.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `revision` types the subject record's revision field.
   */
  revision: string | null;
}

/**
 * World-space box a subject occupies, in metres.
 *
 * The engine already answers this for every kind that has an answer -
 * `builtEnvironmentSpaceContentBounds` for a space, `builtEnvironmentElementBounds`
 * for an element, `builtInstanceSetPlacementBounds` for a population - so this
 * shape is deliberately the structural intersection of all three rather than a
 * fourth spelling of the same box.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `IAutoMovieViewerSubjectBounds` supplies the subject's own extent, which is what lets the inspection choose a viewpoint without an authored camera.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `IAutoMovieViewerSubjectBounds` types the extent a viewpoint plan derives its distances from.
 * @author Samchon
 */
export interface IAutoMovieViewerSubjectBounds {
  /**
   * Lower world corner, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `min` states the subject's lower extent so the inspection can frame it on its own terms.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `min` types the lower corner a viewpoint plan measures from.
   */
  min: { x: number; y: number; z: number };
  /**
   * Upper world corner, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `max` states the subject's upper extent so the inspection can frame it on its own terms.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `max` types the upper corner a viewpoint plan measures from.
   */
  max: { x: number; y: number; z: number };
}

/**
 * One planned direction to look at a subject from.
 *
 * A viewpoint is stated relative to the subject rather than in world
 * coordinates, so the same plan applied to a 0.05 m mullion and to a 50 m
 * elevation asks for the same angles and gets two different distances.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `IAutoMovieViewerViewpoint` records an angle and distance the inspection chose, not one an authored camera imposed.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `IAutoMovieViewerViewpoint` types one entry of the viewpoint plan with its direction, distance, and deterministic identity.
 * @author Samchon
 */
export interface IAutoMovieViewerViewpoint {
  /**
   * Deterministic identity of this viewpoint within its plan.
   *
   * Derived from the angles, so the same plan yields the same identities and a
   * coverage record can say which of them were actually rendered.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `id` names a chosen viewpoint so the record can state which viewpoints an inspection actually took.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `id` supplies the deterministic viewpoint identity the plan requires for equal inputs.
   */
  id: string;
  /**
   * Compass angle around the subject's world-up axis, in degrees, measured
   * from `+Z` toward `+X`.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `azimuthDeg` is the angle the inspection chose to look from.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `azimuthDeg` types the plan entry's horizontal direction.
   */
  azimuthDeg: number;
  /**
   * Angle above the subject's horizontal plane, in degrees.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `elevationDeg` is the height the inspection chose to look from.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `elevationDeg` types the plan entry's vertical direction.
   */
  elevationDeg: number;
  /**
   * Multiplier on the distance that exactly fits the subject, where `1` fits
   * it and larger values leave surrounding context in frame.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `distanceFactor` is how much room around the subject the inspection chose, independent of the subject's absolute size.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `distanceFactor` types the plan entry's distance rule in units of the fitted distance.
   */
  distanceFactor: number;
}

/**
 * Lens the inspection looks through.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `IAutoMovieViewerSubjectLens` belongs to the inspection rather than to any authored camera.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `IAutoMovieViewerSubjectLens` types the projection the viewpoint plan states.
 * @author Samchon
 */
export interface IAutoMovieViewerSubjectLens {
  /**
   * Vertical field of view in degrees.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `fovDeg` is the lens the inspection picked to reveal the subject.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `fovDeg` types the projection's vertical field of view.
   */
  fovDeg: number;
  /**
   * Viewport width divided by height.
   *
   * The horizontal field follows from this, and framing uses whichever of the
   * two fields is narrower, so a subject stays inside a portrait viewport.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `aspect` lets the inspection fit the subject to the viewport it actually renders into.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `aspect` types the projection's viewport ratio.
   */
  aspect: number;
}

/**
 * A camera placement: where the eye is, what it looks at, and through what.
 *
 * This is the "position and orientation in" half of pose-to-image. It carries
 * no film time and no shot id, because neither is an input to looking at a
 * thing.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `IAutoMovieViewerSubjectPose` states an eye the inspection owns, unbound from authored camera, shot boundary, and playback time.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `IAutoMovieViewerSubjectPose` types the resolved camera state one viewpoint plan entry produces.
 * @author Samchon
 */
export interface IAutoMovieViewerSubjectPose {
  /**
   * World position of the eye, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `position` places the inspection's own eye.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `position` types the resolved eye position.
   */
  position: { x: number; y: number; z: number };
  /**
   * World point the eye looks at, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `target` orients the inspection's own eye.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `target` types the resolved eye orientation as a look-at point.
   */
  target: { x: number; y: number; z: number };
  /**
   * Lens this pose was resolved for.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `lens` records the projection the inspection chose alongside the eye it chose.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `lens` types the projection carried with the resolved pose.
   */
  lens: IAutoMovieViewerSubjectLens;
  /**
   * Near clip distance, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `near` is derived from the subject's own size so a small part and a large elevation are both clipped sensibly.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `near` types the resolved projection's near plane.
   */
  near: number;
  /**
   * Far clip distance, in metres.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `far` is derived from the subject's own size so a small part and a large elevation are both clipped sensibly.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `far` types the resolved projection's far plane.
   */
  far: number;
}

/**
 * How a turntable plan is laid out around a subject.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-coverage `IAutoMovieViewerTurntableOptions` declares the viewpoint population an inspection plans to observe.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `IAutoMovieViewerTurntableOptions` types the deterministic selection rule the viewpoint plan states.
 * @author Samchon
 */
export interface IAutoMovieViewerTurntableOptions {
  /**
   * Evenly spaced azimuths per elevation ring, at least one.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-coverage `azimuthCount` fixes how many directions per ring the planned coverage contains.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `azimuthCount` types the plan's horizontal sampling rule.
   */
  azimuthCount: number;
  /**
   * Elevation rings in degrees, in the order they are walked.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-coverage `elevationsDeg` fixes which heights the planned coverage contains.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `elevationsDeg` types the plan's vertical sampling rule.
   */
  elevationsDeg: readonly number[];
  /**
   * Distance multiplier every generated viewpoint carries. Defaults to `1.25`,
   * which leaves a margin around the subject rather than cropping it to the
   * viewport edge.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-coverage `distanceFactor` fixes the framing margin the planned coverage was taken at.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `distanceFactor` types the plan's distance rule.
   */
  distanceFactor?: number;
}

/**
 * One inspection observation: the subject, the pose it was seen from, and the
 * image that came back.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence `IAutoMovieViewerSubjectView` records the observed subject identity, the chosen viewpoint, and the artifact that observation produced.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `IAutoMovieViewerSubjectView` types one entry of the subject observation record.
 * @author Samchon
 */
export interface IAutoMovieViewerSubjectView {
  /**
   * Subject that was looked at.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `subject` records which identity and revision the observation was taken of.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `subject` types the observation record's subject identity.
   */
  subject: IAutoMovieViewerSubject;
  /**
   * Planned viewpoint identity this pose came from, or `null` for a pose the
   * caller supplied directly.
   *
   * A `null` here is what separates a planned sample from an ad-hoc look, so a
   * coverage tally cannot silently count the latter as the former.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-coverage `viewpoint` keeps a planned viewpoint's observation apart from an unplanned one so coverage counts only what the plan asked for.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `viewpoint` types the observation record's viewpoint plan reference.
   */
  viewpoint: string | null;
  /**
   * Pose the image was rendered from.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `pose` preserves the viewpoint condition the observation was made under so it can be reopened.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `pose` types the observation record's per-viewpoint condition.
   */
  pose: IAutoMovieViewerSubjectPose;
  /**
   * Image the renderer returned for that pose.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `image` is the artifact the observation produced.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `image` types the observation record's artifact.
   */
  image: IAutoMovieViewerSnapshot;
  /**
   * Always `false`, and typed as the literal so it can never be widened.
   *
   * The eye here is one the inspection chose, so the picture is evidence about
   * a thing and never about a delivered frame. A consumer that requires
   * delivery evidence cannot accept this record, and that refusal is
   * structural rather than a convention a caller may forget.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `deliveryEvidence` marks a subject observation as something that cannot be offered as delivery evidence.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `deliveryEvidence` keeps subject observations out of the delivery evidence population the specification separates.
   */
  deliveryEvidence: false;
}

/**
 * Everything one pose-to-image call needs.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence `IAutoMovieViewerSubjectViewRequest` gathers the subject, viewpoint, and render inputs one observation is derived from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `IAutoMovieViewerSubjectViewRequest` types the inputs the observation record is produced from.
 * @author Samchon
 */
export interface IAutoMovieViewerSubjectViewRequest {
  /**
   * Subject being looked at.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-identity `subject` names what is being opened, rather than the shot that happens to contain it.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `subject` types the request's subject identity.
   */
  subject: IAutoMovieViewerSubject;
  /**
   * Pose to render from.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `pose` is the eye the inspection supplies, which the harness uses instead of any authored camera.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `pose` types the resolved viewpoint the request renders.
   */
  pose: IAutoMovieViewerSubjectPose;
  /**
   * Planned viewpoint identity, when the pose came from a plan.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-coverage `viewpoint` states whether this observation counts toward planned coverage.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `viewpoint` types the request's viewpoint plan reference.
   */
  viewpoint?: string | null;
  /**
   * Scene holding the subject.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `scene` is the compiled content the observation is derived from.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `scene` types the compiled source of the observation.
   */
  scene: THREE.Scene;
  /**
   * Camera the pose is written onto and the frame is drawn through.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `camera` is driven by the inspection's pose rather than by an authored camera track.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `camera` types the projection carrier the resolved pose is applied to.
   */
  camera: THREE.PerspectiveCamera;
  /**
   * Renderer that draws and reads the frame back.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `renderer` produces the artifact this observation records.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `renderer` types the producer of the observation artifact.
   */
  renderer: IAutoMovieViewerSnapshotRenderer;
  /**
   * Tell every compact population where the eye is, before the frame is drawn.
   *
   * Required, and required for one reason. A scene drawn without this call
   * keeps its ordinary meshes and silently drops every instanced population,
   * which reads as a bare roof rather than as a missing call; four rounds of
   * one survey were spent reporting absences that were never absent. A caller
   * that must pass this cannot forget it, so the trap is closed by the type
   * rather than by a comment.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `resolveForCamera` makes the populations the observation claims to have seen actually present in the frame it records.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `resolveForCamera` types the mandatory level-of-detail resolution step the observation artifact is produced under.
   */
  resolveForCamera: (
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
  ) => void;
  /**
   * Image encoding options handed to the snapshot.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence `snapshot` records the encoding the observation artifact was written with.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `snapshot` types the artifact encoding of the observation.
   */
  snapshot?: IAutoMovieViewerSnapshotOptions;
}

/**
 * Half-diagonal a degenerate subject box is framed with, in metres.
 *
 * A box of zero size is an ordinary answer, not a fault: an element citing a
 * runtime model reference reports its own origin, and a transform-only node has
 * no vertices. There is still a place to aim at, so the eye is put half a metre
 * off it and the neighbourhood is what gets shown.
 */
const DEGENERATE_RADIUS = 0.5;

/**
 * Name one subject as a single string both sides of a review can pass around.
 *
 * The form is `kind:id` and, when a revision is stated, `kind:id@revision`.
 * This is what a finding carries instead of a screenshot: the reviewer writes
 * it into the report, the authoring agent pastes it back into the harness, and
 * neither is reasoning about a private reconstruction of the model.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity `autoMovieViewerSubjectKey` renders one subject identity and revision as the stable name by which it is pointed at and opened alone.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record `autoMovieViewerSubjectKey` serializes the subject record's identity fields into one portable target string.
 * @author Samchon
 */
export const autoMovieViewerSubjectKey = (
  subject: IAutoMovieViewerSubject,
): string =>
  subject.revision === null
    ? `${subject.kind}:${subject.id}`
    : `${subject.kind}:${subject.id}@${subject.revision}`;

/**
 * Read a subject key back into an identity.
 *
 * Refuses anything it cannot resolve rather than guessing a kind, because a
 * guessed kind is exactly the prototype-placement confusion the requirement
 * forbids: the same authored name can be both a model and an element placing
 * it, and answering the wrong one looks like agreement while the two sides are
 * looking at different things.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity `parseAutoMovieViewerSubjectKey` resolves a portable subject name back to its kind, identity, and revision without inferring an unstated kind.
 * @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity `parseAutoMovieViewerSubjectKey` refuses any public subject target that cannot be opened as its own observation unit.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity `parseAutoMovieViewerSubjectKey` refuses a target it cannot resolve to a subject unit instead of substituting a neighbouring one.
 * @author Samchon
 */
export const parseAutoMovieViewerSubjectKey = (
  key: string,
): IAutoMovieViewerSubject => {
  const separator = key.indexOf(":");
  if (separator === -1)
    throw new Error(
      `subject key "${key}" names no kind; write it as "<kind>:<id>"`,
    );
  const kind = key.slice(0, separator);
  if (SUBJECT_KINDS.has(kind) === false)
    throw new Error(
      `subject key "${key}" names unknown kind "${kind}"; known kinds are ${[
        ...SUBJECT_KINDS,
      ].join(", ")}`,
    );
  const rest = key.slice(separator + 1);
  // Last `@` wins, so an id that legitimately contains one keeps it and only
  // the trailing revision is split off.
  const revisionAt = rest.lastIndexOf("@");
  const id = revisionAt === -1 ? rest : rest.slice(0, revisionAt);
  const revision = revisionAt === -1 ? null : rest.slice(revisionAt + 1);
  if (id.length === 0)
    throw new Error(`subject key "${key}" names no id after its kind`);
  if (revision !== null && revision.length === 0)
    throw new Error(`subject key "${key}" ends in an empty revision`);
  return { kind: kind as AutoMovieViewerSubjectKind, id, revision };
};

const SUBJECT_KINDS: ReadonlySet<string> = new Set<AutoMovieViewerSubjectKind>([
  "built-environment",
  "building",
  "storey",
  "space",
  "element",
  "part",
  "model",
  "prototype",
  "mesh",
  "primitive",
  "formation",
  "slot",
  "instance-set",
  "instance",
]);

/**
 * Lay out a deterministic ring of viewpoints around a subject.
 *
 * Cheap and reproducible beats complete: a horizontal sweep at a couple of
 * elevations shows a proportion, a missing head, and a brace running at the
 * wrong angle, which is what the defects that survived one whole campaign
 * actually were. The identities are derived from the angles, so the same
 * options always name the same viewpoints and a coverage record can say which
 * of them an inspection reached.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-coverage `autoMovieViewerTurntableViewpoints` declares the planned viewpoint population of one subject inspection so observed coverage can be counted against it.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `autoMovieViewerTurntableViewpoints` implements the deterministic viewpoint selection rule, producing the same identities and order for the same inputs.
 * @author Samchon
 */
export const autoMovieViewerTurntableViewpoints = (
  options: IAutoMovieViewerTurntableOptions,
): IAutoMovieViewerViewpoint[] => {
  if (
    Number.isInteger(options.azimuthCount) === false ||
    options.azimuthCount < 1
  )
    throw new RangeError(
      `turntable azimuth count must be a positive integer, not ${options.azimuthCount}`,
    );
  if (options.elevationsDeg.length === 0)
    throw new RangeError("turntable plan needs at least one elevation ring");
  const distanceFactor = options.distanceFactor ?? 1.25;
  if (distanceFactor <= 0)
    throw new RangeError(
      `turntable distance factor must be positive, not ${distanceFactor}`,
    );
  const viewpoints: IAutoMovieViewerViewpoint[] = [];
  const taken = new Set<string>();
  for (const elevationDeg of options.elevationsDeg)
    for (let index = 0; index < options.azimuthCount; index++) {
      const azimuthDeg = (360 / options.azimuthCount) * index;
      const id = `az${degreeLabel(azimuthDeg)}-el${degreeLabel(elevationDeg)}`;
      // Two rings rounding to one label would give one plan two viewpoints
      // under one name, and a coverage tally could then never say which of
      // them was observed.
      if (taken.has(id))
        throw new RangeError(
          `turntable plan produces viewpoint id "${id}" twice; separate its elevation rings by at least one degree`,
        );
      taken.add(id);
      viewpoints.push({ id, azimuthDeg, elevationDeg, distanceFactor });
    }
  return viewpoints;
};

/** Signed whole degrees as a fixed-width label, so ids sort as they read. */
const degreeLabel = (degrees: number): string => {
  const rounded = Math.round(degrees);
  const magnitude = Math.abs(rounded).toString().padStart(3, "0");
  return rounded < 0 ? `n${magnitude}` : magnitude;
};

/**
 * Place an eye that frames one subject from one viewpoint.
 *
 * The distance comes from the subject's own half-diagonal and the narrower of
 * the two fields of view, so a 0.05 m mullion and a 50 m elevation are framed
 * by one rule and neither needs a hand-tuned camera. The clip planes are
 * derived from that same radius rather than fixed, which keeps the far-to-near
 * ratio constant across every scale: a fixed near plane either slices through a
 * small part or wastes the whole depth buffer on a large one, and the second
 * reads as two surfaces fighting over one distant pixel, which looks like a
 * modelling defect and is not.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `frameAutoMovieViewerSubject` derives the angle, distance, and projection from the subject's own extent, so the inspection owns the viewpoint instead of inheriting an authored camera.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `frameAutoMovieViewerSubject` resolves one viewpoint plan entry into camera state without taking authored camera, shot boundary, or film time as input.
 * @author Samchon
 */
export const frameAutoMovieViewerSubject = (
  bounds: IAutoMovieViewerSubjectBounds,
  viewpoint: IAutoMovieViewerViewpoint,
  lens: IAutoMovieViewerSubjectLens,
): IAutoMovieViewerSubjectPose => {
  if (lens.fovDeg <= 0 || lens.fovDeg >= 180)
    throw new RangeError(
      `inspection lens field of view must be within (0, 180) degrees, not ${lens.fovDeg}`,
    );
  if (lens.aspect <= 0)
    throw new RangeError(
      `inspection lens aspect must be positive, not ${lens.aspect}`,
    );
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const span = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
  const radius = Math.max(
    Math.hypot(span.x, span.y, span.z) / 2,
    DEGENERATE_RADIUS,
  );
  const verticalHalf = THREE.MathUtils.degToRad(lens.fovDeg) / 2;
  // The horizontal field follows the aspect, and the subject has to fit the
  // narrower of the two: fitting the wider one crops a tall subject out of a
  // wide viewport, which is the one framing failure nobody notices from a
  // thumbnail.
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * lens.aspect);
  const distance =
    (radius / Math.sin(Math.min(verticalHalf, horizontalHalf))) *
    viewpoint.distanceFactor;
  const azimuth = THREE.MathUtils.degToRad(viewpoint.azimuthDeg);
  const elevation = THREE.MathUtils.degToRad(viewpoint.elevationDeg);
  const horizontal = Math.cos(elevation);
  return {
    position: {
      x: center.x + Math.sin(azimuth) * horizontal * distance,
      y: center.y + Math.sin(elevation) * distance,
      z: center.z + Math.cos(azimuth) * horizontal * distance,
    },
    target: center,
    lens,
    // Half the gap to the subject's near side, floored off zero so a
    // distance factor of exactly one still has a positive near plane.
    near: Math.max((distance - radius) / 2, radius / 1000),
    // Four radii past the subject's far side, so the eye keeps enough of the
    // surroundings to tell where the subject stands.
    far: distance + radius * 5,
  };
};

/**
 * Build a pose from a bare position and heading.
 *
 * The turntable answers "show me this thing"; this answers "put the eye here,
 * pointing there". Both exist because a reviewer who has already found
 * something needs to say where it was seen from, and a plan's angles are not
 * always where it was.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `autoMovieViewerPoseFromHeading` lets an inspection state an arbitrary angle and distance of its own rather than choosing from a fixed set.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `autoMovieViewerPoseFromHeading` resolves an explicit direction and projection into the same camera state a plan entry produces.
 * @author Samchon
 */
export const autoMovieViewerPoseFromHeading = (
  position: { x: number; y: number; z: number },
  headingDeg: { yaw: number; pitch: number },
  lens: IAutoMovieViewerSubjectLens,
  clip: { near: number; far: number },
): IAutoMovieViewerSubjectPose => {
  if (clip.near <= 0 || clip.far <= clip.near)
    throw new RangeError(
      `inspection clip range must satisfy 0 < near < far, not near=${clip.near} far=${clip.far}`,
    );
  const yaw = THREE.MathUtils.degToRad(headingDeg.yaw);
  const pitch = THREE.MathUtils.degToRad(headingDeg.pitch);
  const horizontal = Math.cos(pitch);
  // One metre ahead is enough to fix an orientation and keeps the target
  // inside the clip range whatever it is.
  return {
    position,
    target: {
      x: position.x - Math.sin(yaw) * horizontal,
      y: position.y + Math.sin(pitch),
      z: position.z - Math.cos(yaw) * horizontal,
    },
    lens,
    near: clip.near,
    far: clip.far,
  };
};

/**
 * Write one pose onto a camera.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `applyAutoMovieViewerSubjectPose` drives the camera from the inspection's own pose rather than from an authored camera track.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan `applyAutoMovieViewerSubjectPose` applies one resolved viewpoint plan entry to the projection carrier it will be rendered through.
 * @author Samchon
 */
export const applyAutoMovieViewerSubjectPose = (
  camera: THREE.PerspectiveCamera,
  pose: IAutoMovieViewerSubjectPose,
): void => {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.fov = pose.lens.fovDeg;
  camera.aspect = pose.lens.aspect;
  camera.near = pose.near;
  camera.far = pose.far;
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateProjectionMatrix();
  // The populations resolve against a world matrix, and `lookAt` only writes
  // the local quaternion; a frame drawn before this reads last frame's eye.
  camera.updateMatrixWorld(true);
};

/**
 * Pose in, image out, for one named subject.
 *
 * This is the call that makes the harness usable by something that cannot look
 * at a screen. An authoring agent names a subject and a pose and receives an
 * image; a reviewer names the same subject and the same pose and receives the
 * same image. That symmetry is the whole point, and the record it returns
 * carries the subject identity so a finding can travel as an id rather than as
 * a picture nobody can act on.
 *
 * The populations are resolved first and unconditionally. See
 * {@link IAutoMovieViewerSubjectViewRequest.resolveForCamera} for why that
 * argument is not optional.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-inspection-reach `captureAutoMovieViewerSubjectView` answers a named subject and a stated viewpoint with an observation artifact, which is what makes the instrument usable by a party that cannot look at a screen.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-inspection-reach Resolves a stable subject and viewpoint request into the actual viewer observation artifact.
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence `captureAutoMovieViewerSubjectView` produces one subject observation carrying the observed identity, the viewpoint it was taken from, and the artifact it produced.
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership `captureAutoMovieViewerSubjectView` renders through the inspection's own pose and marks the result as something no delivery review may consume.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation `captureAutoMovieViewerSubjectView` emits the subject observation record the inspection surface accumulates.
 * @author Samchon
 */
export const captureAutoMovieViewerSubjectView = (
  request: IAutoMovieViewerSubjectViewRequest,
): IAutoMovieViewerSubjectView => {
  applyAutoMovieViewerSubjectPose(request.camera, request.pose);
  request.resolveForCamera(request.camera, request.renderer.domElement.height);
  return {
    subject: request.subject,
    viewpoint: request.viewpoint ?? null,
    pose: request.pose,
    image: captureViewerSnapshot(
      request.renderer,
      request.scene,
      request.camera,
      request.snapshot,
    ),
    deliveryEvidence: false,
  };
};
