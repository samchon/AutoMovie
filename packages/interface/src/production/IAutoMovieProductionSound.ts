import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import {
  AutoMovieContentDigest,
  IAutoMovieShotEventContract,
} from "./IAutoMovieProductionDesign";

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
  /** Stable unsigned 32-bit procedural seed. */
  seed: number;
}

/** One authored timeline cue lowered into the deterministic procedural score. */
export interface IAutoMovieProductionSoundCue {
  /** Exact authored cue id. */
  id: string;
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
