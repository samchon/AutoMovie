import {
  foldAutoMovieSubjectReviewCoverage,
  resolveAutoMovieSubjectReviewUnit,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieSubjectReviewDescription,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieSubjectBox,
  IAutoMovieSubjectReviewCoverage,
  IAutoMovieSubjectReviewObservation,
  IAutoMovieSubjectReviewTarget,
  IAutoMovieSubjectReviewViewpoint,
  IAutoMovieVector3,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import typia from "typia";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import type {
  AutoMovieProductionContext,
  IAutoMovieProductionServices,
} from "./AutoMovieProductionContext";
import {
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

/**
 * Project-relative directory every subject observation artifact is written to.
 *
 * It is deliberately outside the render root. Delivery evidence is collected
 * by walking committed render bundles, so an artifact that never enters that
 * tree cannot be quoted as a delivered frame however a caller
 * describes it. The separation is a location, not a convention someone has to
 * remember.
 *
 * @author Samchon
 */
export const AUTOMOVIE_SUBJECT_INSPECTION_ROOT = "automovie/inspections";

/**
 * File one subject's published viewpoint plan is written to.
 *
 * The plan is the denominator of that subject's coverage, and it is written by
 * the instrument that actually took the look. A reader that recomputed it
 * instead would be inventing a third plan: the viewer page lays its turntable
 * out at its own aspect and the tool lays one out at the caller's raster, and
 * both clamp a low ring against the subject's own box, so one subject is
 * legitimately planned differently in two places. Counting observations against
 * a denominator nobody was answering is worse than counting nothing.
 *
 * @author Samchon
 */
export const AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE = "plan.json";

/**
 * One subject's published viewpoint plan.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionPlanRecord {
  /** Record format. */
  version: 1;
  /** Production namespace the inspection ran in. */
  productionId: string;
  /** Compiled artifact and compiled subject id the plan was laid out for. */
  target: IAutoMovieSubjectReviewTarget;
  /** Revision of the compiled artifact the plan was derived from. */
  revision: string;
  /** Compile the plan and its observations were derived from. */
  compileFingerprint: AutoMovieContentDigest;
  /** Viewpoints the inspection undertook to observe, in plan order. */
  planned: IAutoMovieSubjectReviewViewpoint[];
  /** Never delivery evidence, and typed so it cannot become it. */
  deliveryEvidence: false;
}

/**
 * One published observation, beside the image it was taken of.
 *
 * The revision is what makes it reopenable rather than merely repeatable: the
 * same viewpoint at a later compile is a different look, and a receipt without
 * a revision could not tell a picture drawn before a recompile from one drawn
 * after it.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionObservationRecord {
  /** Record format. */
  version: 1;
  /** Receipt in the shape subject coverage counts. */
  observation: IAutoMovieSubjectReviewObservation;
  /** Camera state the artifact was drawn through. */
  pose: IAutoMovieSubjectInspectionPose;
  /** Compile the observation was derived from. */
  compileFingerprint: AutoMovieContentDigest;
  /** Never delivery evidence, and typed so it cannot become it. */
  deliveryEvidence: false;
}

/** Lock guarding concurrent observation publication inside one project. */
const INSPECTION_LOCK_PATH = "automovie/inspections.lock";

/**
 * Half-diagonal a degenerate subject box is framed with, in metres.
 *
 * A zero-size box is an ordinary answer rather than a fault: a transform-only
 * node has no vertices and an element citing a runtime model reports its own
 * origin. There is still a place to aim at, so the eye is put half a metre off
 * it and the neighbourhood is what gets shown. The value mirrors the viewer
 * harness, because the two must frame one subject identically.
 */
const DEGENERATE_RADIUS = 0.5;

/** Neutral inspection lens, in degrees of vertical field. */
const INSPECTION_FOV_DEG = 35;

/** Turntable margin used when the caller states no distance factor. */
const DEFAULT_DISTANCE_FACTOR = 1.25;

/** Turntable ring used when the caller states no plan of its own. */
const DEFAULT_AZIMUTH_COUNT = 6;

/** Elevation ring used when the caller states no plan of its own. */
const DEFAULT_ELEVATIONS_DEG: readonly number[] = [20];

/**
 * Camera state one inspection viewpoint resolves to.
 *
 * This is the "position and orientation in, image out" half of the harness. It
 * carries no film time and no shot camera, because neither is an input to
 * looking at a thing, and it states the coordinate space it is expressed in so
 * a model-local prototype and a world-placed element are never confused.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionPose {
  /**
   * Coordinate basis both {@link position} and {@link target} are stated in.
   */
  coordinateSpace: "model" | "world";
  /**
   * Eye position in metres.
   */
  position: IAutoMovieVector3;
  /**
   * Point the eye looks at, in metres.
   */
  target: IAutoMovieVector3;
  /**
   * Vertical field of view in degrees.
   */
  fovDeg: number;
  /**
   * Viewport width divided by height.
   */
  aspect: number;
  /**
   * Near clip distance in metres, derived from the subject's own size.
   */
  near: number;
  /**
   * Far clip distance in metres, derived from the subject's own size.
   */
  far: number;
}

