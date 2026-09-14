import type { Sample, createFile } from "mp4box";

/**
 * Copy one sample's timing and flags into the options a track writer takes.
 *
 * Every path that re-emits a sample without decoding it needs exactly these
 * fields, and omitting one would silently change the output's timing.
 */
export const sampleOptions = (
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
