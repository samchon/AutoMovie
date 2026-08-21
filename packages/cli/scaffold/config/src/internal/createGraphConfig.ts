import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphConfig,
} from "@ttsc/evidence";

import type { IAutoMovieEvidenceConfigProps } from "../IAutoMovieEvidenceConfigProps";
import { createAuthoredClaims } from "./createAuthoredClaims";
import { createSourceClaims } from "./createSourceClaims";
import { validateEvidenceHosts } from "./validateEvidenceHosts";
import { validateEvidenceStages } from "./validateEvidenceStages";

/** Builds the validated shared graph and appends production-owned claims. */
export const createGraphConfig = (
  props: IAutoMovieEvidenceConfigProps,
): ITtscEvidenceGraphConfig => {
  validateEvidenceStages(props);
  validateEvidenceHosts(props);

  const sharedClaims: ITtscEvidenceGraphClaim[] = [
    ...createAuthoredClaims(props),
    ...createSourceClaims(props),
  ];
  return {
    claims: [
      ...sharedClaims.filter((claim) =>
        Array.isArray(claim.reference) ? claim.reference.length > 0 : true,
      ),
      ...(props.claims ?? []),
    ],
  };
};
