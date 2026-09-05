import { renderProductionSound } from "@automovie/engine";
import { IAutoMovieProductionSoundPlan } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const FPS = 24;
const SAMPLE_RATE = 48_000;
const SAMPLES_PER_FRAME = SAMPLE_RATE / FPS;

/** The film-global frame the cue starts at, clear of frame zero. */
const START_FRAME = 10;

/** How many film frames the cue occupies. */
const DURATION_FRAMES = 8;

/** How many film frames the plan runs. */
const TOTAL_FRAMES = 48;

/**
 * One plan carrying one authored cue and nothing else.
 *
 * No events and no dialogue, so every sample in the render is the cue's or is
 * silence: a reading of this mix is a reading of the cue rather than of what
 * happened to be summed beside it.
 */
const plan = (props: {
  sourceDurationFrames?: number;
  sourceOffsetFrame?: number;
  startFrame?: number;
  durationFrames?: number;
  gain?: number;
}): IAutoMovieProductionSoundPlan => ({
  version: 1,
  inputFingerprint: "sha256:asset",
  fps: FPS,
  totalFrames: TOTAL_FRAMES,
  sampleRate: SAMPLE_RATE,
  channels: 2,
  events: [],
  dialogue: [],
  cues: [
    {
      id: "bed",
      asset: "public/bed.wav",
      startFrame: props.startFrame ?? START_FRAME,
      durationFrames: props.durationFrames ?? DURATION_FRAMES,
      sourceOffsetFrame: props.sourceOffsetFrame ?? 0,
      sourceDurationFrames: props.sourceDurationFrames ?? DURATION_FRAMES,
      gain: props.gain ?? 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      bus: "ambience",
      seed: 7,
    },
  ],
});

/**
 * The same single-cue plan on the NTSC film clock, where one frame is 1601.6
 * samples and no frame boundary but the multiples of five lands on a sample.
 */
const ntscPlan = (props: {
  sourceDurationFrames: number;
  sourceOffsetFrame: number;
  startFrame: number;
}): IAutoMovieProductionSoundPlan => ({
  ...plan({ ...props, durationFrames: 1 }),
  fps: 30_000 / 1_001,
  frameRate: { numerator: 30_000, denominator: 1_001 },
  totalFrames: 6,
});

/**
 * A source whose every sample states its own index and none is zero.
 *
 * A constant would be mixed correctly by a renderer that read the wrong sample,
 * and a sine would be mixed nearly correctly by one that read a neighbouring
 * sample. A ramp makes the value carry the position, so where the mix read is
 * legible in what it wrote, and a ramp that never reaches zero keeps a read
 * sample distinguishable from silence.
 */
const ramp = (length: number): Float32Array =>
  Float32Array.from({ length }, (_, index) => (index + 1) / (length + 1));

/** The mixed sample at one offset into the cue, taken from the left channel. */
const at = (pcm: Float32Array, offset: number): number =>
  pcm[Math.round((START_FRAME * SAMPLES_PER_FRAME + offset) * 2)]!;

/** The left-channel mixed sample at one absolute sample index. */
const sample = (pcm: Float32Array, index: number): number => pcm[index * 2]!;

