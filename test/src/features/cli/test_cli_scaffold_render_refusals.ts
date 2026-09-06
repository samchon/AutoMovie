import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Every sentence scaffold rendering refuses with, produced rather than assumed.
 *
 * `renderScaffold` decides a project name before it reads a single asset.
 *
 * The name rule is one long disjunction, so it is exercised operand by operand.
 * Testing it with a single bad name would leave the other clauses in exactly
 * the state this case exists to end, and would not notice one of them being
 * deleted. Each shape below is the only one in the table that its own clause
 * catches.
 *
 * The two refusals are also separated on purpose. An empty name and an
 * unportable name are different author mistakes with different corrections, and
 * a caller that cannot tell them apart cannot say which one to fix.
 *
 * Scenarios:
 *
 * 1. An empty name, and a name that is only whitespace, are refused by the
 *    name-required sentence rather than the portability one, because `trim`
 *    runs first and turns the second into the first.
 * 2. Each remaining clause of the portability rule refuses its own shape --
 *    the two relative directory names, a trailing dot, a path or wildcard
 *    character, and a reserved device name with and without an extension --
 *    and each message names the offending input so an author can see what was
 *    read.
 * 3. An ordinary name renders, so the rule refuses shapes rather than refusing
 *    everything.
 */
export const test_cli_scaffold_render_refusals = (): void => {
  const refusal = (name: string): string => {
    try {
      renderScaffold({ name, language: "english" });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const unportable = (name: string): string =>
    `scaffold project name "${name}" must be one portable directory segment`;

  TestValidator.equals(
    "an empty name is a different mistake from an unportable one",
    {
      empty: refusal(""),
      whitespace: refusal("   "),
    },
    {
      empty: "scaffold requires a project name",
      whitespace: "scaffold requires a project name",
    },
  );

  TestValidator.equals(
    "every clause of the portability rule refuses its own shape",
    {
      self: refusal("."),
      parent: refusal(".."),
      trailingDot: refusal("film."),
      separator: refusal("studio/film"),
      wildcard: refusal("film*"),
      device: refusal("con"),
      deviceWithExtension: refusal("COM1.film"),
    },
    {
      self: unportable("."),
      parent: unportable(".."),
      trailingDot: unportable("film."),
      separator: unportable("studio/film"),
      wildcard: unportable("film*"),
      device: unportable("con"),
      deviceWithExtension: unportable("COM1.film"),
    },
  );

  TestValidator.equals(
    "a name the rule accepts renders the scaffold",
    refusal("ordinary-film") === "accepted",
    true,
  );
};
