import type { BoxKind, DataStream } from "mp4box";

import { assertProductionVideoProfile } from "../delivery/assertProductionVideoProfile";
import { resolveProductionVideoProfile } from "../delivery/resolveProductionVideoProfile";
import { AUTOMOVIE_MP4_SRGB_COLOUR } from "./AUTOMOVIE_MP4_SRGB_COLOUR";
import { parseMp4 } from "./parseMp4";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { residentMp4Box } from "./residentMp4Box";
import { sampleDescription } from "./sampleDescription";
import { sampleOptions } from "./sampleOptions";

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
      ...description.boxes
        .filter((box) => box.type !== "colr")
        .map((box) => box as unknown as BoxKind),
      productionSrgbColorBox() as unknown as BoxKind,
    ],
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
    stream.writeUint16(AUTOMOVIE_MP4_SRGB_COLOUR.primaries);
    stream.writeUint16(AUTOMOVIE_MP4_SRGB_COLOUR.transfer);
    stream.writeUint16(AUTOMOVIE_MP4_SRGB_COLOUR.matrix);
    // The full-range flag is the high bit of the byte that follows.
    stream.writeUint8(AUTOMOVIE_MP4_SRGB_COLOUR.fullRange ? 0x80 : 0x00);
  };
  return box;
};
