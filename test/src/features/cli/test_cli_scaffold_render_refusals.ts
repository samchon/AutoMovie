import { renderScaffold, scaffoldAssetDirectory } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every sentence scaffold rendering refuses with, produced rather than assumed.
 *
 * `renderScaffold` decides a project name before it reads a single asset, and
 * `scaffoldAssetDirectory` decides whether there are assets to read at all.
 * Both refusals were written and neither had ever been produced: the coverage
 * gate's first real judgment of this branch reported them uncovered, which was
 * a true reading of a guard whose failure sentence nobody had seen. A rule that
 * has never once refused is indistinguishable from a rule that does not work.
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
 * 4. `scaffoldAssetDirectory` resolves the shipped assets by default, and
 *    refuses a module directory with no `scaffold` sibling by naming the exact
 *    path it looked for. A refusal that withholds the path it tried is a
 *    refusal an author cannot act on.
 */
export const test_cli_scaffold_render_refusals = (): void => {
  const refusal = (name: string): string => {
    try {
      renderScaffold({ name });
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

  const shipped = scaffoldAssetDirectory();
  const empty = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-scaffold-assets-"),
  );
  try {
    // `scaffoldAssetDirectory` resolves `<moduleDirectory>/../scaffold`, so a
    // module directory nested one level inside an empty root has no sibling to
    // find, and one beside a real `scaffold` directory does.
    const missingFrom = path.join(empty, "lib");
    const carrier = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-scaffold-carrier-"),
    );
    const present = path.join(carrier, "scaffold");
    fs.mkdirSync(present);

    const refused = ((): string => {
      try {
        return scaffoldAssetDirectory(missingFrom);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    })();

    TestValidator.equals(
      "the assets are located by default and their absence is refused by path",
      {
        shippedExists: fs.existsSync(shipped),
        shippedIsNamedScaffold: path.basename(shipped) === "scaffold",
        refusedNamesThePath:
          refused ===
          `scaffold assets are missing: ${path.join(empty, "scaffold")}`,
        foundBesideAModule:
          scaffoldAssetDirectory(path.join(carrier, "lib")) === present,
      },
      {
        shippedExists: true,
        shippedIsNamedScaffold: true,
        refusedNamesThePath: true,
        foundBesideAModule: true,
      },
    );
    fs.rmSync(carrier, { recursive: true, force: true });
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
};
