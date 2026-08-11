import {
  type IAutoMovieAcousticRequest,
  type IAutoMovieDialogueSpeakerBinding,
  type IAutoMovieDialogueVisemeTimeline,
  builtEnvironmentContainsPoint,
  deriveAutoMovieInteriorAcousticResponse,
  deriveProductionSoundPlan,
  joinAutoMovieDialogueVisemes,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieShotContract,
  IAutoMovieVector3,
} from "@automovie/interface";

import type { IAutoMovieProductionDialogueRuntime } from "./productionRuntimeState";
import type {
  IAutoMovieProductionAcousticBinding,
  IAutoMovieProductionAcousticStudy,
} from "./productionStudies";

export {
  currentProductionDialogueRuntime,
  installProductionDialogueRuntime,
  productionDialogueFrameForShotTime,
  productionDialogueRuntimeIdentity,
  type IAutoMovieProductionDialogueRuntime,
  type IAutoMovieProductionViewerRuntime,
} from "./productionRuntimeState";

/**
 * Build the production-selected sound plan and attach exact acoustic receipts.
 *
 * Every optional model and room join comes from a declaration. No path picks a
 * provider, propagation profile, room, study, mapping, or fallback response.
 */
export const deriveProductionRuntimeSoundPlan = (props: {
  timeline: IAutoMovieFilmTimeline;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  sound: IAutoMovieProductionDesign["sound"];
  acousticStudies: readonly IAutoMovieProductionAcousticStudy[];
  acousticBindings: readonly IAutoMovieProductionAcousticBinding[];
}): IAutoMovieProductionSoundPlan => {
  const plan = deriveProductionSoundPlan({
    timeline: props.timeline,
    contracts: props.contracts,
    compiled: props.compiled,
    ...(props.sound?.propagation === undefined
      ? {}
      : { propagationProfile: props.sound.propagation }),
    ...(props.sound?.acousticResponse === undefined
      ? {}
      : { acousticProfile: props.sound.acousticResponse }),
  });
  const profile = props.sound?.acousticResponse;
  if (profile === undefined) {
    if (props.acousticBindings.length !== 0)
      throw new Error(
        "Production acoustic event bindings require an explicitly selected acoustic response profile.",
      );
    return plan;
  }

  const studies = uniqueBy(
    props.acousticStudies,
    (study) => study.id,
    "production acoustic study",
  );
  const bindings = uniqueBy(
    props.acousticBindings,
    (binding) => binding.event,
    "production acoustic event binding",
  );
  for (const event of plan.events) {
    const binding = bindings.get(event.id);
    if (binding === undefined)
      throw new Error(
        `Sound occurrence "${event.id}" has a selected acoustic profile but no explicit room binding.`,
      );
    bindings.delete(event.id);
    const compiled = props.compiled.get(event.shot);
    if (compiled === undefined)
      throw new Error(
        `Sound occurrence "${event.id}" has no current compiled shot.`,
      );
    validateDeclaredSpace(
      compiled,
      binding.sourceSpace,
      event.emitter,
      `${event.id} emitter`,
    );
    validateDeclaredSpace(
      compiled,
      binding.listenerSpace,
      event.listener,
      `${event.id} listener`,
    );
    const study =
      binding.study === null ? null : (studies.get(binding.study) ?? null);
    if (binding.study !== null && study === null)
      throw new Error(
        `Sound occurrence "${event.id}" selects missing acoustic study "${binding.study}".`,
      );
    if (
      binding.sourceSpace === null &&
      binding.listenerSpace === null &&
      study !== null
    )
      throw new Error(
        `Outdoor sound occurrence "${event.id}" must not select a room study.`,
      );
    if (
      (binding.sourceSpace !== null || binding.listenerSpace !== null) &&
      study === null
    )
      throw new Error(
        `Indoor sound occurrence "${event.id}" must select one declared acoustic study.`,
      );
    const request =
      study === null
        ? null
        : currentAcousticRequest({
            event: event.id,
            inputRevision: plan.inputFingerprint,
            listener: event.listener,
            source: event.emitter,
            sourceSpace: binding.sourceSpace,
            study,
          });
    event.acousticResponse = deriveAutoMovieInteriorAcousticResponse({
      sourceSpace: binding.sourceSpace,
      listenerSpace: binding.listenerSpace,
      inputRevision: plan.inputFingerprint,
      request,
      profile,
    });
  }
  if (bindings.size !== 0)
    throw new Error(
      `Acoustic bindings name absent sound occurrences: ${[...bindings.keys()].join(", ")}.`,
    );
  return plan;
};

