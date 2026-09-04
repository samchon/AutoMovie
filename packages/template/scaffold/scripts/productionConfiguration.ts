import type { IAutoMovieDialogueSpeakerBinding } from "@automovie/engine";
import type {
  AutoMovieRepaintReferenceRole,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintGeneratorProvenance,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintReferenceInput,
  IAutoMovieRepaintRequestEvidence,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import {
  type IAutoMovieProductionRenderTier,
  assertAutoMovieExternalGeneratorTermsAt,
  assertAutoMovieRepaintExecutionPolicy,
  autoMovieExternalLocatorRefusal,
  canonicalizeAutoMovieJson,
} from "@automovie/production";

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
 * and consumer questions for generated sound that the project asset manifest
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
  evidence: IAutoMovieRepaintRequestEvidence;
  selectionReview: IAutoMovieProductionRepaintSelectionReview | null;
}

/** Reviewed evidence used only by explicit candidate selection or reversal. */
export interface IAutoMovieProductionRepaintSelectionReview {
  candidateAttemptId: string;
  candidateOutputDigest: string;
  reason: string;
  structuralReview: string;
  continuityReview: {
    baseline: string;
    playbackEvidence: string;
    mixedDeliveryPolicy: string | null;
    flicker: "pass";
    identityDrift: "pass";
    geometryWarp: "pass";
    textureCrawl: "pass";
    transitionMismatch: "pass";
  } | null;
}

/** Complete generator adoption and request population for repaint delivery. */
export interface IAutoMovieProductionRepaintSelection {
  generator: IAutoMovieRepaintGeneratorAdoption;
  executionPolicy: IAutoMovieRepaintExecutionPolicy;
  requests: readonly IAutoMovieProductionRepaintRequest[];
}

/** One explicit repaint operation with no hidden reroll or adoption choice. */
export type AutoMovieProductionRepaintCommand =
  | { kind: "reroll"; shot: string }
  | { kind: "retry"; shot: string; requestId: string }
  | { kind: "selection"; shot: string; attemptId: string }
  | { kind: "reversal"; shot: string; attemptId: string };

/** The proxy and final tiers one production renders at. */
export interface IAutoMovieProductionRenderTiers {
  proxy: IAutoMovieProductionRenderTier & { kind: "proxy" };
  final: IAutoMovieProductionRenderTier & { kind: "final" };
}

/**
 * The review and delivery tiers a production renders at until it declares its
 * own pair on its design record.
 *
 * A blank project has no design record, so it has authored no tier. Falling
 * back here keeps `npm run render` usable before the first `npm run design`
 * without any file standing in for a decision nobody has made: the moment the
 * production declares `renderTiers`, that declaration wins outright.
 */
export const AUTOMOVIE_SHIPPED_RENDER_TIERS = {
  proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
  final: { kind: "final", resolutionScale: 1, frameStep: 1 },
} as const satisfies IAutoMovieProductionRenderTiers;

/**
 * Read the production's own delivery tiers, or the shipped pair when it
 * declares none.
 *
 * TypeScript settles the shape of a design record this project emitted itself.
 * This parser settles the shape of the record actually resident on disk, which
 * a hand edit, a partial write, or an older emitter can disagree with, before
 * a raster or a frame clock is derived from it.
 */
export const readProductionRenderTiers = (
  selected: unknown,
): IAutoMovieProductionRenderTiers => {
  if (selected === undefined || selected === null)
    return structuredClone(AUTOMOVIE_SHIPPED_RENDER_TIERS);
  const value = exactObject(selected, "renderTiers", ["proxy", "final"]);
  return {
    proxy: readProductionRenderTier(value.proxy, "renderTiers.proxy", "proxy"),
    final: readProductionRenderTier(value.final, "renderTiers.final", "final"),
  };
};

