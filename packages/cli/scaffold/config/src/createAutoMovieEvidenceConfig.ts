import type { ITtscEvidenceGraphConfig } from "@ttsc/evidence";

import type { IAutoMovieEvidenceConfigProps } from "./IAutoMovieEvidenceConfigProps";
import { createGraphConfig } from "./internal/createGraphConfig";

/** Creates the evidence graph for one generated AutoMovie production. */
export function createAutoMovieEvidenceConfig(
  props: IAutoMovieEvidenceConfigProps,
): ITtscEvidenceGraphConfig {
  return createGraphConfig(props);
}
