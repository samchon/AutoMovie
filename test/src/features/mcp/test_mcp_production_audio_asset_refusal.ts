import { decodeProductionAudioAsset } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { productionWav } from "./productionMediaFixtures";

const ASSET = "public/audio/bed.wav";

/** True when decoding these bytes throws naming every listed fragment. */
const refuses = (
  bytes: Uint8Array,
  fragments: readonly string[],
  sampleRate = 48_000,
): boolean =>
  throwsError(
    () => decodeProductionAudioAsset({ path: ASSET, bytes, sampleRate }),
    [ASSET, ...fragments],
  );

/** What every refusal names, so a rejected asset says what to convert it to. */
const SUPPORTED =
  'Supported audio assets are RIFF/WAVE ("*.wav") containers carrying 16-bit PCM or 32-bit IEEE float samples, mono or stereo.';

/**
 * One well-formed 16-bit PCM mono asset, the twin every refusal is one step
 * from.
 */
const VALID = productionWav({ channels: [[0, 16_384, -32_768, 8_192]] });

/**
 * An audio asset the decoder cannot read is an input violation, not silence.
 *
 * A decoder that returned an empty buffer for an unreadable file would publish
 * a film whose sound design is missing and whose render reported success, and
 * the author would have no way to tell a stem that failed to decode from a cue
 * they forgot to place. So every unsupported container, every unsupported
 * sample format, and every structurally broken WAV throws, and the message
 * names both what it found and what is supported instead.
 *
 * Each case below is one step from {@link VALID}, which decodes: without that
 * twin these would equally be satisfied by a decoder that refused everything.
 *
 * Scenarios:
 *
 * 1. Bytes too short to hold a header, another container entirely, and a RIFF file
 *    whose form is not WAVE are each refused by what they actually are.
 * 2. A chunk declaring more bytes than remain is refused with both counts rather
 *    than read past the end of the buffer.
 * 3. A container missing its format chunk, its data chunk, or carrying a format
 *    chunk too short to hold the fields it must declare is refused by which
 *    part is missing.
 * 4. An extensible header too small to carry its sub-format is refused, because
 *    guessing the sub-format would guess the sample encoding.
 * 5. 8-bit PCM, 64-bit float, and an entirely different encoding are refused by
 *    the exact format tag and bit depth found.
 * 6. More than two channels and a zero sample rate are refused by the value.
 * 7. A data chunk that is not a whole number of frames, and one carrying no frames
 *    at all, are refused rather than decoded to a truncated buffer.
 * 8. A decode target rate that is not a positive whole number is refused, so a bad
 *    rate cannot silently divide the resampler into NaN.
 * 9. The same bytes at a real rate decode, which is what makes each refusal a
 *    statement about the input rather than about the decoder.
 */
