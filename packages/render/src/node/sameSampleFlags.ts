import type { Sample } from "mp4box";

import { canonicalSampleDependsOn } from "./canonicalSampleDependsOn";

/**
 * Whether two samples carry the same dependency and redundancy flags.
 *
 * An unspecified sync-sample dependency is read in its canonical form first. A
 * lossless splice has to preserve these flags, so the comparison and the flag
 * record it explains read one definition.
 */
export const sameSampleFlags = (left: Sample, right: Sample): boolean =>
  left.is_sync === right.is_sync &&
  left.is_leading === right.is_leading &&
  canonicalSampleDependsOn(left) === canonicalSampleDependsOn(right) &&
  left.is_depended_on === right.is_depended_on &&
  left.has_redundancy === right.has_redundancy &&
  left.degradation_priority === right.degradation_priority &&
  JSON.stringify(left.subsamples ?? []) ===
    JSON.stringify(right.subsamples ?? []);
