import { canonicalProductionFrameRate } from "@automovie/engine";
import type { IAutoMovieProductionVideoProbe } from "@automovie/interface";
import type { Box, Track, createFile } from "mp4box";

import { AUTOMOVIE_MP4_SRGB_COLOUR } from "./AUTOMOVIE_MP4_SRGB_COLOUR";
import { verifySampleStorage } from "./verifySampleStorage";

/**
 * Read one parsed H.264 track into the video probe record.
 *
 * Codec identity, raster, rational frame rate, file-type brands, the sample
 * table, the presentation clocks and the container colour description are all
 * read here, so the rendered-media probe and the parsed video probe answer with
 * one field-for-field reading instead of two.
 */
export const probeVideoTrack = (
  bytes: Uint8Array,
  file: ReturnType<typeof createFile>,
  track: Track,
): IAutoMovieProductionVideoProbe => {
  if (/^(avc1|avc3)(?:\.|$)/i.test(track.codec) === false)
    throw new Error(
      `MP4 video codec "${track.codec}" is not an H.264/AVC sample entry.`,
    );
  if (
    track.video === undefined ||
    track.video.width <= 0 ||
    track.video.height <= 0 ||
    track.timescale <= 0 ||
    track.duration <= 0 ||
    track.nb_samples <= 0
  )
    throw new Error(
      "MP4 video track lacks positive dimensions, duration, timescale, or samples.",
    );
  const samples = verifySampleStorage(bytes, file, track);
  const firstDuration = samples[0]!.duration;
  if (
    firstDuration <= 0 ||
    samples.some((sample) => sample.duration !== firstDuration)
  )
    throw new Error(
      "MP4 video samples do not use one constant deterministic frame duration.",
    );
  const runtimeSeconds = track.duration / track.timescale;
  const fps = track.timescale / firstDuration;
  if (samples.some((sample) => sample.is_sync) === false)
    throw new Error(
      "MP4 video track has no independently decodable sync sample.",
    );
  const ftypBoxes = file.getBoxes("ftyp", false) as Array<
    Box & {
      major_brand: string;
      compatible_brands: string[];
    }
  >;
  if (
    ftypBoxes.length !== 1 ||
    typeof ftypBoxes[0]!.major_brand !== "string" ||
    Array.isArray(ftypBoxes[0]!.compatible_brands) === false ||
    ftypBoxes[0]!.compatible_brands.some(
      (brand) => typeof brand !== "string",
    ) ||
    ftypBoxes[0]!.major_brand.trim().length === 0 ||
    ftypBoxes[0]!.compatible_brands.some((brand) => brand.trim().length === 0)
  )
    throw new Error("MP4 output requires one nonblank file-type brand box.");
  const ftyp = ftypBoxes[0]!;
  const description = samples[0]!.description as unknown as {
    width: number;
    height: number;
    boxes?: Array<{ type?: string } & Record<string, unknown>>;
  };
  // The parser derives the track raster from this same sample entry and
  // stamps every sample with the one media timescale it decoded from 32-bit
  // table entries, so neither the raster nor the sample clock can disagree.
  const colorBoxes = (description.boxes ?? []).filter(
    (box) => box.type === "colr",
  );
  if (colorBoxes.length > 1)
    throw new Error("MP4 video sample entry contains multiple color boxes.");
  const colorBox = colorBoxes[0] as
    | {
        colour_type: string;
        colour_primaries: number;
        transfer_characteristics: number;
        matrix_coefficients: number;
        full_range_flag: number;
      }
    | undefined;
  const paspBoxes = (description.boxes ?? []).filter(
    (box) => box.type === "pasp",
  ) as Array<{ hSpacing: number; vSpacing: number }>;
  if (paspBoxes.length > 1)
    throw new Error(
      "MP4 video sample entry contains multiple pixel-aspect boxes.",
    );
  if (
    paspBoxes.some(
      (box) =>
        Number.isSafeInteger(box.hSpacing) === false ||
        box.hSpacing <= 0 ||
        Number.isSafeInteger(box.vSpacing) === false ||
        box.vSpacing <= 0,
    )
  )
    throw new Error("MP4 pixel-aspect terms must be positive safe integers.");
  const trackHeaders = file.getBoxes("tkhd", false) as Array<
    Box & {
      track_id: number;
      width: number;
      height: number;
      matrix: number[];
    }
  >;
  const trackHeaderMatches = trackHeaders.filter(
    (header) => header.track_id === track.id,
  );
  if (trackHeaderMatches.length !== 1)
    throw new Error(
      `MP4 video track ${track.id} requires one exact track header.`,
    );
  // The parser reads the header width and height as 32-bit integers and the
  // nine fixed-point matrix terms as one Int32Array, so no malformed display
  // transform survives parsing; the terms are copied as plain numbers below.
  const trackHeader = trackHeaderMatches[0]!;
  return {
    kind: "video",
    container: "mp4",
    codec: "h264",
    width: track.video.width,
    height: track.video.height,
    runtimeSeconds,
    frameCount: track.nb_samples,
    fps,
    frameRate: canonicalProductionFrameRate({
      numerator: track.timescale,
      denominator: firstDuration,
    }),
    brands: {
      major: ftyp.major_brand,
      compatible: [...ftyp.compatible_brands],
    },
    coded: {
      width: description.width,
      height: description.height,
    },
    trackDisplay: {
      width16_16: trackHeader.width,
      height16_16: trackHeader.height,
    },
    trackMatrix: [
      ...trackHeader.matrix,
    ] as IAutoMovieProductionVideoProbe["trackMatrix"],
    pixelAspect:
      paspBoxes.length === 0
        ? { kind: "implicit-square" }
        : {
            kind: "explicit",
            hSpacing: paspBoxes[0]!.hSpacing,
            vSpacing: paspBoxes[0]!.vSpacing,
          },
    presentation: {
      movieTimescale: track.movie_timescale,
      mediaTimescale: track.timescale,
      movieDuration: track.movie_duration,
      mediaDuration: track.duration,
      edits: (track.edits ?? []).map((edit) => ({
        segmentDuration: edit.segment_duration,
        mediaTime: edit.media_time,
        mediaRateInteger: edit.media_rate_integer,
        mediaRateFraction: edit.media_rate_fraction,
      })),
    },
    samples: {
      count: samples.length,
      duration: firstDuration,
      timescale: track.timescale,
      firstDts: samples[0]!.dts,
      lastDts: samples.at(-1)!.dts,
      firstCts: samples[0]!.cts,
      lastCts: samples.at(-1)!.cts,
    },
    color: {
      container:
        colorBox?.colour_type === "nclx"
          ? {
              kind: "nclx",
              primaries: colorBox.colour_primaries,
              transfer: colorBox.transfer_characteristics,
              matrix: colorBox.matrix_coefficients,
              fullRange: colorBox.full_range_flag === 1,
            }
          : { kind: "absent" },
      resolved:
        colorBox?.colour_type === "nclx" &&
        colorBox.colour_primaries === AUTOMOVIE_MP4_SRGB_COLOUR.primaries &&
        colorBox.transfer_characteristics ===
          AUTOMOVIE_MP4_SRGB_COLOUR.transfer &&
        colorBox.matrix_coefficients === AUTOMOVIE_MP4_SRGB_COLOUR.matrix &&
        (colorBox.full_range_flag === 1) === AUTOMOVIE_MP4_SRGB_COLOUR.fullRange
          ? { kind: "srgb", source: "container" }
          : { kind: "absent" },
    },
  };
};
