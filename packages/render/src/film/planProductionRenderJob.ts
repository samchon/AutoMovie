import {
  autoMovieRenderDigest,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  equalProductionFrameRates,
  productionFilmEffectEditFingerprint,
  productionFrameBoundaryToGridTick,
  resolveProductionFrameRate,
  sampleProductionFilmEffects,
  sampleProductionRenderFrame,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
} from "@automovie/interface";

import { canonicalProductionWebVtt } from "../caption/canonicalProductionWebVtt";
import type { IAutoMovieProductionAudioAssetIdentity } from "./IAutoMovieProductionAudioAssetIdentity";
import type { IAutoMovieProductionRenderChunk } from "./IAutoMovieProductionRenderChunk";
import type { IAutoMovieProductionRenderJobPlan } from "./IAutoMovieProductionRenderJobPlan";
import type { IAutoMovieProductionRenderRuntimeIdentity } from "./IAutoMovieProductionRenderRuntimeIdentity";
import type { IAutoMovieProductionRenderTier } from "./IAutoMovieProductionRenderTier";
import { assertSingleGuidePass } from "./assertSingleGuidePass";
import { normalizeAudioAssets } from "./normalizeAudioAssets";
import { normalizeRenderTier } from "./normalizeRenderTier";
import { resolveProductionRenderTierFrameFormat } from "./resolveProductionRenderTierFrameFormat";
import { validDigest } from "./validDigest";

/**
 * Build content-addressed chunks from the builder-owned film edit.
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-sample-boundary Converts each cue declared source duration onto the asset own sample clock and refuses an asset whose sample count or duration disagrees, so a planned cue source boundary is an exact sample count rather than a rounded second. The delivered priming, tail and presentation boundary is verified by the Opus profile assertion against the encoded bytes.
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition Partitions the exact frame schedule into non-overlapping content-addressed chunks whose identity does not depend on chunk size or worker count.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Reads the compiled edit's start-inclusive, end-exclusive frame ranges with exact integer arithmetic rather than rounding a duration by frame rate.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal Refuses an invalid rate, an empty range or an unrepresentable frame count before any chunk is scheduled.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Carries the exact rational picture rate and the stream timebases as separate plan fields and never recomputes a duration from a decimal rate.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time Maps every output frame number of a tier to exactly one full-rate timeline frame and one exact time, so a proxy numbering has no duplicate, gap or off-by-one.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Slices every chunk from one global frame schedule, so a chunk or a retry carries exactly the frames a full render would.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Declares the one timeline frame per output frame at which capture resolves every shot layer and film effect.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Generates the ordered frame set from the exact rational clock and slices chunks from it, so subrange and full execution share each global frame's state.
 */
