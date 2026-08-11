import type {
  AutoMovieContentDigest,
  IAutoMovieAcousticResponseProfile,
  IAutoMovieAnalysisRun,
  IAutoMovieProductionAcousticResponse,
} from "@automovie/interface";

import {
  type IAutoMovieAcousticRequest,
  analyzeAutoMovieAcoustics,
} from "../analysis/acousticAnalysis";
import { Vector3 } from "../math/Vector3";

/** Fixed internal diffuse-response tier: 20 ms taps, at most 32 and 2 s. */
const TAP_INTERVAL_SECONDS = 0.02;
const MAX_TAPS = 32;
const MAX_TAIL_SECONDS = 2;

/**
 * Derive the shared room-path result from a selected acoustic profile.
 *
 * Both spaces absent is outdoor. Exactly one absent is unsupported coupling.
 * The built-in profile runs the existing Sabine solver once; an adopted
 * response remains `not-run` here because this pure engine function receives no
 * adopted bytes. Same-room results carry T60 and a source/receiver-specific
 * direct-to-diffuse energy ratio. Cross-room results carry only partition
 * gain.
 *
 * @evidence requirements/sound/interior-acoustics.md#sound-room-binding Preserves outdoor, same-room, different-room, and unresolved paths.
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-input-revision Rejects a shared analysis request whose digest differs from the event revision and records the verified digest on every available response.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Produces the bounded response for the resolved room route.
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Reuses the shared analysis revision in audible processing.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Keeps absent analysis distinct from success.
 */
export const deriveAutoMovieInteriorAcousticResponse = (props: {
  /** Source space, or `null` outdoors. */
  sourceSpace: string | null;
  /** Listener space, or `null` outdoors. */
  listenerSpace: string | null;
  /** Exact geometry/material/emitter/listener input digest. */
  inputRevision: AutoMovieContentDigest;
  /** Shared acoustic request for the source room, when available. */
  request: IAutoMovieAcousticRequest | null;
  /** Explicit production-owned response source. */
  profile: IAutoMovieAcousticResponseProfile;
}): IAutoMovieProductionAcousticResponse => {
  if (props.profile.id.trim().length === 0)
    throw new Error("acoustic response profile id must not be blank");
  if (DIGEST_PATTERN.test(props.inputRevision) === false)
    throw new Error(
      "acoustic response input revision must be a SHA-256 digest",
    );
  if (props.sourceSpace === null && props.listenerSpace === null)
    return {
      status: "available",
      path: "outdoor",
      profile: props.profile.id,
      inputRevision: props.inputRevision,
      reverberationTimeSeconds: null,
      directToDiffuseRatio: null,
      transmissionGain: null,
    };
  if (props.sourceSpace === null || props.listenerSpace === null)
    return {
      status: "unsupported",
      path: null,
      reason:
        "source and listener room binding is incomplete; one endpoint is indoors and the other is unresolved",
    };
  const path =
    props.sourceSpace === props.listenerSpace ? "same-room" : "different-room";
  if (props.profile.kind === "adopted-response")
    return {
      status: "not-run",
      path,
      reason:
        "the selected adopted response must be decoded and mapped before the engine can consume it",
    };
  if (props.profile.solver !== "sabine-broadband-v1")
    throw new Error("acoustic response solver is unsupported");
  if (props.request === null)
    return {
      status: "not-run",
      path,
      reason: `space "${props.sourceSpace}" has no adopted acoustic analysis input`,
    };
  if (props.request.subject !== props.sourceSpace)
    throw new Error(
      `acoustic request subject "${props.request.subject}" does not match source space "${props.sourceSpace}"`,
    );
  if (props.request.inputRevision !== props.inputRevision)
    throw new Error(
      "acoustic request revision does not match the event input revision",
    );

  const analysis = analyzeAutoMovieAcoustics({ request: props.request });
  // The bounded acoustic analyzer always seals a solved run; unsupported
  // individual facts are metric gaps inside that solved outcome.
  const metrics = (
    analysis.outcome as Extract<
      IAutoMovieAnalysisRun["outcome"],
      { status: "solved" }
    >
  ).metrics;
  if (path === "same-room") {
    const reverberation = metricValue(metrics, "room.reverberationTime");
    const roomConstant = metricValue(metrics, "room.constant");
    if (reverberation === null || roomConstant === null)
      return {
        status: "unsupported",
        path,
        // The analyzer derives both diffuse-field metrics from one room
        // constant, so they gap together and share the reverberation reason.
        reason: metricGap(metrics, "room.reverberationTime"),
      };
    if (
      props.request.sources.length !== 1 ||
      props.request.receivers.length !== 1
    )
      return {
        status: "unsupported",
        path,
        reason:
          "an audible same-room response requires exactly one event source and one listener receiver",
      };
    const source = props.request.sources[0]!;
    const receiver = props.request.receivers[0]!;
    const distance = Vector3.length(
      Vector3.subtract(receiver.position, source.position),
    );
    const direct = source.directivity / (4 * Math.PI * distance * distance);
    const diffuse = 4 / roomConstant;
    return {
      status: "available",
      path,
      profile: props.profile.id,
      inputRevision: props.inputRevision,
      reverberationTimeSeconds: reverberation,
      directToDiffuseRatio: direct / diffuse,
      transmissionGain: null,
    };
  }

  const transmissionLoss = metricValue(
    metrics,
    "partition.compositeTransmissionLoss",
  );
  if (transmissionLoss === null)
    return {
      status: "unsupported",
      path,
      reason: metricGap(metrics, "partition.compositeTransmissionLoss"),
    };
  return {
    status: "available",
    path,
    profile: props.profile.id,
    inputRevision: props.inputRevision,
    reverberationTimeSeconds: null,
    directToDiffuseRatio: null,
    transmissionGain: Math.pow(10, -transmissionLoss / 20),
  };
};

