import {
  equalProductionFrameRates,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type { IAutoMovieProductionFrameRate } from "@automovie/interface";
import type { createFile } from "mp4box";

import { assertProductionVideoProfile } from "../delivery/assertProductionVideoProfile";
import { resolveProductionVideoProfile } from "../delivery/resolveProductionVideoProfile";
import type { IProductionRenditionClip } from "./IProductionRenditionClip";
import { appendLosslessVideoClip } from "./appendLosslessVideoClip";
import { parseProductionRenditionClip } from "./parseProductionRenditionClip";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { residentMp4Box } from "./residentMp4Box";
import { sameSampleDescription } from "./sameSampleDescription";
import { sampleDescription } from "./sampleDescription";

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
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-assembly Assembles the feature only from a contiguous, complete set of current chunks and refuses a partial set as encode input.
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
    // The chunk is attributed by index above; only then does the generic
    // delivery profile judge its container facts.
    assertProductionVideoProfile({
      expected: resolveProductionVideoProfile({
        width: props.frameFormat.width,
        height: props.frameFormat.height,
        frameRate,
      }),
      actual: clip.probe,
    });
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