/**
 * Host instrument that answers one inspection pose with PNG bytes.
 *
 * It is deliberately a second adapter beside the delivery frame capture rather
 * than a third target on it. A delivery capture carries a renderer identity, a
 * target fingerprint and a content-addressed render bundle because a delivered
 * frame has to be reopenable as the thing that was delivered; an inspection
 * image has none of those obligations and must not be able to acquire them by
 * travelling the same path. Separating the instrument makes a subject image
 * structurally incapable of arriving with a delivery receipt attached.
 *
 * @author Samchon
 */
export type AutoMovieProductionSubjectInspection = (input: {
  /** Active project root. */
  projectRoot: string;
  /** Active production namespace inside the project. */
  productionId: string;
  /** Current compile fingerprint the observation is derived from. */
  compileFingerprint: AutoMovieContentDigest;
  /** Compiled artifact and stable subject id being opened. */
  target: IAutoMovieSubjectReviewTarget;
  /** Revision of the compiled artifact the subject was read from. */
  revision: string;
  /** Planned viewpoint identity this pose answers. */
  viewpoint: string;
  /** Inspection-owned camera state to draw through. */
  pose: IAutoMovieSubjectInspectionPose;
  /** Requested pixel width. */
  width: number;
  /** Requested pixel height. */
  height: number;
}) => Promise<
  IAutoMovieSubjectInspectionDrawn | IAutoMovieSubjectInspectionRefusal
>;

/**
 * The raster one instrument drew for one planned viewpoint.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionDrawn {
  /** Raw PNG bytes. */
  bytes: Uint8Array;
  /** Pixel width the instrument actually drew. */
  width: number;
  /** Pixel height the instrument actually drew. */
  height: number;
}

/**
 * One instrument's answer that this subject is not one it can frame.
 *
 * It is separated from throwing because the two mean opposite things about the
 * instrument. A throw says the instrument itself failed, and the shipped host
 * answers that by discarding the page it drew through, since a page that lost
 * its execution context cannot be trusted with the next viewpoint. A refusal
 * says the instrument is working and this subject is not one it can answer for:
 * the shipped page stages a world scene, so a prototype measured in model space
 * stands nowhere in it and a world eye aimed at that box would photograph
 * whatever occupies the origin.
 *
 * Collapsing the two costs the sweep its whole saving. Measured on the starter
 * production, one model-space subject in a sweep discarded the staged page and
 * the next subject rebuilt the scene, so a sweep over a population that is
 * entirely model-space rebuilds once per subject — exactly the cost `#1956`
 * removed for every other population.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionRefusal {
  /**
   * Why this instrument cannot frame the named subject.
   *
   * It is quoted to the caller verbatim, so it states what the instrument is
   * and what would be observable instead, rather than naming an internal.
   */
  refused: string;
}

/**
 * One observation the inspection produced, with the eye it was taken from.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectInspectionView {
  /**
   * Viewpoint identity from the plan this observation answers.
   */
  viewpoint: string;
  /**
   * Camera state the image was drawn through.
   */
  pose: IAutoMovieSubjectInspectionPose;
  /**
   * Project-relative PNG the host instrument produced.
   */
  path: string;
  /**
   * Exact digest of the written PNG bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Decoded pixel width.
   */
  width: number;
  /**
   * Decoded pixel height.
   */
  height: number;
  /**
   * Receipt in the shape subject coverage counts.
   */
  observation: IAutoMovieSubjectReviewObservation;
}

/**
 * Everything one subject inspection request answers.
 *
 * `deliveryEvidence` is typed as the literal `false` rather than as a boolean,
 * so a consumer requiring delivery evidence refuses this record at the type
 * level instead of by a reviewer remembering to.
 *
 * @author Samchon
 */
export interface IAutoMovieInspectSubject {
  /**
   * True only when every planned viewpoint produced a verified observation.
   */
  inspected: boolean;
  /**
   * Production namespace the request resolved against.
   */
  productionId: string;
  /**
   * Compiled artifact and stable subject id that were opened.
   */
  target: IAutoMovieSubjectReviewTarget;
  /**
   * Revision of the compiled artifact the subject was read from, or null.
   */
  revision: string | null;
  /**
   * Compiled description of the subject, or null when it did not resolve.
   */
  subject: AutoMovieSubjectReviewDescription | null;
  /**
   * Inspection-owned viewpoint plan in deterministic order.
   */
  plan: IAutoMovieSubjectReviewViewpoint[];
  /**
   * One entry per observation the host instrument actually produced.
   */
  views: IAutoMovieSubjectInspectionView[];
  /**
   * Planned against observed coverage, or null when nothing resolved.
   */
  coverage: IAutoMovieSubjectReviewCoverage | null;
  /**
   * Always `false`, and typed as the literal so it can never be widened.
   */
  deliveryEvidence: false;
  /**
   * Exact refusal diagnostics, empty on success.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieInspectSubject {
  /**
   * One subject inspection request.
   *
   * @author Samchon
   */
  export interface IProps {
    /**
     * Optional production namespace; required when the host has no default.
     */
    productionId?: string;
    /**
     * Compiled shot artifact that owns the stable subject id.
     */
    shot: string;
    /**
     * Stable namespaced subject id, such as `element:hall-oriel-2`.
     */
    subject: string;
    /**
     * Evenly spaced azimuths per elevation ring; six by default.
     */
    azimuthCount?: number;
    /**
     * Elevation rings in degrees, in the order they are walked; `[20]` by
     * default.
     */
    elevationsDeg?: number[];
    /**
     * Multiplier on the distance that exactly fits the subject, where `1` fits
     * it and larger values leave surrounding context in frame; `1.25` by
     * default.
     */
    distanceFactor?: number;
    /**
     * Optional positive integer width no larger than production width.
     */
    width?: number;
    /**
     * Optional positive integer height no larger than production height.
     */
    height?: number;
  }
}

