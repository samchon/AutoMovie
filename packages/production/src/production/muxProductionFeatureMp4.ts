import {
  equalProductionFrameRates,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type {
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
} from "@automovie/interface";
import type {
  Box,
  BoxKind,
  DataStream,
  IsoFileOptions,
  Movie,
  Sample,
  Track,
  createFile,
} from "mp4box";

import {
  probeProductionMedia,
  probeProductionVideoMp4,
} from "./probeProductionMedia";
import {
  assertProductionVideoProfile,
  resolveProductionVideoProfile,
} from "./productionMp4Profile";
import { residentMp4Box } from "./residentCodecs";
import { trimProductionAudioPresentation } from "./trimProductionAudioPresentation";

/**
 * Mux one parser-verified H.264 stream and one exact-runtime audio stream.
 */
export const muxProductionFeatureMp4 = (props: {
  video: Uint8Array;
  audio: Uint8Array;
}): Uint8Array => {
  const videoProbe = probeProductionVideoMp4(props.video);
  const audioProbe = probeProductionMedia({
    kind: "audio-mix",
    mediaType: "audio/mp4",
    bytes: props.audio,
  });
  const video = parseMp4(props.video);
  const audio = parseMp4(props.audio);
  const videoTrack = video.movie.videoTracks[0]!;
  const audioTrack = audio.movie.audioTracks[0]!;
  if (videoProbe.kind !== "video" || audioProbe.kind !== "audio")
    throw new Error("Feature mux requires one parsed video and audio track.");
  if (
    exactClockProduct(
      videoProbe.presentation.movieDuration,
      audioProbe.timebase.movieTimescale,
    ) !==
    exactClockProduct(
      audioProbe.timebase.movieDuration,
      videoProbe.presentation.movieTimescale,
    )
  )
    throw new Error(
      "Feature mux requires byte sources with exactly equal track runtimes.",
    );
  const presentationSamples = exactPresentationTicks(
    audioProbe.timebase.movieDuration,
    audioProbe.timebase.movieTimescale,
    audioProbe.sampleRate,
  );
  const output = residentMp4Box().createFile();
  output.init({
    brands: ["isom", "iso2", "mp41", "Opus"],
    timescale: videoTrack.timescale,
    duration: videoTrack.duration,
  });
  copyTrack({
    output,
    source: video.file,
    bytes: props.video,
    track: videoTrack,
    name: "AutoMovie H.264 feature",
  });
  const outputAudioTrack = copyTrack({
    output,
    source: audio.file,
    bytes: props.audio,
    track: audioTrack,
    name: "AutoMovie deterministic mix",
  });
  trimProductionAudioPresentation({
    file: output,
    track: outputAudioTrack,
    mediaTimescale: audioTrack.timescale,
    movieTimescale: videoTrack.timescale,
    primingSamples: audioProbe.primingSamples,
    presentationSamples,
  });
  const bytes = new Uint8Array(output.getBuffer().buffer);
  probeProductionMedia({
    kind: "feature",
    mediaType: "video/mp4",
    bytes,
  });
  return bytes;
};

/**
 * Preserve one H.264 elementary stream while adding the explicit sRGB sample
 * description required by every final production picture.
 */
export const normalizeProductionH264Mp4 = (bytes: Uint8Array): Uint8Array => {
  const source = parseMp4(bytes);
  const track = source.movie.videoTracks[0];
  if (track === undefined || source.movie.tracks.length !== 1)
    throw new Error("H.264 normalization requires exactly one video track.");
  const samples = source.file.getTrackSamplesInfo(track.id);
  if (samples.length === 0)
    throw new Error("H.264 normalization requires resident video samples.");
  const description = sampleDescription(samples[0]!);
  const output = residentMp4Box().createFile();
  output.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: track.timescale,
    duration: track.duration,
  });
  const outputTrack = output.addTrack({
    type: description.type,
    hdlr: "vide",
    name: "AutoMovie explicit sRGB H.264",
    timescale: track.timescale,
    media_duration: track.duration,
    duration: track.duration,
    width: track.video!.width,
    height: track.video!.height,
    language: track.language,
    description_boxes: [
      ...description.boxes.filter((box) => box.type !== "colr"),
      productionSrgbColorBox(),
    ] as BoxKind[],
  });
  for (const sample of samples)
    output.addSample(
      outputTrack,
      Uint8Array.from(
        bytes.subarray(sample.offset, sample.offset + sample.size),
      ),
      sampleOptions(sample),
    );
  const normalized = new Uint8Array(output.getBuffer().buffer);
  const probe = probeProductionVideoMp4(normalized);
  assertProductionVideoProfile({
    expected: resolveProductionVideoProfile({
      width: probe.width,
      height: probe.height,
      frameRate: probe.frameRate,
    }),
    actual: probe,
  });
  return normalized;
};

