import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import {
  AutoMovieContentDigest,
  IAutoMovieProductionFrameRate,
  IAutoMovieShotEventContract,
} from "./IAutoMovieProductionDesign";

/**
 * Production-selected bounded direct-path propagation model.
 *
 * AutoMovie supplies the calculation, not atmospheric content. Every physical
 * scalar and the cut-boundary decision are declared by the production.
 *
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Makes sound speed, distance gain, and spectral absorption one declared model.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Defines the deterministic direct-path inputs without inferring climate or provider state.
 * @author Samchon
 */
export interface IAutoMovieSoundPropagationProfile {
  /**
   * Stable profile identity within the production.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Binds events to one declared propagation model.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Identifies the exact calculation inputs.
   */
  id: string;
  /**
   * Finite strictly positive propagation speed in meters per second.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Makes propagation delay production-owned.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Supplies arrival-time calculation speed.
   */
  speedOfSoundMetersPerSecond: number;
  /**
   * Declared distance-gain law.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Prevents hidden attenuation defaults.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Selects the bounded gain calculation.
   */
  distanceGain: {
    /** Current bounded law, `1 / (1 + coefficient * distance^2)`. */
    kind: "softened-inverse-square-v1";
    /** Finite non-negative softening coefficient. */
    coefficient: number;
  };
  /**
   * Declared spectral treatment; `none` never masquerades as absorption.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Separates omitted spectral physics from modeled attenuation.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Makes spectral output conditional on a declared model.
   */
  spectral:
    | {
        /** No spectral propagation is claimed. */
        kind: "none";
      }
    | {
        /** One bounded broadband high-frequency attenuation stage. */
        kind: "broadband-high-frequency-v1";
        /** Finite non-negative high-frequency loss in dB per meter. */
        absorptionDbPerMeter: number;
      };
  /**
   * Authored edit decision when arrival lies beyond the source shot segment.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Leaves carry-versus-trim to the production.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Makes cut-boundary handling deterministic.
   */
  segmentBoundary: "carry-across-cut" | "trim-at-segment";
  /**
   * Non-empty statements of the physical assumptions this profile adopts.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Exposes the bounded model's claim assumptions.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Keeps physical interpretation explicit.
   */
  assumptions: string[];
}

/**
 * Production-selected source of room-response data.
 *
 * The choice is either the repository's bounded broadband room analysis or an
 * explicitly adopted external result. No solver, provider, asset, or mapping is
 * selected by the engine.
 *
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Keeps derived and externally adopted response sources equally expressible.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Carries the user's response-source choice and adopted-byte identity.
 */
export type IAutoMovieAcousticResponseProfile =
  | {
      /** Use the shared bounded room analysis. */
      kind: "derived-room-analysis";
      /** Stable profile identity within the production. */
      id: string;
      /** Closed calculation tier shared with architectural analysis. */
      solver: "sabine-broadband-v1";
    }
  | {
      /** Use a response artifact the production adopted. */
      kind: "adopted-response";
      /** Stable profile identity within the production. */
      id: string;
      /** Manifest-owned response asset path. */
      asset: string;
      /** Digest of the exact adopted bytes. */
      digest: AutoMovieContentDigest;
      /** Positive sample rate of an impulse-response asset. */
      sampleRate: number;
      /** Explicit source-room and listener-room mapping identities. */
      roomMappings: Array<{
        /** Source interior-space id. */
        source: string;
        /** Listener interior-space id. */
        listener: string;
        /** Stable response member inside the adopted asset. */
        response: string;
      }>;
      /** Optional provider metadata retained as provenance, never authority. */
      provider?: {
        /** External provider name retained from the adoption receipt. */
        name: string;
        /** Optional provider model identity. */
        model?: string;
        /** Optional provider model or service revision. */
        version?: string;
      };
    };

/**
 * One semantic event lowered from the compiled film edit into audible space.
 *
 * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `IAutoMovieProductionSoundEvent` as the portable data boundary for the sound event derived timing requirement.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `IAutoMovieProductionSoundEvent` for the sound cue kind and event timing system contract.
 */
