import type { IAutoMovieDialogueSpeakerBinding } from "@automovie/engine";
import type {
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import type { IAutoMovieProductionRenderTier } from "@automovie/production";

import type { AutoMovieCaptureBrowserConfig } from "./capture-browser";

/** Kokoro adapter identity implemented by the shipped render runtime. */
export const AUTOMOVIE_DIALOGUE_PROVIDER = "kokoro-local-v1" as const;
/** Exact model repository implemented by the shipped render runtime. */
export const AUTOMOVIE_DIALOGUE_MODEL =
  "onnx-community/Kokoro-82M-v1.0-ONNX" as const;
/** Immutable model revision implemented by the shipped render runtime. */
export const AUTOMOVIE_DIALOGUE_MODEL_REVISION =
  "1939ad2a8e416c0acfeecc08a694d14ef25f2231" as const;
/** Device the deterministic local adapter currently implements. */
export const AUTOMOVIE_DIALOGUE_DEVICE = "cpu" as const;

/**
 * Authored adoption facts for an external generator used by this production.
 *
 * The record contains no credential. It answers the same source, rights, cost,
 * and consumer questions for generated sound that `automovie/assets.json`
 * answers for distributable input bytes and that a repaint adapter must answer
 * for generated pictures.
 */
export type IAutoMovieExternalGeneratorProvenance =
  IAutoMovieProductionTtsReceipt["generatorProvenance"];

/** Explicit dialogue generator and voice selection for one production. */
export interface IAutoMovieDialogueSynthesisSelection {
  provider: typeof AUTOMOVIE_DIALOGUE_PROVIDER;
  model: typeof AUTOMOVIE_DIALOGUE_MODEL;
  modelRevision: typeof AUTOMOVIE_DIALOGUE_MODEL_REVISION;
  dtype: "q8";
  device: typeof AUTOMOVIE_DIALOGUE_DEVICE;
  voice: string;
  speed: number;
  generatorProvenance: IAutoMovieExternalGeneratorProvenance;
}

/** Complete generated-project configuration, separating wiring from choices. */
export interface IAutoMovieProductionConfiguration {
  /** Stable production namespace used by project scripts. */
  productionId: string;
  /** Pure browser-launch wiring. */
  capture: { browser: AutoMovieCaptureBrowserConfig };
  /** Authored delivery tiers implementing the settings delivery contract. */
  render: {
    proxy: IAutoMovieProductionRenderTier & { kind: "proxy" };
    final: IAutoMovieProductionRenderTier & { kind: "final" };
  };
  /** Authored dialogue generation and settings-subject joins. */
  sound: {
    dialogueSynthesis: IAutoMovieDialogueSynthesisSelection | null;
    speakerBindings: readonly IAutoMovieDialogueSpeakerBinding[];
  };
  /** Authored admission order for expensive moving-boundary solves. */
  simulation: { liveWearableSoftBodies: readonly string[] };
  /** Pure local viewer-server wiring. */
  viewer: { host: string; basePath: string };
}

/** Read one explicit generator adoption without accepting hidden parameters. */
export const readProductionDialogueSynthesis = (
  selected: unknown,
): IAutoMovieDialogueSynthesisSelection | null => {
  if (selected === null) return null;
  const value = exactObject(selected, "sound.dialogueSynthesis", [
    "provider",
    "model",
    "modelRevision",
    "dtype",
    "device",
    "voice",
    "speed",
    "generatorProvenance",
  ]);
  if (
    value.provider !== AUTOMOVIE_DIALOGUE_PROVIDER ||
    value.model !== AUTOMOVIE_DIALOGUE_MODEL ||
    value.modelRevision !== AUTOMOVIE_DIALOGUE_MODEL_REVISION ||
    value.dtype !== "q8" ||
    value.device !== AUTOMOVIE_DIALOGUE_DEVICE
  )
    throw new Error(
      "This scaffold runtime supports only its explicitly pinned Kokoro local adapter; it never substitutes a provider, model, revision, dtype, or device.",
    );
  const voice = nonBlank(value.voice, "sound.dialogueSynthesis.voice");
  if (
    typeof value.speed !== "number" ||
    Number.isFinite(value.speed) === false ||
    value.speed <= 0
  )
    throw new Error("sound.dialogueSynthesis.speed must be positive.");
  return {
    provider: value.provider,
    model: value.model,
    modelRevision: value.modelRevision,
    dtype: value.dtype,
    device: value.device,
    voice,
    speed: value.speed,
    generatorProvenance: readExternalGeneratorProvenance(
      value.generatorProvenance,
    ),
  };
};

/** Refuse a dialogue generator selection that disagrees with screenplay use. */
export const assertProductionDialogueSynthesis = (props: {
  selected: unknown;
  dialogue: readonly unknown[];
}): IAutoMovieDialogueSynthesisSelection | null => {
  const selected = readProductionDialogueSynthesis(props.selected);
  if (props.dialogue.length !== 0 && selected === null)
    throw new Error(
      "Dialogue lines require an explicit sound.dialogueSynthesis selection.",
    );
  if (props.dialogue.length === 0 && selected !== null)
    throw new Error(
      "sound.dialogueSynthesis selects a generator but the production has no dialogue lines to synthesize.",
    );
  return selected;
};

/** Read exact authored speaker joins and refuse ambiguous config identities. */
export const readProductionSpeakerBindings = (
  selected: unknown,
): IAutoMovieDialogueSpeakerBinding[] => {
  if (Array.isArray(selected) === false)
    throw new Error("sound.speakerBindings must be an array.");
  const speakers = new Set<string>();
  return selected.map((binding, index) => {
    const value = exactObject(binding, `sound.speakerBindings[${index}]`, [
      "speaker",
      "actor",
    ]);
    const speaker = nonBlank(
      value.speaker,
      `sound.speakerBindings[${index}].speaker`,
    );
    const actor = nonBlank(
      value.actor,
      `sound.speakerBindings[${index}].actor`,
    );
    if (speakers.has(speaker))
      throw new Error(
        `sound.speakerBindings repeats speaker identity "${speaker}".`,
      );
    speakers.add(speaker);
    return { speaker, actor };
  });
};

/** Read the production-wide live-soft budget order exactly as authored. */
export const readProductionLiveWearableSoftBodies = (
  selected: unknown,
): string[] => {
  if (Array.isArray(selected) === false)
    throw new Error(
      "simulation.liveWearableSoftBodies must be an array of domain ids.",
    );
  const ids = new Set<string>();
  return selected.map((entry, index) => {
    const id = nonBlank(entry, `simulation.liveWearableSoftBodies[${index}]`);
    if (ids.has(id))
      throw new Error(
        `simulation.liveWearableSoftBodies repeats domain id "${id}".`,
      );
    ids.add(id);
    return id;
  });
};

/** Whether a domain requires primary-motion boundary samples at every step. */
export const productionSoftBodyUsesMovingBoundary = (
  domain: Pick<IAutoMovieSoftBodyDomain, "anchors" | "colliders">,
): boolean =>
  domain.anchors.some((anchor) => anchor.binding !== undefined) ||
  domain.colliders.some((collider) => collider.kind === "body-capsule");

/** Resolve one shot's exact share of the production-wide live-soft selection. */
export const selectProductionLiveWearableSoftBodies = <
  Domain extends Pick<IAutoMovieSoftBodyDomain, "id" | "anchors" | "colliders">,
>(
  domains: readonly Domain[],
  selected: unknown,
): Array<{ domain: Domain; subjectIndex: number; maxSubjects: number }> => {
  const ordered = readProductionLiveWearableSoftBodies(selected);
  const selectedSet = new Set(ordered);
  const available = new Map<string, Domain>();
  for (const domain of domains) {
    if (
      domain.id.trim().length === 0 ||
      domain.id !== domain.id.trim() ||
      available.has(domain.id)
    )
      throw new Error(
        "Compiled soft-body domain ids must be non-blank, trimmed, and unique.",
      );
    available.set(domain.id, domain);
    if (
      productionSoftBodyUsesMovingBoundary(domain) &&
      selectedSet.has(domain.id) === false
    )
      throw new Error(
        `Live wearable soft body "${domain.id}" declares a moving boundary but simulation.liveWearableSoftBodies does not select it.`,
      );
  }
  return ordered.flatMap((id, subjectIndex) => {
    const domain = available.get(id);
    if (domain === undefined) return [];
    if (productionSoftBodyUsesMovingBoundary(domain) === false)
      throw new Error(
        `Live wearable soft body "${id}" is selected for a live solve but declares no moving boundary.`,
      );
    return [{ domain, subjectIndex, maxSubjects: ordered.length }];
  });
};

/**
 * Refuse a production-wide live-soft declaration that differs from its shots.
 *
 * A selected id may be absent from an individual shot because the list is a
 * production budget, not a shot-local list. Across the complete compiled film,
 * however, its set must equal the set of domains that actually require moving
 * anchors or body capsules. A selected static occurrence is also a conflicting
 * identity rather than a fallback.
 */
export const assertProductionLiveWearableSoftBodies = (props: {
  selected: unknown;
  shots: ReadonlyMap<
    string,
    Pick<IAutoMovieCompiledShotSource, "softBodyDomains">
  >;
}): string[] => {
  const selected = readProductionLiveWearableSoftBodies(props.selected);
  const selectedSet = new Set(selected);
  const moving = new Set<string>();
  for (const [shot, compiled] of props.shots) {
    const ids = new Set<string>();
    for (const domain of compiled.softBodyDomains ?? []) {
      const id = nonBlank(domain.id, `compiled shot "${shot}" soft-body id`);
      if (ids.has(id))
        throw new Error(
          `Compiled shot "${shot}" repeats soft-body domain id "${id}".`,
        );
      ids.add(id);
      const requiresLive = productionSoftBodyUsesMovingBoundary(domain);
      if (requiresLive) {
        moving.add(id);
        if (selectedSet.has(id) === false)
          throw new Error(
            `Compiled shot "${shot}" soft body "${id}" declares a moving boundary but simulation.liveWearableSoftBodies does not select it.`,
          );
      } else if (selectedSet.has(id))
        throw new Error(
          `Compiled shot "${shot}" soft body "${id}" is selected for a live solve but declares no moving boundary.`,
        );
    }
  }
  const unused = selected.filter((id) => moving.has(id) === false);
  if (unused.length !== 0)
    throw new Error(
      `simulation.liveWearableSoftBodies selects domain ids absent from the compiled production: ${unused.join(", ")}.`,
    );
  return selected;
};

/**
 * Prove every configured visual speaker maps to the same actor in its shots.
 *
 * Settings owns the subject identity. The screenplay carries the speaker id,
 * this config joins that id to the source actor id, and compiled shot nodes are
 * the executable last link. An off-screen audible identity has no actor binding
 * and therefore remains outside this mouth-animation join.
 */
export const assertProductionSpeakerBindings = (props: {
  bindings: readonly IAutoMovieDialogueSpeakerBinding[];
  dialogue: readonly Pick<
    IAutoMovieProductionDialogueLine,
    "id" | "speaker" | "startFrame" | "endFrame"
  >[];
  timeline: Pick<IAutoMovieFilmTimeline, "segments">;
  shots: ReadonlyMap<string, Pick<IAutoMovieCompiledShotSource, "scene">>;
}): void => {
  const bindings = readProductionSpeakerBindings(props.bindings);
  for (const binding of bindings) {
    const lines = props.dialogue.filter(
      (line) => line.speaker === binding.speaker,
    );
    if (lines.length === 0)
      throw new Error(
        `sound.speakerBindings speaker "${binding.speaker}" is not used by any dialogue line.`,
      );
    for (const line of lines) {
      const segments = props.timeline.segments.filter(
        (segment) =>
          line.startFrame < segment.endFrame &&
          line.endFrame > segment.startFrame,
      );
      if (segments.length === 0)
        throw new Error(
          `Dialogue line "${line.id}" lies outside the compiled film timeline.`,
        );
      for (const segment of segments) {
        const compiled = props.shots.get(segment.shot);
        if (compiled === undefined)
          throw new Error(
            `Dialogue line "${line.id}" resolves to absent compiled shot "${segment.shot}".`,
          );
        if (
          compiled.scene.nodes.some((node) => node.id === binding.actor) ===
          false
        )
          throw new Error(
            `Dialogue line "${line.id}" binds settings speaker "${binding.speaker}" to actor "${binding.actor}", which is absent from compiled shot "${segment.shot}".`,
          );
      }
    }
  }
};

const readExternalGeneratorProvenance = (
  input: unknown,
): IAutoMovieExternalGeneratorProvenance => {
  const value = exactObject(
    input,
    "sound.dialogueSynthesis.generatorProvenance",
    ["source", "license", "termsCheckedAt", "cost", "consumer"],
  );
  const termsCheckedAt = nonBlank(
    value.termsCheckedAt,
    "sound.dialogueSynthesis.generatorProvenance.termsCheckedAt",
  );
  if (
    /^\d{4}-\d{2}-\d{2}$/u.test(termsCheckedAt) === false ||
    new Date(`${termsCheckedAt}T00:00:00.000Z`)
      .toISOString()
      .startsWith(termsCheckedAt) === false
  )
    throw new Error(
      "sound.dialogueSynthesis.generatorProvenance.termsCheckedAt must be a real YYYY-MM-DD date.",
    );
  const consumer = exactObject(
    value.consumer,
    "sound.dialogueSynthesis.generatorProvenance.consumer",
    ["kind", "reason"],
  );
  if (consumer.kind !== "dialogue-synthesis")
    throw new Error(
      'sound.dialogueSynthesis.generatorProvenance.consumer.kind must be "dialogue-synthesis".',
    );
  return {
    source: nonBlank(
      value.source,
      "sound.dialogueSynthesis.generatorProvenance.source",
    ),
    license: nonBlank(
      value.license,
      "sound.dialogueSynthesis.generatorProvenance.license",
    ),
    termsCheckedAt,
    cost: nonBlank(
      value.cost,
      "sound.dialogueSynthesis.generatorProvenance.cost",
    ),
    consumer: {
      kind: consumer.kind,
      reason: nonBlank(
        consumer.reason,
        "sound.dialogueSynthesis.generatorProvenance.consumer.reason",
      ),
    },
  };
};

const exactObject = (
  input: unknown,
  label: string,
  keys: readonly string[],
): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error(`${label} must be an object.`);
  const value = input as Record<string, unknown>;
  const expected = new Set(keys);
  const unknown = Object.keys(value).filter(
    (key) => expected.has(key) === false,
  );
  const missing = keys.filter((key) => Object.hasOwn(value, key) === false);
  if (unknown.length !== 0 || missing.length !== 0)
    throw new Error(
      `${label} must contain exactly ${keys.join(", ")}; unknown: ${unknown.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}.`,
    );
  return value;
};

const nonBlank = (value: unknown, label: string): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  )
    throw new Error(`${label} must be a non-blank trimmed string.`);
  return value;
};