/** Writable nclx box because the installed parser exposes no colr writer. */
const productionSrgbColorBox = (): BoxKind => {
  const box = new (residentMp4Box().BoxParser.box.colr)();
  box.write = function (stream: DataStream): void {
    this.size = 11;
    this.writeHeader(stream);
    stream.writeString("nclx");
    stream.writeUint16(1);
    stream.writeUint16(13);
    stream.writeUint16(1);
    stream.writeUint8(0x80);
  };
  return box;
};

const exactClockProduct = (left: number, right: number): bigint => {
  if (
    Number.isSafeInteger(left) === false ||
    left <= 0 ||
    Number.isSafeInteger(right) === false ||
    right <= 0
  )
    throw new Error("MP4 presentation clocks must be positive safe integers.");
  return BigInt(left) * BigInt(right);
};

const exactPresentationTicks = (
  duration: number,
  timescale: number,
  destinationTimescale: number,
): number => {
  const numerator = exactClockProduct(duration, destinationTimescale);
  if (Number.isSafeInteger(timescale) === false || timescale <= 0)
    throw new Error(
      "MP4 presentation timescale must be a positive safe integer.",
    );
  const denominator = BigInt(timescale);
  if (numerator % denominator !== 0n)
    throw new Error(
      "Audio presentation duration is not an exact integer sample boundary.",
    );
  const quotient = numerator / denominator;
  if (quotient > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(
      "Audio presentation sample count exceeds the safe integer domain.",
    );
  return Number(quotient);
};

/**
 * Conform immutable per-shot repaint clips into the current cut-only timeline.
 *
 * Repaint delivery deliberately refuses transitions, trims, transformed
 * presentation metadata, and changing codec configuration: silently falling
 * back to deterministic pixels would misrepresent the selected product.
 */
export const conformProductionRenditionVideoMp4 = (props: {
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}): Uint8Array => {
  const { parsed, first, description, sampleDuration, mediaDuration } =
    productionRenditionVideoPlan(props);
  const output = residentMp4Box().createFile();
  output.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: first.track.timescale,
    duration: mediaDuration,
  });
  const trackId = output.addTrack({
    type: description.type,
    hdlr: "vide",
    name: "AutoMovie receipt-bound repaint feature",
    timescale: first.track.timescale,
    media_duration: mediaDuration,
    duration: mediaDuration,
    width: first.probe.width,
    height: first.probe.height,
    language: first.track.language,
    description_boxes: description.boxes,
  });
  let frame = 0;
  for (const clip of parsed)
    frame = appendLosslessVideoClip({
      file: output,
      track: trackId,
      clip,
      frame,
      sampleDuration,
    });
  if (frame !== props.timeline.totalFrames)
    throw new Error(
      "Repaint clip samples do not cover the exact current film timeline.",
    );
  const bytes = new Uint8Array(output.getBuffer().buffer);
  const probe = probeProductionVideoMp4(bytes);
  const frameRate = resolveProductionFrameRate(props.timeline);
  assertProductionVideoProfile({
    expected: resolveProductionVideoProfile({
      width: first.probe.width,
      height: first.probe.height,
      frameRate,
    }),
    actual: probe,
  });
  if (
    probe.frameCount !== props.timeline.totalFrames ||
    equalProductionFrameRates(probe.frameRate, frameRate) === false
  )
    throw new Error(
      "Conformed repaint video failed exact parser verification.",
    );
  return bytes;
};

