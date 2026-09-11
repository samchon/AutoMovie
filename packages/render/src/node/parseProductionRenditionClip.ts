import type { IProductionRenditionClip } from "./IProductionRenditionClip";
import { neutralTrackPresentation } from "./neutralTrackPresentation";
import { parseMp4 } from "./parseMp4";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { sameSampleDescription } from "./sameSampleDescription";
import { sampleDescription } from "./sampleDescription";

/**
 * Parse one clip that is to be spliced without decoding it: a repaint shot or
 * one range of a chunked render. `label` names the clip in every refusal, so a
 * multi-clip splice says which one failed.
 */
export const parseProductionRenditionClip = (
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
    decodeStart: samples[0]!.dts,
    presentationStart,
  };
};
