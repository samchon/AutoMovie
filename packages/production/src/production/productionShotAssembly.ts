import {
  type IAutoMovieCameraClearanceRuntime,
  compileDefinedShot,
  defineShot,
  formationSlot,
  inheritProductionLighting,
  makeActorSynthesizer,
  worldGroundHeight,
} from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieDiagnostic,
  IAutoMovieFilmEdit,
  IAutoMovieProductionDesign,
  IAutoMovieProductionShotProgram,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotBuildContext,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieVector3,
  IAutoMovieVideoEdit,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import typia from "typia";

import { materializeInstanceSlot } from "./materializeProduction";
import { boundFolds } from "./productionEnvironmentValidation";
import {
  IProductionExternalMotionAdoption,
  IProductionExternalMotionConversionDraft,
  resolveExternalMotionClips,
} from "./productionExternalMotion";
import {
  actorRuntimeOf,
  contractOfRegistration,
  sourceRuntimeOf,
} from "./productionShotRuntime";
import { buildSourceExport } from "./productionSourceBuild";

interface IShotAssemblyProps {
  id: string;
  path: string;
  exportName: string;
  source: string;
  /** Reader for project source this shot imports. */
  sourceRoot: string;
  context: {
    contract: IAutoMovieShotContract;
    models: IAutoMovieShotBuildContext["models"];
    derivedArtifacts: IAutoMovieShotBuildContext["derivedArtifacts"];
    lighting: IAutoMovieShotBuildContext["lighting"];
    world: IAutoMovieWorldDesign;
    formations: IAutoMovieShotBuildContext["formations"];
    runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
    formationRuntime: IAutoMovieShotBuildContext["formationRuntime"];
    instanceSetRuntime: IAutoMovieShotBuildContext["instanceSetRuntime"];
    externalMotions: readonly IProductionExternalMotionAdoption[];
    frameFormat: Pick<
      IAutoMovieProductionDesign["frameFormat"],
      "width" | "height"
    >;
  };
  /** Compiler-owned snapshot and fixed clock; never exposed to shot source. */
  cameraClearance: IAutoMovieCameraClearanceRuntime;
  /** Prior full-shot closing state at the authoritative hard-cut boundary. */
  previous: IAutoMovieBeatEndState | null;
}

interface IShotAssemblyResult {
  value: IAutoMovieShotSourceOutput | null;
  /** Closing state available to the next full hard-cut shot, on success. */
  closing: IAutoMovieBeatEndState | null;
  conversions: IProductionExternalMotionConversionDraft[];
  diagnostics: IAutoMovieDiagnostic[];
}

/** One unique shot in authoritative film order, or an unplaced graph remainder. */
interface IShotAssemblyEntry {
  id: string;
  contract: IAutoMovieShotContract;
  placement: IAutoMovieVideoEdit | null;
  placementIndex: number | null;
}

/** The immediately preceding placed shot and its successfully measured closing. */
export interface ICompiledVideoClosing extends IShotAssemblyEntry {
  placement: IAutoMovieVideoEdit;
  placementIndex: number;
  closing: IAutoMovieBeatEndState | null;
}

/** Resolve one shot contract's screenplay or direct-brief H3 owner address. */
export const shotSourceOwnerTarget = (
  contract: IAutoMovieShotContract,
  screenplay: IAutoMovieScreenplayIndex | null,
): string | undefined => {
  if (screenplay === null) return undefined;
  const scenes = new Map(
    screenplay.screenplay.scenes.map((scene) => [scene.id, scene] as const),
  );
  const targets = [
    ...new Set(
      (contract.evidence ?? []).flatMap((citation) => {
        const scene = scenes.get(citation.scene);
        if (scene === undefined || scene.status !== "active") return [];
        return [
          `${scene.path ?? screenplay.screenplay.path}#${scene.id.toLowerCase()}`,
        ];
      }),
    ),
  ];
  return targets.length === 1 ? targets[0] : undefined;
};

/**
 * Compile placed shots in film order, then every remaining graph shot in its
 * stable design order so omitted/unaccounted sources keep their diagnostics.
 */
export const shotAssemblyOrder = (
  contracts: ReadonlyMap<string, IAutoMovieShotContract>,
  edit: IAutoMovieFilmEdit | null,
): IShotAssemblyEntry[] => {
  const ordered: IShotAssemblyEntry[] = [];
  const placed = new Set<string>();
  edit?.tracks.video.forEach((placement, placementIndex) => {
    const contract = contracts.get(placement.shot);
    if (contract === undefined || placed.has(placement.shot)) return;
    placed.add(placement.shot);
    ordered.push({
      id: placement.shot,
      contract,
      placement,
      placementIndex,
    });
  });
  for (const [id, contract] of contracts)
    if (placed.has(id) === false)
      ordered.push({ id, contract, placement: null, placementIndex: null });
  return ordered;
};

