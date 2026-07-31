import {
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionViseme,
  IAutoMovieShotContract,
  IAutoMovieVector3,
} from "@automovie/interface";

import { resolveCameraAt } from "../film/cameraProjection";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleClipSequence } from "../resolve/sampleClip";

/** Renderer-neutral interleaved stereo PCM and its deterministic evidence. */
export interface IAutoMovieRenderedProductionSound {
  /** Fixed 48 kHz stereo samples in LRLR order. */
  pcm: Float32Array;
  /** Analysis calculated from these exact post-limiter samples. */
  analysis: IAutoMovieProductionSoundAnalysis;
}

/** RGBA evidence raster before a package-owned PNG encoder serializes it. */
export interface IAutoMovieProductionSoundRaster {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/**
 * Lower semantic shot events, authored score cues, and shared caption timing
 * into one immutable sound plan on the finished-film clock.
 */
export const deriveProductionSoundPlan = (props: {
  timeline: IAutoMovieFilmTimeline;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
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
      const emitter = resolveEmitter(compiled, event.subjects, sample.time);
      const delta = Vector3.subtract(emitter, listener.position);
      const distanceMeters = Vector3.length(delta);
      const local = Quaternion.rotateVector(
        Quaternion.inverse(listener.rotation),
        delta,
      );
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
        pan: clamp(local.x / Math.max(distanceMeters, 1e-9), -1, 1),
        attenuation: 1 / (1 + 0.08 * distanceMeters * distanceMeters),
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
    totalFrames: props.timeline.totalFrames,
    sampleRate: 48_000,
    channels: 2,
    events: events.sort(
      (left, right) =>
        left.frame - right.frame || compareCodeUnits(left.id, right.id),
    ),
    cues: props.timeline.tracks.audio.map((cue) => ({
      id: cue.id,
      startFrame: cue.startFrame,
      durationFrames: cue.durationFrames,
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
 */
export const renderProductionSound = (props: {
  plan: IAutoMovieProductionSoundPlan;
  dialogue?: ReadonlyMap<string, Float32Array>;
}): IAutoMovieRenderedProductionSound => {
  const sampleFrames = Math.round(
    (props.plan.totalFrames / props.plan.fps) * props.plan.sampleRate,
  );
  const pcm = new Float32Array(sampleFrames * 2);
  for (const event of props.plan.events) mixEvent(pcm, props.plan, event);
  for (const cue of props.plan.cues) mixCue(pcm, props.plan, cue);
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
  let peak = 0;
  for (const value of pcm) peak = Math.max(peak, Math.abs(value));
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let index = 0; index < pcm.length; ++index)
      pcm[index] = Math.fround(pcm[index]! * scale);
  }
  return { pcm, analysis: analyzeProductionSound(props.plan, pcm) };
};

/** Derive a bounded frame-normalized VRM mouth sequence from Kokoro phonemes. */
export const productionPhonemesToVisemes = (props: {
  phonemes: string;
  startFrame: number;
  endFrame: number;
}): IAutoMovieProductionViseme[] => {
  const duration = props.endFrame - props.startFrame;
  if (duration <= 0) return [];
  const all = Array.from(props.phonemes.normalize("NFKC")).filter(
    (token) => /\s/u.test(token) === false,
  );
  const stride = Math.max(1, Math.ceil(all.length / duration));
  const tokens = all.filter((_token, index) => index % stride === 0);
  if (tokens.length === 0)
    return [
      {
        phoneme: "",
        viseme: "rest",
        startFrame: props.startFrame,
        endFrame: props.endFrame,
      },
    ];
  return tokens.map((phoneme, index) => ({
    phoneme,
    viseme: phonemeViseme(phoneme),
    startFrame:
      props.startFrame + Math.floor((duration * index) / tokens.length),
    endFrame:
      props.startFrame + Math.floor((duration * (index + 1)) / tokens.length),
  }));
};

/** Draw sample extrema as deterministic waveform evidence. */
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

/** Draw a fixed-window log-magnitude spectrogram from exact mixed PCM. */
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

const resolveEmitter = (
  compiled: IAutoMovieCompiledShotSource,
  subjects: readonly string[],
  time: number,
): IAutoMovieVector3 => {
  const sampled = sampleClipSequence(compiled.shot.objectMotions, time);
  const resolved = subjects.flatMap((subject): IAutoMovieVector3[] => {
    const node = compiled.scene.nodes.find(
      (candidate) => candidate.id === subject,
    );
    if (node !== undefined) {
      const translation = sampled.get(`node:${subject}:translation`)?.value;
      return [
        translation === undefined
          ? node.transform.translation
          : { x: translation[0]!, y: translation[1]!, z: translation[2]! },
      ];
    }
    const formation = compiled.formations.find(
      (candidate) => candidate.id === subject,
    );
    if (formation !== undefined) return [formation.centroid];
    const instances = compiled.instanceSets.find(
      (candidate) => candidate.id === subject,
    );
    return instances === undefined ? [] : [instances.centroid];
  });
  if (resolved.length === 0)
    throw new Error(
      `Sound event in shot "${compiled.shot.id}" has no spatially resolved subject among ${subjects.join(", ")}.`,
    );
  const total = resolved.reduce(Vector3.add, Vector3.create());
  return Vector3.scale(total, 1 / resolved.length);
};

const mixEvent = (
  pcm: Float32Array,
  plan: IAutoMovieProductionSoundPlan,
  event: IAutoMovieProductionSoundPlan["events"][number],
): void => {
  const durationSeconds: Record<typeof event.kind, number> = {
    contact: 0.22,
    arrival: 0.7,
    volley: 0.85,
    break: 0.48,
    reveal: 1.1,
    transition: 0.55,
  };
  const start = frameToSample(plan, event.frame);
  const length = Math.round(durationSeconds[event.kind] * plan.sampleRate);
  const left = Math.sqrt((1 - event.pan) * 0.5);
  const right = Math.sqrt((1 + event.pan) * 0.5);
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
      volley:
        noise * (0.65 + 0.35 * Math.cos(2 * Math.PI * 13 * t)) +
        Math.sin(2 * Math.PI * 72 * t) * 0.4,
      break: noise * 0.9 + Math.sin(2 * Math.PI * 190 * t) * 0.3,
      reveal:
        Math.sin(2 * Math.PI * (220 + 440 * normalized) * t) * 0.7 +
        Math.sin(2 * Math.PI * 330 * t) * 0.3,
      transition: noise * 0.25 + Math.sin(2 * Math.PI * 88 * t) * 0.5,
    };
    const impulse = index === 0 ? 1 : 0;
    const value =
      (base[event.kind] * envelope * 0.28 + impulse * 0.5) * event.attenuation;
    pcm[(start + index) * 2] += value * left;
    pcm[(start + index) * 2 + 1] += value * right;
  }
};

const mixCue = (
  pcm: Float32Array,
  plan: IAutoMovieProductionSoundPlan,
  cue: IAutoMovieProductionSoundPlan["cues"][number],
): void => {
  if (cue.gain === 0) return;
  const start = frameToSample(plan, cue.startFrame);
  const length = Math.max(0, frameToSample(plan, cue.durationFrames));
  const fadeIn = frameToSample(plan, cue.fadeInFrames);
  const fadeOut = frameToSample(plan, cue.fadeOutFrames);
  for (
    let index = 0;
    index < length && start + index < pcm.length / 2;
    ++index
  ) {
    const t = index / plan.sampleRate;
    const fade =
      Math.min(1, fadeIn === 0 ? 1 : index / fadeIn) *
      Math.min(1, fadeOut === 0 ? 1 : (length - index) / fadeOut);
    const noise = seededNoise(cue.seed, index);
    const signal =
      cue.bus === "music"
        ? Math.sin(2 * Math.PI * 110 * t) * 0.18 +
          Math.sin(2 * Math.PI * 165 * t) * 0.12 +
          Math.sin(2 * Math.PI * 220 * t) * 0.08
        : cue.bus === "ambience"
          ? noise * 0.09 + Math.sin(2 * Math.PI * 48 * t) * 0.04
          : cue.bus === "effects"
            ? noise * 0.16
            : Math.sin(2 * Math.PI * 175 * t) * 0.08;
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
  let clippingSamples = 0;
  let longestSilence = 0;
  let silence = 0;
  for (let frame = 0; frame < pcm.length / 2; ++frame) {
    const left = pcm[frame * 2]!;
    const right = pcm[frame * 2 + 1]!;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    if (Math.abs(left) > 1) clippingSamples += 1;
    if (Math.abs(right) > 1) clippingSamples += 1;
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
    clippingSamples,
    longestSilenceSeconds: longestSilence / plan.sampleRate,
    eventAlignment: plan.events.map((event) => {
      const expected = frameToSample(plan, event.frame);
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
      const errorFrames =
        (Math.abs(peakSample - expected) * plan.fps) / plan.sampleRate;
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
  if (source.length === 0 || length === 0) return output;
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
): number => Math.round((frame / plan.fps) * plan.sampleRate);

const edgeEnvelope = (index: number, length: number, edge: number): number =>
  Math.min(1, index / edge, (length - index) / edge);

const phonemeViseme = (
  phoneme: string,
): IAutoMovieProductionViseme["viseme"] => {
  const token = phoneme.toLocaleLowerCase("en-US");
  if (/[aɑɒæʌə]/u.test(token)) return "aa";
  if (/[iɪɨ]/u.test(token)) return "ih";
  if (/[uʊw]/u.test(token)) return "ou";
  if (/[eɛj]/u.test(token)) return "ee";
  if (/[oɔ]/u.test(token)) return "oh";
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
