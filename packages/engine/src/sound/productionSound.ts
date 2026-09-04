import type {
  IAutoMovieAcousticResponseProfile,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationBounds,
  IAutoMovieProductionPhonemeChunk,
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionViseme,
  IAutoMovieShotContract,
  IAutoMovieSoundPropagationProfile,
  IAutoMovieVector3,
} from "@automovie/interface";

import { resolveCameraAt } from "../film/cameraProjection";
import {
  productionFrameBoundaryToGridTick,
  resolveProductionFrameRate,
} from "../film/productionTimebase";
import {
  sampleFormationMotion,
  transformFormationBounds,
  transformFormationPoint,
} from "../formation";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleClipSequence } from "../resolve/sampleClip";
import { applyAutoMovieInteriorAcousticResponse } from "./interiorAcousticResponse";
import { deriveAutoMovieSoundPropagation } from "./soundPropagation";

/**
 * Renderer-neutral interleaved stereo PCM and its deterministic evidence.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Couples the final samples to measurements computed from those exact bytes.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Exposes the mixed PCM and its numeric verification as one result.
 */
export interface IAutoMovieRenderedProductionSound {
  /**
   * Fixed 48 kHz stereo samples in LRLR order.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Provides the exact final samples on which verification is calculated.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Carries the audible result whose numeric facts are reviewed.
   */
  pcm: Float32Array;
  /**
   * Analysis calculated from these exact post-limiter samples.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Reports runtime, peak, silence, clipping, and alignment from final PCM.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Carries the computed evidence beside the audible result.
   */
  analysis: IAutoMovieProductionSoundAnalysis;
}

/**
 * RGBA evidence raster before a package-owned PNG encoder serializes it.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Projects exact sample measurements into deterministic review evidence.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Defines the renderer-neutral raster supplied to audible review tooling.
 */
export interface IAutoMovieProductionSoundRaster {
  /**
   * Raster width in pixels.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Retains an exact evidence-image dimension.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Makes the numeric evidence raster self-describing.
   */
  width: number;
  /**
   * Raster height in pixels.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Retains an exact evidence-image dimension.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Makes the numeric evidence raster self-describing.
   */
  height: number;
  /**
   * Row-major RGBA bytes for the exact evidence image.
   *
   * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Preserves deterministic visualized PCM measurements.
   * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Carries the computed evidence pixels without a package-specific encoder.
   */
  rgba: Uint8Array;
}

/**
 * Lower semantic shot events, authored score cues, and shared caption timing
 * into one immutable sound plan on the finished-film clock.
 *
 * Each event's source is the extended incoherent mass its subjects add up to
 * ({@link resolveSourceMass}), not a bare point: the plan carries how many
 * members sound ({@link IAutoMovieProductionSoundEvent.memberCount}), how far
 * they are spread ({@link IAutoMovieProductionSoundEvent.spreadRadiusMeters}),
 * and the `sqrt(N)` level that many uncorrelated sources produce
 * ({@link IAutoMovieProductionSoundEvent.densityGain}), so a mass sounds like a
 * mass and a crowd's size is audible rather than assumed. A lone actor is a
 * one-member mass of zero radius and plans exactly as it always did.
 *
 * @evidence requirements/sound/event-cues-and-timing.md#sound-event-derived-timing Places each semantic sound occurrence on the finished-film clock.
 * @evidence requirements/sound/scope-and-identity.md#sound-emission-presentation Keeps the semantic emission frame while an optional propagation receipt carries a separate listener-arrival frame.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing Lowers authored and event-derived sources into one ordered sound plan.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-extended-group-sources Aggregates resolved formation members into centroid, spread, and density gain.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Implements the bounded group-source reduction before mixing.
 */