export interface IAutoMovieProductionSoundEvent {
  /**
   * Stable occurrence id, including the owning film segment.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `id` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `id` for the sound cue kind and event timing system contract.
   */
  id: string;
  /**
   * Compiled shot that owns the event.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `shot` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `shot` for the sound cue kind and event timing system contract.
   */
  shot: string;
  /**
   * Authoritative event-contract id.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `event` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `event` for the sound cue kind and event timing system contract.
   */
  event: string;
  /**
   * Procedural sound family selected by the event contract.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `kind` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `kind` for the sound cue kind and event timing system contract.
   */
  kind: IAutoMovieShotEventContract["kind"];
  /**
   * Exact film-global event frame.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `frame` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `frame` for the sound cue kind and event timing system contract.
   */
  frame: number;
  /**
   * Exact frame-derived film time.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `timeSeconds` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `timeSeconds` for the sound cue kind and event timing system contract.
   */
  timeSeconds: number;
  /**
   * Sampled world-space source point.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `emitter` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `emitter` for the sound cue kind and event timing system contract.
   */
  emitter: IAutoMovieVector3;
  /**
   * Sampled world-space camera point.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `listener` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `listener` for the sound cue kind and event timing system contract.
   */
  listener: IAutoMovieVector3;
  /**
   * Euclidean distance in meters from the listener to `emitter`.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `distanceMeters` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `distanceMeters` for the sound cue kind and event timing system contract.
   */
  distanceMeters: number;
  /**
   * How many individual sources the event's subjects contain: one for a scene
   * node, the member count for a formation or an instance set, summed over
   * every subject the event names.
   *
   * This is what makes a mass sound like a mass. A group used to contribute
   * exactly one emitter no matter how many stood in it, so three people and a
   * hundred thousand were acoustically identical.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `memberCount` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `memberCount` for the sound cue kind and event timing system contract.
   */
  memberCount: number;
  /**
   * Root-mean-square distance in meters from `emitter` to those members: the
   * source's own size.
   *
   * Zero for a single node. A crowd has a radius, and a source with a radius is
   * not a point: it cannot be all in one place in the stereo field, and the
   * listener is not the same distance from all of it.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `spreadRadiusMeters` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `spreadRadiusMeters` for the sound cue kind and event timing system contract.
   */
  spreadRadiusMeters: number;
  /**
   * Level factor for `memberCount` mutually uncorrelated sources,
   * `sqrt(memberCount)`.
   *
   * Independent sources add in POWER, not in amplitude, because their cross
   * terms average to zero over time: `p_total^2 = N * p_single^2`, so the
   * amplitude gain is `sqrt(N)` and the level rises `10*log10(N)` dB per the
   * standard incoherent-summation result (coherent, perfectly in-phase sources
   * would instead give `N` and `20*log10(N)` dB, which no crowd is). Ten voices
   * are 10 dB over one, a hundred are 20 dB over one.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `densityGain` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `densityGain` for the sound cue kind and event timing system contract.
   */
  densityGain: number;
  /**
   * Camera-relative stereo position from -1 (left) through 1 (right), narrowed
   * by the source's own angular width: `local.x / hypot(distanceMeters,
   * spreadRadiusMeters)`.
   *
   * A wide crowd close to the listener occupies a span of the stereo field
   * rather than a point in it, and its energy-weighted image sits nearer the
   * center than its centroid's direction alone would put it; a distant one has
   * no width left to speak of and pans exactly as a point source does.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `pan` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `pan` for the sound cue kind and event timing system contract.
   */
  pan: number;
  /**
   * Distance-derived dry gain from zero through one, taken at the
   * root-mean-square source/listener distance `hypot(distanceMeters,
   * spreadRadiusMeters)` rather than at the centroid alone.
   *
   * That substitution is an identity, not a fudge: for members distributed with
   * RMS radius `a` about a centroid at distance `d`, the mean squared
   * listener-to-member distance is exactly `d^2 + a^2`. It is what keeps a
   * sprawling crowd underfoot from attenuating as though every member stood at
   * one point in its middle.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `attenuation` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `attenuation` for the sound cue kind and event timing system contract.
   */
  attenuation: number;
  /**
   * Direct-path propagation result when the production selected a profile.
   * Omitted only on the legacy dry path.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Keeps emission and listener arrival as distinct film times.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Carries deterministic arrival rounding and the selected cut-boundary outcome.
   */
  propagation?: {
    /** Selected production propagation profile id. */
    profile: string;
    /** Exact film-global listener-arrival frame. */
    arrivalFrame: number;
    /** Exact frame-derived listener-arrival time. */
    arrivalTimeSeconds: number;
    /** Distance gain derived by the declared law. */
    distanceGain: number;
    /** High-frequency linear gain, or null when no spectral model was claimed. */
    highFrequencyGain: number | null;
    /** Applied shot-boundary decision. */
    boundary: "inside-segment" | "carried-across-cut" | "trimmed-at-segment";
  };
  /**
   * Room-path result when the production selected an acoustic profile. Omitted
   * only on the legacy dry path.
   *
   * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Carries the exact room result selected for this event's mix path.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Distinguishes outdoor, same-room, different-room, unsupported, and not-run outcomes.
   */
  acousticResponse?: IAutoMovieProductionAcousticResponse;
  /**
   * Stable unsigned 32-bit procedural seed.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Exposes `seed` as the portable data boundary for the sound event derived timing requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Types `seed` for the sound cue kind and event timing system contract.
   */
  seed: number;
}

