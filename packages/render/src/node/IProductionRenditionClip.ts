import type { Sample, Track } from "mp4box";

import type { probeProductionVideoMp4 } from "./probeProductionVideoMp4";

/**
 * One clip parsed for splicing without decoding it.
 *
 * Its bytes, probe, track, samples, constant sample duration and the decode and
 * presentation origins its samples are re-timed from travel together, because
 * every lossless splice path reads all of them.
 */
export interface IProductionRenditionClip {
  /** The clip's exact bytes, which every copied sample is read out of. */
  bytes: Uint8Array;
  /** Parser-observed container facts of this clip. */
  probe: ReturnType<typeof probeProductionVideoMp4>;
  /** The clip's single video track. */
  track: Track;
  /** Every sample of that track, in decode order. */
  samples: Sample[];
  /** The one sample duration every sample of the clip carries. */
  sampleDuration: number;
  /** Decode time of the clip's first sample on its own clock. */
  decodeStart: number;
  /** Presentation time of the clip's earliest sample on its own clock. */
  presentationStart: number;
}