/**
 * Lay out a deterministic ring of inspection viewpoints around one box.
 *
 * Cheap and reproducible beats complete: a horizontal sweep at one or two
 * elevations shows a wrong proportion, a missing head and a brace running at
 * the wrong angle, which is what the defects that survived a whole campaign
 * actually were. Identities are derived from the angles and distances from the
 * subject's own half-diagonal, so a 0.05 m mullion and a 50 m elevation are
 * planned by one rule and two requesters naming the same subject receive the
 * same viewpoints in the same order.
 *
 * @author Samchon
 */
export const autoMovieSubjectInspectionPlan = (props: {
  /** Box the plan frames, in the subject's own coordinate space. */
  bounds: IAutoMovieSubjectBox;
  /** Evenly spaced azimuths per elevation ring, at least one. */
  azimuthCount: number;
  /** Elevation rings in degrees, in the order they are walked. */
  elevationsDeg: readonly number[];
  /** Positive multiplier on the distance that exactly fits the subject. */
  distanceFactor: number;
  /** Vertical field of view in degrees, inside `(0, 180)`. */
  fovDeg: number;
  /** Positive viewport width divided by height. */
  aspect: number;
}): IAutoMovieSubjectReviewViewpoint[] => {
  if (
    Number.isInteger(props.azimuthCount) === false ||
    props.azimuthCount < 1 ||
    props.azimuthCount > 64
  )
    throw new RangeError(
      `Inspection azimuth count must be an integer from 1 through 64, not ${props.azimuthCount}.`,
    );
  if (props.elevationsDeg.length === 0 || props.elevationsDeg.length > 8)
    throw new RangeError(
      "Inspection plan needs from one through eight elevation rings.",
    );
  if (
    props.elevationsDeg.some(
      (elevation) =>
        Number.isFinite(elevation) === false ||
        elevation < -85 ||
        elevation > 85,
    )
  )
    throw new RangeError(
      "Every inspection elevation must be a finite angle within [-85, 85] degrees.",
    );
  if (
    Number.isFinite(props.distanceFactor) === false ||
    props.distanceFactor <= 0
  )
    throw new RangeError(
      `Inspection distance factor must be finite and positive, not ${props.distanceFactor}.`,
    );
  const distance = subjectFitDistance(props);
  const viewpoints: IAutoMovieSubjectReviewViewpoint[] = [];
  const taken = new Set<string>();
  for (const elevationDeg of props.elevationsDeg)
    for (let index = 0; index < props.azimuthCount; index++) {
      const azimuthDeg = (360 / props.azimuthCount) * index;
      const id = `az${degreeLabel(azimuthDeg)}-el${degreeLabel(elevationDeg)}`;
      // Two rings rounding to one label would give one plan two viewpoints
      // under one name, and coverage could then never say which was observed.
      if (taken.has(id))
        throw new RangeError(
          `Inspection plan produces viewpoint id "${id}" twice; separate its elevation rings by at least one degree.`,
        );
      taken.add(id);
      viewpoints.push({
        id,
        direction: subjectViewDirection(azimuthDeg, elevationDeg),
        distance,
        projection: "perspective",
        pose: null,
        state: null,
      });
    }
  return viewpoints;
};

/**
 * Raise any requested elevation that would put the eye under the subject.
 *
 * A turntable angle is stated relative to the subject's centre, and a subject
 * standing on the ground has its centre above that ground, so a low ring digs.
 * Measured on one production, a room whose centre sits 4.95 m up put the eye
 * 7.49 m *below* grade at twenty degrees down, and eight of that sweep's
 * twenty-four viewpoints were underground pictures of nothing. A client that
 * cannot look at a screen has no way to notice that, which is exactly why the
 * rule belongs here rather than in the caller's judgement.
 *
 * The floor comes from the subject's own box rather than from a world constant,
 * so a slate lying three metres up keeps its full downward angle and only a
 * subject that actually rests on the ground is lifted. Two elevations that
 * collapse onto one angle collapse into one viewpoint, because two identical
 * angles are one viewpoint however they were asked for.
 *
 * @author Samchon
 */
