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
import { projectToNdc, resolveCameraAt } from "./cameraProjection";

/** Derive and validate contract outcomes from actual compiled artifacts. */
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
    "width" | "height"
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
        "must resolve and project every required subject root inside current camera depth and frame bounds",
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
    // Shot source owns choreography but not promoted hero nodes. The MCP
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
  for (const subject of props.contract.camera.requiredSubjects)
    try {
      const point = props.formations.has(subject)
        ? resolveSpatial(props, { kind: "formation", id: subject }, time)
        : resolveSpatial(props, { kind: "node", id: subject }, time);
      ++resolvedSubjects;
      const projection = projectToNdc(resolvedCamera, point, halfY, aspect);
      if (
        projection.depth >= camera.near &&
        projection.depth <= camera.far &&
        Math.abs(projection.ndcX) <= 1 &&
        Math.abs(projection.ndcY) <= 1
      )
        ++readableSubjects;
    } catch {}
  return {
    time,
    requiredSubjects: props.contract.camera.requiredSubjects.length,
    resolvedSubjects,
    readableSubjects,
    passed:
      resolvedSubjects === props.contract.camera.requiredSubjects.length &&
      readableSubjects === props.contract.camera.requiredSubjects.length,
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