/**
 * Assemble one whole-film video from the per-chunk H.264 encodes a chunked
 * render already committed, without decoding or re-encoding a single frame.
 *
 * A render job splits the film into independently rendered, independently
 * resumable frame ranges and encodes each range's frames into its own
 * receipt-verified MP4. Re-encoding those frames a second time to obtain the
 * whole film costs one decode plus one encode per frame and holds the entire
 * output inside one encoder, which is what bounds a long production. This
 * copies each chunk's already-encoded samples into one track instead, so the
 * cost is proportional to the bytes moved and the elementary stream is
 * preserved sample for sample: the assembled film decodes to exactly the frames
 * the chunks decode to.
 *
 * The chunks arrive as an `Iterable` and are read once, in play order, so a
 * caller may load each chunk's bytes only when this asks for them; at most two
 * chunks are held at a time.
 *
 * The boundary rule is the chunked render's own: a frame belongs to exactly one
 * chunk, every chunk starts at an independently decodable sync sample, and
 * every chunk shares one raster, one rational frame clock, and one decoder
 * configuration. A chunk that breaks any of those is refused rather than
 * silently re-encoded, because re-encoding would change reviewed pixels.
 *
 * One chunk covering the whole film is returned verbatim: it already is the
 * film's video, so an assembly that spans a single chunk is byte-identical to
 * encoding that chunk.
 */
export const assembleProductionChunkVideoMp4 = (props: {
  /** Encoded chunk MP4s in play order, read once. */
  chunks: Iterable<Uint8Array>;

  /** Exact raster and rational frame clock every chunk must already carry. */
  frameFormat: {
    fps: number;
    frameRate?: IAutoMovieProductionFrameRate;
    height: number;
    width: number;
  };

  /** Exact total output frames the assembled chunks must cover. */
  totalFrames: number;
}): Uint8Array => {
  let reference: IProductionChunkVideoReference | undefined;
  let opening:
    | { bytes: Uint8Array; clip: IProductionRenditionClip }
    | undefined;
  let assembly:
    | { file: ReturnType<typeof createFile>; track: number }
    | undefined;
  let frame = 0;
  let index = 0;
  const frameRate = resolveProductionFrameRate(props.frameFormat);
  for (const bytes of props.chunks) {
    const clip = parseProductionRenditionClip(bytes, `Render chunk ${index}`);
    assertProductionVideoProfile({
      expected: resolveProductionVideoProfile({
        width: props.frameFormat.width,
        height: props.frameFormat.height,
        frameRate,
      }),
      actual: clip.probe,
    });
    const description = sampleDescription(clip.samples[0]!);
    reference ??= {
      description,
      height: clip.probe.height,
      language: clip.track.language,
      sampleDuration: clip.sampleDuration,
      timescale: clip.track.timescale,
      width: clip.probe.width,
    };
    if (
      clip.probe.width !== props.frameFormat.width ||
      clip.probe.height !== props.frameFormat.height ||
      equalProductionFrameRates(clip.probe.frameRate, frameRate) === false ||
      clip.track.timescale !== reference.timescale ||
      clip.sampleDuration !== reference.sampleDuration ||
      sameSampleDescription(reference.description, description) === false
    )
      throw new Error(
        `Render chunk ${index} does not share the assembled raster, rational frame clock, and H.264 decoder configuration.`,
      );
    ++index;
    if (opening === undefined) {
      opening = { bytes, clip };
      continue;
    }
    if (assembly === undefined) {
      assembly = openProductionChunkVideo(reference, props.totalFrames);
      frame = appendLosslessVideoClip({
        ...assembly,
        clip: opening.clip,
        frame,
        sampleDuration: reference.sampleDuration,
      });
    }
    frame = appendLosslessVideoClip({
      ...assembly,
      clip,
      frame,
      sampleDuration: reference.sampleDuration,
    });
  }
  if (opening === undefined)
    throw new Error(
      "Chunked video assembly requires at least one encoded render chunk.",
    );
  if (assembly === undefined) {
    if (opening.clip.probe.frameCount !== props.totalFrames)
      throw new Error(
        `Chunked video assembly covers ${opening.clip.probe.frameCount} frames; expected ${props.totalFrames}.`,
      );
    return opening.bytes;
  }
  const bytes = new Uint8Array(assembly.file.getBuffer().buffer);
  const probe = probeProductionVideoMp4(bytes);
  if (
    probe.frameCount !== props.totalFrames ||
    probe.width !== props.frameFormat.width ||
    probe.height !== props.frameFormat.height ||
    equalProductionFrameRates(probe.frameRate, frameRate) === false
  )
    throw new Error(
      `Assembled chunk video parses as ${probe.frameCount} frames of ${probe.width}x${probe.height} at ${probe.fps} fps; expected ${props.totalFrames} frames of ${props.frameFormat.width}x${props.frameFormat.height} at ${props.frameFormat.fps} fps.`,
    );
  return bytes;
};