export const autoMovieSubjectInspectionElevations = (props: {
  /** Box the plan frames, in the subject's own coordinate space. */
  bounds: IAutoMovieSubjectBox;
  /** Elevation rings the caller asked for, in degrees. */
  elevationsDeg: readonly number[];
  /** Distance the plan places the eye at, in metres. */
  distance: number;
}): number[] => {
  const floor = Math.min(0, props.bounds.min.y);
  const drop = boxCenter(props.bounds).y - floor;
  const lowest =
    props.distance <= 0
      ? 0
      : -Math.asin(Math.min(1, drop / props.distance)) * (180 / Math.PI);
  const grounded: number[] = [];
  for (const elevationDeg of props.elevationsDeg) {
    const raised = Math.max(elevationDeg, lowest);
    if (grounded.includes(raised) === false) grounded.push(raised);
  }
  return grounded;
};

/**
 * Resolve one planned viewpoint into the camera state it is drawn through.
 *
 * The clip planes come from the same half-diagonal the distance did, which
 * keeps the far-to-near ratio constant across every scale. A fixed near plane
 * either slices through a small part or spends the whole depth buffer on a
 * large one, and the second reads as two surfaces fighting over one distant
 * pixel, which looks like a modelling defect and is not.
 *
 * @author Samchon
 */
export const autoMovieSubjectInspectionPose = (props: {
  /** Box the viewpoint frames, in the subject's own coordinate space. */
  bounds: IAutoMovieSubjectBox;
  /** Coordinate basis the box, and therefore the pose, is stated in. */
  coordinateSpace: "model" | "world";
  /** Plan entry being resolved. */
  viewpoint: IAutoMovieSubjectReviewViewpoint;
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Viewport width divided by height. */
  aspect: number;
}): IAutoMovieSubjectInspectionPose => {
  const center = boxCenter(props.bounds);
  const radius = boxRadius(props.bounds);
  const distance = props.viewpoint.distance;
  return {
    coordinateSpace: props.coordinateSpace,
    position: {
      x: center.x + props.viewpoint.direction.x * distance,
      y: center.y + props.viewpoint.direction.y * distance,
      z: center.z + props.viewpoint.direction.z * distance,
    },
    target: center,
    fovDeg: props.fovDeg,
    aspect: props.aspect,
    // Half the gap to the subject's near side, floored off zero so a distance
    // factor of exactly one still leaves a positive near plane.
    near: Math.max((distance - radius) / 2, radius / 1000),
    // Five radii past the subject's far side, so the eye keeps enough of the
    // surroundings to tell where the subject stands.
    far: distance + radius * 5,
  };
};

/**
 * Answer a named subject and an inspection-owned viewpoint with an image.
 *
 * This is the reach the harness is missing without it. An authoring agent
 * cannot look at a screen, so an instrument that only opens in a browser is an
 * instrument that agent does not have; here it names `element:hall-oriel-2`,
 * states a turntable rule, and receives one PNG per planned viewpoint. A
 * reviewer naming the same subject and the same rule receives the same
 * viewpoints, which is what lets a finding travel as an id rather than as a
 * picture the other side cannot act on.
 *
 * Nothing it produces is delivery evidence. The instrument is a separate host
 * adapter from frame capture, the artifacts are written outside the render
 * root, and the answer carries `deliveryEvidence` as a literal `false`.
 *
 * @author Samchon
 */
export class AutoMovieProductionSubjectInspectionService {
  /** Bind the optional host instrument this server was configured with. */
  public constructor(
    private readonly adapter?: AutoMovieProductionSubjectInspection,
  ) {}

  /**
   * Serve one inspection request against the session context.
   *
   * The knowledge gate runs before the production is resolved, so an ungated
   * caller is told what to read rather than which production failed to open.
   */
  public async serve(
    context: AutoMovieProductionContext,
    input: IAutoMovieInspectSubject.IProps,
  ): Promise<IAutoMovieInspectSubject> {
    return this.inspect(context.forProduction(input.productionId), input);
  }