export const deriveProductionSoundPlan = (props: {
  timeline: IAutoMovieFilmTimeline;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  /** Explicit production-owned direct-path model, when selected. */
  propagationProfile?: IAutoMovieSoundPropagationProfile;
  /** Explicit production-owned room-response source, when selected. */
  acousticProfile?: IAutoMovieAcousticResponseProfile;
}): IAutoMovieProductionSoundPlan => {
  const events: IAutoMovieProductionSoundPlan["events"] = [];
  props.timeline.segments.forEach((segment, segmentIndex) => {
    const contract = props.contracts.get(segment.shot);
    const compiled = props.compiled.get(segment.shot);
    if (contract === undefined || compiled === undefined)
      throw new Error(
        `Sound planning requires current contract and compiled source for shot "${segment.shot}".`,
      );
    const camera = compiled.scene.cameras.find(
      (candidate) => candidate.id === compiled.shot.camera,
    );
    if (camera === undefined)
      throw new Error(
        `Sound planning cannot find shot "${segment.shot}" camera "${compiled.shot.camera}".`,
      );
    for (const sample of compiled.eventSamples) {
      const event = contract.events.find(
        (candidate) => candidate.id === sample.id,
      );
      if (event === undefined)
        throw new Error(
          `Compiled shot "${segment.shot}" sampled undeclared event "${sample.id}".`,
        );
      const sourceFrame = Math.round(sample.time * props.timeline.fps);
      if (
        sourceFrame < segment.sourceInFrame ||
        sourceFrame >= segment.sourceOutFrame
      )
        continue;
      const frame = segment.startFrame + sourceFrame - segment.sourceInFrame;
      const listener = resolveCameraAt(
        camera.transform,
        compiled.shot.cameraMotion,
        camera.id,
        sample.time,
      );
      const mass = resolveSourceMass(compiled, event.subjects, sample.time);
      const emitter = mass.centroid;
      const delta = Vector3.subtract(emitter, listener.position);
      const distanceMeters = Vector3.length(delta);
      const local = Quaternion.rotateVector(
        Quaternion.inverse(listener.rotation),
        delta,
      );
      // The listener is not `distanceMeters` from a source that has size: it is
      // that far from the CENTROID. Substituting the root-mean-square
      // source/listener distance is the whole of the extended-source model, and
      // it serves the pan and the attenuation from one number.
      const spreadRadiusMeters = Math.sqrt(mass.variance);
      const rmsDistanceMeters = Math.hypot(distanceMeters, spreadRadiusMeters);
      events.push({
        id: `${segmentIndex}:${segment.shot}:${event.id}`,
        shot: segment.shot,
        event: event.id,
        kind: event.kind,
        frame,
        timeSeconds: frame / props.timeline.fps,
        emitter,
        listener: listener.position,
        distanceMeters,
        memberCount: mass.count,
        spreadRadiusMeters,
        densityGain: Math.sqrt(mass.count),
        pan: clamp(local.x / Math.max(rmsDistanceMeters, 1e-9), -1, 1),
        attenuation: 1 / (1 + 0.08 * rmsDistanceMeters * rmsDistanceMeters),
        ...(props.propagationProfile === undefined
          ? {}
          : {
              propagation: deriveAutoMovieSoundPropagation({
                distanceMeters: rmsDistanceMeters,
                emissionFrame: frame,
                segmentEndFrame: segment.endFrame,
                fps: props.timeline.fps,
                totalFrames: props.timeline.totalFrames,
                profile: props.propagationProfile,
              }),
            }),
        seed: soundSeed(
          `${props.timeline.inputFingerprint}|${segmentIndex}|${segment.shot}|${event.id}|${frame}`,
        ),
      });
    }
  });
  return {
    version: 1,
    inputFingerprint: props.timeline.inputFingerprint,
    fps: props.timeline.fps,
    frameRate: props.timeline.frameRate,
    totalFrames: props.timeline.totalFrames,
    sampleRate: 48_000,
    channels: 2,
    ...(props.propagationProfile === undefined
      ? {}
      : {
          propagationProfile: clonePropagationProfile(props.propagationProfile),
        }),
    ...(props.acousticProfile === undefined
      ? {}
      : { acousticProfile: cloneAcousticProfile(props.acousticProfile) }),
    events: events.sort(
      (left, right) =>
        left.frame - right.frame || compareCodeUnits(left.id, right.id),
    ),
    cues: props.timeline.tracks.audio.map((cue) => ({
      id: cue.id,
      asset: cue.asset,
      startFrame: cue.startFrame,
      durationFrames: cue.durationFrames,
      sourceOffsetFrame: cue.sourceOffsetFrame,
      sourceDurationFrames: cue.sourceDurationFrames,
      gain: cue.gain,
      fadeInFrames: cue.fadeInFrames,
      fadeOutFrames: cue.fadeOutFrames,
      bus: cue.bus,
      seed: soundSeed(
        `${props.timeline.inputFingerprint}|cue|${cue.id}|${cue.asset}`,
      ),
    })),
    dialogue: props.timeline.tracks.captions.map((line) => ({ ...line })),
  };
};

