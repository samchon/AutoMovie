import { resolveProductionFrameRate } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieProductionPublicationIdentity,
} from "@automovie/interface";
import path from "node:path";
import typia from "typia";

import { canonicalAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";
import {
  type IAutoMovieProductionRenderJobPlan,
  resolveProductionRenderTierFrameFormat,
} from "./productionRenderJob";

type PublicationBasis = Omit<
  IAutoMovieProductionPublicationIdentity,
  "fingerprint"
>;

const digestValue = (value: unknown): AutoMovieContentDigest =>
  digestAutoMovieBytes(canonicalAutoMovieJsonBytes(value));

const CONTENT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

const nonBlank = (value: string): boolean =>
  value.trim().length !== 0 && value === value.trim();

const sameCanonicalJson = (left: unknown, right: unknown): boolean =>
  Buffer.from(canonicalAutoMovieJsonBytes(left)).equals(
    Buffer.from(canonicalAutoMovieJsonBytes(right)),
  );

/**
 * Refuse a structurally typed identity that no render plan could have produced.
 *
 * `typia` settles shape; this settles the invariants the planner holds by
 * construction, so a stored identity cannot pass recomputation while naming a
 * blank production, a digest that is not a digest, a tier projection the
 * planner would refuse, or a chunk population that does not partition the
 * planned extent.
 */
const assertPublicationSemantics = (
  identity: IAutoMovieProductionPublicationIdentity,
): void => {
  const runtime = identity.runtimeIdentity;
  if (
    nonBlank(identity.productionId) === false ||
    nonBlank(runtime.encoder.package) === false ||
    nonBlank(runtime.encoder.version) === false
  )
    throw new Error(
      "Production publication identity names a blank production or encoder package.",
    );
  if (
    [
      identity.compileFingerprint,
      identity.editFingerprint,
      runtime.sourceDigest,
      ...(runtime.dialogueRuntimeIdentity === null
        ? []
        : [runtime.dialogueRuntimeIdentity]),
      runtime.encoder.closureDigest,
      identity.tracks.captions,
      identity.tracks.audio,
      identity.tracks.audioAssets,
      identity.tracks.effects,
    ].some((value) => CONTENT_DIGEST.test(value) === false)
  )
    throw new Error(
      "Production publication identity carries a malformed content digest.",
    );
  canonicalAutoMovieCaptureRuntimeIdentity(runtime.capture);
  for (const format of [identity.sourceFrameFormat, identity.frameFormat]) {
    if (
      Number.isSafeInteger(format.width) === false ||
      format.width <= 0 ||
      Number.isSafeInteger(format.height) === false ||
      format.height <= 0
    )
      throw new Error(
        "Production publication frame format raster is not a positive integer size.",
      );
    resolveProductionFrameRate(format);
  }
  if (
    sameCanonicalJson(
      identity.frameFormat,
      resolveProductionRenderTierFrameFormat(
        identity.sourceFrameFormat,
        identity.tier,
      ),
    ) === false
  )
    throw new Error(
      "Production publication frame format is not the tier projection of its source frame format.",
    );
  if (
    Number.isSafeInteger(identity.totalFrames) === false ||
    identity.totalFrames <= 0 ||
    Number.isSafeInteger(identity.chunkFrames) === false ||
    identity.chunkFrames <= 0
  )
    throw new Error("Production publication frame or chunk extent is invalid.");
  const slots = new Set<string>();
  const ids = new Set<string>();
  const series = new Map<
    string,
    { kind: "feature" | "guide-pass"; pass: string; end: number }
  >();
  for (const chunk of identity.chunks) {
    if (
      nonBlank(chunk.slot) === false ||
      nonBlank(chunk.deliverable) === false ||
      CONTENT_DIGEST.test(chunk.id) === false ||
      CONTENT_DIGEST.test(chunk.frames) === false ||
      (chunk.kind === "feature") !== (chunk.pass === "beauty") ||
      slots.has(chunk.slot.toLowerCase()) ||
      ids.has(chunk.id)
    )
      throw new Error(
        "Production publication chunk identity is malformed, duplicated, or pairs a deliverable kind with a foreign pass.",
      );
    slots.add(chunk.slot.toLowerCase());
    ids.add(chunk.id);
    const previous = series.get(chunk.deliverable) ?? {
      kind: chunk.kind,
      pass: chunk.pass,
      end: 0,
    };
    const span = chunk.frameEndExclusive - chunk.frameStart;
    if (
      previous.kind !== chunk.kind ||
      previous.pass !== chunk.pass ||
      chunk.frameStart !== previous.end ||
      Number.isSafeInteger(chunk.frameEndExclusive) === false ||
      span <= 0 ||
      span > identity.chunkFrames ||
      (span < identity.chunkFrames &&
        chunk.frameEndExclusive !== identity.totalFrames) ||
      chunk.frameEndExclusive > identity.totalFrames
    )
      throw new Error(
        `Production publication chunk "${chunk.slot}" does not continue one exact partition of its deliverable's planned extent.`,
      );
    series.set(chunk.deliverable, {
      kind: chunk.kind,
      pass: chunk.pass,
      end: chunk.frameEndExclusive,
    });
  }
  for (const [deliverable, state] of series)
    if (state.end !== identity.totalFrames)
      throw new Error(
        `Production publication deliverable "${deliverable}" chunks stop at frame ${state.end} of ${identity.totalFrames}.`,
      );
};

const publicationBasis = (
  plan: IAutoMovieProductionRenderJobPlan,
): PublicationBasis => ({
  protocolVersion: "automovie.production-publication.v4",
  planVersion: plan.version,
  productionId: plan.productionId,
  compileFingerprint: plan.compileFingerprint,
  editFingerprint: plan.editFingerprint,
  runtimeIdentity: structuredClone(plan.runtimeIdentity),
  tier: structuredClone(plan.tier),
  sourceFrameFormat: structuredClone(plan.sourceFrameFormat),
  frameFormat: structuredClone(plan.frameFormat),
  totalFrames: plan.totalFrames,
  chunkFrames: plan.chunkFrames,
  chunks: plan.chunks.map((chunk) => ({
    slot: chunk.slot,
    id: chunk.id,
    deliverable: chunk.deliverable,
    kind: chunk.kind,
    pass: chunk.pass,
    frameStart: chunk.frameStart,
    frameEndExclusive: chunk.frameEndExclusive,
    frames: digestValue(chunk.frames),
  })),
  tracks: {
    captions: digestValue(plan.tracks.captions),
    audio: digestValue(plan.tracks.audio),
    audioAssets: digestValue(plan.tracks.audioAssets),
    effects: digestValue(plan.tracks.effects),
  },
});

/**
 * Build the self-verifying identity of one exact persisted render plan.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Preserves the complete capture, dialogue, and encoder generation that produced a publication.
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Makes every meaningful plan or runtime change produce a distinct final-publication identity.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity Produces a canonical structured basis whose fingerprint can be recomputed without trusting its path.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-publication-preconditions Supplies the exact candidate generation checked before terminal commit.
 */
export const productionRenderPublicationIdentity = (
  plan: IAutoMovieProductionRenderJobPlan,
): IAutoMovieProductionPublicationIdentity => {
  const basis = publicationBasis(plan);
  return {
    ...basis,
    fingerprint: digestValue(basis),
  };
};

/**
 * Strictly parse and recompute one stored publication identity.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Refuses malformed or internally inconsistent publication provenance rather than treating it as current.
 * @evidence specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-resume-verified-artifacts Admits reuse only after the complete stored identity validates and its digest recomputes.
 */
export const parseProductionRenderPublicationIdentity = (
  value: unknown,
): IAutoMovieProductionPublicationIdentity => {
  const validation =
    typia.validateEquals<IAutoMovieProductionPublicationIdentity>(value);
  if (validation.success === false)
    throw new Error(
      `Invalid production publication identity: ${validation.errors
        .map((error) => `${error.path} expects ${error.expected}`)
        .join("; ")}.`,
    );
  try {
    assertPublicationSemantics(validation.data);
  } catch (error) {
    throw new Error(
      `Invalid production publication identity: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const { fingerprint, ...basis } = validation.data;
  if (fingerprint !== digestValue(basis))
    throw new Error(
      "Production publication identity fingerprint does not match its canonical structured basis.",
    );
  return validation.data;
};

/**
 * Require stored provenance to equal the current same-tier render plan.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Prevents coincidentally identical output bytes from erasing the execution generation that produced them.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-publication-retention Keeps proxy and final histories independent while rejecting a stale generation within either tier.
 */
export const assertProductionRenderPublicationCurrent = (props: {
  identity: unknown;
  plan: IAutoMovieProductionRenderJobPlan;
}): IAutoMovieProductionPublicationIdentity => {
  const actual = parseProductionRenderPublicationIdentity(props.identity);
  const expected = productionRenderPublicationIdentity(props.plan);
  if (sameCanonicalJson(actual, expected) === false)
    throw new Error(
      `Stored ${actual.tier.kind} publication identity does not match the current ${expected.tier.kind} render plan. Replan and republish this tier.`,
    );
  return actual;
};

/**
 * Whether one publication path is a canonical portable relative identity.
 *
 * A manifest, receipt, or sidecar path is compared as bytes across platforms,
 * so one physical file must have exactly one spelling: forward slashes, no
 * root, drive, NUL, empty, `.`, or `..` segment, and already normalized.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Refuses a ledger path alias that would let one physical output be claimed or missed under a second spelling.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity Fixes the portable path identity that manifest and receipt entries are joined on.
 */
export const isPortableProductionPublicationPath = (value: string): boolean =>
  value.length !== 0 &&
  value.includes("\\") === false &&
  value.includes("\0") === false &&
  value.startsWith("/") === false &&
  /^[A-Za-z]:/u.test(value) === false &&
  path.posix.normalize(value) === value &&
  value
    .split("/")
    .every(
      (segment) => segment.length !== 0 && segment !== "." && segment !== "..",
    );
