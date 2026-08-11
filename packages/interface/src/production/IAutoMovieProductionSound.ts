import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import {
  AutoMovieContentDigest,
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
    /**
     * Current bounded law, `1 / (1 + coefficient * distance^2)`.
     *
     * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Names the exact gain law.
     * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Keeps distance gain deterministic and bounded.
     */
    kind: "softened-inverse-square-v1";
    /**
     * Finite non-negative softening coefficient.
     *
     * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Makes the law parameter explicit.
     * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Supplies the selected gain coefficient.
     */
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
        /**
         * No spectral propagation is claimed.
         *
         * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Preserves an explicit no-model state.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Prevents invented high-frequency gain.
         */
        kind: "none";
      }
    | {
        /**
         * One bounded broadband high-frequency attenuation stage.
         *
         * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Selects the production's bounded spectral tier.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Names the supported spectral calculation.
         */
        kind: "broadband-high-frequency-v1";
        /**
         * Finite non-negative high-frequency loss in dB per meter.
         *
         * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Declares the spectral loss parameter.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Supplies the deterministic high-frequency calculation input.
         */
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
      /**
       * Use the shared bounded room analysis.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Represents the production's derived-analysis choice.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Keeps derived analysis distinct from adopted bytes.
       */
      kind: "derived-room-analysis";
      /**
       * Stable profile identity within the production.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Identifies the selected response source.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Joins mix results to one profile.
       */
      id: string;
      /**
       * Closed calculation tier shared with architectural analysis.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Declares the bounded derived response tier.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Selects the supported broadband analysis.
       */
      solver: "sabine-broadband-v1";
    }
  | {
      /**
       * Use a response artifact the production adopted.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Represents the production's external adoption choice.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Keeps provider metadata non-authoritative.
       */
      kind: "adopted-response";
      /**
       * Stable profile identity within the production.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Identifies the selected response source.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Joins mix results to one adopted profile.
       */
      id: string;
      /**
       * Manifest-owned response asset path.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Binds selection to adopted project bytes.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Names the adopted response artifact.
       */
      asset: string;
      /**
       * Digest of the exact adopted bytes.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Makes the response provider-independent after adoption.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Binds evaluation to immutable response bytes.
       */
      digest: AutoMovieContentDigest;
      /**
       * Positive sample rate of an impulse-response asset.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Declares the adopted response clock.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Supplies the response decoding fact.
       */
      sampleRate: number;
      /**
       * Explicit source-room and listener-room mapping identities.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Leaves room mapping to the production.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Selects response members for exact room pairs.
       */
      roomMappings: Array<{
        /**
         * Source interior-space id.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Identifies the emitter room.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Keys the adopted room-pair mapping.
         */
        source: string;
        /**
         * Listener interior-space id.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Identifies the listener room.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Completes the adopted room-pair mapping.
         */
        listener: string;
        /**
         * Stable response member inside the adopted asset.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Makes response-member choice explicit.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Selects the exact adopted result.
         */
        response: string;
      }>;
      /**
       * Optional provider metadata retained as provenance, never authority.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Preserves provider identity without granting it selection authority.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Treats provider data as provenance only.
       */
      provider?: {
        /**
         * External provider name retained from the adoption receipt.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Records provenance without selecting a provider.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Keeps provider identity non-authoritative.
         */
        name: string;
        /**
         * Optional provider model identity.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Retains chosen-provider provenance when supplied.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Does not let model metadata replace adopted-byte identity.
         */
        model?: string;
        /**
         * Optional provider model or service revision.
         *
         * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Retains chosen-provider provenance when supplied.
         * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Does not let provider revision replace adopted-byte identity.
         */
        version?: string;
      };
    };