  /**
   * Open one compiled subject from every planned viewpoint.
   */
  public async inspect(
    services: IAutoMovieProductionServices,
    input: IAutoMovieInspectSubject.IProps,
  ): Promise<IAutoMovieInspectSubject> {
    const target: IAutoMovieSubjectReviewTarget = {
      shot: input.shot,
      subject: input.subject,
    };
    const refuse = (
      code: AutoMovieDiagnosticCode,
      message: string,
      partial?: Partial<IAutoMovieInspectSubject>,
    ): IAutoMovieInspectSubject => ({
      inspected: false,
      productionId: services.project.productionId,
      target,
      revision: null,
      subject: null,
      plan: [],
      views: [],
      coverage: null,
      deliveryEvidence: false,
      ...partial,
      diagnostics: [
        {
          code,
          category: "error",
          phase: "render",
          target: `subject:${input.shot}:${input.subject}`,
          path: null,
          message,
        },
      ],
    });
    if (this.adapter === undefined)
      return refuse(
        "capture-host-unavailable",
        "This project supplies no subject inspection instrument. The scaffold ships one at `scripts/inspectSubject.ts`; pass that, or another AutoMovieProductionSubjectInspection, to the call that reached here and retry. AutoMovie will not fabricate an observation it did not draw.",
      );
    const generated = services.project.generatedManifest();
    if (generated === null)
      return refuse(
        "compile-missing",
        "Subject inspection requires a current source compile. Run the scaffold compile command before opening a subject.",
      );
    const status = services.compileStatus();
    if (status.compiler.inputFingerprint !== generated.inputFingerprint)
      return refuse(
        "generated-stale",
        `Generated input ${generated.inputFingerprint} differs from current ${status.compiler.inputFingerprint}. Run the scaffold compile command before opening a subject.`,
      );
    if (status.success === false)
      return refuse(
        "compile-current-invalid",
        "Current source does not pass the read-only compiler gate, so a subject read from it would describe a state nothing renders. Correct it and run the scaffold compile command.",
      );
    const production = services.project.graph().production;
    if (production === null)
      return refuse(
        "compile-missing",
        "Subject inspection requires a current production frame format. Create the tracked production design record and run the scaffold compile command.",
      );
    const width = input.width ?? production.frameFormat.width;
    const height = input.height ?? production.frameFormat.height;
    if (
      Number.isInteger(width) === false ||
      Number.isInteger(height) === false ||
      width <= 0 ||
      height <= 0 ||
      width > production.frameFormat.width ||
      height > production.frameFormat.height
    )
      return refuse(
        "preview-input-invalid",
        `Inspection dimensions must be positive integers no larger than the validated ${production.frameFormat.width}x${production.frameFormat.height} production frame. Correct inspectSubject input.`,
      );
    const resolved = resolveSubject(services, target);
    if (resolved === null)
      return refuse(
        "capture-target-missing",
        `Subject "${input.subject}" is absent from current compiled artifact "${input.shot}". Correct the subject id or compile its source, then retry. Inspect the same artifact to list the ids it actually owns.`,
      );
    const frame = inspectionFrame(resolved.description);
    if (frame === null)
      return refuse(
        "review-subject-viewpoint-unsupported",
        `Compiled subject "${input.subject}" has no measured extent this surface can frame, so no inspection-owned viewpoint can be derived for it. Report its viewpoint range as unsupported rather than as observed.`,
        { revision: resolved.revision, subject: resolved.description },
      );
    let plan: IAutoMovieSubjectReviewViewpoint[];
    try {
      const rule = {
        bounds: frame.bounds,
        azimuthCount: input.azimuthCount ?? DEFAULT_AZIMUTH_COUNT,
        elevationsDeg: input.elevationsDeg ?? DEFAULT_ELEVATIONS_DEG,
        distanceFactor: input.distanceFactor ?? DEFAULT_DISTANCE_FACTOR,
        fovDeg: INSPECTION_FOV_DEG,
        aspect: width / height,
      };
      // The distance is asked of the plan rather than recomputed, so the one
      // rule that decides where the eye stands stays in one place and the
      // bit-for-bit agreement with the viewer harness survives this correction.
      const asked = autoMovieSubjectInspectionPlan(rule);
      const grounded = autoMovieSubjectInspectionElevations({
        bounds: frame.bounds,
        elevationsDeg: rule.elevationsDeg,
        distance: asked[0]!.distance,
      });
      plan =
        grounded.length === rule.elevationsDeg.length &&
        grounded.every(
          (degrees, index) => degrees === rule.elevationsDeg[index],
        )
          ? asked
          : autoMovieSubjectInspectionPlan({
              ...rule,
              elevationsDeg: grounded,
            });
    } catch (error) {
      return refuse(
        "preview-input-invalid",
        `${error instanceof Error ? error.message : String(error)} Correct the inspectSubject viewpoint rule.`,
        { revision: resolved.revision, subject: resolved.description },
      );
    }
    // The plan is published before the first picture is drawn, so a sweep that
    // refuses partway leaves a denominator standing beside the observations it
    // did manage. Without that, a half-finished inspection would read as a
    // completed one over a smaller plan, which is the shape of a rubber stamp.
    const directory = inspectionDirectory(
      services.project.productionId,
      target.shot,
      resolved.description.id,
    );
    publishInspectionFile(
      services.project.root,
      `${directory}/${AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE}`,
      Buffer.from(
        `${JSON.stringify(
          {
            version: 1,
            productionId: services.project.productionId,
            target: { shot: target.shot, subject: resolved.description.id },
            revision: resolved.revision,
            compileFingerprint: generated.inputFingerprint,
            planned: plan,
            deliveryEvidence: false,
          } satisfies IAutoMovieSubjectInspectionPlanRecord,
          null,
          2,
        )}\n`,
        "utf8",
      ),
    );
    const views: IAutoMovieSubjectInspectionView[] = [];
    for (const viewpoint of plan) {
      const pose = autoMovieSubjectInspectionPose({
        bounds: frame.bounds,
        coordinateSpace: frame.coordinateSpace,
        viewpoint,
        fovDeg: INSPECTION_FOV_DEG,
        aspect: width / height,
      });
      let drawn: Awaited<ReturnType<AutoMovieProductionSubjectInspection>>;
      try {
        drawn = await this.adapter({
          projectRoot: services.project.root,
          productionId: services.project.productionId,
          compileFingerprint: generated.inputFingerprint,
          target,
          revision: resolved.revision,
          viewpoint: viewpoint.id,
          pose,
          width,
          height,
        });
      } catch (error) {
        return refuse(
          "capture-failed",
          `${error instanceof Error ? error.message : String(error)} Correct the subject inspection instrument and retry inspectSubject.`,
          { revision: resolved.revision, subject: resolved.description, plan },
        );
      }
      // A working instrument saying it cannot frame this subject is the
      // unsupported-viewpoint answer, not a failure of the instrument. Telling
      // the caller to correct an instrument that is behaving correctly sends it
      // to the one place the fault is not, and the review surface already reads
      // this code as the range being unobservable rather than as work owed.
      if ("refused" in drawn)
        return refuse(
          "review-subject-viewpoint-unsupported",
          `The subject inspection instrument cannot frame compiled subject "${input.subject}": ${drawn.refused} Report its viewpoint range as unsupported rather than as observed.`,
          { revision: resolved.revision, subject: resolved.description, plan },
        );
      let png: PNG;
      try {
        if (drawn.bytes.length === 0)
          throw new Error("the inspection instrument returned zero bytes");
        png = PNG.sync.read(Buffer.from(drawn.bytes));
      } catch (error) {
        return refuse(
          "capture-png-invalid",
          `${error instanceof Error ? error.message : String(error)}. The subject inspection instrument must return a decodable PNG.`,
          { revision: resolved.revision, subject: resolved.description, plan },
        );
      }
      if (
        drawn.width !== width ||
        drawn.height !== height ||
        png.width !== width ||
        png.height !== height
      )
        return refuse(
          "capture-size-mismatch",
          `Requested ${width}x${height}, instrument reported ${drawn.width}x${drawn.height}, and PNG decoded as ${png.width}x${png.height}. Fix the subject inspection viewport.`,
          { revision: resolved.revision, subject: resolved.description, plan },
        );
      if (hasVisiblePixelVariance(png) === false)
        return refuse(
          "capture-png-blank",
          `Viewpoint "${viewpoint.id}" decoded with no visible pixel variance. An empty picture is not an observation of the subject; correct the framing, lighting, or instrument before recording it.`,
          { revision: resolved.revision, subject: resolved.description, plan },
        );
      const bytes = Buffer.from(drawn.bytes);
      const relative = `${directory}/${encodeAutoMoviePathSegment(viewpoint.id)}.png`;
      publishInspectionFile(services.project.root, relative, bytes);
      const digest = digestAutoMovieBytes(bytes);
      const observation: IAutoMovieSubjectReviewObservation = {
        kind: "subject-view",
        subject: resolved.description.id,
        revision: resolved.revision,
        viewpoint: viewpoint.id,
        artifact: relative,
        digest,
      };
      publishInspectionFile(
        services.project.root,
        `${directory}/${encodeAutoMoviePathSegment(viewpoint.id)}.json`,
        Buffer.from(
          `${JSON.stringify(
            {
              version: 1,
              observation,
              pose,
              compileFingerprint: generated.inputFingerprint,
              deliveryEvidence: false,
            } satisfies IAutoMovieSubjectInspectionObservationRecord,
            null,
            2,
          )}\n`,
          "utf8",
        ),
      );
      views.push({
        viewpoint: viewpoint.id,
        pose,
        path: relative,
        digest,
        width,
        height,
        observation,
      });
    }
    // A compile that moved while the sweep ran leaves a set of pictures taken
    // of two different models, and nothing in the individual images says so.
    const current = services.project.generatedManifest();
    if (
      current === null ||
      current.inputFingerprint !== generated.inputFingerprint
    )
      return refuse(
        "capture-input-changed",
        "Production source or generated output changed while the subject was being inspected. Discard this mixed sweep, compile the current project, and inspect the subject again.",
        { revision: resolved.revision, subject: resolved.description, plan },
      );
    const coverage = foldAutoMovieSubjectReviewCoverage(
      resolved.unit,
      plan,
      views.map((view) => view.observation),
    );
    return {
      // Reaching here means every planned viewpoint produced a verified
      // observation, because the first one that did not returned a refusal.
      // A partial sweep is never reported as an inspection.
      inspected: true,
      productionId: services.project.productionId,
      target,
      revision: resolved.revision,
      subject: resolved.description,
      plan,
      views,
      coverage,
      deliveryEvidence: false,
      diagnostics: [],
    };
  }
}

