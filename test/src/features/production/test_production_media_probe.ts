import type {
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionSoundEvidence,
} from "@automovie/interface";
import {
  muxProductionFeatureMp4,
  probeProductionMedia,
  probeProductionVideoMp4,
  trimProductionAudioPresentation,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createFile } from "mp4box";

import { namedFacts } from "../internal/predicates";
import {
  productionAudioMp4,
  productionH264Mp4,
  productionInterframeH264Mp4,
  productionMpeg4Part2Mp4,
  productionOpusMp4,
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

const summarizeWebVtt = (probe: IAutoMovieProductionMediaProbe) => {
  if (probe.kind !== "webvtt") throw new Error("Expected a WebVTT probe.");
  return {
    kind: probe.kind,
    cueCount: probe.cueCount,
    firstCueSeconds: probe.firstCueSeconds,
    lastCueSeconds: probe.lastCueSeconds,
  };
};

/** Production receipts are decoded from actual raster, text and MP4 bytes. */
export const test_production_media_probe = async (): Promise<void> => {
  const png = productionPng(16, 8);
  TestValidator.equals(
    "the PNG probe reports the decoded raster",
    probeProductionMedia({
      kind: "preview",
      mediaType: "image/png",
      bytes: png,
    }),
    {
      kind: "png",
      width: 16,
      height: 8,
      picture: {
        width: 16,
        height: 8,
        bitDepth: 8,
        color: "rgba",
        alpha: "straight",
        interlace: "none",
        colorSpace: "srgb",
        pixelAspect: { kind: "square" },
        orientation: "upright",
      },
    },
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
      "requires image/png",
    ),
  );
  TestValidator.predicate(
    "a malformed PNG is refused by name before any decoder speaks",
    refused(
      () =>
        probeProductionMedia({
          kind: "preview",
          mediaType: "image/png",
          bytes: Buffer.from("not a png"),
        }),
      "PNG datastream lacks the required signature",
    ),
  );
  const soundEvidenceValue: IAutoMovieProductionSoundEvidence = {
    version: 2,
    plan: {
      version: 1,
      inputFingerprint: `sha256:${"1".repeat(64)}`,
      fps: 24,
      frameRate: { numerator: 24, denominator: 1 },
      totalFrames: 24,
      sampleRate: 48_000,
      channels: 2,
      events: [],
      cues: [],
      dialogue: [],
    },
    analysis: {
      version: 1,
      sampleRate: 48_000,
      sampleFrames: 48_000,
      runtimeSeconds: 1,
      integratedLoudness: null,
      samplePeak: 0,
      clippingSamples: 0,
      longestSilenceSeconds: 1,
      eventAlignment: [],
    },
    tts: [],
    audio: {
      path: "audio.mp4",
      mediaType: "audio/mp4",
      bytes: 128,
      digest: `sha256:${"2".repeat(64)}`,
    },
    measurement: {
      source: "pre-encode-pcm",
      algorithm: "automovie-production-sound-analysis-v1",
    },
  };
  const soundEvidence = Buffer.from(JSON.stringify(soundEvidenceValue));
  TestValidator.equals(
    "sound evidence preserves the complete current version-2 identity",
    probeProductionMedia({
      kind: "audio-mix",
      mediaType: "application/json",
      bytes: soundEvidence,
    }),
    { kind: "sound-evidence", evidence: soundEvidenceValue },
  );
  TestValidator.equals(
    "sound evidence must be UTF-8 JSON in the complete current schema",
    namedFacts([
      [
        "refusedProbeProductionMediaKind",
        () =>
          refused(
            () =>
              probeProductionMedia({
                kind: "audio-mix",
                mediaType: "application/json",
                bytes: Buffer.from([0xc3]),
              }),
            "UTF-8 JSON",
          ),
      ],
      [
        "refusedProbeProductionMediaKind2",
        () =>
          refused(
            () =>
              probeProductionMedia({
                kind: "audio-mix",
                mediaType: "application/json",
                bytes: Buffer.from(
                  JSON.stringify({
                    version: 1,
                    plan: { events: [{}] },
                    analysis: { clippingSamples: 0, eventAlignment: [] },
                    tts: [],
                  }),
                ),
              }),
            "complete version-2",
          ),
      ],
      [
        "refusedProbeProductionMediaKind3",
        () =>
          refused(
            () =>
              probeProductionMedia({
                kind: "audio-mix",
                mediaType: "application/json",
                bytes: Buffer.from("{}"),
              }),
            "complete version-2",
          ),
      ],
    ]),
    {
      refusedProbeProductionMediaKind: true,
      refusedProbeProductionMediaKind2: true,
      refusedProbeProductionMediaKind3: true,
    },
  );
  TestValidator.equals(
    "audio-mix PNG evidence is decoded as a raster",
    probeProductionMedia({
      kind: "audio-mix",
      mediaType: "image/png",
      bytes: png,
    }),
    {
      kind: "png",
      width: 16,
      height: 8,
      picture: {
        width: 16,
        height: 8,
        bitDepth: 8,
        color: "rgba",
        alpha: "straight",
        interlace: "none",
        colorSpace: "srgb",
        pixelAspect: { kind: "square" },
        orientation: "upright",
      },
    },
  );

  const vtt = productionWebVtt();
  TestValidator.equals(
    "the WebVTT probe counts observable cues",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: vtt,
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 2,
      firstCueSeconds: 0,
      lastCueSeconds: 0.1,
    },
  );
  TestValidator.equals(
    "WebVTT metadata blocks are ignored before observable cues are counted",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\nNOTE production metadata\nnot a cue\n\n00:00:00.000 --> 00:00:00.100\nVisible.\n",
        ),
      }),
    ),
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
      bytes: "WEBVTT\n\n00:00.000\u2028-->\u202900:00.250\nMalformed.\n",
      message: "malformed",
    },
    {
      bytes: "WEBVTT\n\n00:00.000 --> 00:00.250 --> invalid\nMalformed.\n",
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
  TestValidator.predicate(
    "WebVTT bytes must be valid UTF-8",
    refused(
      () =>
        probeProductionMedia({
          kind: "captions",
          mediaType: "text/vtt",
          bytes: Buffer.concat([
            Buffer.from("WEBVTT\n\n00:00.000 --> 00:00.250\nInvalid byte: "),
            Buffer.from([0xc3]),
            Buffer.from("\n"),
          ]),
        }),
      "valid UTF-8",
    ),
  );
  TestValidator.equals(
    "WebVTT accepts the standard timestamp form without an hour field",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\n00:00.000 --> 00:00.250\nShort timestamp.\n",
        ),
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT accepts one cue identifier before observable payload",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\nopening-line\n00:00.000 --> 00:00.250\nSignal.\n",
        ),
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT settings preserve legal Unicode line-separator characters",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\n00:00.000 --> 00:00.250 region:zone\u2028\u2029\nSignal.\n",
        ),
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT preserves whitespace-only payload lines inside one cue",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\n00:00.000 --> 00:00.250\nFirst.\n \nSecond.\n",
        ),
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 1,
      firstCueSeconds: 0,
      lastCueSeconds: 0.25,
    },
  );
  TestValidator.equals(
    "WebVTT metadata tokens remain legal timed cue identifiers",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from(
          "WEBVTT\n\nNOTE\n00:00.000 --> 00:00.100\nFirst.\n\nSTYLE intro\n00:00.100 --> 00:00.200\nSecond.\n\nREGION intro\n00:00.200 --> 00:00.300\nThird.\n",
        ),
      }),
    ),
    {
      kind: "webvtt",
      cueCount: 3,
      firstCueSeconds: 0,
      lastCueSeconds: 0.3,
    },
  );
  TestValidator.equals(
    "WebVTT treats a whitespace-only separator as a cue boundary",
    summarizeWebVtt(
      probeProductionMedia({
        kind: "captions",
        mediaType: "text/vtt",
        bytes: Buffer.from("WEBVTT\n \n00:00.000 --> 00:00.250\nSignal.\n"),
      }),
    ),
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
  const videoProbe = probeProductionMedia({
    kind: "guide-pass",
    mediaType: "video/mp4",
    bytes: video,
  });
  TestValidator.equals(
    "the guide probe derives H.264 geometry and frame timing",
    namedFacts([
      ["videoProbeKindVideo", () => videoProbe.kind === "video"],
      [
        "videoProbeContainerMp4",
        () => videoProbe.kind === "video" && videoProbe.container === "mp4",
      ],
      [
        "videoProbeCodecH264",
        () => videoProbe.kind === "video" && videoProbe.codec === "h264",
      ],
      [
        "videoProbeWidth",
        () => videoProbe.kind === "video" && videoProbe.width === 16,
      ],
      [
        "videoProbeHeight",
        () => videoProbe.kind === "video" && videoProbe.height === 16,
      ],
      [
        "videoProbeFrameCount",
        () => videoProbe.kind === "video" && videoProbe.frameCount === 4,
      ],
      [
        "videoProbeFps",
        () => videoProbe.kind === "video" && videoProbe.fps === 24,
      ],
      [
        "MathAbsVideoProbe",
        () =>
          videoProbe.kind === "video" &&
          Math.abs(videoProbe.runtimeSeconds - 4 / 24) < 1e-9,
      ],
    ]),
    {
      videoProbeKindVideo: true,
      videoProbeContainerMp4: true,
      videoProbeCodecH264: true,
      videoProbeWidth: true,
      videoProbeHeight: true,
      videoProbeFrameCount: true,
      videoProbeFps: true,
      MathAbsVideoProbe: true,
    },
  );
  const featureBytes = muxProductionFeatureMp4({
    video,
    audio: productionOpusMp4(8_000),
  });
  const feature = probeProductionMedia({
    kind: "feature",
    mediaType: "video/mp4",
    bytes: featureBytes,
  });
  TestValidator.equals(
    "a feature requires and preserves exact-runtime H.264 plus stereo Opus",
    namedFacts([
      ["featureKindFeature", () => feature.kind === "feature"],
      [
        "featureFrameCount",
        () => feature.kind === "feature" && feature.video.frameCount === 4,
      ],
      [
        "featureFps",
        () => feature.kind === "feature" && feature.video.fps === 24,
      ],
      [
        "MathAbsFeature",
        () =>
          feature.kind === "feature" &&
          Math.abs(feature.video.runtimeSeconds - 4 / 24) < 1e-9,
      ],
      [
        "featureAudioOpus",
        () => feature.kind === "feature" && feature.audio.codec === "opus",
      ],
    ]),
    {
      featureKindFeature: true,
      featureFrameCount: true,
      featureFps: true,
      MathAbsFeature: true,
      featureAudioOpus: true,
    },
  );
  TestValidator.predicate(
    "video-only MP4 cannot satisfy the final feature contract",
    refused(
      () =>
        probeProductionMedia({
          kind: "feature",
          mediaType: "video/mp4",
          bytes: video,
        }),
      "exactly 2",
    ),
  );
  TestValidator.equals(
    "the intermediate production-video probe accepts only H.264-only MP4",
    namedFacts([
      [
        "probeProductionVideoMp4VideoFrameCount",
        () => probeProductionVideoMp4(video).frameCount === 4,
      ],
      [
        "refusedProbeProductionVideoMp4FeatureBytes",
        () =>
          refused(() => probeProductionVideoMp4(featureBytes), "exactly one"),
      ],
      [
        "refusedProbeProductionVideoMp4ProductionOpusMp4",
        () =>
          refused(
            () => probeProductionVideoMp4(productionOpusMp4(8_000)),
            "0 video tracks",
          ),
      ],
    ]),
    {
      probeProductionVideoMp4VideoFrameCount: true,
      refusedProbeProductionVideoMp4FeatureBytes: true,
      refusedProbeProductionVideoMp4ProductionOpusMp4: true,
    },
  );
  TestValidator.predicate(
    "feature mux refuses unequal track clocks",
    refused(
      () =>
        muxProductionFeatureMp4({
          video,
          audio: productionOpusMp4(7_999),
        }),
      "exactly equal",
    ),
  );
  TestValidator.predicate(
    "feature mux refuses a non-48-kHz-stereo final audio track",
    refused(
      () =>
        muxProductionFeatureMp4({
          video,
          audio: productionOpusMp4(8_000, 1),
        }),
      "unsupported-audio-profile.channels",
    ),
  );
  const editFile = createFile();
  editFile.init({ brands: ["isom"], timescale: 48_000, duration: 960 });
  const editTrack = editFile.addTrack({
    type: "Opus",
    hdlr: "soun",
    timescale: 48_000,
    media_duration: 960,
    duration: 960,
  });
  TestValidator.equals(
    "audio presentation edits reject malformed clocks and duplicate edits",
    namedFacts([
      [
        "refusedTrimProductionAudioPresentationFile",
        () =>
          refused(
            () =>
              trimProductionAudioPresentation({
                file: editFile,
                track: 0,
                mediaTimescale: 48_000,
                movieTimescale: 48_000,
                primingSamples: 0,
                presentationSamples: 960,
              }),
            "finite sample counts",
          ),
      ],
      [
        "refusedTrimProductionAudioPresentationFile2",
        () =>
          refused(
            () =>
              trimProductionAudioPresentation({
                file: editFile,
                track: editTrack,
                mediaTimescale: 48_000,
                movieTimescale: 48_000,
                primingSamples: -1,
                presentationSamples: 960,
              }),
            "finite sample counts",
          ),
      ],
      [
        "refusedTrimProductionAudioPresentationFile3",
        () =>
          refused(
            () =>
              trimProductionAudioPresentation({
                file: editFile,
                track: editTrack,
                mediaTimescale: 3,
                movieTimescale: 2,
                primingSamples: 0,
                presentationSamples: 1,
              }),
            "does not land",
          ),
      ],
      [
        "refusedTrimProductionAudioPresentationFile4",
        () =>
          refused(
            () =>
              trimProductionAudioPresentation({
                file: editFile,
                track: editTrack + 1,
                mediaTimescale: 48_000,
                movieTimescale: 48_000,
                primingSamples: 0,
                presentationSamples: 960,
              }),
            "existing track",
          ),
      ],
    ]),
    {
      refusedTrimProductionAudioPresentationFile: true,
      refusedTrimProductionAudioPresentationFile2: true,
      refusedTrimProductionAudioPresentationFile3: true,
      refusedTrimProductionAudioPresentationFile4: true,
    },
  );
  trimProductionAudioPresentation({
    file: editFile,
    track: editTrack,
    mediaTimescale: 48_000,
    movieTimescale: 48_000,
    primingSamples: 312,
    presentationSamples: 960,
  });
  TestValidator.predicate(
    "audio presentation edits cannot be added twice",
    refused(
      () =>
        trimProductionAudioPresentation({
          file: editFile,
          track: editTrack,
          mediaTimescale: 48_000,
          movieTimescale: 48_000,
          primingSamples: 312,
          presentationSamples: 960,
        }),
      "already has",
    ),
  );
  const headerless = createFile();
  headerless.init({ brands: ["isom"], timescale: 48_000, duration: 960 });
  const headerlessTrack = headerless.addTrack({
    type: "Opus",
    hdlr: "soun",
    timescale: 48_000,
    media_duration: 960,
    duration: 960,
  });
  Object.defineProperty(headerless, "getBox", {
    value: () => undefined,
  });
  TestValidator.predicate(
    "audio presentation edits require movie metadata",
    refused(
      () =>
        trimProductionAudioPresentation({
          file: headerless,
          track: headerlessTrack,
          mediaTimescale: 48_000,
          movieTimescale: 48_000,
          primingSamples: 0,
          presentationSamples: 960,
        }),
      "movie header",
    ),
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
  // The normalized fixture is fragmented: its movie-level sample tables are
  // empty and every sample offset comes from the fragment run, so the escape
  // is staged on the run's data offset rather than on an empty `stco`.
  const escapedSamples = Buffer.from(video);
  const trackRunBox = escapedSamples.indexOf("trun");
  if (trackRunBox < 0)
    throw new Error("H.264 fixture has no trun sample-offset table to mutate.");
  if ((escapedSamples.readUInt32BE(trackRunBox + 4) & 0x1) === 0)
    throw new Error("H.264 fixture trun carries no data offset to mutate.");
  escapedSamples.writeInt32BE(0x7fffffff, trackRunBox + 12);
  TestValidator.predicate(
    "a sample table cannot point outside resident container bytes",
    refused(
      () =>
        probeProductionMedia({
          kind: "guide-pass",
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
          kind: "guide-pass",
          mediaType: "video/mp4",
          bytes: zeroVideoClock,
        }),
      "positive dimensions",
    ),
  );
  // Fragmented samples carry their durations in the track run, so the zero
  // duration is staged on the run's first sample rather than on the empty
  // movie-level time-to-sample table.
  const zeroSampleDuration = Buffer.from(video);
  const trackRun = boxTypeOffset(zeroSampleDuration, "trun");
  if ((zeroSampleDuration.readUInt32BE(trackRun + 4) & 0x100) === 0)
    throw new Error("H.264 fixture trun carries no per-sample durations.");
  zeroSampleDuration.writeUInt32BE(0, trackRun + 16);
  TestValidator.predicate(
    "video frames require a positive constant sample duration",
    refused(
      () =>
        probeProductionMedia({
          kind: "guide-pass",
          mediaType: "video/mp4",
          bytes: zeroSampleDuration,
        }),
      "constant deterministic frame duration",
    ),
  );
  // Fragmented samples carry their sync flag per sample in each track run
  // (bit 16 set means "not a sync sample"), so every run's sample flags are
  // rewritten rather than an empty movie-level sync table.
  const noSyncSample = Buffer.from(productionInterframeH264Mp4());
  let trackRunCursor = noSyncSample.indexOf("trun");
  if (trackRunCursor < 0)
    throw new Error("H.264 fixture has no trun sample table to mutate.");
  while (trackRunCursor >= 0) {
    const flags = noSyncSample.readUInt32BE(trackRunCursor + 4) & 0xffffff;
    if ((flags & 0x400) === 0)
      throw new Error("H.264 fixture trun carries no per-sample flags.");
    const sampleCount = noSyncSample.readUInt32BE(trackRunCursor + 8);
    const entryStart =
      trackRunCursor +
      12 +
      ((flags & 0x1) !== 0 ? 4 : 0) +
      ((flags & 0x4) !== 0 ? 4 : 0);
    const entrySize =
      ((flags & 0x100) !== 0 ? 4 : 0) +
      ((flags & 0x200) !== 0 ? 4 : 0) +
      4 +
      ((flags & 0x800) !== 0 ? 4 : 0);
    const flagOffset =
      ((flags & 0x100) !== 0 ? 4 : 0) + ((flags & 0x200) !== 0 ? 4 : 0);
    for (let index = 0; index < sampleCount; ++index)
      noSyncSample.writeUInt32BE(
        0x01010000,
        entryStart + index * entrySize + flagOffset,
      );
    trackRunCursor = noSyncSample.indexOf("trun", trackRunCursor + 4);
  }
  TestValidator.predicate(
    "a deterministic video requires at least one sync sample",
    refused(
      () =>
        probeProductionMedia({
          kind: "guide-pass",
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
          kind: "guide-pass",
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
          kind: "guide-pass",
          mediaType: "video/mp4",
          bytes: productionMpeg4Part2Mp4(),
        }),
      "not an H.264",
    ),
  );

  const audio = productionOpusMp4(48_000);
  const audioProbe = probeProductionMedia({
    kind: "audio-mix",
    mediaType: "audio/mp4",
    bytes: audio,
  });
  TestValidator.equals(
    "the audio probe derives presentation clock, profile, packets and priming",
    namedFacts([
      ["audioProbeKindAudio", () => audioProbe.kind === "audio"],
      [
        "audioProbeContainerMp4",
        () => audioProbe.kind === "audio" && audioProbe.container === "mp4",
      ],
      [
        "audioProbeCodecToLowerCase",
        () =>
          audioProbe.kind === "audio" &&
          audioProbe.codec.toLowerCase().startsWith("opus"),
      ],
      [
        "audioProbeRuntimeSeconds",
        () => audioProbe.kind === "audio" && audioProbe.runtimeSeconds === 1,
      ],
      [
        "audioProbeChannels",
        () => audioProbe.kind === "audio" && audioProbe.channels === 2,
      ],
      [
        "audioProbeSampleRate000",
        () => audioProbe.kind === "audio" && audioProbe.sampleRate === 48_000,
      ],
      [
        "audioProbeSampleCount",
        () => audioProbe.kind === "audio" && audioProbe.sampleCount > 0,
      ],
      [
        "audioProbePrimingSamples",
        () => audioProbe.kind === "audio" && audioProbe.primingSamples === 312,
      ],
    ]),
    {
      audioProbeKindAudio: true,
      audioProbeContainerMp4: true,
      audioProbeCodecToLowerCase: true,
      audioProbeRuntimeSeconds: true,
      audioProbeChannels: true,
      audioProbeSampleRate000: true,
      audioProbeSampleCount: true,
      audioProbePrimingSamples: true,
    },
  );
  TestValidator.predicate(
    "audio-mix rejects a resident mono AAC track",
    refused(
      () =>
        probeProductionMedia({
          kind: "audio-mix",
          mediaType: "audio/mp4",
          bytes: productionAudioMp4(),
        }),
      "expected Opus",
    ),
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
  const tracklessFile = createFile();
  tracklessFile.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: 48_000,
    duration: 48_000,
  });
  const trackless = new Uint8Array(tracklessFile.getBuffer().buffer);
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
