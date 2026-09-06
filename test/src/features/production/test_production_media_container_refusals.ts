import {
  muxProductionFeatureMp4,
  normalizeProductionH264Mp4,
  probeProductionMedia,
  probeProductionVideoMp4,
  trimProductionAudioPresentation,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { type Box, createFile } from "mp4box";

import {
  productionH264Mp4,
  productionOpusMp4,
  rawMp4Box,
  rewriteProductionH264Mp4,
} from "./productionMediaFixtures";

/** The refusal message of `task`, or null when it returned. */
const refusal = (task: () => unknown): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    // Every media boundary under test throws nothing but Error refusals.
    return (error as Error).message;
  }
};

/** Copy `bytes` with `values` written at `offset`. */
const patched = (
  bytes: Uint8Array,
  offset: number,
  values: number[],
): Uint8Array => {
  const copy = Uint8Array.from(bytes);
  copy.set(values, offset);
  return copy;
};

/** Byte offset of the first box header carrying `type`. */
const boxStart = (bytes: Uint8Array, type: string): number => {
  const offset = Buffer.from(bytes).indexOf(type, 0, "latin1");
  if (offset < 0) throw new Error(`MP4 fixture has no ${type} box.`);
  return offset - 4;
};

const nclx = (fullRange: number): Uint8Array =>
  Uint8Array.from([0x6e, 0x63, 0x6c, 0x78, 0, 1, 0, 13, 0, 1, fullRange]);

const pasp = (hSpacing: number, vSpacing: number): Uint8Array => {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setUint32(0, hSpacing);
  new DataView(payload.buffer).setUint32(4, vSpacing);
  return payload;
};

const withoutPasp = (boxes: Box[]): Box[] =>
  boxes.filter((box) => box.type !== "pasp");

const audioMix = (bytes: Uint8Array): unknown =>
  probeProductionMedia({ kind: "audio-mix", mediaType: "audio/mp4", bytes });

const CLOCK_REFUSAL = "MP4 presentation clocks must be positive safe integers.";

/**
 * Container shapes the resident encoder never writes are still judged by the
 * probe and the feature mux, one named refusal per shape.
 *
 * Every shape is authored through the resident MP4 writer or a single header
 * field patch over a valid fixture, so each refusal is reached with every
 * other container fact intact.
 *
 * Scenarios:
 *
 * 1. H.264 normalization admits exactly one video track that carries samples.
 * 2. The feature mux refuses a video whose movie header declares no runtime,
 *    and an audio track without a presentation edit is refused by the Opus
 *    profile after its empty edit population was read.
 * 3. The video probe refuses a blank file-type brand, repeated color or
 *    pixel-aspect boxes, a zero pixel-aspect term, a duplicated track header,
 *    and a feature whose video track header declares no runtime.
 * 4. The video probe reports a declared presentation edit, an absent color
 *    box, and a sample entry without any child box as such.
 */