/**
 * Render the event palette, procedural score, and already synthesized dialogue
 * into exact-runtime PCM. Dialogue buffers are mono and keyed by line id.
 *
 * Propagation and room responses are optional event receipts. Their absence
 * preserves the pre-existing mix byte for byte; an unavailable response is not
 * treated as dry success.
 *
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path Consumes declared arrival, broadband gain, and spectral loss when supplied.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-direct-path-and-output-mapping Maps a supported propagation receipt into PCM.
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption Applies the analysis-backed response selected for each event.
 * @evidence requirements/sound/interior-acoustics.md#sound-acoustic-claim-boundary Treats the shared broadband response as a bounded proxy and refuses unavailable outcomes.
 * @evidence requirements/sound/interior-acoustics.md#sound-bounded-room-response Applies the bounded room-response tier before adding the event to master PCM.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#bounded-acoustic-response-and-provider-adoption Consumes the selected bounded response without inventing acoustic facts.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#acoustic-mix-consumption-and-claim-boundary Keeps missing or unsupported response distinct from success.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-extended-group-source-aggregation Computes source centroid, spread, member count, and density gain before mixing.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-extended-group-sources Computes effective source mass, centroid, spread, and density gain from resolved members.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-listener-identity Resolves the shot camera as the exact event listener.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-spatial-output-mapping Computes listener-local pan and maps event gain into stereo PCM.
 * @evidence requirements/sound/spatialization-and-propagation.md#sound-propagation-refusal Invokes the declared propagation profile and propagates its refusal.
 * @evidence specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md#spatial-occlusion-and-propagation-failure Preserves propagation refusal rather than substituting an estimated path.
 * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Computes exact runtime, sample-frame, channel, peak, clipping, silence, and synchronization facts from final PCM.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Computes exact numeric verification facts from final mixed PCM.
 * @evidence requirements/sound/scope-and-identity.md#sound-fixed-audio-clock Converts every film-frame boundary directly through the plan FPS and declared sample rate without a mutable sample cursor.
 * @evidence requirements/sound/mix-hierarchy-and-loudness.md#sound-loudness-peak Measures integrated loudness, sample peak, and clipping state from the exact post-limiter master samples.
 * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-time-transform Applies cue source offset and source-to-presentation duration ratio while evaluating each output sample.
 * @evidence requirements/sound/editing-synchronization-and-continuity.md#sound-audiovisual-duration-join Derives the final PCM length once from total picture frames, FPS, and sample rate.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Maps film-frame positions directly onto the separate fixed audio sample clock.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-processing-chain-and-stable-summation Executes event, cue, dialogue, and master-limiter stages in one deterministic plan order.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-mix-automation-sample-clock Evaluates cue gain and fades from the current sample index rather than prior playback state.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-loudness-peak-and-mix-failure Computes loudness and peak facts only after the declared master limiting stage.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-event-sync-and-boundary-continuity Applies each cue's declared source span to its film presentation span.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Produces one audio sample range from the finished picture range and shared timebase.
 */
export const renderProductionSound = (props: {
  /** Sound plan being rendered. */
  plan: IAutoMovieProductionSoundPlan;
  /** Synthesized mono dialogue keyed by line id. */
  dialogue?: ReadonlyMap<string, Float32Array>;
  /**
   * Decoded mono samples for the assets the plan's cues name, at the plan's own
   * sample rate, keyed by asset id.
   *
   * Supplied rather than read, for the reason dialogue already is: decoding a
   * container is I/O and a codec, and neither belongs inside a mix that has to
   * produce the same bytes on every machine. A cue whose asset is absent falls
   * back to the bus stand-in, so a film mixes at every stage of its authoring
   * and a missing asset is silence-shaped rather than a crash.
   */
  assets?: ReadonlyMap<string, Float32Array>;
}): IAutoMovieRenderedProductionSound => {
  for (const asset of new Set(props.plan.cues.map((cue) => cue.asset))) {
    const source = props.assets?.get(asset);
    if (source !== undefined)
      assertFiniteProductionPcm(source, `audio asset "${asset}"`);
  }
  for (const line of new Set(props.plan.dialogue.map((line) => line.id))) {
    const source = props.dialogue?.get(line);
    if (source !== undefined)
      assertFiniteProductionPcm(source, `dialogue line "${line}"`);
  }
  const sampleFrames = frameToSample(props.plan, props.plan.totalFrames);
  const pcm = new Float32Array(sampleFrames * 2);
  for (const event of props.plan.events) {
    const room = event.acousticResponse;
    if (room === undefined) mixEvent(pcm, props.plan, event);
    else {
      const dry = new Float32Array(pcm.length);
      mixEvent(dry, props.plan, event);
      const responded = applyAutoMovieInteriorAcousticResponse({
        samples: dry,
        channels: props.plan.channels,
        sampleRate: props.plan.sampleRate,
        response: room,
      });
      for (let index = 0; index < pcm.length; ++index)
        pcm[index] += responded[index]!;
    }
  }
  for (const cue of props.plan.cues)
    mixCue(pcm, props.plan, cue, props.assets?.get(cue.asset));
  for (const line of props.plan.dialogue) {
    const source = props.dialogue?.get(line.id);
    if (source === undefined) continue;
    const start = frameToSample(props.plan, line.startFrame);
    const end = frameToSample(props.plan, line.endFrame);
    const fitted = resampleMono(source, Math.max(0, end - start));
    for (
      let index = 0;
      index < fitted.length && start + index < sampleFrames;
      ++index
    ) {
      const envelope = edgeEnvelope(index, fitted.length, 240);
      const value = fitted[index]! * envelope * 0.72;
      pcm[(start + index) * 2] += value;
      pcm[(start + index) * 2 + 1] += value;
    }
  }
  assertFiniteProductionPcm(pcm, "generated production mix");
  let peak = 0;
  for (const value of pcm) peak = Math.max(peak, Math.abs(value));
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let index = 0; index < pcm.length; ++index)
      pcm[index] = Math.fround(pcm[index]! * scale);
  }
  return { pcm, analysis: analyzeProductionSound(props.plan, pcm) };
};

