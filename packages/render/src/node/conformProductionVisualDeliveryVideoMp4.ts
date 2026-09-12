import { resolveProductionFrameRate } from "@automovie/engine";
import type { IAutoMovieFilmTimeline } from "@automovie/interface";

import { assertProductionVideoProfile } from "../delivery/assertProductionVideoProfile";
import { resolveProductionVideoProfile } from "../delivery/resolveProductionVideoProfile";
import { productionVisualDeliveryOccurrence } from "../film/productionVisualDeliveryOccurrence";
import type { IProductionRenditionClip } from "./IProductionRenditionClip";
import { appendLosslessVideoClip } from "./appendLosslessVideoClip";
import { parseProductionRenditionClip } from "./parseProductionRenditionClip";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { residentMp4Box } from "./residentMp4Box";
import { sameSampleDescription } from "./sameSampleDescription";
import { sampleDescription } from "./sampleDescription";

/**
 * Losslessly conform explicit deterministic and repaint occurrence lanes.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-mixed-delivery Selects pixels only from the declared lane and refuses fallback at a lane crossing.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-failure-publication Preserves the shared H.264 presentation contract while joining occurrence-addressed sources.
 */
export const conformProductionVisualDeliveryVideoMp4 = (props: {
  timeline: IAutoMovieFilmTimeline;
  sources: ReadonlyArray<{
    occurrence: string;
    lane: "deterministic" | "repainted";
    bytes: Uint8Array;
  }>;
}): Uint8Array => {
  if (
    props.sources.length !== props.timeline.segments.length ||
    props.sources.some(
      (source, index) =>
        source.occurrence !==
        productionVisualDeliveryOccurrence(
          props.timeline.segments[index]!,
          index,
        ),
    )
  )
    throw new Error(
      "Visual delivery sources must exactly join the current timeline occurrences.",
    );
  let deterministic: IProductionRenditionClip | undefined;
  const parsed = props.timeline.segments.map((segment, index) => {
    if (
      segment.transitionIn.kind !== "cut" ||
      segment.transitionOut.kind !== "cut"
    )
      throw new Error(
        `Mixed visual delivery currently requires cut-only editing at occurrence ${index}.`,
      );
    const source = props.sources[index]!;
    if (source.lane === "deterministic") {
      deterministic ??= parseProductionRenditionClip(
        source.bytes,
        "Deterministic feature source",
      );
      if (
        deterministic.probe.frameCount !== props.timeline.totalFrames ||
        source.bytes.length !== deterministic.bytes.length ||
        source.bytes.some(
          (value, offset) => value !== deterministic!.bytes[offset],
        )
      )
        throw new Error(
          "Every deterministic lane must cite the same exact current feature source.",
        );
      const samples = deterministic.samples.slice(
        segment.startFrame,
        segment.endFrame,
      );
      if (
        samples.length !== segment.endFrame - segment.startFrame ||
        (index > 0 &&
          props.sources[index - 1]!.lane !== "deterministic" &&
          samples[0]?.is_sync !== true)
      )
        throw new Error(
          `Deterministic occurrence ${index} cannot begin losslessly at its declared lane crossing.`,
        );
      return {
        ...deterministic,
        samples,
        decodeStart: samples[0]!.dts,
        presentationStart: samples.reduce(
          (minimum, sample) => Math.min(minimum, sample.cts),
          samples[0]!.cts,
        ),
      };
    }
    const clip = parseProductionRenditionClip(
      source.bytes,
      `Repaint occurrence ${index}`,
    );
    if (
      segment.sourceInFrame !== 0 ||
      segment.sourceOutFrame !== clip.probe.frameCount ||
      segment.endFrame - segment.startFrame !== clip.probe.frameCount
    )
      throw new Error(
        `Repaint occurrence ${index} must supply the exact full-shot clip.`,
      );
    return clip;
  });
  const first = parsed[0];
  if (first === undefined)
    throw new Error("Mixed visual delivery requires a non-empty timeline.");
  const description = sampleDescription(first.samples[0]!);
  for (const [index, clip] of parsed.entries())
    if (
      clip.probe.width !== first.probe.width ||
      clip.probe.height !== first.probe.height ||
      clip.track.timescale !== first.track.timescale ||
      clip.sampleDuration !== first.sampleDuration ||
      sameSampleDescription(
        description,
        sampleDescription(clip.samples[0]!),
      ) === false
    )
      throw new Error(
        `Visual delivery occurrence ${index} changes the exact video presentation contract.`,
      );
  const output = residentMp4Box().createFile();
  const mediaDuration = props.timeline.totalFrames * first.sampleDuration;
  output.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: first.track.timescale,
    duration: mediaDuration,
  });
  const trackId = output.addTrack({
    type: description.type,
    hdlr: "vide",
    name: "AutoMovie explicit visual-lane feature",
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
      sampleDuration: first.sampleDuration,
    });
  if (frame !== props.timeline.totalFrames)
    throw new Error("Visual delivery sources do not cover the current film.");
  const bytes = new Uint8Array(output.getBuffer().buffer);
  // The frame count was proved equal to the film above, and the profile
  // assertion proves the exact rational clock of every written sample.
  assertProductionVideoProfile({
    expected: resolveProductionVideoProfile({
      width: first.probe.width,
      height: first.probe.height,
      frameRate: resolveProductionFrameRate(props.timeline),
    }),
    actual: probeProductionVideoMp4(bytes),
  });
  return bytes;
};