interface IResolvedInspectionSubject {
  revision: string;
  unit: ReturnType<typeof resolveAutoMovieSubjectReviewUnit>;
  description: AutoMovieSubjectReviewDescription;
}

/**
 * Read one compiled subject from the artifact the target names.
 *
 * The revision is digested from the exact bytes the description was read from
 * rather than copied out of a manifest, so an observation can never claim a
 * revision it did not come from.
 */
const resolveSubject = (
  services: IAutoMovieProductionServices,
  target: IAutoMovieSubjectReviewTarget,
): IResolvedInspectionSubject | null => {
  let bytes: Uint8Array;
  let compiled: IAutoMovieCompiledShotSource;
  try {
    bytes = services.project.readGeneratedFile(
      `shots/${encodeAutoMoviePathSegment(target.shot)}.json`,
    );
    // Asserting rather than validating keeps one refusal path: a compiled shot
    // that is unreadable, absent, or not a compiled shot at all is the same
    // answer to the caller, and a second branch saying so would only be a
    // branch no arrangement can reach.
    compiled = typia.assertEquals<IAutoMovieCompiledShotSource>(
      JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
    );
  } catch {
    return null;
  }
  const revision = digestAutoMovieBytes(bytes);
  for (const subject of compiledSubjectSpellings(target.subject))
    try {
      const unit = resolveAutoMovieSubjectReviewUnit(
        { revision, compiled },
        { shot: target.shot, subject },
      );
      return { revision, unit, description: unit.description };
    } catch {
      continue;
    }
  return null;
};