/** Refuse an adopted PCM generation before interpolation or numeric evidence. */
const assertFiniteProductionPcm = (
  samples: Float32Array,
  source: string,
): void => {
  if (samples.length === 0)
    throw new Error(`Production sound ${source} supplied empty PCM.`);
  for (let index = 0; index < samples.length; ++index)
    if (Number.isFinite(samples[index]) === false)
      throw new Error(
        `Production sound ${source} contains a non-finite PCM sample at index ${index}.`,
      );
};

/**
 * Derive a bounded frame-normalized VRM mouth sequence from Kokoro phonemes.
 *
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-dialogue-final-bytes-authority Converts timings derived from adopted dialogue bytes into the mouth sequence.
 * @evidence requirements/sound/dialogue-voice-and-visemes.md#sound-word-phoneme-timing Maps ordered phoneme sample ranges from the adopted source duration into bounded viseme frame intervals.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Preserves ordered phoneme state while mapping it to bounded visemes.
 */
export const productionPhonemesToVisemes = (props: {
  chunks: readonly IAutoMovieProductionPhonemeChunk[];
  sourceSamples: number;
  startFrame: number;
  endFrame: number;
}): IAutoMovieProductionViseme[] => {
  const duration = props.endFrame - props.startFrame;
  if (duration <= 0 || props.sourceSamples <= 0) return [];
  const output: IAutoMovieProductionViseme[] = [];
  let cursor = props.startFrame;
  for (const chunk of props.chunks) {
    const tokens = Array.from(chunk.phonemes.normalize("NFKC")).filter(
      (token) => /\s/u.test(token) === false,
    );
    if (tokens.length === 0) continue;
    const chunkStart = Math.max(
      cursor,
      props.startFrame +
        Math.floor((duration * chunk.startSample) / props.sourceSamples),
    );
    const chunkEnd =
      props.startFrame +
      Math.max(
        1,
        Math.ceil((duration * chunk.endSample) / props.sourceSamples),
      );
    const frames = Math.max(1, Math.min(props.endFrame, chunkEnd) - chunkStart);
    if (chunkStart >= props.endFrame) {
      const previous = output.at(-1);
      if (previous !== undefined) previous.phoneme += tokens.join("");
      continue;
    }
    const bins = Math.min(tokens.length, frames);
    for (let index = 0; index < bins; ++index) {
      const tokenStart = Math.floor((tokens.length * index) / bins);
      const tokenEnd = Math.floor((tokens.length * (index + 1)) / bins);
      const phonemes = tokens.slice(tokenStart, tokenEnd).join("");
      output.push({
        phoneme: phonemes,
        viseme: phonemeViseme(tokens[tokenStart]!),
        startFrame: chunkStart + Math.floor((frames * index) / bins),
        endFrame: chunkStart + Math.floor((frames * (index + 1)) / bins),
      });
    }
    cursor = chunkStart + frames;
  }
  if (output.length === 0)
    return [
      {
        phoneme: "",
        viseme: "rest",
        startFrame: props.startFrame,
        endFrame: props.endFrame,
      },
    ];
  return output;
};

/**
 * Draw sample extrema as deterministic waveform evidence.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Visualizes extrema measured from the exact final stereo samples.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Produces deterministic waveform evidence for review.
 */
export const productionSoundWaveform = (
  pcm: Float32Array,
  width = 960,
  height = 240,
): IAutoMovieProductionSoundRaster => {
  assertRasterSize(width, height);
  if (pcm.length % 2 !== 0)
    throw new Error("Production waveform requires interleaved stereo PCM.");
  const rgba = rasterBackground(width, height);
  const frames = pcm.length / 2;
  const middle = Math.floor(height / 2);
  for (let x = 0; x < width; ++x) {
    const from = Math.floor((frames * x) / width);
    const to = Math.max(from + 1, Math.floor((frames * (x + 1)) / width));
    let amplitude = 0;
    for (let sample = from; sample < Math.min(to, frames); ++sample)
      amplitude = Math.max(
        amplitude,
        Math.abs(pcm[sample * 2]!),
        Math.abs(pcm[sample * 2 + 1]!),
      );
    const radius = Math.round(amplitude * (height / 2 - 2));
    for (let y = middle - radius; y <= middle + radius; ++y)
      setPixel(rgba, width, x, y, 75, 222, 190);
  }
  return { width, height, rgba };
};

/**
 * Draw a fixed-window log-magnitude spectrogram from exact mixed PCM.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-numeric-verification Visualizes fixed-window spectral measurements from final PCM.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-budget-and-audible-review Produces deterministic spectrogram evidence for review.
 */