/**
 * Refuse repaint bytes that cannot be conformed without decoding or changing
 * their reviewed presentation.
 */
export const assertProductionRenditionClipDelivery = (props: {
  bytes: Uint8Array;
  shot: string;
  width: number;
  height: number;
  fps: number;
  frameRate?: IAutoMovieProductionFrameRate;
  frameCount: number;
  runtimeSeconds: number;
}): void => {
  const clip = parseProductionRenditionClip(
    props.bytes,
    `Repaint clip "${props.shot}"`,
  );
  const frameRate = resolveProductionFrameRate(props);
  assertProductionVideoProfile({
    expected: resolveProductionVideoProfile({
      width: props.width,
      height: props.height,
      frameRate,
    }),
    actual: clip.probe,
  });
  if (
    clip.probe.frameCount !== props.frameCount ||
    props.runtimeSeconds !==
      (props.frameCount * frameRate.denominator) / frameRate.numerator ||
    BigInt(clip.probe.presentation.movieDuration) *
      BigInt(frameRate.numerator) !==
      BigInt(props.frameCount) *
        BigInt(frameRate.denominator) *
        BigInt(clip.probe.presentation.movieTimescale)
  )
    throw new Error(
      `Repaint clip "${props.shot}" does not match its exact raster, rational frame clock, frame count, and runtime contract.`,
    );
};

/**
 * Prove a feature directly against immutable repaint clips without rebuilding
 * the expected full-length video in memory.
 */
export const assertProductionFeatureUsesRenditionClips = (props: {
  feature: Uint8Array;
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}): void => {
  const plan = productionRenditionVideoPlan(props);
  const actual = parseMp4(props.feature);
  const track = actual.movie.videoTracks[0];
  const samples =
    track === undefined ? [] : actual.file.getTrackSamplesInfo(track.id);
  if (
    track === undefined ||
    track.timescale !== plan.first.track.timescale ||
    track.duration !== plan.mediaDuration ||
    track.movie_timescale !== plan.first.track.timescale ||
    track.movie_duration !== plan.mediaDuration ||
    track.video?.width !== plan.first.probe.width ||
    track.video?.height !== plan.first.probe.height ||
    track.track_width !== plan.first.probe.width ||
    track.track_height !== plan.first.probe.height ||
    samples.length !== props.timeline.totalFrames ||
    neutralTrackPresentation(track, 0) === false
  )
    throw new Error(
      "Feature video presentation does not match the selected repaint timeline.",
    );
  let index = 0;
  for (const clip of plan.parsed) {
    const clipStart = index;
    for (const source of clip.samples) {
      const actualSample = samples[index];
      if (actualSample === undefined)
        throw new Error("Feature video omits a selected repaint sample.");
      const dtsFrame = source.dts / clip.sampleDuration;
      const ctsFrame =
        (source.cts - clip.presentationStart) / clip.sampleDuration;
      const sourceBytes = clip.bytes.subarray(
        source.offset,
        source.offset + source.size,
      );
      const actualBytes = props.feature.subarray(
        actualSample.offset,
        actualSample.offset + actualSample.size,
      );
      if (
        actualSample.duration !== plan.sampleDuration ||
        actualSample.dts !== (clipStart + dtsFrame) * plan.sampleDuration ||
        actualSample.cts !== (clipStart + ctsFrame) * plan.sampleDuration ||
        sameSampleFlags(actualSample, source) === false ||
        sameSampleDescription(
          sampleDescription(actualSample),
          plan.description,
        ) === false ||
        actualBytes.length !== sourceBytes.length ||
        actualBytes.some((value, offset) => value !== sourceBytes[offset])
      )
        throw new Error(
          `Feature video sample ${index} differs from the selected repaint timeline:\n${JSON.stringify(
            {
              timing: {
                actual: {
                  duration: actualSample.duration,
                  dts: actualSample.dts,
                  cts: actualSample.cts,
                },
                expected: {
                  duration: plan.sampleDuration,
                  dts: (clipStart + dtsFrame) * plan.sampleDuration,
                  cts: (clipStart + ctsFrame) * plan.sampleDuration,
                },
              },
              flags: {
                actual: sampleFlagRecord(actualSample),
                expected: sampleFlagRecord(source),
                match: sameSampleFlags(actualSample, source),
              },
              sampleDescriptionMatches: sameSampleDescription(
                sampleDescription(actualSample),
                plan.description,
              ),
              payload: {
                actualBytes: actualBytes.length,
                expectedBytes: sourceBytes.length,
                firstDifferingActualByte: actualBytes.findIndex(
                  (value, byte) => value !== sourceBytes[byte],
                ),
              },
            },
            null,
            2,
          )}`,
        );
      ++index;
    }
  }
};