/**
 * Bounded room-path result consumed by the production mix.
 *
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Separates outdoor propagation, same-room response, and cross-room transmission.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Preserves unavailable analysis as unsupported or not-run rather than an invented effect.
 */
export type IAutoMovieProductionAcousticResponse =
  | {
      /** A bounded response is available. */
      status: "available";
      /** Outdoor direct path, same-room response, or cross-room transmission. */
      path: "outdoor" | "same-room" | "different-room";
      /** Selected production acoustic profile id. */
      profile: string;
      /** Digest of geometry, materials, openings, emitter, and listener input. */
      inputRevision: AutoMovieContentDigest;
      /** Same-room reverberation time in seconds, otherwise null. */
      reverberationTimeSeconds: number | null;
      /** Same-room direct-to-diffuse energy ratio, otherwise null. */
      directToDiffuseRatio: number | null;
      /** Different-room linear transmission gain, otherwise null. */
      transmissionGain: number | null;
    }
  | {
      /** Response could not be claimed or was not evaluated. */
      status: "unsupported" | "not-run";
      /** Path classification, or null when room binding itself was unavailable. */
      path: "outdoor" | "same-room" | "different-room" | null;
      /** Non-blank reason no response was consumed. */
      reason: string;
    };

/**
 * One authored timeline cue lowered into the deterministic procedural score.
 *
 * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `IAutoMovieProductionSoundCue` as the portable data boundary for the sound cue sample boundary requirement.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `IAutoMovieProductionSoundCue` for the sound cue sample boundary and arrival system contract.
 */
export interface IAutoMovieProductionSoundCue {
  /**
   * Exact authored cue id.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `id` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `id` for the sound cue sample boundary and arrival system contract.
   */
  id: string;
  /**
   * The asset this cue plays.
   *
   * Carried because a cue is a statement about a particular sound, and a plan
   * that dropped the name could only ever be rendered as a stand-in for one:
   * the renderer took the id to seed its noise and then had nothing left to
   * play. A caller decodes the asset and hands the samples in, exactly as it
   * already does for synthesized dialogue, so decoding stays outside the
   * deterministic mix and the mix stays a pure function of what it is given.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `asset` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `asset` for the sound cue sample boundary and arrival system contract.
   */
  asset: string;
  /**
   * Film-global inclusive start frame.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `startFrame` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `startFrame` for the sound cue sample boundary and arrival system contract.
   */
  startFrame: number;
  /**
   * Exact cue duration in film frames.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `durationFrames` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `durationFrames` for the sound cue sample boundary and arrival system contract.
   */
  durationFrames: number;
  /**
   * Source-asset frame at which this edit begins.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `sourceOffsetFrame` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `sourceOffsetFrame` for the sound cue sample boundary and arrival system contract.
   */
  sourceOffsetFrame: number;
  /**
   * Source-asset duration available to this edit.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `sourceDurationFrames` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `sourceDurationFrames` for the sound cue sample boundary and arrival system contract.
   */
  sourceDurationFrames: number;
  /**
   * Authored linear gain.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `gain` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `gain` for the sound cue sample boundary and arrival system contract.
   */
  gain: number;
  /**
   * Exact fade-in duration in film frames.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `fadeInFrames` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `fadeInFrames` for the sound cue sample boundary and arrival system contract.
   */
  fadeInFrames: number;
  /**
   * Exact fade-out duration in film frames.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `fadeOutFrames` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `fadeOutFrames` for the sound cue sample boundary and arrival system contract.
   */
  fadeOutFrames: number;
  /**
   * Compiler-owned mix bus.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `bus` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `bus` for the sound cue sample boundary and arrival system contract.
   */
  bus: "dialogue" | "music" | "effects" | "ambience";
  /**
   * Stable unsigned 32-bit procedural seed.
   *
   * @evidence requirements/sound/event-cues-and-timing.md#sound-cue-sample-boundary Exposes `seed` as the portable data boundary for the sound cue sample boundary requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Types `seed` for the sound cue sample boundary and arrival system contract.
   */
  seed: number;
}

