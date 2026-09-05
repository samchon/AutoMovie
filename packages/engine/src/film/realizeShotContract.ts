import {
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledPredicateResult,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieShotSourceOutput,
  IAutoMovieShotSpatialSelector,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { sampleFormationMotion, transformFormationPoint } from "../formation";
import { Quaternion } from "../math/Quaternion";
import { sampleMotion } from "../motion/sampleMotion";
import { productionRuntimeModelId } from "../productionIdentity";
import { sampleClipSequence } from "../resolve/sampleClip";
import { evaluateAutoMovieCameraDepthPrecision } from "./cameraDepthPrecision";
import { computeModelRestExtent, computeRestHeight } from "./cameraMove";
import {
  intersectsPerspectiveFrustumBox,
  projectToNdc,
  resolveCameraAt,
} from "./cameraProjection";
import {
  IAutoMovieSubjectBox,
  formationMemberExtent,
  formationSubjectBox,
  nodeSubjectBox,
  nodeSubjectExtent,
} from "./subjectExtent";

/**
 * Derive and validate contract outcomes from actual compiled artifacts.
 *
 * @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-delivery-acceptance realizeShotContract makes delivery acceptance measurable: Derive and validate contract outcomes from actual compiled artifacts.
 * @evidence requirements/story/beats-and-causality.md#story-semantic-event-identity Joins each authored contract event id to exactly one compiled event sample and preserves that identity in the realization outcome independently of frame or shot traversal.
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-observability Evaluates only typed compiled predicates over current state, event, camera, actor, and formation facts; it does not infer an unobservable inner state from prose.
 * @evidence requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance Gives every opening, closing, event, camera, actor, and formation check an addressed subject, sample time, measured condition, and explicit failure result.
 * @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-judgment-measurement Restricts automatic outcomes to structural and numeric facts from compiled artifacts and does not claim clarity, emotion, theme, or audience approval.
 * @evidence requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance Separately records typed scene-boundary states, realized semantic events, and camera-required subjects instead of promoting one passing cue into whole-story acceptance.
 * @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-blocking-pass Checks the blocking-pass structural invariants it can measure—subject identity, placement state, motion, event time, and coarse camera framing—without claiming final fidelity.
 * @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-prototype-instance Distinguishes compact anonymous formation slots from promoted hero actor instances when validating the compiled subject realization.
 * @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-hero-background Verifies declared formation population counts and exact promoted hero nodes while leaving anonymous background members represented by compact chunks.
 * @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-review-times Samples the declared opening, every authored review frame, and the closing time from the compiled shot rather than inferring review instants from edit order.
 * @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-contract-refusal Returns addressed diagnostics when required events, actors, formations, camera subjects, or typed opening and closing predicates fail their compiled-artifact checks.
 * @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-subject-deliveries Requires actor participants to have both a staged node and performance, verifies formation materialization, and tests every camera-required subject.
 * @evidence requirements/staging/visibility-and-readability.md#staging-readability-acceptance Treats a required subject as readable only when its current world box intersects the realized camera's closed frustum; it does not claim contrast, duration, reveal, or priority evaluation.
 * @evidence requirements/staging/visibility-and-readability.md#staging-visibility-time-sampling Recomputes the moving camera and each required subject bound at the opening, every declared review instant, and closing instead of reusing one visibility result.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Tests each required subject's current world box against the realized camera's declared near and far planes at the contract sample time.
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-range Evaluates required subject bounds through resolved camera motion at every camera-contract sample rather than accepting one opening frame.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-contract-realization-acceptance-status realizeShotContract samples the compiled scene, motion, and camera facts needed to return an explicit outcome for each authored delivery predicate.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-semantic-event-occurrence Preserves authored semantic event ids while binding each one to its single current compiled occurrence and sampled predicate outcome.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-scene-dependency-refusal Makes observable compiled state and event predicates fail when their addressed subject or sample is absent instead of accepting narrative prose.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-criterion-cases Produces a mechanical pass/fail boundary for each typed contract criterion at its declared subject and time.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-human-machine-verdict Keeps structural event, state, camera, actor, and formation measurements distinct from any human narrative judgment.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-review-surfaces Returns one shot-contract surface of scene states, events, and camera delivery facts without claiming sequence or film acceptance.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-blocking-pass-invariants Validates only reproducible blocking structure and coarse framing facts, never photoreal finish or detailed likeness.
 * @evidence specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-subject-prototype-role Preserves the distinction between compact formation slots, anonymous members, and explicitly promoted hero instances in the realization result.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-visibility-reveal-readability Applies automatic coarse framing acceptance to current subject boxes at declared contract times; it does not evaluate occlusion, contrast, reveal, or readable duration.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Applies exact current-bound frustum clipping at the addressed contract time against an empty optional plane set, because an authored camera declares no section plane and a cut view is never delivery evidence; it does not evaluate camera clearance or swept geometry.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-interval-crop Evaluates the live subject bound at each addressed contract time; it does not claim crop intent, interval extrema, or swept visibility between samples.
 */
export const realizeShotContract = (props: {
  contract: IAutoMovieShotContract;
  /**
   * Full production design for compiler-materialized output. `null` marks the
   * direct source-stage pass, before compiler-owned formation heroes exist.
   */
  production: IAutoMovieProductionDesign | null;
  /** Direct authoring raster when no production design object exists. */
  frameFormat?: Pick<
    IAutoMovieProductionDesign["frameFormat"],
    "crop" | "width" | "height"
  >;
  world: IAutoMovieWorldDesign | null;
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  compiled: IAutoMovieShotSourceOutput &
    Partial<
      Pick<IAutoMovieCompiledShotSource, "models" | "formations" | "effects">
    >;
  /** Direct authoring rig lookup when compiler-owned models are not attached. */
  skeleton?: (node: string) => IAutoMovieSkeleton | null;
  collisions: readonly string[];
}): {
  realization: IAutoMovieCompiledContractRealization;
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push({
      code: "contract-realization-failed",
      category: "error",
      phase: "compile",
      target: `shot:${props.contract.id}`,
      path: null,
      message: `${field} ${expectation}. Correct the actual scene, motion, camera, or source event sample; contract prose and echoed ids are not evidence.`,
    });
  };
  for (const node of props.collisions)
    fail(
      `formation slot "${node}"`,
      "collides with a coding-agent scene node; ordinary formation slots are compiler-owned",
    );

  const opening = props.contract.opening.map((state) => {
    const predicates = state.predicates.map((predicate) =>
      evaluatePredicate(props, predicate, 0),
    );
    const passed = predicates.every((predicate) => predicate.passed);
    if (passed === false)
      fail(
        `opening state "${state.id}"`,
        "must satisfy every typed predicate at time 0",
      );
    return { id: state.id, predicates, passed };
  });
  const closing = props.contract.closing.map((state) => {
    const predicates = state.predicates.map((predicate) =>
      evaluatePredicate(props, predicate, props.contract.durationSeconds),
    );
    const passed = predicates.every((predicate) => predicate.passed);
    if (passed === false)
      fail(
        `closing state "${state.id}"`,
        `must satisfy every typed predicate at ${props.contract.durationSeconds}s`,
      );
    return { id: state.id, predicates, passed };
  });

  const samples = new Map(
    props.compiled.eventSamples.map((sample) => [sample.id, sample]),
  );
  if (
    samples.size !== props.compiled.eventSamples.length ||
    samples.size !== props.contract.events.length
  )
    fail("eventSamples", "must name every authoritative event exactly once");
  const events = props.contract.events.map((event) => {
    const sample = samples.get(event.id);
    const time = sample?.time ?? event.window.from;
    const subjectsResolved = event.subjects.every((subject) =>
      eventSubjectResolves(props, subject),
    );
    const predicates = event.predicates.map((predicate) =>
      evaluatePredicate(props, predicate, time),
    );
    const passed =
      sample !== undefined &&
      subjectsResolved &&
      Number.isFinite(time) &&
      time >= event.window.from &&
      time <= event.window.to &&
      predicates.every((predicate) => predicate.passed);
    if (passed === false)
      fail(
        `event "${event.id}"`,
        `must resolve every declared subject and have one finite source sample inside ${event.window.from}..${event.window.to}s whose typed predicates all pass`,
      );
    return { id: event.id, time, predicates, passed };
  });

  const cameraTimes = [
    0,
    ...props.contract.reviewFrames.map((frame) => frame.time),
    props.contract.durationSeconds,
  ]
    .filter((time, index, values) => values.indexOf(time) === index)
    .sort((left, right) => left - right);
  const camera = cameraTimes.map((time) => cameraOutcome(props, time));
  for (const outcome of camera)
    if (outcome.passed === false)
      fail(
        `camera at ${outcome.time}s`,
        "must resolve every required subject bound inside the current camera frame and clipping range with the declared depth precision",
      );

  const formations = props.contract.participants.flatMap((participant) => {
    if (participant.kind !== "formation") return [];
    const design = props.formations.get(participant.id);
    const formation = (props.compiled.formations ?? []).find(
      (candidate) => candidate.id === participant.id,
    );
    const nodes = new Map(
      props.compiled.scene.nodes.map((node) => [node.id, node]),
    );
    const heroes =
      formation?.heroes.flatMap((hero) => {
        const node = nodes.get(hero.actor);
        return node === undefined ? [] : [{ hero, node }];
      }) ?? [];
    const compactPassed =
      design !== undefined &&
      formation !== undefined &&
      formation.count === design.count &&
      formation.anonymousCount + formation.heroes.length === design.count &&
      formation.chunks.reduce((sum, chunk) => sum + chunk.count, 0) ===
        design.count &&
      formation.chunks.every(
        (chunk, index) =>
          chunk.index === index &&
          chunk.start ===
            formation.chunks
              .slice(0, index)
              .reduce((sum, previous) => sum + previous.count, 0),
      );
    // Shot source owns choreography but not promoted hero nodes. The compiler
    // compiler adds or corrects those nodes only after compileDefinedShot has
    // returned its source, then invokes this realization again with the full
    // production. Requiring heroes during the direct/source pass makes that
    // materialization unreachable for every formation with an override.
    const materializedHeroesPassed =
      props.production === null ||
      (design !== undefined &&
        formation !== undefined &&
        heroes.length === formation.heroes.length &&
        heroes.every(({ hero, node }) => {
          return (
            vectorClose(
              node.transform.translation,
              hero.transform.translation,
            ) &&
            quaternionClose(node.transform.rotation, hero.transform.rotation) &&
            vectorClose(node.transform.scale, hero.transform.scale) &&
            node.model === productionRuntimeModelId(design.modelRecipe)
          );
        }));
    const passed = compactPassed && materializedHeroesPassed;
    if (passed === false)
      fail(
        `formation "${participant.id}"`,
        `must materialize one compact ${design?.count ?? 0}-slot runtime with contiguous chunks, designed bounds, and exact promoted hero nodes`,
      );
    return [
      {
        id: participant.id,
        count: formation?.count ?? 0,
        min: formation?.bounds.min ?? { x: 0, y: 0, z: 0 },
        max: formation?.bounds.max ?? { x: 0, y: 0, z: 0 },
        passed,
      },
    ];
  });

  for (const participant of props.contract.participants)
    if (participant.kind === "actor") {
      const node = props.compiled.scene.nodes.find(
        (candidate) => candidate.id === participant.id,
      );
      const performance = props.compiled.shot.performances.find(
        (candidate) => candidate.node === participant.id,
      );
      if (node === undefined || performance === undefined)
        fail(
          `actor "${participant.id}"`,
          "must be a current performed scene node",
        );
    }

  return {
    realization: {
      version: 1,
      shot: props.contract.id,
      opening,
      closing,
      events,
      camera,
      formations,
    },
    diagnostics,
  };
};

