import type {
  IAutoMovieProductionSoundEvent,
  IAutoMovieSoundPropagationProfile,
} from "@automovie/interface";

/**
 * Derive one declared emitter-to-listener propagation result.
 *
 * Delay is rounded once onto the film clock. The production's segment-boundary
 * choice then either carries the arrival across the cut or marks it trimmed; an
 * arrival outside the finished film is always refused. The `none` spectral
 * choice remains `null`, never a successful absorption estimate.
 *
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Computes delay, distance gain, and declared spectral loss together.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Produces the shared deterministic event result.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-propagation-refusal Rejects incomplete or invalid physical inputs without a generic fallback.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-occlusion-and-propagation-failure Keeps unsupported facts out of a successful path.
 * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Computes one rounded audible-arrival frame.
 * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-refusal Refuses invalid event timing and arrivals outside the finished film.
 * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Rounds propagation delay exactly once onto the film frame boundary.
 * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Derives presentation arrival from declared emission time and distance.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-failure-contract Refuses invalid propagation inputs rather than emitting a plausible cue result.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Preserves the event emission clock while deriving presentation arrival.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Computes one deterministic film-frame arrival.
 */
export const deriveAutoMovieSoundPropagation = (props: {
  /** Effective source/listener distance in metres. */
  distanceMeters: number;
  /** Exact story emission frame. */
  emissionFrame: number;
  /** Exclusive end of the owning film segment. */
  segmentEndFrame: number;
  /** Production frame rate. */
  fps: number;
  /** Exclusive finished-film frame bound. */
  totalFrames: number;
  /** Explicitly selected production propagation profile. */
  profile: IAutoMovieSoundPropagationProfile;
}): NonNullable<IAutoMovieProductionSoundEvent["propagation"]> => {
  assertFiniteNonnegative(props.distanceMeters, "sound propagation distance");
  assertInteger(props.emissionFrame, "sound propagation emission frame", 0);
  assertInteger(
    props.segmentEndFrame,
    "sound propagation segment end frame",
    props.emissionFrame + 1,
  );
  assertFinitePositive(props.fps, "sound propagation frame rate");
  assertInteger(props.totalFrames, "sound propagation total frames", 1);
  if (props.emissionFrame >= props.totalFrames)
    throw new Error("sound propagation emission frame lies outside the film");
  if (props.segmentEndFrame > props.totalFrames)
    throw new Error("sound propagation segment end lies outside the film");
  if (props.profile.id.trim().length === 0)
    throw new Error("sound propagation profile id must not be blank");
  assertFinitePositive(
    props.profile.speedOfSoundMetersPerSecond,
    "sound propagation speed",
  );
  if (props.profile.distanceGain.kind !== "softened-inverse-square-v1")
    throw new Error("sound propagation distance-gain law is unsupported");
  assertFiniteNonnegative(
    props.profile.distanceGain.coefficient,
    "sound propagation distance coefficient",
  );
  if (
    props.profile.assumptions.length === 0 ||
    props.profile.assumptions.some(
      (assumption) => assumption.trim().length === 0,
    )
  )
    throw new Error(
      "sound propagation profile must state non-blank physical assumptions",
    );
  if (
    props.profile.segmentBoundary !== "carry-across-cut" &&
    props.profile.segmentBoundary !== "trim-at-segment"
  )
    throw new Error("sound propagation segment-boundary policy is unsupported");

  const delaySeconds =
    props.distanceMeters / props.profile.speedOfSoundMetersPerSecond;
  const arrivalFrame =
    props.emissionFrame + Math.round(delaySeconds * props.fps);
  if (arrivalFrame >= props.totalFrames)
    throw new Error(
      `sound propagation arrival frame ${arrivalFrame} lies outside the ${props.totalFrames}-frame film`,
    );
  const crossed = arrivalFrame >= props.segmentEndFrame;
  const boundary = crossed
    ? props.profile.segmentBoundary === "carry-across-cut"
      ? "carried-across-cut"
      : "trimmed-at-segment"
    : "inside-segment";

  let highFrequencyGain: number | null;
  if (props.profile.spectral.kind === "none") highFrequencyGain = null;
  else if (props.profile.spectral.kind === "broadband-high-frequency-v1") {
    assertFiniteNonnegative(
      props.profile.spectral.absorptionDbPerMeter,
      "sound propagation high-frequency absorption",
    );
    highFrequencyGain = Math.pow(
      10,
      (-props.profile.spectral.absorptionDbPerMeter * props.distanceMeters) /
        20,
    );
  } else throw new Error("sound propagation spectral law is unsupported");

  return {
    profile: props.profile.id,
    arrivalFrame,
    arrivalTimeSeconds: arrivalFrame / props.fps,
    distanceGain:
      1 /
      (1 +
        props.profile.distanceGain.coefficient *
          props.distanceMeters *
          props.distanceMeters),
    highFrequencyGain,
    boundary,
  };
};

const assertFinitePositive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be finite and positive`);
};

const assertFiniteNonnegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be finite and non-negative`);
};

const assertInteger = (value: number, label: string, minimum: number): void => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${label} must be an integer at least ${minimum}`);
};
