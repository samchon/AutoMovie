import { TestValidator } from "@nestia/e2e";

import {
  analyzePublicApiConsumers,
  selfTestPublicApiConsumers,
} from "../../integrity/publicApiConsumers";
import { namedFacts } from "../internal/predicates";

/** Every callable public export has an honest non-test consumer decision. */
export const test_workspace_public_api_consumers = (): void => {
  selfTestPublicApiConsumers();
  const result = analyzePublicApiConsumers();
  console.log(
    `Public API consumers: ${result.publicCallables} callables, ${result.documentedOnly} documented-only, ${result.testOnly} test-only.`,
  );
  for (const finding of result.findings)
    console.error(
      `${finding.code}: ${finding.package} ${finding.names.join(", ")} at ${finding.location}: ${finding.reason}`,
    );
  TestValidator.equals(
    "the public surface has no unresolved consumer decision",
    namedFacts([
      [
        "the repository exports callable APIs",
        () => result.publicCallables > 0,
      ],
      ["no callable remains test-only", () => result.testOnly === 0],
      [
        "no public-consumer finding remains",
        () => result.findings.length === 0,
      ],
    ]),
    {
      "the repository exports callable APIs": true,
      "no callable remains test-only": true,
      "no public-consumer finding remains": true,
    },
  );
};