const readProductionRenderTier = <Kind extends "proxy" | "final">(
  input: unknown,
  label: string,
  kind: Kind,
): IAutoMovieProductionRenderTier & { kind: Kind } => {
  const value = exactObject(input, label, [
    "kind",
    "resolutionScale",
    "frameStep",
  ]);
  if (value.kind !== kind) throw new Error(`${label}.kind must be "${kind}".`);
  if (
    typeof value.resolutionScale !== "number" ||
    Number.isFinite(value.resolutionScale) === false
  )
    throw new Error(`${label}.resolutionScale must be a finite number.`);
  if (Number.isSafeInteger(value.frameStep) === false)
    throw new Error(`${label}.frameStep must be a safe integer.`);
  return {
    kind,
    resolutionScale: value.resolutionScale,
    frameStep: value.frameStep as number,
  };
};

/**
 * Join this production's reviewed repaint requests with the candidate reviews
 * that were written after their bytes existed.
 *
 * The request is design: changing a prompt, a seed, or a reference is a change
 * to what the production asks for, and it must stale the compile that consumed
 * it. The post-generation review is not: it is an observation of a candidate
 * the current source already produced, and recording what you saw must not
 * invalidate the render you saw it in. So the two live apart and meet here, at
 * the one place a repaint operation reads them together.
 */
export const productionRepaintInput = (
  repaint: IAutoMovieProductionDesign["repaint"],
  reviews: Readonly<
    Record<string, IAutoMovieProductionRepaintSelectionReview>
  > = {},
): unknown =>
  repaint === undefined
    ? null
    : {
        generator: repaint.generator,
        executionPolicy: repaint.executionPolicy,
        requests: repaint.requests.map((request) => ({
          shot: request.shot,
          parameters: request.parameters,
          references: request.references,
          evidence: request.evidence,
          selectionReview: Object.hasOwn(reviews, request.shot)
            ? reviews[request.shot]
            : null,
        })),
      };

/** Read one explicit generator adoption without accepting hidden parameters. */
export const readProductionDialogueSynthesis = (
  selected: unknown,
  occurredAt: Date | string = new Date(),
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
      occurredAt,
    ),
  };
};