/**
 * One caption placement that also owns its synthesized dialogue timing.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `IAutoMovieProductionDialogueLine` as the portable data boundary for the sound dialogue voice consistency requirement.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `IAutoMovieProductionDialogueLine` for the dialogue voice consistency and phoneme state system contract.
 */
export interface IAutoMovieProductionDialogueLine {
  /**
   * Exact compiler-owned caption id.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `id` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `id` for the dialogue voice consistency and phoneme state system contract.
   */
  id: string;
  /**
   * Spoken and captioned text.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `text` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `text` for the dialogue voice consistency and phoneme state system contract.
   */
  text: string;
  /**
   * BCP-47-ish authored language label.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `language` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `language` for the dialogue voice consistency and phoneme state system contract.
   */
  language: string;
  /**
   * Optional authored speaker identity.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `speaker` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `speaker` for the dialogue voice consistency and phoneme state system contract.
   */
  speaker?: string;
  /**
   * Film-global inclusive start frame.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `startFrame` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `startFrame` for the dialogue voice consistency and phoneme state system contract.
   */
  startFrame: number;
  /**
   * Film-global exclusive end frame.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-voice-consistency Exposes `endFrame` as the portable data boundary for the sound dialogue voice consistency requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Types `endFrame` for the dialogue voice consistency and phoneme state system contract.
   */
  endFrame: number;
}

/**
 * Complete deterministic sound input derived from one compiled film edit.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `IAutoMovieProductionSoundPlan` as the portable data boundary for the sound derived source closure requirement.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `IAutoMovieProductionSoundPlan` for the sound decode and derived source closure system contract.
 */
export interface IAutoMovieProductionSoundPlan {
  /**
   * Sound-plan schema.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `version` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `version` for the sound decode and derived source closure system contract.
   */
  version: 1;
  /**
   * Exact compiler input shared with the film timeline.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `inputFingerprint` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `inputFingerprint` for the sound decode and derived source closure system contract.
   */
  inputFingerprint: AutoMovieContentDigest;
  /**
   * Production frame rate.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `fps` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `fps` for the sound decode and derived source closure system contract.
   */
  fps: number;
  /**
   * Exact frame rate when `fps` is fractional. Integer legacy rates use an
   * equivalent denominator of one when this field is omitted.
   *
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Binds the sound plan to the exact production frame clock.
   * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Supplies the rational source clock for sample-boundary conversion.
   */
  frameRate?: IAutoMovieProductionFrameRate;
  /**
   * Exact finished-film frame count.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `totalFrames` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `totalFrames` for the sound decode and derived source closure system contract.
   */
  totalFrames: number;
  /**
   * Fixed output PCM sample rate.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `sampleRate` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `sampleRate` for the sound decode and derived source closure system contract.
   */
  sampleRate: 48_000;
  /**
   * Fixed interleaved stereo channel count.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `channels` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `channels` for the sound decode and derived source closure system contract.
   */
  channels: 2;
  /**
   * Selected direct-path propagation profile, or null for the byte-compatible
   * legacy dry path.
   *
   * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Makes propagation an explicit production choice.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Binds every propagated event to one declared model.
   */
  propagationProfile?: IAutoMovieSoundPropagationProfile;
  /**
   * Selected room-response source, or absent for the byte-compatible dry path.
   *
   * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Preserves the user's derived-versus-adopted response choice.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Carries provider-neutral response provenance into the mix plan.
   */
  acousticProfile?: IAutoMovieAcousticResponseProfile;
  /**
   * Ordered semantic sound occurrences.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `events` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `events` for the sound decode and derived source closure system contract.
   */
  events: IAutoMovieProductionSoundEvent[];
  /**
   * Ordered authored procedural score cues.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `cues` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `cues` for the sound decode and derived source closure system contract.
   */
  cues: IAutoMovieProductionSoundCue[];
  /**
   * Ordered dialogue/caption placements.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `dialogue` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `dialogue` for the sound decode and derived source closure system contract.
   */
  dialogue: IAutoMovieProductionDialogueLine[];
}

