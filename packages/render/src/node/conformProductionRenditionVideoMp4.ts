import {
  equalProductionFrameRates,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type { IAutoMovieFilmTimeline } from "@automovie/interface";

import { assertProductionVideoProfile } from "../delivery/assertProductionVideoProfile";
import { resolveProductionVideoProfile } from "../delivery/resolveProductionVideoProfile";
import { appendLosslessVideoClip } from "./appendLosslessVideoClip";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { productionRenditionVideoPlan } from "./productionRenditionVideoPlan";
import { residentMp4Box } from "./residentMp4Box";

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
