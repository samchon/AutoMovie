import type { IAutoMovieDialogueSpeakerBinding } from "@automovie/engine";
import type {
  AutoMovieRepaintReferenceRole,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintGeneratorProvenance,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintReferenceInput,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import {
  type IAutoMovieProductionRenderTier,
  canonicalizeAutoMovieJson,
} from "@automovie/production";

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

/** One reviewed, immutable repaint request for an authored shot. */
export interface IAutoMovieProductionRepaintRequest {
  shot: string;
  parameters: IAutoMovieRepaintParameters;
  references: readonly IAutoMovieRepaintReferenceInput[];
}

/** Complete generator adoption and request population for repaint delivery. */
export interface IAutoMovieProductionRepaintSelection {
  generator: IAutoMovieRepaintGeneratorAdoption;
  requests: readonly IAutoMovieProductionRepaintRequest[];
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
  /** Authored appearance rendition selection and exact reviewed requests. */
  visual: {
    repaint: IAutoMovieProductionRepaintSelection | null;
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
      "sound.dialogueSynthesis.generatorProvenance",
      "dialogue-synthesis",
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

/**
 * Read the reviewed repaint adoption and requests without hidden CLI choices.
 *
 * Settings owns shared visual grammar and delivery fidelity, research owns the
 * external source and current terms, and the applicable design owners settle
 * subject-specific appearance and references. This config only serializes
 * those reviewed decisions for execution.
 */
export const readProductionRepaintSelection = (
  selected: unknown,
): IAutoMovieProductionRepaintSelection | null => {
  if (selected === null) return null;
  const value = exactObject(selected, "visual.repaint", [
    "generator",
    "requests",
  ]);
  const generatorValue = exactObject(
    value.generator,
    "visual.repaint.generator",
    ["runtimeIdentity", "generatorProvenance"],
  );
  const runtime = exactObject(
    generatorValue.runtimeIdentity,
    "visual.repaint.generator.runtimeIdentity",
    ["protocolVersion", "provider", "model", "version", "execution"],
  );
  if (
    runtime.protocolVersion !== "automovie.repaint-runtime.v1" ||
    (runtime.execution !== "local" &&
      runtime.execution !== "api" &&
      runtime.execution !== "other")
  )
    throw new Error(
      "visual.repaint.generator.runtimeIdentity requires repaint protocol v1 and a local, api, or other execution boundary.",
    );
  const generator: IAutoMovieRepaintGeneratorAdoption = {
    runtimeIdentity: {
      protocolVersion: runtime.protocolVersion,
      provider: nonBlank(
        runtime.provider,
        "visual.repaint.generator.runtimeIdentity.provider",
      ),
      model: nonBlank(
        runtime.model,
        "visual.repaint.generator.runtimeIdentity.model",
      ),
      version: nonBlank(
        runtime.version,
        "visual.repaint.generator.runtimeIdentity.version",
      ),
      execution: runtime.execution,
    },
    generatorProvenance: readExternalGeneratorProvenance(
      generatorValue.generatorProvenance,
      "visual.repaint.generator.generatorProvenance",
      "repaint",
    ),
  };
  if (Array.isArray(value.requests) === false || value.requests.length === 0)
    throw new Error(
      "visual.repaint.requests must be a non-empty array for a selected repaint generator.",
    );
  const shots = new Set<string>();
  const requests = value.requests.map((request, index) => {
    const label = `visual.repaint.requests[${index}]`;
    const record = exactObject(request, label, [
      "shot",
      "parameters",
      "references",
    ]);
    const shot = nonBlank(record.shot, `${label}.shot`);
    if (shots.has(shot))
      throw new Error(`visual.repaint.requests repeats shot "${shot}".`);
    shots.add(shot);
    return {
      shot,
      parameters: readRepaintParameters(
        record.parameters,
        `${label}.parameters`,
      ),
      references: readRepaintReferences(
        record.references,
        `${label}.references`,
      ),
    };
  });
  return { generator, requests };
};

/** Refuse a delivery whose reviewed request set differs from compiled shots. */
export const assertProductionRepaintSelection = (props: {
  selected: unknown;
  visualDelivery: "deterministic" | "repainted";
  shots: readonly string[];
}): IAutoMovieProductionRepaintSelection | null => {
  const selected = readProductionRepaintSelection(props.selected);
  if (props.visualDelivery === "deterministic") {
    if (selected !== null)
      throw new Error(
        "visual.repaint selects a generator and requests for a deterministic visual delivery.",
      );
    return null;
  }
  if (selected === null)
    throw new Error(
      "A repainted visual delivery requires an explicit visual.repaint generator and reviewed request for every compiled shot.",
    );
  const compiled = exactIdentitySet(props.shots, "compiled repaint shot");
  const configured = selected.requests.map((request) => request.shot).sort();
  if (
    compiled.length !== configured.length ||
    compiled.some((shot, index) => shot !== configured[index])
  )
    throw new Error(
      `visual.repaint.requests must exactly equal the compiled repaint shot set; configured: ${configured.join(", ") || "none"}; compiled: ${compiled.join(", ") || "none"}.`,
    );
  return selected;
};

/** Resolve one shot only from its reviewed repaint configuration. */
export const selectProductionRepaintRequest = (
  selected: unknown,
  shot: unknown,
): {
  generator: IAutoMovieRepaintGeneratorAdoption;
  request: IAutoMovieProductionRepaintRequest;
} => {
  const repaint = readProductionRepaintSelection(selected);
  if (repaint === null)
    throw new Error(
      "This production has no reviewed visual.repaint generator or requests.",
    );
  const id = nonBlank(shot, "repaint shot");
  const request = repaint.requests.find((candidate) => candidate.shot === id);
  if (request === undefined)
    throw new Error(
      `Shot "${id}" has no reviewed visual.repaint request in automovie.config.ts.`,
    );
  return { generator: repaint.generator, request };
};

/** Read the repaint CLI's only allowed operation selector. */
export const readProductionRepaintShotArgument = (
  args: readonly string[],
): string => {
  if (args.length !== 2 || args[0] !== "--shot")
    throw new Error("repaint requires exactly --shot <authored-shot-id>.");
  return nonBlank(args[1], "repaint --shot");
};

/** Refuse stored outputs created under another generator adoption. */
export const assertProductionRepaintReceiptAdoption = (props: {
  selected: IAutoMovieProductionRepaintSelection;
  receipts: readonly IAutoMovieRepaintReceipt[];
}): void => {
  const selected = readProductionRepaintSelection(props.selected);
  if (selected === null)
    throw new Error(
      "Repaint receipt adoption requires a reviewed visual.repaint selection.",
    );
  const expected = selected.generator;
  const configuredShots = new Set(
    selected.requests.map((request) => request.shot),
  );
  const receiptShots = new Set<string>();
  for (const receipt of props.receipts) {
    if (receiptShots.has(receipt.shot))
      throw new Error(`Repaint receipts repeat shot "${receipt.shot}".`);
    receiptShots.add(receipt.shot);
    let runtime: unknown;
    try {
      runtime = JSON.parse(receipt.adapterIdentity);
    } catch {
      throw new Error(
        `Repaint receipt for shot "${receipt.shot}" has a non-JSON adapter identity.`,
      );
    }
    const actual = readProductionRepaintSelection({
      generator: {
        runtimeIdentity: runtime,
        generatorProvenance: receipt.generatorProvenance,
      },
      requests: [
        {
          shot: receipt.shot,
          parameters: receipt.parameters,
          references: receipt.references.map(({ role, path }) => ({
            role,
            path,
          })),
        },
      ],
    })!;
    const reviewed = selected.requests.find(
      (request) => request.shot === receipt.shot,
    );
    if (
      canonicalizeAutoMovieJson(actual.generator) !==
        canonicalizeAutoMovieJson(expected) ||
      reviewed === undefined ||
      canonicalizeAutoMovieJson(actual.requests[0]) !==
        canonicalizeAutoMovieJson(reviewed) ||
      receipt.structuralAuthority !== "deterministic-source-only"
    )
      throw new Error(
        `Repaint receipt for shot "${receipt.shot}" does not match the current reviewed generator adoption, per-shot request, or deterministic structural-authority boundary.`,
      );
  }
  const missing = [...configuredShots].filter(
    (shot) => receiptShots.has(shot) === false,
  );
  const extra = [...receiptShots].filter(
    (shot) => configuredShots.has(shot) === false,
  );
  if (missing.length !== 0 || extra.length !== 0)
    throw new Error(
      `Current repaint receipts must exactly equal configured requests; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`,
    );
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

const readExternalGeneratorProvenance = <
  Kind extends "dialogue-synthesis" | "repaint",
>(
  input: unknown,
  label: string,
  kind: Kind,
): Kind extends "dialogue-synthesis"
  ? IAutoMovieExternalGeneratorProvenance
  : IAutoMovieRepaintGeneratorProvenance => {
  const value = exactObject(input, label, [
    "source",
    "license",
    "termsCheckedAt",
    "cost",
    "consumer",
  ]);
  const termsCheckedAt = nonBlank(
    value.termsCheckedAt,
    `${label}.termsCheckedAt`,
  );
  if (
    /^\d{4}-\d{2}-\d{2}$/u.test(termsCheckedAt) === false ||
    Number.isNaN(new Date(`${termsCheckedAt}T00:00:00.000Z`).getTime()) ||
    new Date(`${termsCheckedAt}T00:00:00.000Z`)
      .toISOString()
      .startsWith(termsCheckedAt) === false
  )
    throw new Error(`${label}.termsCheckedAt must be a real YYYY-MM-DD date.`);
  const consumer = exactObject(value.consumer, `${label}.consumer`, [
    "kind",
    "reason",
  ]);
  if (consumer.kind !== kind)
    throw new Error(`${label}.consumer.kind must be "${kind}".`);
  return {
    source: nonBlank(value.source, `${label}.source`),
    license: nonBlank(value.license, `${label}.license`),
    termsCheckedAt,
    cost: nonBlank(value.cost, `${label}.cost`),
    consumer: {
      kind,
      reason: nonBlank(consumer.reason, `${label}.consumer.reason`),
    },
  } as Kind extends "dialogue-synthesis"
    ? IAutoMovieExternalGeneratorProvenance
    : IAutoMovieRepaintGeneratorProvenance;
};

const exactObject = (
  input: unknown,
  label: string,
  keys: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error(`${label} must be an object.`);
  const value = input as Record<string, unknown>;
  const expected = new Set([...keys, ...optional]);
  const unknown = Object.keys(value).filter(
    (key) => expected.has(key) === false,
  );
  const missing = keys.filter((key) => Object.hasOwn(value, key) === false);
  if (unknown.length !== 0 || missing.length !== 0)
    throw new Error(
      `${label} requires ${keys.join(", ")} and allows only ${[...keys, ...optional].join(", ")}; unknown: ${unknown.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}.`,
    );
  return value;
};

const readRepaintParameters = (
  input: unknown,
  label: string,
): IAutoMovieRepaintParameters => {
  const value = exactObject(
    input,
    label,
    ["prompt", "seed", "strength"],
    ["negativePrompt", "controls"],
  );
  const prompt = nonBlank(value.prompt, `${label}.prompt`);
  if (Number.isSafeInteger(value.seed) === false)
    throw new Error(`${label}.seed must be a safe integer.`);
  if (
    typeof value.strength !== "number" ||
    Number.isFinite(value.strength) === false ||
    value.strength < 0 ||
    value.strength > 1
  )
    throw new Error(`${label}.strength must be finite and in [0, 1].`);
  const negativePrompt =
    value.negativePrompt === undefined
      ? undefined
      : nonBlank(value.negativePrompt, `${label}.negativePrompt`);
  const controls =
    value.controls === undefined
      ? undefined
      : readRepaintControls(value.controls, `${label}.controls`);
  return {
    prompt,
    seed: value.seed as number,
    strength: value.strength,
    ...(negativePrompt === undefined ? {} : { negativePrompt }),
    ...(controls === undefined ? {} : { controls }),
  };
};

const readRepaintControls = (
  input: unknown,
  label: string,
): Record<string, string | number | boolean> => {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  )
    throw new Error(`${label} must be an object.`);
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const name = nonBlank(key, `${label} key`);
      if (
        (typeof value !== "string" &&
          typeof value !== "number" &&
          typeof value !== "boolean") ||
        (typeof value === "string" &&
          (value.trim().length === 0 || value !== value.trim())) ||
        (typeof value === "number" && Number.isFinite(value) === false)
      )
        throw new Error(
          `${label}.${name} must be a non-blank string, finite number, or boolean.`,
        );
      return [name, value];
    }),
  );
};