/**
 * Prove a muxed feature carries exactly the selected rendition video samples.
 */
export const assertProductionFeatureUsesRenditionVideo = (props: {
  feature: Uint8Array;
  renditionVideo: Uint8Array;
}): void => {
  const actual = parseMp4(props.feature);
  const expected = parseMp4(props.renditionVideo);
  const actualTrack = actual.movie.videoTracks[0];
  const expectedTrack = expected.movie.videoTracks[0];
  if (actualTrack === undefined || expectedTrack === undefined)
    throw new Error(
      "Rendition delivery proof requires one feature video track.",
    );
  const actualSamples = actual.file.getTrackSamplesInfo(actualTrack.id);
  const expectedSamples = expected.file.getTrackSamplesInfo(expectedTrack.id);
  if (
    actualTrack.timescale !== expectedTrack.timescale ||
    actualTrack.duration !== expectedTrack.duration ||
    actualTrack.movie_timescale !== expectedTrack.movie_timescale ||
    actualTrack.movie_duration !== expectedTrack.movie_duration ||
    sameTrackPresentation(actualTrack, expectedTrack) === false ||
    actualTrack.video?.width !== expectedTrack.video?.width ||
    actualTrack.video?.height !== expectedTrack.video?.height ||
    actualTrack.track_width !== expectedTrack.track_width ||
    actualTrack.track_height !== expectedTrack.track_height ||
    actualSamples.length !== expectedSamples.length ||
    actualSamples.length === 0 ||
    sameSampleDescription(
      sampleDescription(actualSamples[0]!),
      sampleDescription(expectedSamples[0]!),
    ) === false
  )
    throw new Error(
      "Feature video track does not match the selected rendition track.",
    );
  for (let index = 0; index < actualSamples.length; ++index) {
    const left = actualSamples[index]!;
    const right = expectedSamples[index]!;
    const leftBytes = props.feature.subarray(
      left.offset,
      left.offset + left.size,
    );
    const rightBytes = props.renditionVideo.subarray(
      right.offset,
      right.offset + right.size,
    );
    if (
      sameSampleTiming(left, right) === false ||
      sameSampleDescription(
        sampleDescription(left),
        sampleDescription(right),
      ) === false ||
      leftBytes.length !== rightBytes.length ||
      leftBytes.some((value, offset) => value !== rightBytes[offset])
    )
      throw new Error(
        `Feature video sample ${index} differs from the selected rendition.`,
      );
  }
};

interface IProductionRenditionClip {
  bytes: Uint8Array;
  probe: ReturnType<typeof probeProductionVideoMp4>;
  track: Track;
  samples: Sample[];
  sampleDuration: number;
  presentationStart: number;
}

/** The one presentation every later clip of an assembly must already share. */
interface IProductionChunkVideoReference {
  description: ReturnType<typeof sampleDescription>;
  height: number;
  language: string;
  sampleDuration: number;
  timescale: number;
  width: number;
}

/** Open the one output track every chunk's samples are copied into. */
const openProductionChunkVideo = (
  reference: IProductionChunkVideoReference,
  totalFrames: number,
): { file: ReturnType<typeof createFile>; track: number } => {
  const mediaDuration = totalFrames * reference.sampleDuration;
  if (Number.isSafeInteger(mediaDuration) === false)
    throw new Error(
      "Assembled chunk video duration exceeds the exact MP4 clock range.",
    );
  const file = residentMp4Box().createFile();
  file.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: reference.timescale,
    duration: mediaDuration,
  });
  return {
    file,
    track: file.addTrack({
      type: reference.description.type,
      hdlr: "vide",
      name: "AutoMovie chunk-assembled feature",
      timescale: reference.timescale,
      media_duration: mediaDuration,
      duration: mediaDuration,
      width: reference.width,
      height: reference.height,
      language: reference.language,
      description_boxes: reference.description.boxes,
    }),
  };
};

