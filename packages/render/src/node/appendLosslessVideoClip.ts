import type { createFile } from "mp4box";

import type { IProductionRenditionClip } from "./IProductionRenditionClip";
import { sampleOptions } from "./sampleOptions";

/**
 * Copy one validated clip's H.264 samples onto the end of an output track,
 * re-timing them onto the assembled clock without touching their payload, and
 * answer the next free output frame.
 */
export const appendLosslessVideoClip = (props: {
  file: ReturnType<typeof createFile>;
  track: number;
  clip: IProductionRenditionClip;
  frame: number;
  sampleDuration: number;
}): number => {
  for (const sample of props.clip.samples) {
    // Both clocks are re-based on the clip's own first sample: a range cut from
    // the middle of a feature carries absolute decode times, and re-timing
    // only the presentation side would push cts below dts.
    const dtsFrame =
      (sample.dts - props.clip.decodeStart) / props.clip.sampleDuration;
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
