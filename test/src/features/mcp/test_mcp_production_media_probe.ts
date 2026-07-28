import { probeProductionMedia } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  productionAudioMp4,
  productionH264Mp4,
  productionInterframeH264Mp4,
  productionMpeg4Part2Mp4,
  productionPng,
  productionWebVtt,
} from "./productionMediaFixtures";

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

const boxTypeOffset = (bytes: Uint8Array, type: string): number => {
  const offset = Buffer.from(bytes).indexOf(type);
  if (offset < 0) throw new Error(`MP4 fixture has no ${type} box.`);
  return offset;
};

/** Production receipts are decoded from actual raster, text and MP4 bytes. */
export const test_mcp_production_media_probe = async (): Promise<void> => {
  const png = productionPng(16, 8);
  TestValidator.equals(
    "the PNG probe reports the decoded raster",
    probeProductionMedia({
      kind: "preview",
      mediaType: "image/png",
      bytes: png,
    }),
    { kind: "png", width: 16, height: 8 },
  );
  TestValidator.predicate(
    "a preview cannot relabel PNG bytes",
    refused(
      () =>
        probeProductionMedia({
          kind: "preview",
          mediaType: "image/jpeg",
          bytes: png,
        }),
      "require image/png",
    ),
  );
  TestValidator.predicate(
    "a malformed PNG is rejected by the decoder",
    refused(
      () =>
        probeProductionMedia({
          kind: "preview",
          mediaType: "image/png",
          bytes: Buffer.from("not a png"),
        }),
      "unrecognised content",
    ),
  );

  const vtt = productionWebVtt();
  TestValidator.equals(
    "the WebVTT probe counts observable cues",
    probeProductionMedia({
      kind: "captions",
      mediaType: "text/vtt",
      bytes: vtt,
    }),
    {
      kind: "webvtt",
      cueCount: 2,
      firstCueSeconds: 0,
      lastCueSeconds: 0.1,
    },
  );
  TestValidator.equals(
    "WebVTT metadata blocks are ignored before observable cues are counted",
    probeProductionMedia({
      kind: "captions",
      mediaType: "text/vtt",
      bytes: Buffer.from(
        "WEBVTT\n\nNOTE production metadata\nnot a cue\n\n00:00:00.000 --> 00:00:00.100\nVisible.\n",
      ),
    }),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.1,
    },
  );
  TestValidator.predicate(
    "captions cannot relabel WebVTT bytes",
    refused(
      () =>
        probeProductionMedia({
          kind: "captions",
          mediaType: "text/plain",
          bytes: vtt,
        }),
      "require text/vtt",
    ),
  );
  TestValidator.predicate(
    "caption bytes require a WebVTT header",
    refused(
      () =>
        probeProductionMedia({
          kind: "captions",
          mediaType: "text/vtt",
          bytes: Buffer.from("00:00:00.000 --> 00:00:00.100\nNo header.\n"),
        }),
      "valid WebVTT header",
    ),
  );
  const invalidWebVttCases = [
    {
      bytes: "WEBVTT\n\n",
      message: "no timed cue",
    },
    {
      bytes:
        "WEBVTT\n\n00:00.000 --> 00:00.250\nValid.\n\nStray untimed payload.\n",
      message: "neither a timed cue",
    },
    {
      bytes: "WEBVTT\n\n00:00:00 --> 00:00:00.100\nMalformed.\n",
      message: "malformed",
    },
    {
      bytes: "WEBVTT\n\n00:00:00.100 --> 00:00:00.100\nZero.\n",
      message: "must end after",
    },
    {
      bytes: "WEBVTT\n\n00:00:00.000 --> 00:00:00.100\n\n",
      message: "no non-empty payload",
    },
    {
      bytes:
        "WEBVTT\n\n00:00.000 --> 00:00.250\nFirst.\n00:00.250 --> 00:00.500\nSecond.\n",
      message: "without a blank separator",
    },
    {
      bytes:
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLater.\n\n00:00.500 --> 00:00.750\nEarlier.\n",
      message: "starts before",
    },
  ];
  TestValidator.predicate(
    "WebVTT cues must be non-empty, syntactically valid, positive and ordered",
    invalidWebVttCases.every((item) =>
      refused(
        () =>
          probeProductionMedia({
            kind: "captions",
            mediaType: "text/vtt",
            bytes: Buffer.from(item.bytes),
          }),
        item.message,
      ),
    ),
  );
  TestValidator.equals(
    "WebVTT accepts the standard timestamp form without an hour field",
    probeProductionMedia({
      kind: "captions",
      mediaType: "text/vtt",
      bytes: Buffer.from(
        "WEBVTT\n\n00:00.000 --> 00:00.250\nShort timestamp.\n",
      ),
    }),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT accepts one cue identifier before observable payload",
    probeProductionMedia({
      kind: "captions",
      mediaType: "text/vtt",
      bytes: Buffer.from(
        "WEBVTT\n\nopening-line\n00:00.000 --> 00:00.250\nSignal.\n",
      ),
    }),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT treats a whitespace-only separator as a cue boundary",
    probeProductionMedia({
      kind: "captions",
      mediaType: "text/vtt",
      bytes: Buffer.from("WEBVTT\n \n00:00.000 --> 00:00.250\nSignal.\n"),
    }),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );

  const video = await productionH264Mp4({
    width: 16,
    height: 16,
    fps: 24,
    frameCount: 4,
  });
  const feature = probeProductionMedia({
    kind: "feature",
    mediaType: "video/mp4",
    bytes: video,
  });
  TestValidator.predicate(
    "the feature probe derives H.264 geometry and frame timing",
    feature.kind === "video" &&
      feature.container === "mp4" &&
      feature.codec === "h264" &&
      feature.width === 16 &&
      feature.height === 16 &&
      feature.frameCount === 4 &&
      feature.fps === 24 &&
      Math.abs(feature.runtimeSeconds - 4 / 24) < 1e-9,
  );
  TestValidator.predicate(
    "guide passes use the same decoded video contract",
    probeProductionMedia({
      kind: "guide-pass",
      mediaType: "video/mp4",
      bytes: video,
    }).kind === "video",
  );
  TestValidator.predicate(
    "encoded video cannot use a different declared media type",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "application/octet-stream",
          bytes: video,
        }),
      "require video/mp4",
    ),
  );
  TestValidator.predicate(
    "an MP4 claim cannot be shorter than a container header",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: video.subarray(0, 12),
        }),
      "too short",
    ),
  );
  const ftypSize = Buffer.from(video).readUInt32BE(0);
  TestValidator.predicate(
    "an ISO brand without movie metadata is not a video",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: video.subarray(0, ftypSize),
        }),
      "movie metadata",
    ),
  );
  const parserReportedContainer = Buffer.from(video);
  parserReportedContainer[ftypSize + 4] = 0;
  TestValidator.predicate(
    "an invalid inner box type is surfaced through the parser error callback",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: parserReportedContainer,
        }),
      "MP4 parser rejected output",
    ),
  );
  const unsupportedItemLocation = Buffer.alloc(12);
  unsupportedItemLocation.writeUInt32BE(12, 0);
  unsupportedItemLocation.write("iloc", 4, 4, "ascii");
  unsupportedItemLocation[8] = 3;
  TestValidator.predicate(
    "a malformed full box surfaced as a synchronous parser exception is normalized",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: Buffer.concat([
            video.subarray(0, ftypSize),
            unsupportedItemLocation,
          ]),
        }),
      "MP4 parser rejected output: RangeError",
    ),
  );
  TestValidator.predicate(
    "movie metadata without an ISO base-media brand is refused",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: video.subarray(ftypSize),
        }),
      "compatible brand",
    ),
  );
  TestValidator.predicate(
    "random bytes cannot masquerade as an MP4 container",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: new Uint8Array(32),
        }),
      "MP4",
    ),
  );
  const malformedContainer = Buffer.from(video);
  const moovType = boxTypeOffset(malformedContainer, "moov");
  malformedContainer.writeUInt32BE(0x7fffffff, moovType - 4);
  TestValidator.predicate(
    "a structurally malformed box cannot escape parser errors",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: malformedContainer,
        }),
      "MP4",
    ),
  );
  const escapedSamples = Buffer.from(video);
  const chunkOffsetBox = escapedSamples.indexOf("stco");
  if (chunkOffsetBox < 0)
    throw new Error("H.264 fixture has no stco sample-offset table to mutate.");
  escapedSamples.writeUInt32BE(0xffffffff, chunkOffsetBox + 12);
  TestValidator.predicate(
    "a sample table cannot point outside resident container bytes",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: escapedSamples,
        }),
      "resident bytes",
    ),
  );
  const zeroVideoClock = Buffer.from(video);
  const videoMediaHeader = boxTypeOffset(zeroVideoClock, "mdhd");
  zeroVideoClock.writeUInt32BE(0, videoMediaHeader + 16);
  TestValidator.predicate(
    "a video track requires a positive media clock",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: zeroVideoClock,
        }),
      "positive dimensions",
    ),
  );
  const zeroSampleDuration = Buffer.from(video);
  const timeToSample = boxTypeOffset(zeroSampleDuration, "stts");
  zeroSampleDuration.writeUInt32BE(0, timeToSample + 16);
  TestValidator.predicate(
    "video frames require a positive constant sample duration",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: zeroSampleDuration,
        }),
      "constant deterministic frame duration",
    ),
  );
  const noSyncSample = Buffer.from(productionInterframeH264Mp4());
  const syncSamples = boxTypeOffset(noSyncSample, "stss");
  noSyncSample.writeUInt32BE(0, syncSamples + 8);
  TestValidator.predicate(
    "a deterministic video requires at least one sync sample",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: noSyncSample,
        }),
      "no independently decodable sync sample",
    ),
  );
  const unbackedSamples = Buffer.from(video);
  unbackedSamples.write(
    "free",
    boxTypeOffset(unbackedSamples, "mdat"),
    4,
    "ascii",
  );
  TestValidator.predicate(
    "sample tables require parsed media-data boxes",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: unbackedSamples,
        }),
      "media-data boxes",
    ),
  );
  TestValidator.predicate(
    "a non-AVC sample entry is refused even inside MP4",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: productionMpeg4Part2Mp4(),
        }),
      "not an H.264",
    ),
  );

  const audio = productionAudioMp4();
  const audioProbe = probeProductionMedia({
    kind: "audio-mix",
    mediaType: "audio/mp4",
    bytes: audio,
  });
  TestValidator.predicate(
    "the audio probe derives real codec, clock, channels and sample rate",
    audioProbe.kind === "audio" &&
      audioProbe.container === "mp4" &&
      audioProbe.codec.length > 0 &&
      audioProbe.runtimeSeconds > 0 &&
      audioProbe.channels === 1 &&
      audioProbe.sampleRate > 0,
  );
  const zeroAudioClock = Buffer.from(audio);
  const audioMediaHeader = boxTypeOffset(zeroAudioClock, "mdhd");
  zeroAudioClock.writeUInt32BE(0, audioMediaHeader + 16);
  TestValidator.predicate(
    "an audio track requires positive timing metadata",
    refused(
      () =>
        probeProductionMedia({
          kind: "audio-mix",
          mediaType: "audio/mp4",
          bytes: zeroAudioClock,
        }),
      "lacks codec, duration",
    ),
  );
  TestValidator.predicate(
    "an audio mix cannot use a different declared media type",
    refused(
      () =>
        probeProductionMedia({
          kind: "audio-mix",
          mediaType: "video/mp4",
          bytes: audio,
        }),
      "requires audio/mp4",
    ),
  );
  TestValidator.predicate(
    "audio-only MP4 cannot satisfy a feature track",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: audio,
        }),
      "0 video tracks",
    ),
  );
  TestValidator.predicate(
    "video-only MP4 cannot satisfy an audio mix",
    refused(
      () =>
        probeProductionMedia({
          kind: "audio-mix",
          mediaType: "audio/mp4",
          bytes: video,
        }),
      "video tracks; none are allowed",
    ),
  );
  const trackless = Buffer.from(audio);
  trackless.write("free", boxTypeOffset(trackless, "trak"), "ascii");
  TestValidator.predicate(
    "an audio mix requires exactly one audio track",
    refused(
      () =>
        probeProductionMedia({
          kind: "audio-mix",
          mediaType: "audio/mp4",
          bytes: trackless,
        }),
      "0 audio tracks",
    ),
  );
};
