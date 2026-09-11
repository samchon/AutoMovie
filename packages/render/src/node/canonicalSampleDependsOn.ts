import type { Sample } from "mp4box";

/** Treat an unspecified sync-sample dependency as its MP4Box canonical form. */
export const canonicalSampleDependsOn = (sample: Sample): number =>
  sample.is_sync === true && sample.depends_on === 0 ? 2 : sample.depends_on;