/** Refuse a dialogue generator selection that disagrees with screenplay use. */
export const assertProductionDialogueSynthesis = (props: {
  selected: unknown;
  dialogue: readonly unknown[];
  occurredAt?: Date | string;
}): IAutoMovieDialogueSynthesisSelection | null => {
  const selected = readProductionDialogueSynthesis(
    props.selected,
    props.occurredAt,
  );
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

/** Refuse generated or resumed dialogue receipts with stale adoption time. */
export const assertProductionDialogueReceiptAdoption = (props: {
  selected: IAutoMovieDialogueSynthesisSelection;
  receipts: readonly IAutoMovieProductionTtsReceipt[];
  occurredAt?: Date | string;
}): void => {
  const selected = readProductionDialogueSynthesis(
    props.selected,
    props.occurredAt ?? props.receipts[0]?.generatedAt ?? new Date(),
  );
  if (selected === null)
    throw new Error(
      "Dialogue receipt adoption requires a reviewed sound.dialogueSynthesis selection.",
    );
  for (const receipt of props.receipts) {
    exactUtcInstant(
      receipt.generatedAt,
      `Dialogue receipt "${receipt.line}" generatedAt`,
    );
    assertAutoMovieExternalGeneratorTermsAt({
      termsCheckedAt: receipt.generatorProvenance.termsCheckedAt,
      occurredAt: receipt.generatedAt,
      label: `Dialogue receipt "${receipt.line}" generator provenance`,
    });
    if (
      receipt.version !== 6 ||
      receipt.model !== selected.model ||
      receipt.modelRevision !== selected.modelRevision ||
      receipt.voice !== selected.voice ||
      canonicalizeAutoMovieJson(receipt.generatorProvenance) !==
        canonicalizeAutoMovieJson(selected.generatorProvenance)
    )
      throw new Error(
        `Dialogue receipt "${receipt.line}" does not match the current reviewed generator adoption or immutable synthesis instant.`,
      );
  }
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
  occurredAt: Date | string = new Date(),
): IAutoMovieProductionRepaintSelection | null => {
  if (selected === null) return null;
  const value = exactObject(selected, "repaint", [
    "generator",
    "executionPolicy",
    "requests",
  ]);
  const generatorValue = exactObject(value.generator, "repaint.generator", [
    "runtimeIdentity",
    "generatorProvenance",
  ]);
  const runtime = exactObject(
    generatorValue.runtimeIdentity,
    "repaint.generator.runtimeIdentity",
    ["protocolVersion", "provider", "model", "version", "execution"],
  );
  if (
    runtime.protocolVersion !== "automovie.repaint-runtime.v1" ||
    (runtime.execution !== "local" &&
      runtime.execution !== "api" &&
      runtime.execution !== "other")
  )
    throw new Error(
      "repaint.generator.runtimeIdentity requires repaint protocol v1 and a local, api, or other execution boundary.",
    );
  const generator: IAutoMovieRepaintGeneratorAdoption = {
    runtimeIdentity: {
      protocolVersion: runtime.protocolVersion,
      provider: nonBlank(
        runtime.provider,
        "repaint.generator.runtimeIdentity.provider",
      ),
      model: nonBlank(runtime.model, "repaint.generator.runtimeIdentity.model"),
      version: nonBlank(
        runtime.version,
        "repaint.generator.runtimeIdentity.version",
      ),
      execution: runtime.execution,
    },
    generatorProvenance: readExternalGeneratorProvenance(
      generatorValue.generatorProvenance,
      "repaint.generator.generatorProvenance",
      "repaint",
      occurredAt,
    ),
  };
  const executionPolicy = readRepaintExecutionPolicy(
    value.executionPolicy,
    "repaint.executionPolicy",
  );
  if (Array.isArray(value.requests) === false || value.requests.length === 0)
    throw new Error(
      "repaint.requests must be a non-empty array for a selected repaint generator.",
    );
  const shots = new Set<string>();
  const requests = value.requests.map((request, index) => {
    const label = `repaint.requests[${index}]`;
    const record = exactObject(request, label, [
      "shot",
      "parameters",
      "references",
      "evidence",
      "selectionReview",
    ]);
    const shot = nonBlank(record.shot, `${label}.shot`);
    if (shots.has(shot))
      throw new Error(`repaint.requests repeats shot "${shot}".`);
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
      evidence: readRepaintEvidence(record.evidence, `${label}.evidence`),
      selectionReview: readRepaintSelectionReview(
        record.selectionReview,
        `${label}.selectionReview`,
      ),
    };
  });
  for (const [index, request] of requests.entries()) {
    if (
      request.selectionReview !== null &&
      ((request.evidence.continuity === null) !==
        (request.selectionReview.continuityReview === null) ||
        (request.evidence.continuity !== null &&
          request.selectionReview.continuityReview?.baseline !==
            request.evidence.continuity))
    )
      throw new Error(
        `repaint.requests[${index}] must pair a film continuity evidence address with the same reviewed baseline, or use null for both outside film continuity.`,
      );
  }
  return { generator, executionPolicy, requests };
};

