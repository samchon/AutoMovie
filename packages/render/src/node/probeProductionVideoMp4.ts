import type { IAutoMovieProductionMediaProbe } from "@automovie/interface";

import { parseProductionMp4Output } from "./parseProductionMp4Output";
import { probeParsedProductionVideoMp4 } from "./probeParsedProductionVideoMp4";

/**
 * Parse one H.264-only intermediate production video.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-identity Identifies each track by its parsed role and codec facts rather than by a probe index.
 */
export const probeProductionVideoMp4 = (
  bytes: Uint8Array,
): Extract<IAutoMovieProductionMediaProbe, { kind: "video" }> =>
  probeParsedProductionVideoMp4(bytes, parseProductionMp4Output(bytes));