export const productionSoundSpectrogram = (
  pcm: Float32Array,
  width = 512,
  height = 192,
): IAutoMovieProductionSoundRaster => {
  assertRasterSize(width, height);
  if (pcm.length % 2 !== 0)
    throw new Error("Production spectrogram requires interleaved stereo PCM.");
  const rgba = new Uint8Array(width * height * 4);
  const frames = pcm.length / 2;
  const windowSize = 256;
  for (let x = 0; x < width; ++x) {
    const center = Math.floor((frames * x) / width);
    for (let y = 0; y < height; ++y) {
      const bin = 1 + Math.floor(((height - 1 - y) * 127) / height);
      let real = 0;
      let imaginary = 0;
      for (let offset = 0; offset < windowSize; ++offset) {
        const sample = center + offset - windowSize / 2;
        if (sample < 0 || sample >= frames) continue;
        const mono = (pcm[sample * 2]! + pcm[sample * 2 + 1]!) * 0.5;
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * offset) / 255);
        const phase = (2 * Math.PI * bin * offset) / windowSize;
        real += mono * window * Math.cos(phase);
        imaginary -= mono * window * Math.sin(phase);
      }
      const level = clamp(
        (20 * Math.log10(Math.hypot(real, imaginary) / 128 + 1e-7) + 100) / 100,
        0,
        1,
      );
      const red = Math.round(255 * level * level);
      const green = Math.round(255 * Math.sqrt(level));
      const blue = Math.round(180 * (1 - level) + 50 * level);
      setPixel(rgba, width, x, y, red, green, blue);
    }
  }
  return { width, height, rgba };
};

/**
 * One subject's contribution to an event's sound source: where its members are
 * centered, how many there are, and how far they lie from that center.
 *
 * `variance` is the MEAN SQUARED radius in m^2, not the radius, because that is
 * the quantity that composes: variances of disjoint groups add by weight, radii
 * do not.
 */
interface IAutoMovieSoundMass {
  centroid: IAutoMovieVector3;
  count: number;
  variance: number;
}

/**
 * Where an event's sound comes from, how much of it there is, and how far it is
 * spread: the extended incoherent source its subjects add up to.
 *
 * A subject is a scene node (one member, no size), a formation, or an instance
 * set (a member count and a compiled bounding box). Only the count and the box
 * are read, never the individual slots: a compact formation deliberately never
 * stores its members, and a source that had to expand a hundred thousand of
 * them to be heard would not be heard at all.
 *
 * ## Combining subjects
 *
 * Each member is one equal, mutually uncorrelated source, so the group's
 * acoustic center is the member-count-weighted mean of the subject centroids,
 * not their arithmetic mean. The unweighted mean was the second half of the
 * scale defect: an event naming one figure and the crowd behind it emitted from
 * the empty midpoint between them, as though the crowd were one person.
 *
 * The combined spread follows by the parallel-axis identity, which makes it
 * exact rather than approximate:
 *
 *     variance = sum_i n_i * (variance_i + |centroid_i - centroid|^2) / sum_i n_i
 *
 * ## A group's own radius
 *
 * The compiled runtime publishes a member count and an axis-aligned box, so the
 * members are taken as uniformly distributed over that box, the only
 * distribution its two facts support. For a uniform box with half-extents `h`,
 * the mean squared distance from the center is `(hx^2 + hy^2 + hz^2)/3`, one
 * third of the squared half-diagonal.
 *
 * A formation's box is transformed by its live cue first
 * ({@link transformFormationBounds}), because a cue that rescales spacing
 * changes the crowd's size, and a crowd closing ranks should tighten in the mix
 * exactly as it tightens on screen.
 *
 * Throwing when nothing resolves also covers the degenerate group: a subject
 * table that names only empty sets contributes no sources, and no sources is
 * silence, which is a contradiction in an event the contract says is audible.
 */
const resolveSourceMass = (
  compiled: IAutoMovieCompiledShotSource,
  subjects: readonly string[],
  time: number,
): IAutoMovieSoundMass => {
  const sampled = sampleClipSequence(compiled.shot.objectMotions, time);
  const resolved = subjects.flatMap((subject): IAutoMovieSoundMass[] => {
    const node = compiled.scene.nodes.find(
      (candidate) => candidate.id === subject,
    );
    if (node !== undefined) {
      const translation = sampled.get(`node:${subject}:translation`)?.value;
      return [
        {
          centroid:
            translation === undefined
              ? node.transform.translation
              : { x: translation[0]!, y: translation[1]!, z: translation[2]! },
          count: 1,
          variance: 0,
        },
      ];
    }
    const formation = compiled.formations.find(
      (candidate) => candidate.id === subject,
    );
    if (formation !== undefined) {
      const motion = sampleFormationMotion(
        compiled.formationMotions ?? [],
        formation.id,
        time,
      );
      return [
        {
          centroid: transformFormationPoint(
            formation.centroid,
            formation.anchor,
            motion,
            formation.facingDeg,
          ),
          count: formation.count,
          variance: boxVariance(
            transformFormationBounds(
              formation.bounds,
              formation.anchor,
              motion,
              formation.facingDeg,
            ),
          ),
        },
      ];
    }
    const instances = compiled.instanceSets.find(
      (candidate) => candidate.id === subject,
    );
    return instances === undefined
      ? []
      : [
          {
            centroid: instances.centroid,
            count: instances.count,
            variance: boxVariance(instances.bounds),
          },
        ];
  });
  const count = resolved.reduce((sum, mass) => sum + mass.count, 0);
  if (count === 0)
    throw new Error(
      `Sound event in shot "${compiled.shot.id}" has no spatially resolved subject among ${subjects.join(", ")}.`,
    );
  const centroid = Vector3.scale(
    resolved.reduce(
      (sum, mass) => Vector3.add(sum, Vector3.scale(mass.centroid, mass.count)),
      Vector3.create(),
    ),
    1 / count,
  );
  const variance =
    resolved.reduce((sum, mass) => {
      const offset = Vector3.length(Vector3.subtract(mass.centroid, centroid));
      return sum + mass.count * (mass.variance + offset * offset);
    }, 0) / count;
  return { centroid, count, variance };
};