const eventSubjectResolves = (
  props: Parameters<typeof realizeShotContract>[0],
  subject: string,
): boolean => {
  if (props.compiled.scene.nodes.some((candidate) => candidate.id === subject))
    return true;
  if (
    (props.compiled.formations ?? []).some(
      (formation) => formation.id === subject,
    )
  )
    return true;
  return false;
};

const evaluatePredicate = (
  props: Parameters<typeof realizeShotContract>[0],
  predicate: IAutoMovieShotPredicate,
  time: number,
): IAutoMovieCompiledPredicateResult => {
  let actual: number | null = null;
  try {
    if (predicate.kind === "joint-angle") {
      const node = props.compiled.scene.nodes.find(
        (candidate) => candidate.id === predicate.actor,
      );
      if (node === undefined)
        throw new Error(`node "${predicate.actor}" is absent`);
      const skeleton = skeletonOf(props, node);
      if (
        skeleton === null ||
        skeleton.bones.some((bone) => bone.bone === predicate.bone) === false
      )
        throw new Error(
          `node "${predicate.actor}" has no bone "${predicate.bone}"`,
        );
      const pose = actorPoseAt(props, node, time);
      const joint = pose.joints.find((item) => item.bone === predicate.bone);
      actual = joint?.[predicate.axis] ?? 0;
    } else if (predicate.kind === "position")
      actual = resolveSpatial(props, predicate.subject, time)[predicate.axis];
    else {
      const from = resolveSpatial(props, predicate.from, time);
      const to = resolveSpatial(props, predicate.to, time);
      actual = Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);
    }
  } catch {
    actual = null;
  }
  return {
    predicate,
    actual,
    passed:
      actual !== null &&
      scalarPass(
        actual,
        predicate.operator,
        predicate.value,
        predicate.tolerance,
      ),
  };
};