export const test_production_media_container_refusals =
  async (): Promise<void> => {
    const video = await productionH264Mp4({
      width: 16,
      height: 16,
      fps: 24,
      frameCount: 4,
    });
    const probe = probeProductionVideoMp4(video);
    const audio = productionOpusMp4(8_000);
    const feature = muxProductionFeatureMp4({ video, audio });
    const sampleless = (() => {
      const file = createFile();
      file.init({ brands: ["isom"], timescale: 24, duration: 0 });
      file.addTrack({
        type: "avc1",
        hdlr: "vide",
        timescale: 24,
        media_duration: 0,
        duration: 0,
        width: 16,
        height: 16,
      });
      return new Uint8Array(file.getBuffer().buffer);
    })();
    TestValidator.equals(
      "normalization admits exactly one sampled video track",
      {
        twoTracks: refusal(() => normalizeProductionH264Mp4(feature)),
        sampleless: refusal(() => normalizeProductionH264Mp4(sampleless)),
      },
      {
        twoTracks: "H.264 normalization requires exactly one video track.",
        sampleless: "H.264 normalization requires resident video samples.",
      },
    );

    const zeroMovie = rewriteProductionH264Mp4(video, {
      movie: { timescale: probe.presentation.movieTimescale, duration: 0 },
    });
    const unedited = productionOpusMp4(8_000, 2, {
      movie: { timescale: 48_000, duration: 8_000 },
    });
    TestValidator.equals(
      "the feature mux refuses a runtime-less video and an unedited audio presentation",
      {
        zeroMovie: refusal(() =>
          muxProductionFeatureMp4({ video: zeroMovie, audio }),
        ),
        unedited: refusal(() => audioMix(unedited)),
      },
      {
        zeroMovie: CLOCK_REFUSAL,
        unedited:
          "Audio-mix MP4 unsupported-audio-profile.timebase.edits.length: expected 1, observed 0.",
      },
    );

    const shapes = {
      // The second compatible brand sits 20 bytes into the file-type box; the
      // major brand is judged earlier by the parser wrapper.
      blankBrand: patched(
        video,
        boxStart(video, "ftyp") + 20,
        [0x20, 0x20, 0x20, 0x20],
      ),
      doubleColor: rewriteProductionH264Mp4(video, {
        descriptionBoxes: (boxes) => [...boxes, rawMp4Box("colr", nclx(0x80))],
      }),
      doublePasp: rewriteProductionH264Mp4(video, {
        descriptionBoxes: (boxes) => [
          ...withoutPasp(boxes),
          rawMp4Box("pasp", pasp(1, 1)),
          rawMp4Box("pasp", pasp(1, 1)),
        ],
      }),
      zeroPasp: rewriteProductionH264Mp4(video, {
        descriptionBoxes: (boxes) => [
          ...withoutPasp(boxes),
          rawMp4Box("pasp", pasp(0, 1)),
        ],
      }),
      doubleHeader: rewriteProductionH264Mp4(video, {
        mutate: (file) => {
          const trak = file.moov!.traks[0]!;
          trak.boxes!.push(trak.tkhd!);
        },
      }),
      // The video track header is the first one the mux writes; its version 0
      // duration sits 28 bytes into the box.
      zeroFeatureClock: patched(
        feature,
        boxStart(feature, "tkhd") + 28,
        [0, 0, 0, 0],
      ),
    };
    TestValidator.equals(
      "the video probe refuses header shapes the encoder never writes",
      {
        blankBrand: refusal(() => probeProductionVideoMp4(shapes.blankBrand)),
        doubleColor: refusal(() => probeProductionVideoMp4(shapes.doubleColor)),
        doublePasp: refusal(() => probeProductionVideoMp4(shapes.doublePasp)),
        zeroPasp: refusal(() => probeProductionVideoMp4(shapes.zeroPasp)),
        doubleHeader: refusal(() =>
          probeProductionVideoMp4(shapes.doubleHeader),
        ),
        zeroFeatureClock: refusal(() =>
          probeProductionMedia({
            kind: "feature",
            mediaType: "video/mp4",
            bytes: shapes.zeroFeatureClock,
          }),
        ),
      },
      {
        blankBrand: "MP4 output requires one nonblank file-type brand box.",
        doubleColor: "MP4 video sample entry contains multiple color boxes.",
        doublePasp:
          "MP4 video sample entry contains multiple pixel-aspect boxes.",
        zeroPasp: "MP4 pixel-aspect terms must be positive safe integers.",
        doubleHeader: "MP4 video track 1 requires one exact track header.",
        zeroFeatureClock: CLOCK_REFUSAL,
      },
    );

    const edited = probeProductionVideoMp4(
      rewriteProductionH264Mp4(video, {
        mutate: (file, track) =>
          trimProductionAudioPresentation({
            file,
            track,
            mediaTimescale: probe.presentation.mediaTimescale,
            movieTimescale: probe.presentation.mediaTimescale,
            primingSamples: 0,
            presentationSamples: probe.presentation.mediaDuration,
          }),
      }),
    );
    const plainColor = probeProductionVideoMp4(
      rewriteProductionH264Mp4(video, {
        descriptionBoxes: (boxes) => boxes.filter((box) => box.type !== "colr"),
      }),
    );
    // A sample entry without child boxes decodes as bare avc1 and carries no
    // color or pixel-aspect declaration at all.
    const bareEntry = probeProductionVideoMp4(
      rewriteProductionH264Mp4(video, { descriptionBoxes: () => [] }),
    );
    TestValidator.equals(
      "declared edits and absent color are reported rather than invented",
      {
        edits: edited.presentation.edits,
        color: plainColor.color,
        bareColor: bareEntry.color,
        barePixelAspect: bareEntry.pixelAspect,
      },
      {
        edits: [
          {
            segmentDuration: probe.presentation.mediaDuration,
            mediaTime: 0,
            mediaRateInteger: 1,
            mediaRateFraction: 0,
          },
        ],
        color: {
          container: { kind: "absent" },
          resolved: { kind: "absent" },
        },
        bareColor: {
          container: { kind: "absent" },
          resolved: { kind: "absent" },
        },
        barePixelAspect: { kind: "implicit-square" },
      },
    );
  };