/**
 * Copy one validated clip's H.264 samples onto the end of an output track,
 * re-timing them onto the assembled clock without touching their payload, and
 * answer the next free output frame.
 */
const appendLosslessVideoClip = (props: {
  file: ReturnType<typeof createFile>;
  track: number;
  clip: IProductionRenditionClip;
  frame: number;
  sampleDuration: number;
}): number => {
  for (const sample of props.clip.samples) {
    const dtsFrame = sample.dts / props.clip.sampleDuration;
    const ctsFrame =
      (sample.cts - props.clip.presentationStart) / props.clip.sampleDuration;
    props.file.addSample(
      props.track,
      Uint8Array.from(
        props.clip.bytes.subarray(sample.offset, sample.offset + sample.size),
      ),
      {
        ...sampleOptions(sample),
        duration: props.sampleDuration,
        cts: (props.frame + ctsFrame) * props.sampleDuration,
        dts: (props.frame + dtsFrame) * props.sampleDuration,
      },
    );
  }
  return props.frame + props.clip.samples.length;
};

const productionRenditionVideoPlan = (props: {
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}) => {
  const frameRate = resolveProductionFrameRate(props.timeline);
  const parsed = props.timeline.segments.map((segment) => {
    if (
      segment.transitionIn.kind !== "cut" ||
      segment.transitionOut.kind !== "cut"
    )
      throw new Error(
        `Repainted feature delivery currently requires cut-only editing; shot "${segment.shot}" declares a transition.`,
      );
    const bytes = props.clips.get(segment.shot);
    if (bytes === undefined)
      throw new Error(
        `Repainted feature delivery is missing the current clip for shot "${segment.shot}".`,
      );
    const clip = parseProductionRenditionClip(
      bytes,
      `Repaint clip "${segment.shot}"`,
    );
    if (
      segment.sourceInFrame !== 0 ||
      segment.sourceOutFrame !== clip.probe.frameCount ||
      segment.endFrame - segment.startFrame !== clip.probe.frameCount ||
      equalProductionFrameRates(clip.probe.frameRate, frameRate) === false
    )
      throw new Error(
        `Repainted feature delivery requires one full-shot ${props.timeline.fps}fps clip for segment "${segment.shot}"; partial trims and mismatched media are not representable yet.`,
      );
    return { segment, ...clip };
  });
  const first = parsed[0];
  if (first === undefined)
    throw new Error(
      "Repainted feature delivery requires a non-empty timeline.",
    );
  const description = sampleDescription(first.samples[0]!);
  let nextFrame = 0;
  for (const clip of parsed) {
    if (clip.segment.startFrame !== nextFrame)
      throw new Error(
        `Repaint clip "${clip.segment.shot}" does not begin at the next continuous film frame.`,
      );
    if (
      clip.probe.width !== first.probe.width ||
      clip.probe.height !== first.probe.height ||
      sameSampleDescription(
        description,
        sampleDescription(clip.samples[0]!),
      ) === false
    )
      throw new Error(
        `Repaint clip "${clip.segment.shot}" changes dimensions or H.264 decoder configuration within the feature.`,
      );
    nextFrame = clip.segment.endFrame;
  }
  if (nextFrame !== props.timeline.totalFrames)
    throw new Error(
      "Repaint clips do not cover one continuous current film timeline.",
    );
  const sampleDuration = first.samples[0]!.duration;
  const mediaDuration = props.timeline.totalFrames * sampleDuration;
  if (Number.isSafeInteger(mediaDuration) === false)
    throw new Error(
      "Repainted feature duration exceeds the exact MP4 clock range.",
    );
  return { parsed, first, description, sampleDuration, mediaDuration };
};

/**
 * Parse one clip that is to be spliced without decoding it: a repaint shot or
 * one range of a chunked render. `label` names the clip in every refusal, so a
 * multi-clip splice says which one failed.
 */