const scalarPass = (
  actual: number,
  operator: "<=" | ">=" | "==",
  expected: number,
  tolerance: number,
): boolean =>
  operator === "=="
    ? Math.abs(actual - expected) <= tolerance
    : operator === "<="
      ? actual <= expected + tolerance
      : actual >= expected - tolerance;

const resolveSpatial = (
  props: Parameters<typeof realizeShotContract>[0],
  selector: IAutoMovieShotSpatialSelector,
  time: number,
): IAutoMovieVector3 => {
  if (selector.kind === "point") return selector.position;
  if (selector.kind === "landmark") {
    const landmark = props.world?.landmarks.find(
      (candidate) => candidate.id === selector.id,
    );
    if (landmark === undefined)
      throw new Error(`landmark "${selector.id}" is absent`);
    return landmark.position;
  }
  if (selector.kind === "node")
    return actorTransformAt(props, selector.id, time).translation;
  const formation = (props.compiled.formations ?? []).find(
    (candidate) => candidate.id === selector.id,
  );
  if (formation === undefined)
    throw new Error(`formation "${selector.id}" has no slots`);
  return transformFormationPoint(
    formation.centroid,
    formation.anchor,
    sampleFormationMotion(
      props.compiled.formationMotions ?? [],
      formation.id,
      time,
    ),
    formation.facingDeg,
  );
};