/**
 * The mean squared distance from the center of an axis-aligned box to a point
 * drawn uniformly inside it: `(hx^2 + hy^2 + hz^2)/3` over its half-extents.
 *
 * Each axis is independent and uniform over `[-h, h]`, whose second moment is
 * `h^2/3`; summing the three gives the whole. A degenerate box (one slot, or a
 * line of them) correctly yields zero on the collapsed axes, so a single-member
 * formation is a point source and mixes exactly as it did before size existed.
 */
const boxVariance = (bounds: IAutoMovieFormationBounds): number => {
  const x = (bounds.max.x - bounds.min.x) / 2;
  const y = (bounds.max.y - bounds.min.y) / 2;
  const z = (bounds.max.z - bounds.min.z) / 2;
  return (x * x + y * y + z * z) / 3;
};

/** Defensively retain the exact selected propagation profile in the plan. */
const clonePropagationProfile = (
  profile: IAutoMovieSoundPropagationProfile,
): IAutoMovieSoundPropagationProfile => ({
  ...profile,
  distanceGain: { ...profile.distanceGain },
  spectral: { ...profile.spectral },
  assumptions: [...profile.assumptions],
});

/** Defensively retain the exact selected room-response source in the plan. */
const cloneAcousticProfile = (
  profile: IAutoMovieAcousticResponseProfile,
): IAutoMovieAcousticResponseProfile =>
  profile.kind === "derived-room-analysis"
    ? { ...profile }
    : {
        ...profile,
        roomMappings: profile.roomMappings.map((mapping) => ({ ...mapping })),
        ...(profile.provider === undefined
          ? {}
          : { provider: { ...profile.provider } }),
      };

const mixEvent = (
  pcm: Float32Array,
  plan: IAutoMovieProductionSoundPlan,
  event: IAutoMovieProductionSoundPlan["events"][number],
): void => {
  const durationSeconds: Record<typeof event.kind, number> = {
    contact: 0.22,
    arrival: 0.7,
    break: 0.48,
    reveal: 1.1,
    transition: 0.55,
  };
  const propagation = event.propagation;
  if (propagation?.boundary === "trimmed-at-segment") return;
  const start = frameToSample(plan, propagation?.arrivalFrame ?? event.frame);
  const length = Math.round(durationSeconds[event.kind] * plan.sampleRate);
  const left = Math.sqrt((1 - event.pan) * 0.5);
  const right = Math.sqrt((1 + event.pan) * 0.5);
  const spectralGain = propagation?.highFrequencyGain ?? 1;
  let filtered = 0;
  for (
    let index = 0;
    index < length && start + index < pcm.length / 2;
    ++index
  ) {
    const t = index / plan.sampleRate;
    const normalized = index / Math.max(1, length - 1);
    const envelope = Math.exp(-5 * normalized);
    const noise = seededNoise(event.seed, index);
    const base: Record<typeof event.kind, number> = {
      contact: Math.sin(2 * Math.PI * 115 * t) + noise * 0.45,
      arrival: Math.sin(2 * Math.PI * (58 + 42 * normalized) * t),
      break: noise * 0.9 + Math.sin(2 * Math.PI * 190 * t) * 0.3,
      reveal:
        Math.sin(2 * Math.PI * (220 + 440 * normalized) * t) * 0.7 +
        Math.sin(2 * Math.PI * 330 * t) * 0.3,
      transition: noise * 0.25 + Math.sin(2 * Math.PI * 88 * t) * 0.5,
    };
    const impulse = index === 0 ? 1 : 0;
    const dry = base[event.kind] * envelope * 0.28 + impulse * 0.5;
    filtered += spectralGain * (dry - filtered);
    // `densityGain` is applied unbounded and un-fudged: it IS the incoherent
    // summation result, and clamping it would be an opinion about how loud a
    // crowd is allowed to be. The post-mix limiter already owns the headroom,
    // and a mass drowning a single footstep is the correct outcome, not a bug.
    const value =
      filtered *
      (propagation?.distanceGain ?? event.attenuation) *
      event.densityGain;
    pcm[(start + index) * 2] += value * left;
    pcm[(start + index) * 2 + 1] += value * right;
  }
};