const parseProductionRenditionClip = (
  bytes: Uint8Array,
  label: string,
): IProductionRenditionClip => {
  const probe = probeProductionVideoMp4(bytes);
  const mp4 = parseMp4(bytes);
  const track = mp4.movie.videoTracks[0];
  const samples =
    track === undefined ? [] : mp4.file.getTrackSamplesInfo(track.id);
  if (
    probe.kind !== "video" ||
    track === undefined ||
    samples.length !== probe.frameCount ||
    samples.length === 0
  )
    throw new Error(
      `${label} has no exact parser-owned H.264 sample inventory.`,
    );
  const sampleDuration = samples[0]!.duration;
  const presentationStart = samples.reduce(
    (minimum, sample) => Math.min(minimum, sample.cts),
    samples[0]!.cts,
  );
  const description = sampleDescription(samples[0]!);
  const presentationFrames = samples
    .map((sample) => (sample.cts - presentationStart) / sampleDuration)
    .sort((left, right) => left - right);
  if (
    samples[0]!.is_sync !== true ||
    track.track_width !== probe.width ||
    track.track_height !== probe.height ||
    Number.isSafeInteger(track.timescale) === false ||
    Number.isSafeInteger(track.duration) === false ||
    Number.isSafeInteger(sampleDuration) === false ||
    sampleDuration <= 0 ||
    track.duration !== samples.length * sampleDuration ||
    samples.some(
      (sample, index) =>
        Number.isSafeInteger(sample.dts) === false ||
        Number.isSafeInteger(sample.cts) === false ||
        sample.dts !== index * sampleDuration ||
        Number.isSafeInteger(
          (sample.cts - presentationStart) / sampleDuration,
        ) === false ||
        sameSampleDescription(description, sampleDescription(sample)) === false,
    ) ||
    presentationFrames.some((value, index) => value !== index) ||
    neutralTrackPresentation(track, presentationStart) === false
  )
    throw new Error(
      `${label} must start independently, use one decoder configuration, and expose one complete untransformed rational-clock presentation.`,
    );
  return {
    bytes,
    probe,
    track,
    samples,
    sampleDuration,
    presentationStart,
  };
};

const neutralTrackPresentation = (
  track: Track,
  presentationStart: number,
): boolean => {
  const identityMatrix = [65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824];
  if (
    Array.from(track.matrix).some(
      (value, index) => value !== identityMatrix[index],
    ) ||
    Number.isSafeInteger(track.movie_timescale) === false ||
    Number.isSafeInteger(track.movie_duration) === false ||
    track.movie_timescale <= 0 ||
    equalRational(
      track.movie_duration,
      track.movie_timescale,
      track.duration,
      track.timescale,
    ) === false
  )
    return false;
  const edits = track.edits ?? [];
  return (
    (edits.length === 0 && presentationStart === 0) ||
    (edits.length === 1 &&
      edits[0]!.media_time === presentationStart &&
      edits[0]!.media_rate_integer === 1 &&
      edits[0]!.media_rate_fraction === 0 &&
      equalRational(
        edits[0]!.segment_duration,
        track.movie_timescale,
        track.duration,
        track.timescale,
      ))
  );
};

const sameTrackPresentation = (left: Track, right: Track): boolean =>
  Array.from(left.matrix).every(
    (value, index) => value === Array.from(right.matrix)[index],
  ) && JSON.stringify(left.edits ?? []) === JSON.stringify(right.edits ?? []);

const equalRational = (
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
): boolean =>
  [leftNumerator, leftDenominator, rightNumerator, rightDenominator].every(
    Number.isSafeInteger,
  ) &&
  BigInt(leftNumerator) * BigInt(rightDenominator) ===
    BigInt(rightNumerator) * BigInt(leftDenominator);

const sameSampleTiming = (left: Sample, right: Sample): boolean =>
  left.duration === right.duration &&
  left.cts === right.cts &&
  left.dts === right.dts &&
  sameSampleFlags(left, right);

const sameSampleFlags = (left: Sample, right: Sample): boolean =>
  left.is_sync === right.is_sync &&
  left.is_leading === right.is_leading &&
  canonicalSampleDependsOn(left) === canonicalSampleDependsOn(right) &&
  left.is_depended_on === right.is_depended_on &&
  left.has_redundancy === right.has_redundancy &&
  left.degradation_priority === right.degradation_priority &&
  JSON.stringify(left.subsamples ?? []) ===
    JSON.stringify(right.subsamples ?? []);