/**
 * The model-space box the camera solve assumed for a required NODE subject, so
 * the readability test and the framing that produced the shot share one
 * subject.
 *
 * `performShot`'s `nodeExtent` builds each `IAutoMovieFramedSubject` from the
 * same read through the same {@link nodeSubjectExtent}: a node is measured from
 * the geometry its model draws, its rig's joint span stands in when no model
 * was supplied, and a rig too small to measure takes `DEFAULT_SUBJECT_HEIGHT`.
 * Reading it back the same way is what makes the check honest. Measuring here
 * while the solve assumed a default would frame one subject and grade another.
 *
 * **The floor is part of that reading, not a detail of it.** A model's rest
 * extent is measured in MODEL space, so `min` states where the geometry starts
 * relative to the node's own origin, and it is only zero for a figure that
 * stands on its origin. The solve raises the framed base by it — a canopy whose
 * deck is authored 8 m above its element origin is framed at 8 m — so a grade
 * that placed the same span at the origin would test a segment 8 m below
 * everything the camera was aimed at. That is not a stricter check but an
 * unsatisfiable one: on the fixture `test_film_camera_node_subject_floor` pins,
 * `full`, `medium` and `close` all put the deck squarely in frame while the
 * origin-based segment fell outside it, and no camera the author could write
 * would have passed, because moving down to catch the segment moves the deck
 * out.
 *
 * **So is the width.** The same measurement states what the subject fills
 * horizontally, and the solve aims at the middle of that and stands back for
 * it, so the grade reads the same box: a 60 m facade authored outward from its
 * element origin is tested on `x 0…60, z −1…1` about its own centre rather than
 * as a pole 30 m away from it.
 *
 * A formation does not come through here. Its extent is its own transformed
 * bounds ({@link formationSubjectBox}), measured from where its members stand
 * rather than from one model's rest geometry.
 */