/** One semantic event lowered from the compiled film edit into audible space. */
export interface IAutoMovieProductionSoundEvent {
  /** Stable occurrence id, including the owning film segment. */
  id: string;
  /** Compiled shot that owns the event. */
  shot: string;
  /** Authoritative event-contract id. */
  event: string;
  /** Procedural sound family selected by the event contract. */
  kind: IAutoMovieShotEventContract["kind"];
  /** Exact film-global event frame. */
  frame: number;
  /** Exact frame-derived film time. */
  timeSeconds: number;
  /** Sampled world-space source point. */
  emitter: IAutoMovieVector3;
  /** Sampled world-space camera point. */
  listener: IAutoMovieVector3;
  /** Euclidean distance in meters from the listener to `emitter`. */
  distanceMeters: number;
  /**
   * How many individual sources the event's subjects contain: one for a scene
   * node, the member count for a formation or an instance set, summed over
   * every subject the event names.
   *
   * This is what makes a mass sound like a mass. A group used to contribute
   * exactly one emitter no matter how many stood in it, so three people and a
   * hundred thousand were acoustically identical.
   */
  memberCount: number;
  /**
   * Root-mean-square distance in meters from `emitter` to those members: the
   * source's own size.
   *
   * Zero for a single node. A crowd has a radius, and a source with a radius is
   * not a point: it cannot be all in one place in the stereo field, and the
   * listener is not the same distance from all of it.
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
    /**
     * Selected production propagation profile id.
     *
     * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Joins the result to the declared model.
     * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Identifies the exact calculation inputs.
     */
    profile: string;
    /**
     * Exact film-global listener-arrival frame.
     *
     * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Distinguishes arrival from emission.
     * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Carries frame-rounded listener arrival.
     */
    arrivalFrame: number;
    /**
     * Exact frame-derived listener-arrival time.
     *
     * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Exposes listener time without moving authored emission.
     * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Preserves the frame-clock derivation.
     */
    arrivalTimeSeconds: number;
    /**
     * Distance gain derived by the declared law.
     *
     * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Reports the selected attenuation result.
     * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Supplies the mix's direct-path gain.
     */
    distanceGain: number;
    /**
     * High-frequency linear gain, or null when no spectral model was claimed.
     *
     * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Keeps absent spectral modeling explicit.
     * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Separates a calculated gain from no claim.
     */
    highFrequencyGain: number | null;
    /**
     * Applied shot-boundary decision.
     *
     * @evidence requirements/sound/event-cues-and-timing.md#sound-arrival-time Records carry or trim at the cut.
     * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Preserves the selected boundary outcome.
     */
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
  /** Stable unsigned 32-bit procedural seed. */
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
      /**
       * A bounded response is available.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Marks an evaluated result as consumable.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Distinguishes availability from unsupported or not-run.
       */
      status: "available";
      /**
       * Outdoor direct path, same-room response, or cross-room transmission.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Selects the applicable acoustic path.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Keeps path-specific metrics separate.
       */
      path: "outdoor" | "same-room" | "different-room";
      /**
       * Selected production acoustic profile id.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality Joins the result to the user's source choice.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Identifies the exact response profile.
       */
      profile: string;
      /**
       * Digest of geometry, materials, openings, emitter, and listener input.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Binds the response to current spatial facts.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Makes stale room results detectable.
       */
      inputRevision: AutoMovieContentDigest;
      /**
       * Same-room reverberation time in seconds, otherwise null.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Exposes the bounded same-room response.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Restricts the metric to its applicable path.
       */
      reverberationTimeSeconds: number | null;
      /**
       * Same-room direct-to-diffuse energy ratio, otherwise null.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Exposes the bounded same-room balance.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Restricts the metric to its applicable path.
       */
      directToDiffuseRatio: number | null;
      /**
       * Different-room linear transmission gain, otherwise null.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Exposes the bounded cross-room result.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Restricts the metric to its applicable path.
       */
      transmissionGain: number | null;
    }
  | {
      /**
       * Response could not be claimed or was not evaluated.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Prevents unavailable analysis from becoming a wet mix.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Preserves unsupported and not-run states.
       */
      status: "unsupported" | "not-run";
      /**
       * Path classification, or null when room binding itself was unavailable.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Retains known path context on failure.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Distinguishes missing binding from a path-specific failure.
       */
      path: "outdoor" | "same-room" | "different-room" | null;
      /**
       * Non-blank reason no response was consumed.
       *
       * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Makes the non-consumption cause actionable.
       * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Refuses silent fallback to an invented response.
       */
      reason: string;
    };

/** One authored timeline cue lowered into the deterministic procedural score. */
export interface IAutoMovieProductionSoundCue {
  /** Exact authored cue id. */
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
   */
  asset: string;
  /** Film-global inclusive start frame. */
  startFrame: number;
  /** Exact cue duration in film frames. */
  durationFrames: number;
  /** Source-asset frame at which this edit begins. */
  sourceOffsetFrame: number;
  /** Source-asset duration available to this edit. */
  sourceDurationFrames: number;
  /** Authored linear gain. */
  gain: number;
  /** Exact fade-in duration in film frames. */
  fadeInFrames: number;
  /** Exact fade-out duration in film frames. */
  fadeOutFrames: number;
  /** Compiler-owned mix bus. */
  bus: "dialogue" | "music" | "effects" | "ambience";
  /** Stable unsigned 32-bit procedural seed. */
  seed: number;
}

/** One caption placement that also owns its synthesized dialogue timing. */
export interface IAutoMovieProductionDialogueLine {
  /** Exact compiler-owned caption id. */
  id: string;
  /** Spoken and captioned text. */
  text: string;
  /** BCP-47-ish authored language label. */
  language: string;
  /** Optional authored speaker identity. */
  speaker?: string;
  /** Film-global inclusive start frame. */
  startFrame: number;
  /** Film-global exclusive end frame. */
  endFrame: number;
}

/** Complete deterministic sound input derived from one compiled film edit. */
export interface IAutoMovieProductionSoundPlan {
  /** Sound-plan schema. */
  version: 1;
  /** Exact compiler input shared with the film timeline. */
  inputFingerprint: AutoMovieContentDigest;
  /** Production frame rate. */
  fps: number;
  /** Exact finished-film frame count. */
  totalFrames: number;
  /** Fixed output PCM sample rate. */
  sampleRate: 48_000;
  /** Fixed interleaved stereo channel count. */
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
  /** Ordered semantic sound occurrences. */
  events: IAutoMovieProductionSoundEvent[];
  /** Ordered authored procedural score cues. */
  cues: IAutoMovieProductionSoundCue[];
  /** Ordered dialogue/caption placements. */
  dialogue: IAutoMovieProductionDialogueLine[];
}