/** Treat an unspecified sync-sample dependency as its MP4Box canonical form. */
const canonicalSampleDependsOn = (sample: Sample): number =>
  sample.is_sync === true && sample.depends_on === 0 ? 2 : sample.depends_on;

/** Bounded parser-visible flag evidence for one failed sample comparison. */
const sampleFlagRecord = (sample: Sample) => ({
  isSync: sample.is_sync,
  isLeading: sample.is_leading,
  dependsOn: sample.depends_on,
  isDependedOn: sample.is_depended_on,
  hasRedundancy: sample.has_redundancy,
  degradationPriority: sample.degradation_priority,
});

const sampleDescription = (
  sample: Sample,
): {
  type: IsoFileOptions["type"];
  boxes: NonNullable<IsoFileOptions["description_boxes"]>;
} => {
  const description = sample.description as {
    type: IsoFileOptions["type"];
    boxes?: IsoFileOptions["description_boxes"];
  };
  return { type: description.type, boxes: description.boxes ?? [] };
};

/** Canonicalize a parsed sample-description box without parser object identity. */
const serializeDescriptionBox = (box: Box): Uint8Array => {
  const stream = new (residentMp4Box().DataStream)();
  box.write(stream);
  return new Uint8Array(stream.buffer);
};

const sameSampleDescription = (
  left: ReturnType<typeof sampleDescription>,
  right: ReturnType<typeof sampleDescription>,
): boolean =>
  left.type === right.type &&
  left.boxes.length === right.boxes.length &&
  left.boxes.every((box, index) => {
    const leftBytes = serializeDescriptionBox(box);
    const rightBytes = serializeDescriptionBox(right.boxes[index]!);
    return Buffer.from(leftBytes).equals(Buffer.from(rightBytes));
  });

const copyTrack = (props: {
  output: ReturnType<typeof createFile>;
  source: ReturnType<typeof createFile>;
  bytes: Uint8Array;
  track: Track;
  name: string;
}): number => {
  const samples = props.source.getTrackSamplesInfo(props.track.id);
  const description = samples[0]!.description as {
    type: IsoFileOptions["type"];
    boxes?: IsoFileOptions["description_boxes"];
  };
  const options: IsoFileOptions = {
    type: description.type,
    hdlr: props.track.type === "audio" ? "soun" : "vide",
    name: props.name,
    timescale: props.track.timescale,
    media_duration: props.track.duration,
    duration: props.track.duration,
    language: props.track.language,
    description_boxes: description.boxes ?? [],
  };
  if (props.track.video !== undefined) {
    options.width = props.track.video.width;
    options.height = props.track.video.height;
  }
  if (props.track.audio !== undefined) {
    options.samplerate = props.track.audio.sample_rate;
    options.channel_count = props.track.audio.channel_count;
    options.samplesize = props.track.audio.sample_size;
  }
  const id = props.output.addTrack(options);
  for (const sample of samples)
    props.output.addSample(
      id,
      Uint8Array.from(
        props.bytes.subarray(sample.offset, sample.offset + sample.size),
      ),
      sampleOptions(sample),
    );
  return id;
};

const sampleOptions = (
  sample: Sample,
): NonNullable<Parameters<ReturnType<typeof createFile>["addSample"]>[2]> => ({
  duration: sample.duration,
  cts: sample.cts,
  dts: sample.dts,
  is_sync: sample.is_sync,
  is_leading: sample.is_leading,
  depends_on: sample.depends_on,
  is_depended_on: sample.is_depended_on,
  has_redundancy: sample.has_redundancy,
  degradation_priority: sample.degradation_priority,
  subsamples: sample.subsamples,
});

const parseMp4 = (
  bytes: Uint8Array,
): { file: ReturnType<typeof createFile>; movie: Movie } => {
  const file = residentMp4Box().createFile();
  let movie: Movie | null = null;
  const errors: string[] = [];
  file.onReady = (value) => {
    movie = value;
  };
  file.onError = (module, message) => {
    errors.push(`${module}: ${message}`);
  };
  file.appendBuffer(
    residentMp4Box().MP4BoxBuffer.fromArrayBuffer(
      Uint8Array.from(bytes).buffer,
      0,
    ),
    true,
  );
  file.flush();
  if (errors.length !== 0)
    throw new Error(`MP4 parser rejected mux input: ${errors.join("; ")}`);
  return { file, movie: movie ?? file.getInfo() };
};