const framedSubjectExtent = (
  props: Parameters<typeof realizeShotContract>[0],
  subject: string,
): IAutoMovieSubjectBox => {
  const node = props.compiled.scene.nodes.find(
    (candidate) => candidate.id === subject,
  );
  const model =
    node === undefined
      ? undefined
      : (props.compiled.models ?? []).find(
          (candidate) => candidate.id === node.model,
        );
  const extent = model === undefined ? null : computeModelRestExtent(model);
  const rig = node === undefined ? null : skeletonOf(props, node);
  // A rig span and the stand-in are both measured from the placement itself:
  // neither states a floor or a width, so neither may invent one.
  return nodeSubjectExtent(
    extent,
    rig === null ? null : computeRestHeight(rig),
  );
};

/**
 * The world box a required subject occupies at `time`, given the placement it
 * already resolved to.
 *
 * The two kinds of subject are measured the way the camera solve measured them.
 * A node is its drawn model-space box ({@link framedSubjectExtent}) carried out
 * through its resolved placement by {@link nodeSubjectBox} — the same function,
 * on the same extent, that `performShot` framed it from. A formation is its
 * whole transformed footprint, widened by a member's radius and raised by a
 * member's height, so a unit reads when the frame holds any part of it — its
 * flank, its front rank, or one wing of a line the frame cannot possibly
 * contain whole.
 *
 * **A node's horizontal span is what the solve assumed, not an independent
 * opinion about the subject.** The two sides move together on purpose: grading
 * a 60 m facade on its true box while the solve still aimed at its element
 * origin would refuse shots no authored camera could satisfy, and framing it on
 * that box while the grade still tested a pole would report a passing shot the
 * frame does not hold. Both now read the drawn box, so a `frame` action on a
 * building element aims at the middle of the mass and stands back for its
 * width, and this check tests the mass it aimed at. A node with nothing to
 * measure keeps the horizontally degenerate segment it always had, because a
 * rig span and the stand-in height state no width.
 */
const framedSubjectBox = (
  props: Parameters<typeof realizeShotContract>[0],
  subject: string,
  placement: IAutoMovieTransform,
  time: number,
): IAutoMovieSubjectBox => {
  const formation = props.formations.has(subject)
    ? (props.compiled.formations ?? []).find(
        (candidate) => candidate.id === subject,
      )
    : undefined;
  return formation === undefined
    ? nodeSubjectBox(placement, framedSubjectExtent(props, subject))
    : formationSubjectBox({
        formation,
        motions: props.compiled.formationMotions ?? [],
        member: formationMemberExtent(formation, props.compiled.models),
        seconds: time,
      });
};