export const test_mcp_production_audio_asset_refusal = (): void => {
  TestValidator.equals(
    "an unreadable audio asset is refused by name",
    namedFacts([
      [
        "bytesTooShortForAHeaderAreRefusedByLength",
        () =>
          refuses(Uint8Array.from([0x52, 0x49, 0x46, 0x46]), [
            "is 4 bytes, too short to carry a RIFF/WAVE header",
            SUPPORTED,
          ]),
      ],
      // An ID3 tag: a real container, and one whose leading bytes are not all
      // printable, so the refusal has to report hex beside the tag.
      [
        "anotherContainerIsRefusedByWhatItIs",
        () =>
          refuses(
            Uint8Array.from([
              0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ]),
            ['is not a RIFF/WAVE container: it begins "ID3." (0x49443303)'],
          ),
      ],
      [
        "aRiffWhoseFormIsNotWaveIsRefusedByItsForm",
        () =>
          refuses(productionWav({ form: "AVI " }), ['declares form "AVI "']),
      ],
      [
        "aTruncatedChunkIsRefusedWithBothCounts",
        () =>
          refuses(
            productionWav({ channels: [[0, 0]], declaredDataSize: 4_096 }),
            [
              'is a truncated RIFF/WAVE container: its "data" chunk declares 4096 bytes but only 4 remain',
            ],
          ),
      ],
      [
        "aContainerWithoutAFormatChunkIsRefused",
        () =>
          refuses(productionWav({ omitFormatChunk: true }), [
            'has no RIFF/WAVE "fmt " chunk',
          ]),
      ],
      [
        "aFormatChunkTooShortToDeclareItsFieldsIsRefused",
        () =>
          refuses(productionWav({ formatChunkSize: 14, channels: [[0]] }), [
            'has a "fmt " chunk of 14 bytes; a WAVE format chunk is at least 16 bytes',
          ]),
      ],
      [
        "anExtensibleHeaderWithoutRoomForItsSubFormatIsRefused",
        () =>
          refuses(
            productionWav({
              formatTag: 0xfffe,
              formatChunkSize: 18,
              channels: [[0]],
            }),
            [
              'declares an extensible WAVE format in a "fmt " chunk of 18 bytes, which is too small to carry its 40-byte sub-format',
            ],
          ),
      ],
      [
        "eightBitPcmIsRefusedByItsDepth",
        () =>
          refuses(
            productionWav({
              bitsPerSample: 8,
              declaredChannels: 1,
              data: new Uint8Array(4),
            }),
            ["carries WAVE sample format 0x0001 at 8 bits per sample"],
          ),
      ],
      [
        "sixtyFourBitFloatIsRefusedByItsDepth",
        () =>
          refuses(
            productionWav({
              formatTag: 3,
              bitsPerSample: 64,
              declaredChannels: 1,
              data: new Uint8Array(8),
            }),
            ["carries WAVE sample format 0x0003 at 64 bits per sample"],
          ),
      ],
      [
        "anEntirelyDifferentEncodingIsRefusedByItsFormatTag",
        () =>
          refuses(
            productionWav({
              formatTag: 0x0011,
              bitsPerSample: 4,
              declaredChannels: 1,
              data: new Uint8Array(4),
            }),
            ["carries WAVE sample format 0x0011 at 4 bits per sample"],
          ),
      ],
      [
        "moreThanTwoChannelsIsRefusedByCount",
        () =>
          refuses(
            productionWav({
              declaredChannels: 6,
              data: new Uint8Array(12),
            }),
            ["declares 6 channels", SUPPORTED],
          ),
      ],
      [
        "aZeroSampleRateIsRefusedByValue",
        () =>
          refuses(productionWav({ sampleRate: 0, channels: [[0]] }), [
            "declares a sample rate of 0 Hz",
          ]),
      ],
      [
        "aContainerWithoutADataChunkIsRefused",
        () =>
          refuses(productionWav({ omitDataChunk: true, channels: [[0]] }), [
            'has no RIFF/WAVE "data" chunk',
          ]),
      ],
      [
        "aRaggedDataChunkIsRefusedByFrameArithmetic",
        () =>
          refuses(
            productionWav({ declaredChannels: 2, data: new Uint8Array(6) }),
            [
              'has a "data" chunk of 6 bytes, which is not a whole number of 2-channel 16-bit sample frames',
            ],
          ),
      ],
      [
        "anAssetCarryingNoFramesIsRefused",
        () =>
          refuses(
            productionWav({ declaredChannels: 1, data: new Uint8Array(0) }),
            ["carries no sample frames"],
          ),
      ],
      [
        "aZeroDecodeRateIsRefusedBeforeAnyByteIsRead",
        () => refuses(VALID, ["cannot be decoded at 0 Hz"], 0),
      ],
      [
        "aFractionalDecodeRateIsRefusedTheSameWay",
        () => refuses(VALID, ["cannot be decoded at 48000.5 Hz"], 48_000.5),
      ],
      // The negative twin: the same well-formed bytes every case above is one
      // step from decode, so the refusals above are about their inputs.
      [
        "andTheWellFormedTwinStillDecodes",
        () =>
          decodeProductionAudioAsset({
            path: ASSET,
            bytes: VALID,
            sampleRate: 48_000,
          }).sourceFrames === 4,
      ],
    ]),
    {
      bytesTooShortForAHeaderAreRefusedByLength: true,
      anotherContainerIsRefusedByWhatItIs: true,
      aRiffWhoseFormIsNotWaveIsRefusedByItsForm: true,
      aTruncatedChunkIsRefusedWithBothCounts: true,
      aContainerWithoutAFormatChunkIsRefused: true,
      aFormatChunkTooShortToDeclareItsFieldsIsRefused: true,
      anExtensibleHeaderWithoutRoomForItsSubFormatIsRefused: true,
      eightBitPcmIsRefusedByItsDepth: true,
      sixtyFourBitFloatIsRefusedByItsDepth: true,
      anEntirelyDifferentEncodingIsRefusedByItsFormatTag: true,
      moreThanTwoChannelsIsRefusedByCount: true,
      aZeroSampleRateIsRefusedByValue: true,
      aContainerWithoutADataChunkIsRefused: true,
      aRaggedDataChunkIsRefusedByFrameArithmetic: true,
      anAssetCarryingNoFramesIsRefused: true,
      aZeroDecodeRateIsRefusedBeforeAnyByteIsRead: true,
      aFractionalDecodeRateIsRefusedTheSameWay: true,
      andTheWellFormedTwinStillDecodes: true,
    },
  );
};