/** Refuse a delivery whose reviewed request set differs from compiled shots. */
export const assertProductionRepaintSelection = (props: {
  selected: unknown;
  visualDelivery: "deterministic" | "repainted" | "mixed";
  continuity: "film" | "inapplicable";
  shots: readonly string[];
}): IAutoMovieProductionRepaintSelection | null => {
  const selected = readProductionRepaintSelection(props.selected);
  if (props.visualDelivery === "deterministic") {
    if (selected !== null)
      throw new Error(
        "repaint selects a generator and requests for a deterministic visual delivery.",
      );
    return null;
  }
  if (selected === null)
    throw new Error(
      "A repainted or mixed visual delivery requires an explicit repaint generator and reviewed request for every declared repaint shot.",
    );
  const missingReview = selected.requests.find(
    (request) => request.selectionReview === null,
  );
  if (missingReview !== undefined)
    throw new Error(
      `Repainted delivery shot "${missingReview.shot}" requires a post-generation review bound to the selected candidate attempt id and output digest.`,
    );
  const continuityMismatch = selected.requests.find((request) =>
    props.continuity === "film"
      ? request.evidence.continuity === null ||
        request.selectionReview!.continuityReview === null
      : request.evidence.continuity !== null ||
        request.selectionReview!.continuityReview !== null,
  );
  if (continuityMismatch !== undefined)
    throw new Error(
      props.continuity === "film"
        ? `Repainted film shot "${continuityMismatch.shot}" requires a versioned continuity baseline and passing full-sequence playback review.`
        : `Non-narrative repaint shot "${continuityMismatch.shot}" must mark film-only continuity evidence and review inapplicable with null.`,
    );
  const compiled = exactIdentitySet(props.shots, "compiled repaint shot");
  const configured = selected.requests
    .map((request) => request.shot)
    .sort(compareCodeUnits);
  if (
    compiled.length !== configured.length ||
    compiled.some((shot, index) => shot !== configured[index])
  )
    throw new Error(
      `repaint.requests must exactly equal the declared repaint shot set; configured: ${configured.join(", ") || "none"}; declared: ${compiled.join(", ") || "none"}.`,
    );
  return selected;
};

/** Resolve one shot only from its reviewed repaint configuration. */
export const selectProductionRepaintRequest = (
  selected: unknown,
  shot: unknown,
  occurredAt: Date | string = new Date(),
): {
  generator: IAutoMovieRepaintGeneratorAdoption;
  executionPolicy: IAutoMovieRepaintExecutionPolicy;
  request: IAutoMovieProductionRepaintRequest;
} => {
  const repaint = readProductionRepaintSelection(selected, occurredAt);
  if (repaint === null)
    throw new Error(
      "This production has no reviewed repaint generator or requests.",
    );
  const id = nonBlank(shot, "repaint shot");
  const request = repaint.requests.find((candidate) => candidate.shot === id);
  if (request === undefined)
    throw new Error(
      `Shot "${id}" has no reviewed repaint request on this production's design record.`,
    );
  return {
    generator: repaint.generator,
    executionPolicy: repaint.executionPolicy,
    request,
  };
};

/** Read one explicit reroll, retry, selection, or reversal operation. */
export const readProductionRepaintCommand = (
  args: readonly string[],
): AutoMovieProductionRepaintCommand => {
  if (args[0] === "reroll" && args.length === 3 && args[1] === "--shot")
    return { kind: "reroll", shot: nonBlank(args[2], "repaint --shot") };
  if (
    args[0] === "retry" &&
    args.length === 5 &&
    args[1] === "--shot" &&
    args[3] === "--request"
  )
    return {
      kind: "retry",
      shot: nonBlank(args[2], "repaint --shot"),
      requestId: repaintUuid(args[4], "repaint --request"),
    };
  if (
    (args[0] === "select" || args[0] === "reverse") &&
    args.length === 5 &&
    args[1] === "--shot" &&
    args[3] === "--attempt"
  )
    return {
      kind: args[0] === "select" ? "selection" : "reversal",
      shot: nonBlank(args[2], "repaint --shot"),
      attemptId: repaintUuid(args[4], "repaint --attempt"),
    };
  throw new Error(
    "repaint requires exactly one operation: reroll --shot <id>, retry --shot <id> --request <uuid-v4>, select --shot <id> --attempt <uuid-v4>, or reverse --shot <id> --attempt <uuid-v4>.",
  );
};