export const planProductionRenderJob = (props: {
  timeline: IAutoMovieFilmTimeline;
  effects: readonly IAutoMovieCompiledFilmEffect[];
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  chunkFrames: number;
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
  /** Explicit proxy/final policy; omitted is the exact final tier. */
  tier?: IAutoMovieProductionRenderTier;
}): IAutoMovieProductionRenderJobPlan => {
  if (
    Number.isSafeInteger(props.chunkFrames) === false ||
    props.chunkFrames <= 0
  )
    throw new Error(
      `chunkFrames must be a positive safe integer, but was ${props.chunkFrames}.`,
    );
  if (validDigest(props.runtimeIdentity.sourceDigest) === false)
    throw new Error(
      "Render runtime sourceDigest must be one current SHA-256 content identity.",
    );
  if (
    props.runtimeIdentity.dialogueRuntimeIdentity !== null &&
    validDigest(props.runtimeIdentity.dialogueRuntimeIdentity) === false
  )
    throw new Error(
      "Render runtime dialogueRuntimeIdentity must be null or one current SHA-256 content identity.",
    );
  const tier = normalizeRenderTier(props.tier);
  const frameFormat = resolveProductionRenderTierFrameFormat(
    props.production.frameFormat,
    tier,
  );
  const outputRate = resolveProductionFrameRate(frameFormat);
  if (frameFormat.width % 2 !== 0 || frameFormat.height % 2 !== 0)
    throw new Error(
      "The production H.264 render adapter requires even width and height.",
    );
  const timelineRate = resolveProductionFrameRate(props.timeline);
  const productionRate = resolveProductionFrameRate(
    props.production.frameFormat,
  );
  if (
    props.timeline.id !== props.production.id ||
    equalProductionFrameRates(timelineRate, productionRate) === false ||
    props.production.targetRuntimeSeconds !==
      (props.timeline.totalFrames * productionRate.denominator) /
        productionRate.numerator
  )
    throw new Error(
      "The film edit differs from the production identity, frame clock, or runtime. Recompile before planning.",
    );
  if (props.timeline.totalFrames % tier.frameStep !== 0)
    throw new Error(
      `Render tier "${tier.kind}" frameStep ${tier.frameStep} does not divide the ${props.timeline.totalFrames}-frame edit. Choose a divisor so proxy and final have the same exact runtime.`,
    );
  const audioAssets = normalizeAudioAssets(props.audioAssets);
  for (const cue of props.timeline.tracks.audio) {
    const asset = audioAssets.find((candidate) => candidate.path === cue.asset);
    // `sourceDurationFrames` is the cue's claim about the complete asset, so it
    // is checked where the asset's own clock is known: the declared frame count
    // must land on exactly the sample count the asset carries at its source
    // rate. The trim inside that duration is the mix's own refusal.
    const expectedSamples =
      asset === undefined
        ? null
        : productionFrameBoundaryToGridTick({
            frame: cue.sourceDurationFrames,
            frameRate: timelineRate,
            ticksPerSecond: asset.sampleRate,
            rounding: "nearest",
          });
    if (
      asset === undefined ||
      asset.sourceFrames !== expectedSamples ||
      asset.durationSeconds !== asset.sourceFrames / asset.sampleRate
    )
      throw new Error(
        `Audio cue "${cue.id}" lacks one digest-, format-, and duration-verified source asset.`,
      );
  }
  const legacyGuidePasses = assertSingleGuidePass(
    props.guidePasses ?? ["pose"],
  );
  const editFingerprint = productionFilmEffectEditFingerprint(props.timeline);
  sampleProductionFilmEffects({
    identity: {
      production: props.production.id,
      film: props.timeline.id,
      compileFingerprint: props.timeline.inputFingerprint,
      editFingerprint,
    },
    effects: props.effects.map((effect) => structuredClone(effect)),
    timelineFrame: 0,
  });
  const frames = Array.from(
    { length: props.timeline.totalFrames / tier.frameStep },
    (_, outputFrame) => {
      const timelineFrame = outputFrame * tier.frameStep;
      return {
        ...sampleProductionRenderFrame(props.timeline, timelineFrame),
        globalFrame: outputFrame,
        timelineFrame,
        timeSeconds:
          (outputFrame * outputRate.denominator) / outputRate.numerator,
      };
    },
  );
  const chunks: IAutoMovieProductionRenderChunk[] = [];
  for (const deliverable of props.production.deliverables) {
    // Only the two moving-image kinds carry chunks. Narrowing here rather than
    // resolving an empty pass list keeps the chunk's own `kind` exact, so a
    // caption or audio deliverable cannot reach a video parser probe.
    if (deliverable.kind !== "feature" && deliverable.kind !== "guide-pass")
      continue;
    const passes: readonly AutoMovieGuidePass[] =
      deliverable.kind === "feature"
        ? ["beauty"]
        : assertSingleGuidePass(
            deliverable.pass === undefined
              ? legacyGuidePasses
              : [deliverable.pass],
          );
    // The same arithmetic as `planChunkedSequenceRender`, deliberately not
    // shared with it. Both walk `k * chunkFrames` to
    // `min(start + chunkFrames, total)` and agree on every count and size tried,
    // but `index` means different things. There it is the ordinal the concat
    // reassembly walks, so the count is needed up front to fix a label width;
    // here it restarts for each deliverable and pass because it is one field of
    // a content-addressed slot. The admission rules differ as well: that planner
    // accepts any positive integer, this one only a positive safe integer. A
    // shared primitive would have to carry both contracts to save three lines.
    for (const pass of passes)
      for (
        let frameStart = 0, index = 0;
        frameStart < frames.length;
        frameStart += props.chunkFrames, ++index
      ) {
        const frameEndExclusive = Math.min(
          frameStart + props.chunkFrames,
          frames.length,
        );
        const range = frames.slice(frameStart, frameEndExclusive);
        const sources = [
          ...new Set(
            range.flatMap((frame) => frame.layers.map((layer) => layer.shot)),
          ),
        ]
          .sort(compareCodeUnits)
          .map((shot) => {
            const digest = props.sourceFingerprints[shot];
            if (digest === undefined || validDigest(digest) === false)
              throw new Error(
                `Render range references shot "${shot}" without one current builder-owned source fingerprint.`,
              );
            return { shot, digest };
          });
        const slot = `${props.production.id}:${tier.kind}:${deliverable.id}:${pass}:${index}`;
        const identity = {
          protocol: "automovie.production-render-chunk.v4",
          production: props.production.id,
          tier,
          deliverable: deliverable.id,
          kind: deliverable.kind,
          editFingerprint,
          effects: props.effects.map((effect) => effect.digest),
          sourceFrameFormat: props.production.frameFormat,
          frameFormat,
          frameStart,
          frameEndExclusive,
          pass,
          runtimeIdentity: props.runtimeIdentity,
          sources,
        };
        chunks.push({
          slot,
          id: autoMovieRenderDigest(canonicalizeAutoMovieJson(identity)),
          deliverable: deliverable.id,
          kind: deliverable.kind,
          pass,
          frameStart,
          frameEndExclusive,
          frames: range,
        });
      }
  }
  return {
    version: 4,
    productionId: props.production.id,
    compileFingerprint: props.timeline.inputFingerprint,
    editFingerprint,
    runtimeIdentity: props.runtimeIdentity,
    tier,
    sourceFrameFormat: structuredClone(props.production.frameFormat),
    frameFormat,
    totalFrames: frames.length,
    chunkFrames: props.chunkFrames,
    chunks,
    tracks: {
      captions: canonicalProductionWebVtt(props.timeline),
      audio: structuredClone(props.timeline.tracks.audio),
      audioAssets,
      effects: props.effects.map((effect) => structuredClone(effect)),
    },
  };
};