const cameraOutcome = (
  props: Parameters<typeof realizeShotContract>[0],
  time: number,
): IAutoMovieCompiledContractRealization["camera"][number] => {
  const camera = props.compiled.scene.cameras.find(
    (candidate) => candidate.id === props.compiled.shot.camera,
  );
  const frameFormat = props.production?.frameFormat ?? props.frameFormat;
  if (camera === undefined || frameFormat === undefined)
    return {
      time,
      depthPrecision: evaluateAutoMovieCameraDepthPrecision({
        camera: props.compiled.shot.camera,
        time,
        near: Number.NaN,
        far: Number.NaN,
        requiredNear: Number.NaN,
        requiredFar: Number.NaN,
        constraint: {
          minimumDepthBits: Number.NaN,
          maximumStepMeters: Number.NaN,
        },
      }),
      requiredSubjects: props.contract.camera.requiredSubjects.length,
      resolvedSubjects: 0,
      readableSubjects: 0,
      passed: false,
    };
  const resolvedCamera = resolveCameraAt(
    camera.transform,
    props.compiled.shot.cameraMotion,
    camera.id,
    time,
  );
  const halfY = Math.tan((camera.fovY * Math.PI) / 360);
  const aspect = frameFormat.width / frameFormat.height;
  let resolvedSubjects = 0;
  let readableSubjects = 0;
  let requiredNear = Number.POSITIVE_INFINITY;
  let requiredFar = Number.NEGATIVE_INFINITY;
  for (const subject of props.contract.camera.requiredSubjects)
    try {
      // A node subject carries its orientation as well as its root: a yawed
      // element fills a different world box than the same geometry facing down
      // an axis, and the solve framed it from the same placement. A formation
      // resolves to a point and states its own transformed bounds, so it needs
      // no placement of its own; the identity here is never read.
      const placement: IAutoMovieTransform = props.formations.has(subject)
        ? {
            translation: resolveSpatial(
              props,
              { kind: "formation", id: subject },
              time,
            ),
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          }
        : actorTransformAt(props, subject, time);
      ++resolvedSubjects;
      const box = framedSubjectBox(props, subject, placement, time);
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const depth = projectToNdc(
              resolvedCamera,
              { x, y, z },
              halfY,
              aspect,
              frameFormat.crop,
            ).depth;
            requiredNear = Math.min(requiredNear, depth);
            requiredFar = Math.max(requiredFar, depth);
          }
      if (
        intersectsPerspectiveFrustumBox({
          camera: resolvedCamera,
          min: box.min,
          max: box.max,
          near: camera.near,
          far: camera.far,
          halfY,
          aspect,
          crop: frameFormat.crop,
        })
      )
        ++readableSubjects;
    } catch {}
  const depthPrecision = evaluateAutoMovieCameraDepthPrecision({
    camera: camera.id,
    time,
    near: camera.near,
    far: camera.far,
    requiredNear: resolvedSubjects === 0 ? Number.NaN : requiredNear,
    requiredFar: resolvedSubjects === 0 ? Number.NaN : requiredFar,
    constraint: camera.depthPrecision,
  });
  return {
    time,
    // State the camera this sample actually measured whenever a compiled move
    // means the staged transform is no longer it. `compileCameraMove` keeps the
    // staged bearing and solves the distance from the framing, so a camera
    // staged for a wide exterior can be pulled to a few metres from its subject
    // while every static fact in the artifact still reads as authored. A shot
    // with no `frame` action compiles no move, so its record keeps exactly the
    // bytes it always had.
    ...(props.compiled.shot.cameraMotion === null
      ? {}
      : {
          placement: {
            // Copy rather than alias. `resolveCameraAt` hands back the staged
            // transform's own vectors component-wise when a track is absent,
            // and this record exists to be a fact separate from that transform.
            position: { ...resolvedCamera.position },
            rotation: { ...resolvedCamera.rotation },
          },
        }),
    depthPrecision,
    requiredSubjects: props.contract.camera.requiredSubjects.length,
    resolvedSubjects,
    readableSubjects,
    passed:
      resolvedSubjects === props.contract.camera.requiredSubjects.length &&
      readableSubjects === props.contract.camera.requiredSubjects.length &&
      depthPrecision.passed,
  };
};