/** Refuse stored outputs created under another generator adoption. */
export const assertProductionRepaintReceiptAdoption = (props: {
  selected: IAutoMovieProductionRepaintSelection;
  receipts: readonly IAutoMovieRepaintReceipt[];
}): void => {
  const selected = readProductionRepaintSelection(props.selected);
  if (selected === null)
    throw new Error(
      "Repaint receipt adoption requires a reviewed repaint selection.",
    );
  const configuredShots = new Set(
    selected.requests.map((request) => request.shot),
  );
  const receiptShots = new Set<string>();
  for (const receipt of props.receipts) {
    if (receiptShots.has(receipt.shot))
      throw new Error(`Repaint receipts repeat shot "${receipt.shot}".`);
    receiptShots.add(receipt.shot);
    assertRepaintReceiptMatchesSelection(selected, receipt);
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

/** Refuse selection of one candidate from stale config or evidence owners. */
export const assertProductionRepaintCandidateAdoption = (props: {
  selected: IAutoMovieProductionRepaintSelection;
  receipt: IAutoMovieRepaintReceipt;
}): void => {
  if (props.receipt.startedAt === undefined)
    throw new Error(
      `Repaint candidate for shot "${props.receipt.shot}" has no immutable execution instant.`,
    );
  const selected = readProductionRepaintSelection(
    props.selected,
    props.receipt.startedAt,
  );
  if (selected === null)
    throw new Error(
      "Repaint candidate adoption requires a reviewed repaint selection.",
    );
  assertRepaintReceiptMatchesSelection(selected, props.receipt);
};

/** Return only a review explicitly authored for this immutable candidate. */
export const selectProductionRepaintCandidateReview = (props: {
  request: IAutoMovieProductionRepaintRequest;
  receipt: IAutoMovieRepaintReceipt;
}): Omit<
  IAutoMovieProductionRepaintSelectionReview,
  "candidateAttemptId" | "candidateOutputDigest"
> => {
  const review = props.request.selectionReview;
  if (
    review === null ||
    review.candidateAttemptId !== props.receipt.attemptId ||
    review.candidateOutputDigest !== props.receipt.output.digest
  )
    throw new Error(
      `Repaint selection review for shot "${props.receipt.shot}" must name this candidate's exact attempt id and output digest. Review the generated candidate and full sequence before editing repaintSelectionReviews.ts and selecting it.`,
    );
  const { candidateAttemptId, candidateOutputDigest, ...observation } = review;
  void candidateAttemptId;
  void candidateOutputDigest;
  return observation;
};

const assertRepaintReceiptMatchesSelection = (
  selected: IAutoMovieProductionRepaintSelection,
  receipt: IAutoMovieRepaintReceipt,
): void => {
  let runtime: unknown;
  try {
    runtime = JSON.parse(receipt.adapterIdentity);
  } catch {
    throw new Error(
      `Repaint receipt for shot "${receipt.shot}" has a non-JSON adapter identity.`,
    );
  }
  const reviewed = selected.requests.find(
    (request) => request.shot === receipt.shot,
  );
  if (
    receipt.version !== 4 ||
    receipt.requestId === undefined ||
    repaintUuid(receipt.requestId, "Repaint receipt requestId") !==
      receipt.requestId ||
    repaintUuid(receipt.attemptId, "Repaint receipt attemptId") !==
      receipt.attemptId ||
    receipt.startedAt === undefined ||
    receipt.completedAt === undefined ||
    receipt.executionPolicy === undefined ||
    receipt.evidence === undefined ||
    exactUtcInstant(receipt.startedAt, "Repaint receipt startedAt") >
      exactUtcInstant(receipt.completedAt, "Repaint receipt completedAt") ||
    assertAutoMovieExternalGeneratorTermsAt({
      termsCheckedAt: receipt.generatorProvenance.termsCheckedAt,
      occurredAt: receipt.startedAt,
      label: `Repaint receipt for shot "${receipt.shot}" generator provenance`,
    }) !== receipt.generatorProvenance.termsCheckedAt ||
    canonicalizeAutoMovieJson(runtime) !==
      canonicalizeAutoMovieJson(selected.generator.runtimeIdentity) ||
    canonicalizeAutoMovieJson(receipt.generatorProvenance) !==
      canonicalizeAutoMovieJson(selected.generator.generatorProvenance) ||
    reviewed === undefined ||
    reviewed.selectionReview === null ||
    reviewed.selectionReview.candidateAttemptId !== receipt.attemptId ||
    reviewed.selectionReview.candidateOutputDigest !== receipt.output.digest ||
    canonicalizeAutoMovieJson(receipt.executionPolicy) !==
      canonicalizeAutoMovieJson(selected.executionPolicy) ||
    canonicalizeAutoMovieJson(receipt.parameters) !==
      canonicalizeAutoMovieJson(reviewed.parameters) ||
    canonicalizeAutoMovieJson(
      receipt.references.map(({ role, path }) => ({ role, path })),
    ) !== canonicalizeAutoMovieJson(reviewed.references) ||
    canonicalizeAutoMovieJson(receipt.evidence) !==
      canonicalizeAutoMovieJson(reviewed.evidence) ||
    receipt.structuralAuthority !== "deterministic-source-only"
  )
    throw new Error(
      `Repaint receipt for shot "${receipt.shot}" does not match the current reviewed generator adoption, bounded policy, evidence-addressed request, execution time, or deterministic structural-authority boundary.`,
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
  occurredAt: Date | string,
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
  const termsCheckedAt = assertAutoMovieExternalGeneratorTermsAt({
    termsCheckedAt: value.termsCheckedAt,
    occurredAt,
    label,
  });
  const consumer = exactObject(value.consumer, `${label}.consumer`, [
    "kind",
    "reason",
  ]);
  if (consumer.kind !== kind)
    throw new Error(`${label}.consumer.kind must be "${kind}".`);
  const source = nonBlank(value.source, `${label}.source`);
  const license = nonBlank(value.license, `${label}.license`);
  if (
    autoMovieExternalLocatorRefusal(source) !== null ||
    autoMovieExternalLocatorRefusal(license) !== null
  )
    throw new Error(
      `${label} source and license locators must not contain credentials.`,
    );
  return {
    source,
    license,
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

const readRepaintExecutionPolicy = (
  input: unknown,
  label: string,
): IAutoMovieRepaintExecutionPolicy => {
  const value = exactObject(input, label, [
    "maximumAttempts",
    "attemptTimeoutMs",
    "maximumElapsedMs",
    "maximumCostUnits",
    "backoffMs",
    "retryableFailures",
  ]);
  if (
    Array.isArray(value.backoffMs) === false ||
    Array.isArray(value.retryableFailures) === false
  )
    throw new Error(
      `${label}.backoffMs and ${label}.retryableFailures must be arrays.`,
    );
  const policy: IAutoMovieRepaintExecutionPolicy = {
    maximumAttempts: value.maximumAttempts as number,
    attemptTimeoutMs: value.attemptTimeoutMs as number,
    maximumElapsedMs: value.maximumElapsedMs as number,
    maximumCostUnits: value.maximumCostUnits as number,
    backoffMs: [...value.backoffMs] as number[],
    retryableFailures: [
      ...value.retryableFailures,
    ] as IAutoMovieRepaintExecutionPolicy["retryableFailures"],
  };
  assertAutoMovieRepaintExecutionPolicy(policy);
  return policy;
};

const readRepaintEvidence = (
  input: unknown,
  label: string,
): IAutoMovieRepaintRequestEvidence => {
  const value = exactObject(input, label, [
    "prompt",
    "continuity",
    "settings",
    "design",
    "screenplayOrBrief",
    "shot",
  ]);
  if (value.continuity !== null && typeof value.continuity !== "string")
    throw new Error(`${label}.continuity must be null or an evidence address.`);
  return {
    prompt: nonBlank(value.prompt, `${label}.prompt`),
    continuity:
      value.continuity === null
        ? null
        : nonBlank(value.continuity, `${label}.continuity`),
    settings: nonBlank(value.settings, `${label}.settings`),
    design: nonBlank(value.design, `${label}.design`),
    screenplayOrBrief: nonBlank(
      value.screenplayOrBrief,
      `${label}.screenplayOrBrief`,
    ),
    shot: nonBlank(value.shot, `${label}.shot`),
  };
};

const readRepaintSelectionReview = (
  input: unknown,
  label: string,
): IAutoMovieProductionRepaintSelectionReview | null => {
  if (input === null) return null;
  const value = exactObject(input, label, [
    "candidateAttemptId",
    "candidateOutputDigest",
    "reason",
    "structuralReview",
    "continuityReview",
  ]);
  if (value.continuityReview === null)
    return {
      candidateAttemptId: repaintUuid(
        value.candidateAttemptId,
        `${label}.candidateAttemptId`,
      ),
      candidateOutputDigest: repaintDigest(
        value.candidateOutputDigest,
        `${label}.candidateOutputDigest`,
      ),
      reason: nonBlank(value.reason, `${label}.reason`),
      structuralReview: nonBlank(
        value.structuralReview,
        `${label}.structuralReview`,
      ),
      continuityReview: null,
    };
  const continuity = exactObject(
    value.continuityReview,
    `${label}.continuityReview`,
    [
      "baseline",
      "playbackEvidence",
      "mixedDeliveryPolicy",
      "flicker",
      "identityDrift",
      "geometryWarp",
      "textureCrawl",
      "transitionMismatch",
    ],
  );
  if (
    continuity.mixedDeliveryPolicy !== null &&
    typeof continuity.mixedDeliveryPolicy !== "string"
  )
    throw new Error(
      `${label}.continuityReview.mixedDeliveryPolicy must be null or reviewed text.`,
    );
  for (const key of [
    "flicker",
    "identityDrift",
    "geometryWarp",
    "textureCrawl",
    "transitionMismatch",
  ] as const)
    if (continuity[key] !== "pass")
      throw new Error(
        `${label}.continuityReview.${key} must be the reviewed "pass" verdict.`,
      );
  return {
    candidateAttemptId: repaintUuid(
      value.candidateAttemptId,
      `${label}.candidateAttemptId`,
    ),
    candidateOutputDigest: repaintDigest(
      value.candidateOutputDigest,
      `${label}.candidateOutputDigest`,
    ),
    reason: nonBlank(value.reason, `${label}.reason`),
    structuralReview: nonBlank(
      value.structuralReview,
      `${label}.structuralReview`,
    ),
    continuityReview: {
      baseline: nonBlank(
        continuity.baseline,
        `${label}.continuityReview.baseline`,
      ),
      playbackEvidence: nonBlank(
        continuity.playbackEvidence,
        `${label}.continuityReview.playbackEvidence`,
      ),
      mixedDeliveryPolicy:
        continuity.mixedDeliveryPolicy === null
          ? null
          : nonBlank(
              continuity.mixedDeliveryPolicy,
              `${label}.continuityReview.mixedDeliveryPolicy`,
            ),
      flicker: "pass",
      identityDrift: "pass",
      geometryWarp: "pass",
      textureCrawl: "pass",
      transitionMismatch: "pass",
    },
  };
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
  return [...seen].sort(compareCodeUnits);
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const exactUtcInstant = (value: unknown, label: string): number => {
  if (typeof value !== "string")
    throw new Error(`${label} must be an exact UTC instant.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new Error(`${label} must be an exact UTC instant.`);
  return parsed.getTime();
};

const repaintUuid = (value: unknown, label: string): string => {
  const id = nonBlank(value, label);
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      id,
    ) === false
  )
    throw new Error(`${label} must be a UUID v4.`);
  return id;
};

const repaintDigest = (value: unknown, label: string): string => {
  const digest = nonBlank(value, label);
  if (/^sha256:[0-9a-f]{64}$/u.test(digest) === false)
    throw new Error(`${label} must be a sha256 content digest.`);
  return digest;
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