/**
 * One phoneme-derived mouth target on the production frame clock.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `IAutoMovieProductionViseme` as the portable data boundary for the sound derived source closure requirement.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `IAutoMovieProductionViseme` for the sound decode and derived source closure system contract.
 */
export interface IAutoMovieProductionViseme {
  /**
   * Source phoneme or grapheme token.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `phoneme` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `phoneme` for the sound decode and derived source closure system contract.
   */
  phoneme: string;
  /**
   * VRM expression target, or `rest` for a closed/neutral mouth.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `viseme` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `viseme` for the sound decode and derived source closure system contract.
   */
  viseme: "aa" | "ih" | "ou" | "ee" | "oh" | "rest";
  /**
   * Film-global inclusive start frame.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `startFrame` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `startFrame` for the sound decode and derived source closure system contract.
   */
  startFrame: number;
  /**
   * Film-global exclusive end frame.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Exposes `endFrame` as the portable data boundary for the sound derived source closure requirement.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Types `endFrame` for the sound decode and derived source closure system contract.
   */
  endFrame: number;
}

/**
 * Actor join for visemes derived from one final dialogue receipt.
 *
 * Mouth motion stays on emission time. It layers only the mouth target over
 * authored expression and does not move to delayed listener-arrival time.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Joins final-byte visemes to the speaking actor without hand-authored syllable keys.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Makes emission-time mouth layering explicit and seek-stable.
 */
export type IAutoMovieProductionLipSyncJoin =
  | {
      /** Lip-sync can be applied. */
      status: "available";
      /** Actor id resolved from the authored speaker. */
      actor: string;
      /** Mouth movement follows visual emission, not delayed audio arrival. */
      timing: "emission";
      /** Preserve authored emotion outside the mouth target. */
      composition: "mouth-layer-over-authored-expression";
    }
  | {
      /** Lip-sync could not be joined. */
      status: "not-run";
      /** Exact missing or ambiguous join fact. */
      reason:
        | "speaker-not-declared"
        | "speaker-actor-not-found"
        | "speaker-actor-ambiguous";
    };

/**
 * One Kokoro stream chunk located on its model-native PCM clock.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence Exposes `IAutoMovieProductionPhonemeChunk` as the portable data boundary for the sound seek chunk equivalence requirement.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Types `IAutoMovieProductionPhonemeChunk` for the spatial extended group source aggregation system contract.
 */
export interface IAutoMovieProductionPhonemeChunk {
  /**
   * Chunk phonemes in synthesis order.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence Exposes `phonemes` as the portable data boundary for the sound seek chunk equivalence requirement.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Types `phonemes` for the spatial extended group source aggregation system contract.
   */
  phonemes: string;
  /**
   * Inclusive source-sample offset in the synthesized line.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence Exposes `startSample` as the portable data boundary for the sound seek chunk equivalence requirement.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Types `startSample` for the spatial extended group source aggregation system contract.
   */
  startSample: number;
  /**
   * Exclusive source-sample offset in the synthesized line.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-seek-chunk-equivalence Exposes `endSample` as the portable data boundary for the sound seek chunk equivalence requirement.
   * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Types `endSample` for the spatial extended group source aggregation system contract.
   */
  endSample: number;
}

/**
 * Content-addressed receipt for one locally synthesized Kokoro line.
 *
 * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `IAutoMovieProductionTtsReceipt` as the portable data boundary for the sound event synchronization requirement.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `IAutoMovieProductionTtsReceipt` for the sound event sync and boundary continuity system contract.
 */