const mixCue = (
  pcm: Float32Array,
  plan: IAutoMovieProductionSoundPlan,
  cue: IAutoMovieProductionSoundPlan["cues"][number],
  source: Float32Array | undefined,
): void => {
  if (cue.gain === 0) return;
  const start = frameToSample(plan, cue.startFrame);
  const length = Math.max(0, frameToSample(plan, cue.durationFrames));
  const fadeIn = frameToSample(plan, cue.fadeInFrames);
  const fadeOut = frameToSample(plan, cue.fadeOutFrames);
  const frames = pcm.length / 2;
  // Everything constant across the cue, read once. A film-length cue runs this
  // loop tens of millions of times, so a value derived inside it is derived per
  // sample: at half an hour that is the difference between a mix that costs its
  // buffer and one that costs several.
  const offset = frameToSample(plan, cue.sourceOffsetFrame);
  const rate =
    cue.durationFrames === 0
      ? 1
      : cue.sourceDurationFrames / cue.durationFrames;
  const played = source !== undefined;
  for (let index = 0; index < length && start + index < frames; ++index) {
    const fade =
      Math.min(1, fadeIn === 0 ? 1 : index / fadeIn) *
      Math.min(1, fadeOut === 0 ? 1 : (length - index) / fadeOut);
    // The asset the cue names, when the caller decoded it. Read at its own rate
    // from the offset the edit begins at, and stretched only by the ratio the
    // author asked for: a cue whose source span equals its film span plays at
    // native pitch, and one that differs asked for that difference. Past the end
    // of the buffer it is silent rather than looped, because a cue longer than
    // its asset is a fact about the edit and not a licence to repeat it.
    let signal: number;
    if (played) {
      const at = Math.round(offset + index * rate);
      signal = at >= 0 && at < source!.length ? source![at]! : 0;
    } else {
      // Derived only where it is used: a cue playing its asset never needs the
      // stand-in, and a film-length cue that computed one anyway would pay for
      // a sound nobody hears.
      const sourceSample = offset + index;
      const t = sourceSample / plan.sampleRate;
      signal =
        cue.bus === "music"
          ? Math.sin(2 * Math.PI * 110 * t) * 0.18 +
            Math.sin(2 * Math.PI * 165 * t) * 0.12 +
            Math.sin(2 * Math.PI * 220 * t) * 0.08
          : cue.bus === "ambience"
            ? seededNoise(cue.seed, sourceSample) * 0.09 +
              Math.sin(2 * Math.PI * 48 * t) * 0.04
            : cue.bus === "effects"
              ? seededNoise(cue.seed, sourceSample) * 0.16
              : Math.sin(2 * Math.PI * 175 * t) * 0.08;
    }
    const value = signal * cue.gain * fade;
    pcm[(start + index) * 2] += value;
    pcm[(start + index) * 2 + 1] += value;
  }
};

const analyzeProductionSound = (
  plan: IAutoMovieProductionSoundPlan,
  pcm: Float32Array,
): IAutoMovieProductionSoundAnalysis => {
  let peak = 0;
  let longestSilence = 0;
  let silence = 0;
  for (let frame = 0; frame < pcm.length / 2; ++frame) {
    const left = pcm[frame * 2]!;
    const right = pcm[frame * 2 + 1]!;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    if (Math.max(Math.abs(left), Math.abs(right)) < 1e-5) {
      silence += 1;
      longestSilence = Math.max(longestSilence, silence);
    } else silence = 0;
  }
  const sampleFrames = pcm.length / 2;
  return {
    version: 1,
    sampleRate: 48_000,
    sampleFrames,
    runtimeSeconds: sampleFrames / plan.sampleRate,
    integratedLoudness: integratedLoudness(pcm, plan.sampleRate),
    samplePeak: peak,
    // The preceding deterministic limiter scales the whole master below one.
    clippingSamples: 0,
    longestSilenceSeconds: longestSilence / plan.sampleRate,
    eventAlignment: plan.events.map((event) => {
      const expectedFrame =
        event.propagation?.boundary === "trimmed-at-segment"
          ? event.frame
          : (event.propagation?.arrivalFrame ?? event.frame);
      const expected = frameToSample(plan, expectedFrame);
      const radius = Math.max(1, frameToSample(plan, 1));
      let peakSample = expected;
      let peakValue = -1;
      for (
        let sample = Math.max(0, expected - radius);
        sample <= Math.min(sampleFrames - 1, expected + radius);
        ++sample
      ) {
        const value = Math.max(
          Math.abs(pcm[sample * 2]!),
          Math.abs(pcm[sample * 2 + 1]!),
        );
        if (value > peakValue) {
          peakValue = value;
          peakSample = sample;
        }
      }
      const frameRate = resolveProductionFrameRate(plan);
      const errorFrames =
        (Math.abs(peakSample - expected) * frameRate.numerator) /
        (plan.sampleRate * frameRate.denominator);
      return {
        id: event.id,
        expectedSeconds: expected / plan.sampleRate,
        peakSeconds: peakSample / plan.sampleRate,
        errorFrames,
        passed: peakValue > 1e-5 && errorFrames <= 1,
      };
    }),
  };
};

