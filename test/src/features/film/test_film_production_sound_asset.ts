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

/**
 * One plan carrying one authored cue and nothing else.
 *
 * No events and no dialogue, so every sample in the render is the cue's or is
 * silence: a reading of this mix is a reading of the cue rather than of what
 * happened to be summed beside it.
 */
const plan = (props: {
  sourceDurationFrames?: number;
  gain?: number;
}): IAutoMovieProductionSoundPlan => ({
  version: 1,
  inputFingerprint: "sha256:asset",
  fps: FPS,
  totalFrames: 48,
  sampleRate: SAMPLE_RATE,
  channels: 2,
  events: [],
  dialogue: [],
  cues: [
    {
      id: "bed",
      asset: "public/bed.wav",
      startFrame: START_FRAME,
      durationFrames: DURATION_FRAMES,
      sourceOffsetFrame: 0,
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
 * A source whose every sample states its own index.
 *
 * A constant would be mixed correctly by a renderer that read the wrong sample,
 * and a sine would be mixed nearly correctly by one that read a neighbouring
 * sample. A ramp makes the value carry the position, so where the mix read is
 * legible in what it wrote.
 */
const ramp = (length: number): Float32Array =>
  Float32Array.from({ length }, (_, index) => index / length);

/** The mixed sample at one offset into the cue, taken from the left channel. */
const at = (pcm: Float32Array, offset: number): number =>
  pcm[Math.round((START_FRAME * SAMPLES_PER_FRAME + offset) * 2)]!;

/**
 * A cue plays the asset it names.
 *
 * The plan carried every part of an authored cue except which sound it was: the
 * renderer took the asset id, hashed it into a procedural seed, and then mixed
 * a bus-shaped stand-in -- a sine bed for music, filtered noise for ambience.
 * So a film's whole sound design was expressible and none of it was audible as
 * authored, which is the shape of defect that passes every test written about
 * the mix and none about the film.
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
 *    not a crash.
 * 3. The two are different sounds, so the first reading is a reading of the asset
 *    rather than of a stand-in that happens to agree.
 * 4. A cue whose source span is twice its film span reads the asset at twice the
 *    rate: the stretch is the author's statement and not the renderer's.
 */
export const test_film_production_sound_asset = (): void => {
  const length = Math.round(DURATION_FRAMES * SAMPLES_PER_FRAME);
  const source = ramp(length * 2);
  const gain = 0.5;

  const played = renderProductionSound({
    plan: plan({ gain }),
    assets: new Map([["public/bed.wav", source]]),
  }).pcm;
  const standIn = renderProductionSound({ plan: plan({ gain }) }).pcm;
  const stretched = renderProductionSound({
    plan: plan({ gain, sourceDurationFrames: DURATION_FRAMES * 2 }),
    assets: new Map([["public/bed.wav", source]]),
  }).pcm;

  // Read where the ramp is steep and unambiguous rather than at its ends, so a
  // renderer reading one sample early or late writes a different number here.
  const OFFSET = 1_000;
  TestValidator.equals(
    "an authored cue mixes the asset it names",
    namedFacts([
      [
        "itPlaysTheSampleTheAssetHasThere",
        () => nclose(at(played, OFFSET), source[OFFSET]! * gain, 1e-6),
      ],
      // Twice the source span in the same film span is twice the read rate, so
      // the same film offset lands on twice the source index.
      [
        "aStretchedCueReadsTheAssetFaster",
        () => nclose(at(stretched, OFFSET), source[OFFSET * 2]! * gain, 1e-6),
      ],
      // The stand-in still sounds, and sounds like something else: without both
      // halves this reads as "the mix produced a number" rather than "the mix
      // produced the asset".
      ["theStandInStillSounds", () => Math.abs(at(standIn, OFFSET)) > 1e-6],
      [
        "andTheStandInIsNotTheAsset",
        () => nclose(at(standIn, OFFSET), at(played, OFFSET), 1e-6) === false,
      ],
      // Past the asset's end the cue is silent rather than looped: a cue longer
      // than its asset is a fact about the edit.
      [
        "pastTheAssetItIsSilent",
        () => nclose(at(stretched, Math.round(length * 1.5)), 0, 1e-9),
      ],
    ]),
    {
      itPlaysTheSampleTheAssetHasThere: true,
      aStretchedCueReadsTheAssetFaster: true,
      theStandInStillSounds: true,
      andTheStandInIsNotTheAsset: true,
      pastTheAssetItIsSilent: true,
    },
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