/**
 * Apply the shared bounded room-path result to interleaved PCM.
 *
 * Outdoor input is copied exactly. Different-room input applies only the
 * declared transmission gain. Same-room input adds deterministic diffuse taps
 * at a fixed 20 ms interval, capped at 32 taps and two seconds, decaying to -60
 * dB at T60. This is a staging proxy, not a measured impulse response.
 *
 * @evidence requirements/sound/interior-acoustics.md#sound-bounded-room-response Applies a finite deterministic internal response tier.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Bounds tap count and tail duration.
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-claim-boundary Refuses unavailable responses instead of treating them as dry success.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Limits the claim to a broadband proxy.
 */
export const applyAutoMovieInteriorAcousticResponse = (props: {
  /** Input interleaved PCM. */
  samples: Float32Array;
  /** Positive channel count. */
  channels: number;
  /** Positive sample rate. */
  sampleRate: number;
  /** Shared event room-path result. */
  response: IAutoMovieProductionAcousticResponse;
}): Float32Array => {
  if (!Number.isSafeInteger(props.channels) || props.channels <= 0)
    throw new Error("acoustic response channels must be a positive integer");
  if (!Number.isSafeInteger(props.sampleRate) || props.sampleRate <= 0)
    throw new Error("acoustic response sample rate must be a positive integer");
  if (props.samples.length % props.channels !== 0)
    throw new Error("acoustic response PCM must contain complete frames");
  if (props.response.status !== "available")
    throw new Error(
      `cannot mix ${props.response.status} room response: ${props.response.reason}`,
    );
  if (props.response.path === "outdoor")
    return Float32Array.from(props.samples);
  if (props.response.path === "different-room") {
    const gain = props.response.transmissionGain;
    if (!Number.isFinite(gain) || gain === null || gain < 0 || gain > 1)
      throw new Error(
        "different-room response needs a transmission gain in [0, 1]",
      );
    return Float32Array.from(props.samples, (sample) => sample * gain);
  }

  const reverberation = props.response.reverberationTimeSeconds;
  const ratio = props.response.directToDiffuseRatio;
  if (
    !Number.isFinite(reverberation) ||
    reverberation === null ||
    reverberation <= 0
  )
    throw new Error("same-room response needs a positive reverberation time");
  if (!Number.isFinite(ratio) || ratio === null || ratio <= 0)
    throw new Error(
      "same-room response needs a positive direct-to-diffuse ratio",
    );
  const interval = Math.max(
    1,
    Math.round(TAP_INTERVAL_SECONDS * props.sampleRate),
  );
  const tail = Math.min(MAX_TAIL_SECONDS, reverberation);
  const taps = Math.min(
    MAX_TAPS,
    Math.floor((tail * props.sampleRate) / interval),
  );
  const output = new Float32Array(
    props.samples.length + taps * interval * props.channels,
  );
  output.set(props.samples);
  const wetGain = Math.min(1, 1 / Math.sqrt(ratio));
  for (let tap = 1; tap <= taps; ++tap) {
    const seconds = (tap * interval) / props.sampleRate;
    const gain = wetGain * Math.pow(10, (-3 * seconds) / reverberation);
    const offset = tap * interval * props.channels;
    for (let index = 0; index < props.samples.length; ++index)
      output[index + offset] += props.samples[index]! * gain;
  }
  return output;
};

const metricValue = (
  metrics: Extract<
    IAutoMovieAnalysisRun["outcome"],
    { status: "solved" }
  >["metrics"],
  key: string,
): number | null => metrics.find((metric) => metric.key === key)!.value ?? null;

const metricGap = (
  metrics: Extract<
    IAutoMovieAnalysisRun["outcome"],
    { status: "solved" }
  >["metrics"],
  key: string,
): string => metrics.find((candidate) => candidate.key === key)!.gap!.reason;

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