/** Join final-byte visemes to only the speaker mappings the production wrote. */
export const compileProductionDialogueRuntime = (props: {
  plan: IAutoMovieProductionSoundPlan;
  timeline: IAutoMovieFilmTimeline;
  receipts: readonly IAutoMovieProductionTtsReceipt[];
  bindings: readonly IAutoMovieDialogueSpeakerBinding[];
}): IAutoMovieProductionDialogueRuntime => {
  const lines = uniqueBy(
    props.plan.dialogue,
    (line) => line.id,
    "dialogue line",
  );
  const receipts = uniqueBy(
    props.receipts,
    (receipt) => receipt.line,
    "dialogue receipt",
  );
  const joined: IAutoMovieProductionTtsReceipt[] = [];
  const timelines: IAutoMovieDialogueVisemeTimeline[] = [];
  for (const line of props.plan.dialogue) {
    const receipt = receipts.get(line.id);
    if (receipt === undefined)
      throw new Error(
        `Dialogue line "${line.id}" has no final-byte synthesis receipt.`,
      );
    receipts.delete(line.id);
    const compiled = joinAutoMovieDialogueVisemes({
      line,
      bindings: props.bindings,
      visemes: receipt.visemes,
    });
    joined.push({ ...receipt, lipSync: compiled.join });
    if (compiled.timeline !== null) timelines.push(compiled.timeline);
  }
  if (receipts.size !== 0)
    throw new Error(
      `Dialogue receipts name absent plan lines: ${[...receipts.keys()].join(", ")}.`,
    );
  assertDialogueTimelineSeparation(timelines);
  // Reading this map is intentional: `uniqueBy` proves plan lines are unique
  // before the ordered loop above creates a runtime whose lookup is unambiguous.
  void lines;
  return {
    version: 1,
    inputFingerprint: props.plan.inputFingerprint,
    fps: props.plan.fps,
    segments: props.timeline.segments.map((segment) => ({
      shot: segment.shot,
      startFrame: segment.startFrame,
      endFrame: segment.endFrame,
      sourceInFrame: segment.sourceInFrame,
      sourceOutFrame: segment.sourceOutFrame,
    })),
    receipts: joined,
    timelines,
  };
};

/** Refuse two authored lines that would compete for one actor mouth. */
const assertDialogueTimelineSeparation = (
  timelines: readonly IAutoMovieDialogueVisemeTimeline[],
): void => {
  const byActor = new Map<string, IAutoMovieDialogueVisemeTimeline[]>();
  for (const timeline of timelines) {
    const actor = byActor.get(timeline.actor) ?? [];
    actor.push(timeline);
    byActor.set(timeline.actor, actor);
  }
  for (const [actor, actorTimelines] of byActor) {
    const ordered = [...actorTimelines].sort(
      (left, right) =>
        left.ranges[0]!.startFrame - right.ranges[0]!.startFrame ||
        (left.line < right.line ? -1 : left.line > right.line ? 1 : 0),
    );
    for (let index = 1; index < ordered.length; ++index) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      if (
        current.ranges[0]!.startFrame <
        previous.ranges[previous.ranges.length - 1]!.endFrame
      )
        throw new Error(
          `Dialogue lines "${previous.line}" and "${current.line}" overlap on actor "${actor}".`,
        );
    }
  }
};

const currentAcousticRequest = (props: {
  event: string;
  inputRevision: AutoMovieContentDigest;
  listener: IAutoMovieVector3;
  source: IAutoMovieVector3;
  sourceSpace: string | null;
  study: IAutoMovieProductionAcousticStudy;
}): IAutoMovieAcousticRequest => {
  const request = props.study.request;
  if (props.sourceSpace === null || request.subject !== props.sourceSpace)
    throw new Error(
      `Acoustic study "${props.study.id}" does not answer the declared source room for "${props.event}".`,
    );
  if (
    request.sources.length !== 1 ||
    request.receivers.length !== 1 ||
    vectorEqual(request.sources[0]!.position, props.source) === false ||
    vectorEqual(request.receivers[0]!.position, props.listener) === false
  )
    throw new Error(
      `Acoustic study "${props.study.id}" must declare the exact one source and listener positions of "${props.event}".`,
    );
  return {
    ...request,
    id: `${props.study.id}:${props.event}`,
    inputRevision: props.inputRevision,
  };
};

const validateDeclaredSpace = (
  compiled: IAutoMovieCompiledShotSource,
  space: string | null,
  point: IAutoMovieVector3,
  label: string,
): void => {
  if (space === null) {
    const containing = (compiled.builtEnvironments ?? []).flatMap(
      (environment) =>
        environment.spaces.filter((candidate) =>
          builtEnvironmentContainsPoint(environment, candidate.id, point),
        ),
    );
    if (containing.length !== 0)
      throw new Error(
        `${label} is declared outdoors but lies in authored space(s) ${containing.map((item) => item.id).join(", ")}.`,
      );
    return;
  }
  const owners = (compiled.builtEnvironments ?? []).filter((environment) =>
    environment.spaces.some((candidate) => candidate.id === space),
  );
  if (owners.length !== 1)
    throw new Error(
      `${label} space "${space}" must resolve in exactly one staged built environment.`,
    );
  if (builtEnvironmentContainsPoint(owners[0]!, space, point) === false)
    throw new Error(`${label} does not lie in declared space "${space}".`);
};

const uniqueBy = <Value>(
  values: readonly Value[],
  key: (value: Value) => string,
  label: string,
): Map<string, Value> => {
  const output = new Map<string, Value>();
  for (const value of values) {
    const id = key(value);
    if (id.trim().length === 0 || output.has(id))
      throw new Error(`${label} ids must be non-blank and unique`);
    output.set(id, value);
  }
  return output;
};

const vectorEqual = (
  left: IAutoMovieVector3,
  right: IAutoMovieVector3,
): boolean => left.x === right.x && left.y === right.y && left.z === right.z;