const actorPoseAt = (
  props: Parameters<typeof realizeShotContract>[0],
  node: IAutoMovieShotSourceOutput["scene"]["nodes"][number],
  time: number,
): ReturnType<typeof sampleMotion>["pose"] => {
  const compiled = props.compiled;
  const performance = compiled.shot.performances.find(
    (candidate) => candidate.node === node.id,
  );
  const skeleton = skeletonOf(props, node);
  if (skeleton === null) throw new Error(`node "${node.id}" has no skeleton`);
  const motionId = performance === undefined ? node.motion : performance.motion;
  if (motionId === null)
    return (
      node.pose ?? {
        skeleton: skeleton.id,
        root: null,
        joints: [],
      }
    );
  const motion = compiled.motions.find(
    (candidate) => candidate.id === motionId,
  );
  if (motion === undefined) throw new Error(`motion "${motionId}" is absent`);
  return sampleMotion(
    motion,
    performance === undefined
      ? time
      : Math.max(0, time - performance.startOffset),
  ).pose;
};

const actorTransformAt = (
  props: Parameters<typeof realizeShotContract>[0],
  actor: string,
  time: number,
): IAutoMovieTransform => {
  const compiled = props.compiled;
  const node = compiled.scene.nodes.find((candidate) => candidate.id === actor);
  if (node === undefined) throw new Error(`node "${actor}" is absent`);
  const skeleton = skeletonOf(props, node);
  const pose = skeleton === null ? null : actorPoseAt(props, node, time);
  const sampled = sampleClipSequence(compiled.shot.objectMotions, time);
  const translation = sampled.get(`node:${actor}:translation`)?.value;
  const rotation = sampled.get(`node:${actor}:rotation`)?.value;
  const scale = sampled.get(`node:${actor}:scale`)?.value;
  const nodeTransform: IAutoMovieTransform = {
    translation:
      translation === undefined
        ? node.transform.translation
        : {
            x: translation[0]!,
            y: translation[1]!,
            z: translation[2]!,
          },
    rotation:
      rotation === undefined
        ? node.transform.rotation
        : {
            x: rotation[0]!,
            y: rotation[1]!,
            z: rotation[2]!,
            w: rotation[3]!,
          },
    scale:
      scale === undefined
        ? node.transform.scale
        : { x: scale[0]!, y: scale[1]!, z: scale[2]! },
  };
  return pose?.root === null || pose === null
    ? nodeTransform
    : composeTransforms(nodeTransform, {
        ...pose.root,
        // Engine FK and the viewer both treat pose-root scale as identity.
        scale: { x: 1, y: 1, z: 1 },
      });
};

const skeletonOf = (
  props: Parameters<typeof realizeShotContract>[0],
  node: IAutoMovieShotSourceOutput["scene"]["nodes"][number],
): IAutoMovieSkeleton | null => {
  const model = (props.compiled.models ?? []).find(
    (candidate) => candidate.id === node.model,
  );
  return model === undefined
    ? (props.skeleton?.(node.id) ?? null)
    : model.skeleton;
};

const composeTransforms = (
  parent: IAutoMovieTransform,
  child: IAutoMovieTransform,
): IAutoMovieTransform => {
  const rotated = Quaternion.rotateVector(parent.rotation, {
    x: child.translation.x * parent.scale.x,
    y: child.translation.y * parent.scale.y,
    z: child.translation.z * parent.scale.z,
  });
  return {
    translation: {
      x: parent.translation.x + rotated.x,
      y: parent.translation.y + rotated.y,
      z: parent.translation.z + rotated.z,
    },
    rotation: Quaternion.multiply(parent.rotation, child.rotation),
    scale: {
      x: parent.scale.x * child.scale.x,
      y: parent.scale.y * child.scale.y,
      z: parent.scale.z * child.scale.z,
    },
  };
};

const vectorClose = (
  left: IAutoMovieVector3,
  right: IAutoMovieVector3,
): boolean =>
  Math.abs(left.x - right.x) <= 1e-9 &&
  Math.abs(left.y - right.y) <= 1e-9 &&
  Math.abs(left.z - right.z) <= 1e-9;

const quaternionClose = (
  left: IAutoMovieTransform["rotation"],
  right: IAutoMovieTransform["rotation"],
): boolean =>
  Math.abs(
    Math.abs(
      left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w,
    ) - 1,
  ) <= 1e-9;