/** One phoneme-derived mouth target on the production frame clock. */
export interface IAutoMovieProductionViseme {
  /** Source phoneme or grapheme token. */
  phoneme: string;
  /** VRM expression target, or `rest` for a closed/neutral mouth. */
  viseme: "aa" | "ih" | "ou" | "ee" | "oh" | "rest";
  /** Film-global inclusive start frame. */
  startFrame: number;
  /** Film-global exclusive end frame. */
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
      /**
       * Lip-sync can be applied.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Marks a resolved final-byte actor join.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Distinguishes available mouth motion from not-run.
       */
      status: "available";
      /**
       * Actor id resolved from the authored speaker.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Joins dialogue to the selected performer.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Identifies the actor receiving mouth motion.
       */
      actor: string;
      /**
       * Mouth movement follows visual emission, not delayed audio arrival.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Keeps the speaking performance on authored emission time.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Separates visual mouth timing from listener arrival.
       */
      timing: "emission";
      /**
       * Preserve authored emotion outside the mouth target.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Prevents visemes from replacing authored expression.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Defines mouth-only composition.
       */
      composition: "mouth-layer-over-authored-expression";
    }
  | {
      /**
       * Lip-sync could not be joined.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Records a failed speaker-to-actor join.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Prevents silent loss of mouth motion.
       */
      status: "not-run";
      /**
       * Exact missing or ambiguous join fact.
       *
       * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-lipsync-join Identifies the authored fact that needs correction.
       * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Makes the non-join state actionable.
       */
      reason:
        | "speaker-not-declared"
        | "speaker-actor-not-found"
        | "speaker-actor-ambiguous";
    };

/** One Kokoro stream chunk located on its model-native PCM clock. */
export interface IAutoMovieProductionPhonemeChunk {
  /** Chunk phonemes in synthesis order. */
  phonemes: string;
  /** Inclusive source-sample offset in the synthesized line. */
  startSample: number;
  /** Exclusive source-sample offset in the synthesized line. */
  endSample: number;
}

/** Content-addressed receipt for one locally synthesized Kokoro line. */
export interface IAutoMovieProductionTtsReceipt {
  /** Receipt schema. */
  version: 2;
  /** Exact dialogue line id. */
  line: string;
  /** Content address over text, voice, model, and inference arguments. */
  cacheKey: AutoMovieContentDigest;
  /** Local Kokoro model identity. */
  model: "onnx-community/Kokoro-82M-v1.0-ONNX";
  /** Immutable Hugging Face model revision. */
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231";
  /** Kokoro voice identity. */
  voice: string;
  /** Model-native PCM clock before deterministic resampling. */
  sourceSampleRate: number;
  /** Exact cached mono source sample count. */
  sourceSamples: number;
  /** Digest of cached little-endian Float32 PCM bytes. */
  pcmDigest: AutoMovieContentDigest;
  /** Kokoro phoneme stream joined in synthesis order. */
  phonemes: string;
  /** Phoneme chunks on the exact model-native PCM clock. */
  phonemeChunks: IAutoMovieProductionPhonemeChunk[];
  /** Adapter, native backend, model-cache, and bundled-voice byte identity. */
  runtimeAssets: Array<{
    /** Stable package or revision-cache-relative asset name. */
    path: string;
    /** Digest of the exact bytes consumed by synthesis. */
    digest: AutoMovieContentDigest;
  }>;
  /** Mouth targets derived from the same chunk sample clock. */
  visemes: IAutoMovieProductionViseme[];
  /**
   * Join from final-byte viseme timing to the authored speaking actor.
   *
   * Optional only for legacy receipts. New receipts record an available or
   * not-run outcome rather than silently dropping mouth motion.
   *
   * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Binds mouth timing to the same final bytes as audible dialogue.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Carries the deterministic actor join consumed before frame capture.
   */
  lipSync?: IAutoMovieProductionLipSyncJoin;
}

/** Parser-independent evidence calculated from the final mixed PCM. */
export interface IAutoMovieProductionSoundAnalysis {
  /** Analysis schema. */
  version: 1;
  /** Fixed output PCM clock. */
  sampleRate: 48_000;
  /** Exact interleaved stereo frame count. */
  sampleFrames: number;
  /** Runtime derived from the PCM clock. */
  runtimeSeconds: number;
  /** ITU-R BS.1770 K-weighted, gated integrated loudness in LUFS. */
  integratedLoudness: number | null;
  /** Absolute post-limiter sample peak. */
  samplePeak: number;
  /** Number of post-limiter samples outside [-1, 1]. */
  clippingSamples: number;
  /** Longest contiguous near-silent span. */
  longestSilenceSeconds: number;
  /** Per-event energy evidence centered on the authoritative event frame. */
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