/** Resolve an authored film time only when it lies on the production clock. */
const resolvedFilmFrame = (
  time: IAutoMovieVideoEdit["sourceIn"],
  fps: number,
): number | null => {
  const raw = "frame" in time ? time.frame : time.seconds * fps;
  const rounded = Math.round(raw);
  return Number.isFinite(raw) &&
    Number.isSafeInteger(rounded) &&
    rounded >= 0 &&
    Math.abs(raw - rounded) <= Number.EPSILON * 64 * Math.max(1, Math.abs(raw))
    ? rounded
    : null;
};

/**
 * A full beat-end snapshot is authoritative only across adjacent hard cuts that
 * play the previous source through its end and start the next at frame 0.
 */
export const fullHardCutBoundary = (
  previous: ICompiledVideoClosing,
  current: IShotAssemblyEntry,
  fps: number,
): boolean => {
  if (current.placement === null || current.placementIndex === null)
    return false;
  const previousOut = resolvedFilmFrame(previous.placement.sourceOut, fps);
  const previousDuration = resolvedFilmFrame(
    { seconds: previous.contract.durationSeconds },
    fps,
  );
  return (
    current.placementIndex === previous.placementIndex + 1 &&
    previous.placement.transitionOut.kind === "cut" &&
    current.placement.transitionIn.kind === "cut" &&
    previousOut !== null &&
    previousOut === previousDuration &&
    resolvedFilmFrame(current.placement.sourceIn, fps) === 0
  );
};