export interface IAutoMovieProductionTtsReceipt {
  /**
   * Receipt schema.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `version` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `version` for the sound event sync and boundary continuity system contract.
   */
  version: 6;
  /**
   * Exact dialogue line id.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `line` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `line` for the sound event sync and boundary continuity system contract.
   */
  line: string;
  /**
   * Content address over text, voice, model, and inference arguments.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `cacheKey` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `cacheKey` for the sound event sync and boundary continuity system contract.
   */
  cacheKey: AutoMovieContentDigest;
  /**
   * Local Kokoro model identity.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `model` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `model` for the sound event sync and boundary continuity system contract.
   */
  model: "onnx-community/Kokoro-82M-v1.0-ONNX";
  /**
   * Immutable Hugging Face model revision.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `modelRevision` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `modelRevision` for the sound event sync and boundary continuity system contract.
   */
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231";
  /**
   * Kokoro voice identity.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `voice` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `voice` for the sound event sync and boundary continuity system contract.
   */
  voice: string;
  /**
   * Reviewed external-generator adoption retained with the generated bytes.
   *
   * Credentials are deliberately absent. The record identifies where the
   * generator came from, which rights and terms were reviewed, the authored
   * cost basis, and the exact production consumer affected by later change.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Carries the generator adoption facts with the exact synthesized line rather than leaving them outside the synchronized receipt.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Keeps the adopted generator context on the portable line receipt consumed across the sound-picture join.
   */
  generatorProvenance: {
    /** Stable provider, repository, or local-tool source address. */
    source: string;
    /** License identifier or stable terms location reviewed for this use. */
    license: string;
    /** Calendar date, `YYYY-MM-DD`, on which current terms were checked. */
    termsCheckedAt: string;
    /** Authored cost basis, including an explicit local-compute basis. */
    cost: string;
    /** Typed production consumer and authored reason for this adoption. */
    consumer: {
      /** Exact generated-content lane. */
      kind: "dialogue-synthesis";
      /** Why this production needs synthesized dialogue from this generator. */
      reason: string;
    };
  };
  /**
   * UTC instant captured immediately before the generator call that produced
   * this receipt's immutable PCM.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-source-provenance Prevents a future terms-review date from entering a generated-audio adoption or a resumed cache receipt.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#external-result-provider-neutrality Binds terms validation to an immutable generation instant without adding wall-clock state to content identity.
   */
  generatedAt: string;
  /**
   * Model-native PCM clock before deterministic resampling.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `sourceSampleRate` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `sourceSampleRate` for the sound event sync and boundary continuity system contract.
   */
  sourceSampleRate: number;
  /**
   * Exact cached mono source sample count.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `sourceSamples` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `sourceSamples` for the sound event sync and boundary continuity system contract.
   */
  sourceSamples: number;
  /**
   * Digest of cached little-endian Float32 PCM bytes.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `pcmDigest` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `pcmDigest` for the sound event sync and boundary continuity system contract.
   */
  pcmDigest: AutoMovieContentDigest;
  /**
   * Kokoro phoneme stream joined in synthesis order.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `phonemes` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `phonemes` for the sound event sync and boundary continuity system contract.
   */
  phonemes: string;
  /**
   * Phoneme chunks on the exact model-native PCM clock.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `phonemeChunks` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `phonemeChunks` for the sound event sync and boundary continuity system contract.
   */
  phonemeChunks: IAutoMovieProductionPhonemeChunk[];
  /**
   * Adapter, native backend, model-cache, and bundled-voice byte identity.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `runtimeAssets` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `runtimeAssets` for the sound event sync and boundary continuity system contract.
   */
  runtimeAssets: Array<{
    /** Stable package or revision-cache-relative asset name. */
    path: string;
    /** Digest of the exact bytes consumed by synthesis. */
    digest: AutoMovieContentDigest;
  }>;
  /**
   * Mouth targets derived from the same chunk sample clock.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `visemes` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `visemes` for the sound event sync and boundary continuity system contract.
   */
  visemes: IAutoMovieProductionViseme[];
  /**
   * Join from final-byte viseme timing to the authored speaking actor.
   *
   * Optional only for legacy receipts. New receipts record an available or
   * not-run outcome rather than silently dropping mouth motion.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Binds mouth timing to the same final bytes as audible dialogue.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Carries the deterministic actor join consumed before frame capture.
   *
   * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-event-synchronization Exposes `lipSync` as the portable data boundary for the sound event synchronization requirement.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Types `lipSync` for the sound event sync and boundary continuity system contract.
   */
  lipSync?: IAutoMovieProductionLipSyncJoin;
}

/**
 * Parser-independent evidence calculated from the final mixed PCM.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `IAutoMovieProductionSoundAnalysis` as the portable data boundary for the sound budget evidence requirement.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `IAutoMovieProductionSoundAnalysis` for the sound budget and audible review system contract.
 */