const readRepaintReferences = (
  input: unknown,
  label: string,
): IAutoMovieRepaintReferenceInput[] => {
  if (Array.isArray(input) === false || input.length === 0)
    throw new Error(`${label} must be a non-empty array.`);
  const seen = new Set<string>();
  const rolesByPath = new Map<string, Set<AutoMovieRepaintReferenceRole>>();
  const references = input.map((reference, index) => {
    const itemLabel = `${label}[${index}]`;
    const value = exactObject(reference, itemLabel, ["role", "path"]);
    if (isRepaintReferenceRole(value.role) === false)
      throw new Error(
        `${itemLabel}.role must be structure, character, costume, style, material, color, or environment.`,
      );
    const referencePath = nonBlank(value.path, `${itemLabel}.path`);
    const identity = `${value.role}\0${referencePath}`;
    if (seen.has(identity))
      throw new Error(
        `${label} repeats reference "${value.role}:${referencePath}".`,
      );
    seen.add(identity);
    const roles = rolesByPath.get(referencePath) ?? new Set();
    roles.add(value.role);
    rolesByPath.set(referencePath, roles);
    return { role: value.role, path: referencePath };
  });
  if (
    [...rolesByPath.values()].some(
      (roles) => roles.size === REPAINT_REFERENCE_ROLE_COUNT,
    )
  )
    throw new Error(
      `${label} cannot assign one reference image as canonical guidance for every role; split the seven roles across reviewed assets.`,
    );
  return references;
};

const isRepaintReferenceRole = (
  value: unknown,
): value is AutoMovieRepaintReferenceRole =>
  value === "structure" ||
  value === "character" ||
  value === "costume" ||
  value === "style" ||
  value === "material" ||
  value === "color" ||
  value === "environment";

const REPAINT_REFERENCE_ROLE_COUNT = 7;

const exactIdentitySet = (
  values: readonly unknown[],
  label: string,
): string[] => {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const identity = nonBlank(value, `${label}[${index}]`);
    if (seen.has(identity))
      throw new Error(`${label} repeats identity "${identity}".`);
    seen.add(identity);
  }
  return [...seen].sort();
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