/**
 * A cue plays the asset it names, at unit rate, from exact frame boundaries.
 *
 * The plan carried every part of an authored cue except which sound it was: the
 * renderer took the asset id, hashed it into a procedural seed, and then mixed
 * a bus-shaped stand-in, a sine bed for music, filtered noise for ambience.
 * So a film's whole sound design was expressible and none of it was audible as
 * authored, which is the shape of defect that passes every test written about
 * the mix and none about the film.
 *
 * The mix then read `sourceDurationFrames` as the span the cue plays and
 * stretched it into the cue's film span, while the compiler and the planner
 * read the same field as the asset's complete duration. Every trim of a longer
 * asset, which is what an authored cue normally is, was therefore played fast.
 * The field is the complete asset, the trim is `sourceOffsetFrame` for
 * `durationFrames`, and both ends of the trim and of its film span are mapped
 * to the sample clock by the one nearest-tick rule.
 *
 * Decoding stays outside: a caller hands in decoded mono samples exactly as it
 * already does for synthesized dialogue, so a codec and a filesystem never
 * reach a mix that has to produce the same bytes on every machine.
 *
 * Scenarios:
 *
 * 1. A cue whose asset is supplied mixes THAT asset, sample for sample from the
 *    offset its edit begins at, scaled by its authored gain.
 * 2. A cue whose asset is absent still mixes, as the bus stand-in it mixed before,
 *    so a film has sound at every stage of its authoring and a missing asset is
 *    not a crash; the two are different sounds, so the first reading is a
 *    reading of the asset rather than of a stand-in that happens to agree.
 * 3. A cue shorter than its complete asset reads at unit rate, and a source
 *    offset that ends exactly at the complete duration selects the native-time
 *    samples there rather than a stretched reading.
 * 4. A cue ending exactly at the film's last frame is accepted, while a trim
 *    that leaves its declared source, an empty span, an empty source, a start
 *    before the film, a fractional frame, and a span past the film are each
 *    refused by cue name before any sample is mixed.
 * 5. On the 30000/1001 clock a one-frame trim and its one-frame film span round
 *    to sample counts that differ by one. Hand arithmetic at 1601.6 samples per
 *    frame: frames 0, 1, 2, 3 land on ticks 0, 1602, 3203, 4805. Film frame 1
 *    reading source frame 0 has 1601 presentation samples for 1602 source
 *    samples, so the last source sample goes unread; film frame 0 reading source
 *    frame 1 has 1602 presentation samples for 1601 source samples, so the last
 *    presentation sample is silent although the generation continues past the
 *    trim. Nothing is resampled to hide the phase.
 * 6. A generation that ends before the declared extent is exact where it
 *    reaches and silent where it does not, because whether a generation is the
 *    declared asset is settled at planning, where the source clock is known.
 * 7. Only PCM the plan references must be finite, and a referenced non-finite
 *    sample is refused by identity and index before mixing.
 */