export interface IAutoMovieProductionSoundAnalysis {
  /**
   * Analysis schema.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `version` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `version` for the sound budget and audible review system contract.
   */
  version: 1;
  /**
   * Fixed output PCM clock.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `sampleRate` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `sampleRate` for the sound budget and audible review system contract.
   */
  sampleRate: 48_000;
  /**
   * Exact interleaved stereo frame count.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `sampleFrames` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `sampleFrames` for the sound budget and audible review system contract.
   */
  sampleFrames: number;
  /**
   * Runtime derived from the PCM clock.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `runtimeSeconds` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `runtimeSeconds` for the sound budget and audible review system contract.
   */
  runtimeSeconds: number;
  /**
   * ITU-R BS.1770 K-weighted, gated integrated loudness in LUFS.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `integratedLoudness` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `integratedLoudness` for the sound budget and audible review system contract.
   */
  integratedLoudness: number | null;
  /**
   * Absolute post-limiter sample peak.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `samplePeak` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `samplePeak` for the sound budget and audible review system contract.
   */
  samplePeak: number;
  /**
   * Number of post-limiter samples outside [-1, 1].
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `clippingSamples` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `clippingSamples` for the sound budget and audible review system contract.
   */
  clippingSamples: number;
  /**
   * Longest contiguous near-silent span.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `longestSilenceSeconds` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `longestSilenceSeconds` for the sound budget and audible review system contract.
   */
  longestSilenceSeconds: number;
  /**
   * Per-event energy evidence centered on the authoritative event frame.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-budget-evidence Exposes `eventAlignment` as the portable data boundary for the sound budget evidence requirement.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Types `eventAlignment` for the sound budget and audible review system contract.
   */
  eventAlignment: Array<{
    /** Stable sound occurrence id. */
    id: string;
    /** Exact expected event time. */
    expectedSeconds: number;
    /** Peak-energy sample time inside the event gate. */
    peakSeconds: number;
    /** Absolute frame-clock error. */
    errorFrames: number;
    /** Whether observable energy lands within one production frame. */
    passed: boolean;
  }>;
}

/**
 * Final encoded audio identity retained by sound evidence.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Binds the sound evidence to the exact final audio path, type, size, and bytes inspected for delivery.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Carries the final encoded audio inventory beside its plan and measurements.
 */
export interface IAutoMovieProductionSoundEvidenceAudio {
  /**
   * Render-root-relative sibling audio path.
   * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Binds evidence to the exact final audio member.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final audio inventory path.
   */
  path: string;
  /**
   * Closed final audio media type.
   * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Binds evidence to the encoded audio class.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final audio inventory type.
   */
  mediaType: "audio/mp4";
  /**
   * Exact sibling audio byte length.
   * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Binds evidence to the complete encoded byte population.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final audio size.
   */
  bytes: number;
  /**
   * Digest of the exact sibling audio bytes.
   * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Binds evidence to one encoded payload identity.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final audio digest.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Complete deterministic sound evidence bound to current plans and bytes.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Requires final sound evidence to identify its current plan, analysis, synthesis receipts, encoded bytes, and measurement basis.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Carries the complete measured evidence used by delivery validation rather than lossy aggregate counts.
 */
export interface IAutoMovieProductionSoundEvidence {
  /**
   * Complete evidence schema epoch.
   * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Refuses aggregate-only legacy evidence.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Identifies the complete evidence schema.
   */
  version: 2;
  /**
   * Exact current semantic sound plan.
   * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Preserves every planned event, cue, and dialogue identity.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Supplies the measured plan owner.
   */
  plan: IAutoMovieProductionSoundPlan;
  /**
   * Measurements of the exact pre-encode PCM.
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Preserves the complete current analysis.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Supplies the numeric evidence result.
   */
  analysis: IAutoMovieProductionSoundAnalysis;
  /**
   * Exact current dialogue synthesis receipts.
   * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Preserves each current dialogue byte and viseme identity.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Supplies the dialogue evidence population.
   */
  tts: IAutoMovieProductionTtsReceipt[];
  /**
   * Exact sibling final-audio identity.
   * @evidence requirements/sound/validation-and-delivery.md#sound-picture-delivery-join Joins the evidence to the encoded mix used by delivery.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the encoded audio inventory record.
   */
  audio: IAutoMovieProductionSoundEvidenceAudio;
  /**
   * Closed measurement source and algorithm identity.
   * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Prevents encoded-byte or unknown-method measurements from masquerading as current PCM analysis.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Supplies the measurement provenance.
   */
  measurement: {
    source: "pre-encode-pcm";
    algorithm: "automovie-production-sound-analysis-v1";
  };
}