export const assembleShotSource = (
  props: IShotAssemblyProps,
): IShotAssemblyResult => {
  const program = buildSourceExport({
    ...props,
    context: {
      ...structuredClone(props.context),
      engine: {
        distance: (left: IAutoMovieVector3, right: IAutoMovieVector3) =>
          Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z),
        groundHeight: (point: { x: number; z: number }) =>
          worldGroundHeight(props.context.world.surfaces, point) ?? 0,
        formationSlot: (id: string, slot: number) => {
          const formation = props.context.formationRuntime[id];
          if (formation === undefined)
            throw new RangeError(`Formation "${id}" is unavailable.`);
          return formationSlot(formation, slot);
        },
        instanceSlot: (id: string, slot: number) => {
          const instanceSet = props.context.instanceSetRuntime[id];
          if (instanceSet === undefined)
            throw new RangeError(`Instance set "${id}" is unavailable.`);
          return materializeInstanceSlot(
            instanceSet,
            props.context.world,
            slot,
          );
        },
      },
    },
    target: `shot:${props.id}`,
    label: "thin shot program",
    registration: {
      id: props.id,
      contract: contractOfRegistration(props.context.contract),
    },
    validate: (input) =>
      typia.validateEquals<IAutoMovieProductionShotProgram>(input),
  });
  if (program.value === null)
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: program.diagnostics,
    };

  const sourceRuntime = sourceRuntimeOf({
    program: program.value,
    runtimeModels: props.context.runtimeModels,
    target: `shot:${props.id}`,
    sourcePath: props.path,
  });
  const adoptedMotions = resolveExternalMotionClips({
    adoptions: props.context.externalMotions,
    program: program.value,
    runtimeModels: sourceRuntime.runtimeModels,
    target: `shot:${props.id}`,
    sourcePath: props.path,
  });
  const shotProgram: IAutoMovieProductionShotProgram = {
    ...program.value,
    clips: [...(program.value.clips ?? []), ...adoptedMotions.clips],
  };
  const runtime = actorRuntimeOf(
    shotProgram,
    sourceRuntime.runtimeModels,
    `shot:${props.id}`,
    props.path,
  );
  // Severity decides, not count. Both halves used to be counted because both
  // could only produce errors, and the moment one of them learned to warn, a
  // warning would have withheld the compiled shot while explaining nothing: the
  // author would read one advisory sentence and a film that reports the shot as
  // never compiled.
  if (
    sourceRuntime.diagnostics.some(
      (diagnostic) => diagnostic.category === "error",
    ) ||
    adoptedMotions.diagnostics.some(
      (diagnostic) => diagnostic.category === "error",
    ) ||
    runtime.diagnostics.some((diagnostic) => diagnostic.category === "error")
  )
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: [
        ...program.diagnostics,
        ...sourceRuntime.diagnostics,
        ...adoptedMotions.diagnostics,
        ...runtime.diagnostics,
      ],
    };
  const shot = defineShot(props.id, {
    scene: program.registrationScene!,
    contract: contractOfRegistration(props.context.contract),
    build: () => shotProgram,
  });
  const clipById = new Map(
    (shotProgram.clips ?? []).map((clip) => [clip.id, clip]),
  );
  const referenceSynthesizer = makeActorSynthesizer(
    runtime.actors,
    runtime.nodes,
  );
  const compiled = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: (action, actor, previous) =>
        action.verb === "enact"
          ? (clipById.get(action.clip) ?? null)
          : referenceSynthesizer(action, actor, previous),
      skeleton: (node) => runtime.models.get(node)?.skeleton ?? null,
      hasActorContext: (node) => runtime.actors.has(node),
      gaits: (node) => runtime.actors.get(node)?.gaits.map((gait) => gait.name),
      frameFormat: props.context.frameFormat,
      cameraClearance: props.cameraClearance,
      world: props.context.world,
      formationDesigns: new Map(Object.entries(props.context.formations)),
      formations: Object.values(props.context.formationRuntime),
      // The unit cues the source authored, handed to the performance boundary
      // rather than only attached to the artifact below: a camera framing a
      // formation has to measure it where its cue has moved it.
      formationMotions: shotProgram.formationMotions ?? [],
      // The shot's own light statement, left undefined when the source made
      // none so its compiled artifact keeps the exact bytes it had before this
      // channel existed.
      lightMotions: shotProgram.lightMotions,
      // The shot's own turning things: a building panel on its opening, a
      // prop's leaf on its hinge. Without them the performance boundary has
      // nothing to gate, so a source could author a door swing, pass every
      // validator, and be dropped here without a word.
      objectMotions: shotProgram.objectMotions,
      props: shotProgram.props,
      models: sourceRuntime.models,
      previous: props.previous ?? undefined,
    },
  });
  if (compiled.success === false)
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: [
        ...program.diagnostics,
        ...adoptedMotions.diagnostics,
        ...compiled.diagnostics.map(
          (diagnostic): IAutoMovieDiagnostic => ({
            code: diagnostic.code,
            category: "error",
            phase: "source",
            target: `shot:${props.id}`,
            path: props.path,
            message: `${diagnostic.fact} ${diagnostic.impact} ${diagnostic.recovery}`,
          }),
        ),
      ],
    };
  // The production's own light, at the story moment this shot is pinned to.
  //
  // A film that runs across a stretch of story states its source once and
  // every shot stands under it, instead of each scene restaging its own light
  // with nothing relating one to the next. The merge is the engine's, by id:
  // a staged light a source names is replaced in place, and a source no scene
  // declares is appended. A production that declares no lighting, or a shot
  // carrying no story pin, gets its staged lights back element by element, so
  // the compiled bytes are unchanged for every film that says nothing.
  //
  // State, not motion: the shot inherits where the light IS at its own story
  // origin. Carrying the source's motion in as well would mean resampling a
  // story-clock curve onto a shot-local one, and a resampling is exact for
  // some interpolations and an approximation for others -- a shot states its
  // own light-over-time through `lightMotions`, which runs on top of this.
  const scene = compiled.source.scene;
  const inherited = inheritProductionLighting({
    lighting: props.context.lighting ?? null,
    lights: scene.lights,
    pin: props.context.contract.storyTime ?? null,
    seconds: 0,
  });
  return {
    value: {
      ...compiled.source,
      authoredModels: structuredClone(sourceRuntime.authoredModels),
      props: structuredClone(shotProgram.props ?? []),
      builtEnvironments: structuredClone(shotProgram.builtEnvironments ?? []),
      // Every fold a building binds travels with the artifact, because the
      // renderer reads the artifact and nothing else. A record validated at
      // compile and dropped here is a pond the builder approved and the frame
      // does not contain.
      //
      // A fold nobody declared stays absent rather than arriving as an empty
      // array: the artifact is content-addressed, and eleven empty keys would
      // rewrite the digest of every production that has never heard of water.
      ...boundFolds(shotProgram),
      scene: { ...scene, lights: inherited },
      formationMotions: structuredClone(shotProgram.formationMotions ?? []),
      formationSlotMotions: structuredClone(
        shotProgram.formationSlotMotions ?? [],
      ),
      effectCues: structuredClone(shotProgram.effectCues ?? []),
    },
    closing: compiled.continuity.closing,
    conversions: adoptedMotions.conversions,
    // Every source-phase finding travels, including the two lists a shot used to
    // publish only when it failed. Reaching here means neither carried an error,
    // so what they carry is advice, and advice nobody is told about is the same
    // as advice nobody wrote.
    diagnostics: [
      ...program.diagnostics,
      ...sourceRuntime.diagnostics,
      ...adoptedMotions.diagnostics,
      ...runtime.diagnostics,
    ],
  };
};