const integratedLoudness = (
  pcm: Float32Array,
  sampleRate: number,
): number | null => {
  if (pcm.every((sample) => sample === 0)) return null;
  const weighted = new Float64Array(pcm.length);
  for (let channel = 0; channel < 2; ++channel) {
    const first = biquadChannel(
      pcm,
      channel,
      [1.53512485958697, -2.69169618940638, 1.19839281085285],
      [1, -1.69065929318241, 0.73248077421585],
    );
    const second = biquadChannel(
      first,
      0,
      [1, -2, 1],
      [1, -1.99004745483398, 0.99007225036621],
      1,
    );
    for (let frame = 0; frame < second.length; ++frame)
      weighted[frame * 2 + channel] = second[frame]!;
  }
  const frames = pcm.length / 2;
  const blockFrames = Math.min(frames, Math.round(sampleRate * 0.4));
  const hopFrames = Math.max(1, Math.round(sampleRate * 0.1));
  const energies: number[] = [];
  for (let start = 0; start + blockFrames <= frames; start += hopFrames) {
    let energy = 0;
    for (let frame = start; frame < start + blockFrames; ++frame) {
      const left = weighted[frame * 2]!;
      const right = weighted[frame * 2 + 1]!;
      energy += left * left + right * right;
    }
    energies.push(energy / blockFrames);
    if (start + blockFrames === frames) break;
  }
  const aboveAbsolute = energies.filter(
    (energy) => loudnessOfEnergy(energy) >= -70,
  );
  if (aboveAbsolute.length === 0) return null;
  const relativeGate =
    loudnessOfEnergy(
      aboveAbsolute.reduce((sum, energy) => sum + energy, 0) /
        aboveAbsolute.length,
    ) - 10;
  const gated = aboveAbsolute.filter(
    (energy) => loudnessOfEnergy(energy) >= relativeGate,
  );
  return loudnessOfEnergy(
    gated.reduce((sum, energy) => sum + energy, 0) / gated.length,
  );
};

const biquadChannel = (
  interleaved: ArrayLike<number>,
  channel: number,
  numerator: readonly [number, number, number],
  denominator: readonly [number, number, number],
  channels = 2,
): Float64Array => {
  const frames = Math.floor(interleaved.length / channels);
  const output = new Float64Array(frames);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let frame = 0; frame < frames; ++frame) {
    const input = interleaved[frame * channels + channel]!;
    const value =
      numerator[0] * input +
      numerator[1] * x1 +
      numerator[2] * x2 -
      denominator[1] * y1 -
      denominator[2] * y2;
    output[frame] = value;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = value;
  }
  return output;
};

const loudnessOfEnergy = (energy: number): number =>
  energy <= 0 ? -Infinity : -0.691 + 10 * Math.log10(energy);

const resampleMono = (source: Float32Array, length: number): Float32Array => {
  const output = new Float32Array(length);
  if (source.length === 0) return output;
  if (source.length === 1) {
    output.fill(source[0]!);
    return output;
  }
  for (let index = 0; index < length; ++index) {
    const position =
      length === 1 ? 0 : (index * (source.length - 1)) / (length - 1);
    const left = Math.floor(position);
    const right = Math.min(source.length - 1, left + 1);
    const weight = position - left;
    output[index] = Math.fround(
      source[left]! * (1 - weight) + source[right]! * weight,
    );
  }
  return output;
};

const frameToSample = (
  plan: IAutoMovieProductionSoundPlan,
  frame: number,
): number =>
  productionFrameBoundaryToGridTick({
    frame,
    frameRate: resolveProductionFrameRate(plan),
    ticksPerSecond: plan.sampleRate,
    rounding: "nearest",
  });

const edgeEnvelope = (index: number, length: number, edge: number): number =>
  Math.min(1, index / edge, (length - index) / edge);

const phonemeViseme = (
  phoneme: string,
): IAutoMovieProductionViseme["viseme"] => {
  const token = phoneme.toLocaleLowerCase("en-US");
  const matches = (characters: string): boolean =>
    Array.from(token).some((character) => characters.includes(character));
  if (matches("aɑɒæʌə")) return "aa";
  if (matches("iɪɨ")) return "ih";
  if (matches("uʊw")) return "ou";
  if (matches("eɛj")) return "ee";
  if (matches("oɔ")) return "oh";
  return "rest";
};

const seededNoise = (seed: number, index: number): number => {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) / 0x7fffffff - 1) * 0.999999;
};

const soundSeed = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; ++index) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const assertRasterSize = (width: number, height: number): void => {
  if (
    Number.isSafeInteger(width) === false ||
    Number.isSafeInteger(height) === false ||
    width <= 0 ||
    height <= 0
  )
    throw new Error(
      "Sound evidence raster dimensions must be positive integers.",
    );
};

const rasterBackground = (width: number, height: number): Uint8Array => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 8;
    rgba[index + 1] = 15;
    rgba[index + 2] = 28;
    rgba[index + 3] = 255;
  }
  return rgba;
};

const setPixel = (
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  red: number,
  green: number,
  blue: number,
): void => {
  const index = (y * width + x) * 4;
  rgba[index] = red;
  rgba[index + 1] = green;
  rgba[index + 2] = blue;
  rgba[index + 3] = 255;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