export const test_film_production_sound_asset = (): void => {
  const length = DURATION_FRAMES * SAMPLES_PER_FRAME;
  const source = ramp(length);
  const longSource = ramp(length * 2);
  const gain = 0.5;

  const played = renderProductionSound({
    plan: plan({ gain }),
    assets: new Map([["public/bed.wav", source]]),
  }).pcm;
  const standIn = renderProductionSound({ plan: plan({ gain }) }).pcm;
  const shorterCue = renderProductionSound({
    plan: plan({ gain, sourceDurationFrames: DURATION_FRAMES * 2 }),
    assets: new Map([["public/bed.wav", longSource]]),
  }).pcm;
  const offsetCue = renderProductionSound({
    plan: plan({
      gain,
      sourceDurationFrames: DURATION_FRAMES * 2,
      sourceOffsetFrame: DURATION_FRAMES,
    }),
    assets: new Map([["public/bed.wav", longSource]]),
  }).pcm;

  // Read where the ramp is steep and unambiguous rather than at its ends, so a
  // renderer reading one sample early or late writes a different number here.
  const OFFSET = 1_000;
  TestValidator.equals(
    "an authored cue mixes the asset it names at unit rate",
    namedFacts([
      [
        "itPlaysTheSampleTheAssetHasThere",
        () => nclose(at(played, OFFSET), source[OFFSET]! * gain, 1e-6),
      ],
      // The stand-in still sounds, and sounds like something else: without both
      // halves this reads as "the mix produced a number" rather than "the mix
      // produced the asset".
      ["theStandInStillSounds", () => Math.abs(at(standIn, OFFSET)) > 1e-6],
      [
        "andTheStandInIsNotTheAsset",
        () => nclose(at(standIn, OFFSET), at(played, OFFSET), 1e-6) === false,
      ],
      // A cue half as long as its asset reads the first half of it, not the
      // whole asset at twice the speed.
      [
        "aCueShorterThanItsAssetReadsAtUnitRate",
        () => nclose(at(shorterCue, OFFSET), longSource[OFFSET]! * gain, 1e-6),
      ],
      [
        "aTrimEndingAtTheCompleteDurationReadsNativeTime",
        () =>
          nclose(
            at(offsetCue, OFFSET),
            longSource[length + OFFSET]! * gain,
            1e-6,
          ),
      ],
      [
        "aCueEndingAtTheFilmEndIsAccepted",
        () =>
          renderProductionSound({
            plan: plan({ startFrame: TOTAL_FRAMES - DURATION_FRAMES }),
            assets: new Map([["public/bed.wav", source]]),
          }).analysis.samplePeak > 0,
      ],
    ]),
    {
      itPlaysTheSampleTheAssetHasThere: true,
      theStandInStillSounds: true,
      andTheStandInIsNotTheAsset: true,
      aCueShorterThanItsAssetReadsAtUnitRate: true,
      aTrimEndingAtTheCompleteDurationReadsNativeTime: true,
      aCueEndingAtTheFilmEndIsAccepted: true,
    },
  );

  const refused = (
    cue: Parameters<typeof plan>[0],
    assets: Float32Array = source,
  ): boolean =>
    throwsError(
      () =>
        renderProductionSound({
          plan: plan(cue),
          assets: new Map([["public/bed.wav", assets]]),
        }),
      ['cue "bed"', "positive whole-frame span"],
    );
  TestValidator.equals(
    "a cue that contradicts its source or its film is refused by name",
    namedFacts([
      ["aTrimLeavingTheDeclaredSource", () => refused({ sourceOffsetFrame: 1 })],
      ["anEmptySpan", () => refused({ durationFrames: 0 })],
      ["anEmptySource", () => refused({ sourceDurationFrames: 0 })],
      ["aStartBeforeTheFilm", () => refused({ startFrame: -1 })],
      ["aNegativeOffset", () => refused({ sourceOffsetFrame: -1 })],
      [
        "aFractionalFrame",
        () =>
          refused({
            durationFrames: 1.5,
            sourceDurationFrames: 2,
            sourceOffsetFrame: 0,
          }),
      ],
      [
        "aSpanPastTheFilm",
        () => refused({ startFrame: TOTAL_FRAMES - DURATION_FRAMES + 1 }),
      ],
    ]),
    {
      aTrimLeavingTheDeclaredSource: true,
      anEmptySpan: true,
      anEmptySource: true,
      aStartBeforeTheFilm: true,
      aNegativeOffset: true,
      aFractionalFrame: true,
      aSpanPastTheFilm: true,
    },
  );

  // Frame ticks on the NTSC clock, from 1601.6 samples per frame rounded to
  // nearest: 0, 1602, 3203, 4805. Written out rather than computed, so the
  // expectation is the arithmetic and not the renderer's own conversion.
  const TICK_1 = 1_602;
  const TICK_2 = 3_203;
  const TICK_3 = 4_805;
  const twoFrames = ramp(TICK_2);
  const threeFrames = ramp(TICK_3);
  const shortPresentation = renderProductionSound({
    plan: ntscPlan({ sourceDurationFrames: 2, sourceOffsetFrame: 0, startFrame: 1 }),
    assets: new Map([["public/bed.wav", twoFrames]]),
  }).pcm;
  const shortSource = renderProductionSound({
    plan: ntscPlan({ sourceDurationFrames: 3, sourceOffsetFrame: 1, startFrame: 0 }),
    assets: new Map([["public/bed.wav", threeFrames]]),
  }).pcm;
  TestValidator.equals(
    "a rational frame clock places the trim and its film span by one tick rule",
    namedFacts([
      // Film frame 1 is [1602, 3203): 1601 samples. Source frame 0 is
      // [0, 1602): 1602 samples. The 1601 presentation samples read source
      // samples 0 through 1600 in order; source sample 1601 is unread.
      [
        "theFirstPresentationSampleReadsTheTrimStart",
        () =>
          nclose(sample(shortPresentation, TICK_1), twoFrames[0]!, 1e-6),
      ],
      [
        "theLastPresentationSampleReadsTheLastReachableSourceSample",
        () =>
          nclose(
            sample(shortPresentation, TICK_2 - 1),
            twoFrames[TICK_2 - TICK_1 - 1]!,
            1e-6,
          ),
      ],
      [
        "andTheSampleAfterTheSpanIsSilent",
        () => sample(shortPresentation, TICK_2) === 0,
      ],
      // Film frame 0 is [0, 1602): 1602 samples. Source frame 1 is
      // [1602, 3203): 1601 samples. Presentation samples 0 through 1600 read
      // source samples 1602 through 3202; presentation sample 1601 would read
      // source sample 3203, which the trim does not include although the
      // three-frame generation does, so it is silent.
      [
        "theFirstPresentationSampleReadsTheOffsetTick",
        () => nclose(sample(shortSource, 0), threeFrames[TICK_1]!, 1e-6),
      ],
      [
        "theLastReadSampleIsTheTrimsLast",
        () =>
          nclose(
            sample(shortSource, TICK_2 - TICK_1 - 1),
            threeFrames[TICK_2 - 1]!,
            1e-6,
          ),
      ],
      [
        "thePresentationSamplePastTheTrimIsSilent",
        () => sample(shortSource, TICK_2 - TICK_1) === 0,
      ],
      ["andSoIsTheSampleAfterTheSpan", () => sample(shortSource, TICK_1) === 0],
    ]),
    {
      theFirstPresentationSampleReadsTheTrimStart: true,
      theLastPresentationSampleReadsTheLastReachableSourceSample: true,
      andTheSampleAfterTheSpanIsSilent: true,
      theFirstPresentationSampleReadsTheOffsetTick: true,
      theLastReadSampleIsTheTrimsLast: true,
      thePresentationSamplePastTheTrimIsSilent: true,
      andSoIsTheSampleAfterTheSpan: true,
    },
  );

  const shortGeneration = renderProductionSound({
    plan: plan({ gain }),
    assets: new Map([["public/bed.wav", source.subarray(0, length - 1)]]),
  }).pcm;
  TestValidator.equals(
    "a generation is exact where it reaches and silent where it does not",
    namedFacts([
      [
        "theReachedSampleIsExact",
        () =>
          nclose(at(shortGeneration, length - 2), source[length - 2]! * gain, 1e-6),
      ],
      ["theUnreachedTickIsSilent", () => at(shortGeneration, length - 1) === 0],
    ]),
    { theReachedSampleIsExact: true, theUnreachedTickIsSilent: true },
  );

  const dialoguePlan: IAutoMovieProductionSoundPlan = {
    ...plan({}),
    cues: [],
    dialogue: [
      {
        id: "line",
        text: "line",
        language: "en",
        startFrame: 0,
        endFrame: 1,
      },
    ],
  };
  TestValidator.equals(
    "only referenced supplied PCM must be finite before mixing",
    namedFacts([
      [
        "aReferencedAssetNaNIsRefusedByIdentityAndIndex",
        () =>
          throwsError(
            () =>
              renderProductionSound({
                plan: plan({}),
                assets: new Map([
                  ["public/bed.wav", Float32Array.of(0, Number.NaN)],
                ]),
              }),
            ['audio asset "public/bed.wav"', "index 1"],
          ),
      ],
      [
        "aReferencedDialogueInfinityIsRefused",
        () =>
          throwsError(
            () =>
              renderProductionSound({
                plan: dialoguePlan,
                dialogue: new Map([["line", Float32Array.of(-Infinity)]]),
              }),
            ['dialogue line "line"', "index 0"],
          ),
      ],
      [
        "anUnreferencedInvalidEntryIsOutsideTheIngressBoundary",
        () =>
          renderProductionSound({
            plan: plan({}),
            assets: new Map([
              ["unused", Float32Array.of(Number.NaN)],
              ["public/bed.wav", Float32Array.of(-0, 1e-45, 3.4e38)],
            ]),
          }).pcm.every(Number.isFinite),
      ],
    ]),
    {
      aReferencedAssetNaNIsRefusedByIdentityAndIndex: true,
      aReferencedDialogueInfinityIsRefused: true,
      anUnreferencedInvalidEntryIsOutsideTheIngressBoundary: true,
    },
  );
};