/**
 * Spellings of one subject name this surface will try, in order.
 *
 * The viewer harness and the compiled description agree on every id except a
 * placed or reusable part, which the harness writes `part:<node>/<part>` and
 * the compiler writes `element-part:` or `prototype-part:`. An authoring agent
 * handed a name by one instrument has to be able to paste it into the other, so
 * the divergence is absorbed here instead of being answered with "no such
 * subject". A viewer key may also carry a trailing `@revision`, which names the
 * state it was read at rather than a different subject.
 */
const compiledSubjectSpellings = (subject: string): string[] => {
  const revisionAt = subject.lastIndexOf("@");
  const bare = revisionAt === -1 ? subject : subject.slice(0, revisionAt);
  return bare.startsWith("part:")
    ? [
        `element-part:${bare.slice("part:".length)}`,
        `prototype-part:${bare.slice("part:".length)}`,
      ]
    : [bare];
};

interface IInspectionFrame {
  bounds: IAutoMovieSubjectBox;
  coordinateSpace: "model" | "world";
}

/**
 * Pick the box an inspection frames, or refuse the subject.
 *
 * Measured content wins over a declaration, because what a reviewer opens a
 * subject to judge is what the compile actually holds. A formation carries its
 * extent in its own unit-local frame under its own motion vocabulary, and
 * reading that box as if it were a placement box would aim the eye at empty
 * ground; a subject this surface cannot frame honestly is reported unsupported
 * rather than framed wrongly.
 */
const inspectionFrame = (
  description: AutoMovieSubjectReviewDescription,
): IInspectionFrame | null => {
  if (description.kind === "formation") return null;
  const bounds = description.bounds.content ?? description.bounds.declared;
  return bounds === null
    ? null
    : { bounds, coordinateSpace: description.bounds.coordinateSpace };
};

/**
 * Project-relative directory holding one compiled subject's inspection.
 *
 * It is keyed by the compiled subject id rather than by the spelling the caller
 * used, so a name pasted from the viewer page and the same subject named the
 * compiler's way publish into one place instead of two.
 *
 * @author Samchon
 */
export const inspectionDirectory = (
  productionId: string,
  shot: string,
  subject: string,
): string =>
  [
    AUTOMOVIE_SUBJECT_INSPECTION_ROOT,
    encodeAutoMoviePathSegment(productionId),
    encodeAutoMoviePathSegment(shot),
    encodeAutoMoviePathSegment(subject),
  ].join("/");

/**
 * Read one compiled subject's published plan and verified observations.
 *
 * This is the read side of the receipt, so a consumer counting coverage never
 * has to know where the files live or how a viewpoint id becomes a filename.
 * Every observation is admitted only when the artifact it names is present and
 * still hashes to the digest it claims; a picture that was deleted or replaced
 * is not an observation, and letting it count is the fabricated pass the whole
 * refusal exists to prevent.
 *
 * @author Samchon
 */
