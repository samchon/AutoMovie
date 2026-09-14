import { TestValidator } from "@nestia/e2e";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";
import { productionModule } from "./sourceStatusFixtures";

const { generatedOwnershipDiagnosticMessage } = loadSourceModule<{
  generatedOwnershipDiagnosticMessage(props: {
    actual: string | null;
    expected: string;
    repair: boolean;
  }): string;
}>(productionModule("generatedOwnershipDiagnosticMessage.ts"));

/**
 * A builder-owned digest mismatch names its output, its causes, and its remedy.
 *
 * This diagnostic used to say that "current source and design" derive the
 * expected digest, which is a verdict about the author's own inputs and sends
 * them hunting a source change that may not exist. A derived-result finding
 * states which output is unconfirmed; a mismatch here is caused either by an
 * edit to the builder-owned file or by a move in any compile input, the build
 * protocol included, and the message has to admit both.
 *
 * The two callers differ in what they can promise. A repairing build will
 * rewrite the file, while a read-only lint can only refuse it and direct the
 * author to compile, so one message may not stand for both.
 *
 * Scenarios:
 *
 * 1. Both arms carry the observed and derived digests.
 * 2. Both arms name an edit and an input move as the two possible causes, and
 *    both name the build protocol among the inputs.
 * 3. Neither arm attributes the mismatch to current source and design alone.
 * 4. The repairing arm promises regeneration, the refusing arm directs to the
 *    scaffold compile command, and the two messages differ.
 * 5. An absent file renders its missing digest rather than inventing one.
 */
export const test_production_generated_ownership_message = (): void => {
  const actual = "sha256:aaaa";
  const expected = "sha256:bbbb";
  const repair = generatedOwnershipDiagnosticMessage({
    actual,
    expected,
    repair: true,
  });
  const refuse = generatedOwnershipDiagnosticMessage({
    actual,
    expected,
    repair: false,
  });
  const absent = generatedOwnershipDiagnosticMessage({
    actual: null,
    expected,
    repair: false,
  });

  TestValidator.equals(
    "the digest mismatch names both digests, both causes, and its own remedy",
    namedFacts([
      [
        "bothArmsCarryBothDigests",
        () =>
          [repair, refuse].every(
            (message) => message.includes(actual) && message.includes(expected),
          ),
      ],
      [
        "bothArmsNameAnEdit",
        () => [repair, refuse].every((message) => message.includes("edited")),
      ],
      [
        "bothArmsNameAnInputMove",
        () =>
          [repair, refuse].every((message) => message.includes("inputs moved")),
      ],
      [
        "bothArmsNameTheProtocolAsAnInput",
        () =>
          [repair, refuse].every((message) =>
            message.includes("builder protocol"),
          ),
      ],
      [
        "neitherArmBlamesSourceAndDesignAlone",
        () =>
          [repair, refuse].every(
            (message) =>
              message.includes("current source and design derive") === false,
          ),
      ],
      [
        "theRepairingArmPromisesRegeneration",
        () => repair.includes("will regenerate"),
      ],
      [
        "theRefusingArmDirectsToCompile",
        () => refuse.includes("scaffold compile command"),
      ],
      ["thetwoRemediesDiffer", () => repair !== refuse],
      [
        "anAbsentFileRendersItsMissingDigest",
        () => absent.includes("Generated digest is null"),
      ],
    ]),
    {
      bothArmsCarryBothDigests: true,
      bothArmsNameAnEdit: true,
      bothArmsNameAnInputMove: true,
      bothArmsNameTheProtocolAsAnInput: true,
      neitherArmBlamesSourceAndDesignAlone: true,
      theRepairingArmPromisesRegeneration: true,
      theRefusingArmDirectsToCompile: true,
      thetwoRemediesDiffer: true,
      anAbsentFileRendersItsMissingDigest: true,
    },
  );
};
