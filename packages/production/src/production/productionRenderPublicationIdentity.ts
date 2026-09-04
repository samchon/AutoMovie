import type {
  AutoMovieContentDigest,
  IAutoMovieProductionPublicationIdentity,
} from "@automovie/interface";
import typia from "typia";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";
import type { IAutoMovieProductionRenderJobPlan } from "./productionRenderJob";

type PublicationBasis = Omit<
  IAutoMovieProductionPublicationIdentity,
  "fingerprint"
>;

const digestValue = (value: unknown): AutoMovieContentDigest =>
  digestAutoMovieBytes(canonicalAutoMovieJsonBytes(value));

const publicationBasis = (
  plan: IAutoMovieProductionRenderJobPlan,
): PublicationBasis => ({
  protocolVersion: "automovie.production-publication.v3",
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
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(actual)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(expected)),
    ) === false
  )
    throw new Error(
      `Stored ${actual.tier.kind} publication identity does not match the current ${expected.tier.kind} render plan. Replan and republish this tier.`,
    );
  return actual;
};