export const readAutoMovieSubjectInspection = (props: {
  /** Project root the inspection published into. */
  projectRoot: string;
  /** Production namespace the inspection ran in. */
  productionId: string;
  /** Compiled artifact owning the subject. */
  shot: string;
  /** Compiled subject id. */
  subject: string;
}): {
  /** Declared viewpoint population, empty when nothing was ever planned. */
  planned: IAutoMovieSubjectReviewViewpoint[];
  /** Observations whose artifacts still answer for them, in plan order. */
  observations: IAutoMovieSubjectReviewObservation[];
} => {
  const directory = inspectionDirectory(
    props.productionId,
    props.shot,
    props.subject,
  );
  const absolute = (relative: string): string =>
    path.join(props.projectRoot, ...relative.split("/"));
  const plan = readInspectionJson<IAutoMovieSubjectInspectionPlanRecord>(
    absolute(`${directory}/${AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE}`),
    (value) =>
      value.version === 1 &&
      Array.isArray(value.planned) &&
      value.deliveryEvidence === false,
  );
  if (plan === null) return { planned: [], observations: [] };
  const observations: IAutoMovieSubjectReviewObservation[] = [];
  for (const viewpoint of plan.planned) {
    const record =
      readInspectionJson<IAutoMovieSubjectInspectionObservationRecord>(
        absolute(
          `${directory}/${encodeAutoMoviePathSegment(viewpoint.id)}.json`,
        ),
        (value) =>
          value.version === 1 &&
          value.deliveryEvidence === false &&
          typeof value.observation?.artifact === "string" &&
          typeof value.observation?.digest === "string",
      );
    if (record === null) continue;
    let bytes: Buffer;
    try {
      bytes = fs.readFileSync(absolute(record.observation.artifact));
    } catch {
      continue;
    }
    if (digestAutoMovieBytes(bytes) !== record.observation.digest) continue;
    observations.push(record.observation);
  }
  return { planned: plan.planned, observations };
};

/** Read one inspection record, refusing anything it cannot recognize. */
const readInspectionJson = <T>(
  file: string,
  accepts: (value: T) => boolean,
): T | null => {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    return accepts(value) ? value : null;
  } catch {
    return null;
  }
};

/** Write one inspection file under the project's inspection lock. */
const publishInspectionFile = (
  root: string,
  relative: string,
  bytes: Buffer,
): void => {
  const absolute = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const lockFile = path.join(root, ...INSPECTION_LOCK_PATH.split("/"));
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const token = acquireCommitLock(lockFile);
  try {
    const staged = `${absolute}.staged`;
    fs.writeFileSync(staged, bytes);
    fs.renameSync(staged, absolute);
  } finally {
    releaseCommitLock(lockFile, token);
  }
};

/** Centre of one inclusive box. */
const boxCenter = (bounds: IAutoMovieSubjectBox): IAutoMovieVector3 => ({
  x: (bounds.min.x + bounds.max.x) / 2,
  y: (bounds.min.y + bounds.max.y) / 2,
  z: (bounds.min.z + bounds.max.z) / 2,
});

/** Half-diagonal of one inclusive box, floored off a degenerate answer. */
const boxRadius = (bounds: IAutoMovieSubjectBox): number =>
  Math.max(
    Math.hypot(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    ) / 2,
    DEGENERATE_RADIUS,
  );

/**
 * Distance that fits one box under the narrower of the two fields.
 *
 * Fitting the wider field crops a tall subject out of a wide viewport, which is
 * the one framing failure nobody notices from a thumbnail.
 */
const subjectFitDistance = (props: {
  bounds: IAutoMovieSubjectBox;
  distanceFactor: number;
  fovDeg: number;
  aspect: number;
}): number => {
  if (props.fovDeg <= 0 || props.fovDeg >= 180)
    throw new RangeError(
      `Inspection lens field of view must be within (0, 180) degrees, not ${props.fovDeg}.`,
    );
  if (Number.isFinite(props.aspect) === false || props.aspect <= 0)
    throw new RangeError(
      `Inspection lens aspect must be finite and positive, not ${props.aspect}.`,
    );
  // The angle conversions deliberately mirror the viewer harness expression by
  // expression. Two agents naming one subject have to receive the same eye, and
  // "the same" here means bit-identical: a differently associated radian
  // conversion agrees to twelve decimals and still fails the equality that
  // proves the two instruments are one instrument.
  const verticalHalf = (props.fovDeg * (Math.PI / 180)) / 2;
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * props.aspect);
  return (
    (boxRadius(props.bounds) /
      Math.sin(Math.min(verticalHalf, horizontalHalf))) *
    props.distanceFactor
  );
};

/** Unit direction from the subject centre toward the inspection camera. */
const subjectViewDirection = (
  azimuthDeg: number,
  elevationDeg: number,
): IAutoMovieVector3 => {
  const azimuth = azimuthDeg * (Math.PI / 180);
  const elevation = elevationDeg * (Math.PI / 180);
  const horizontal = Math.cos(elevation);
  return {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation),
    z: Math.cos(azimuth) * horizontal,
  };
};

/** Signed whole degrees as a fixed-width label, so ids sort as they read. */
const degreeLabel = (degrees: number): string => {
  const rounded = Math.round(degrees);
  const magnitude = Math.abs(rounded).toString().padStart(3, "0");
  return rounded < 0 ? `n${magnitude}` : magnitude;
};

/** Whether the decoded raster shows anything at all. */
const hasVisiblePixelVariance = (png: PNG): boolean => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3]!;
    if (
      png.data[offset]! * currentAlpha !== first[0] ||
      png.data[offset + 1]! * currentAlpha !== first[1] ||
      png.data[offset + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};
