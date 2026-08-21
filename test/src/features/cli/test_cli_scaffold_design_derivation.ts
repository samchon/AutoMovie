import { renderScaffold } from "@automovie/cli";
import { compareCodeUnits } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/**
 * Every design record the scaffold ships is one its own emitter derives.
 *
 * `.automovie/design` looks hand-kept and is not: `scripts/emitDesign.ts` builds
 * each record from the typed source that owns it, and the compiler refuses a
 * record that disagrees with its source. A shipped record nothing derives is
 * therefore a trap rather than a gap. It stays resident through a production's
 * own authoring, keeps every obligation the record carries, and cannot be
 * corrected by editing source, because no source owns it.
 *
 * A benchmark run paid for that trap in the other direction: it replaced the
 * starter's documents and source, left the derived layer alone, and compiled for
 * two turns against shots it had already deleted. Nothing failed, because
 * nothing checks that the two halves describe one film.
 *
 * The check is a logical-label check rather than an execution. Running the emitter needs
 * the project's own installed dependencies, and the fixture roots this suite
 * builds have none, so this asks the weaker question that still catches the
 * whole failure class: a record whose path the emitter never names is a record
 * nobody derives.
 *
 * Scenarios:
 *
 * 1. The scaffold ships design records, so a reader that finds none fails here
 *    instead of passing on an empty population.
 * 2. Every shipped record except the screenplay index has a shared or
 *    production-tree path whose logical suffix is named by the emitter,
 *    literally or by a template that covers its directory.
 * 3. The screenplay index is the one exception, and the emitter says so in
 *    prose. This keeps the exception a decision rather than an omission that
 *    happens to look like one.
 */
export const test_cli_scaffold_design_derivation = (): void => {
  const scaffold = path.resolve(__dirname, "../../../../packages/cli/scaffold");
  const design = path.join(scaffold, ".automovie", "design");
  const emitter = fs.readFileSync(
    path.join(scaffold, "scripts", "emitDesign.ts"),
    "utf8",
  );

  const records = walk(design).map((file) =>
    path.relative(design, file).replaceAll("\\", "/"),
  );
  TestValidator.equals(
    "the scaffold ships tracked design records",
    records.length > 0,
    true,
  );

  TestValidator.equals(
    "every shipped design record is derived by the scaffold's own emitter",
    distinct(
      records
        .filter((record) => record !== SCREENPLAY_INDEX)
        .filter((record) => isDerived(record, emitter) === false),
    ),
    [],
  );

  TestValidator.equals(
    "the screenplay index is the emitter's one stated exception",
    {
      resident: records.includes(SCREENPLAY_INDEX),
      derived: isDerived(SCREENPLAY_INDEX, emitter),
      explained: emitter.includes("The screenplay index stays hand-authored"),
    },
    { resident: true, derived: false, explained: true },
  );

  const rendered = renderScaffold({ name: "rendered-production" });
  TestValidator.equals(
    "production-owned design paths substitute the project name",
    Object.hasOwn(
      rendered,
      ".automovie/design/rendered-production/screenplay/index.json",
    ),
    true,
  );
  TestValidator.equals(
    "no scaffold path ships an unresolved project-name token",
    Object.keys(rendered).every((file) => file.includes("{{name}}") === false),
    true,
  );
};

/** The one record the emitter deliberately leaves alone. */
const SCREENPLAY_INDEX = "{{name}}/screenplay/index.json";

const walk = (directory: string): string[] =>
  fs.existsSync(directory) === false
    ? []
    : fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? walk(path.join(directory, entry.name))
            : entry.name.endsWith(".json")
              ? [path.join(directory, entry.name)]
              : [],
        );

/**
 * Whether the emitter names this record's logical label.
 *
 * The design-tree prefix is storage ownership and not part of an emitter label,
 * so `shared/` and `{{name}}/` are removed first. Two spellings then count,
 * because the emitter legitimately uses both. A record with
 * one owner is named whole (`"shots/opening.json"`), and a family whose members
 * come from a list is named by a template over its directory
 * (`` `acceptance/${scenario.id}.json` ``). A template is accepted for its whole
 * directory rather than per member: the ids come from source this reader does not
 * execute, and demanding each one would only be answerable by re-implementing
 * the emitter here.
 */
const isDerived = (record: string, emitter: string): boolean => {
  const label = record.startsWith("shared/")
    ? record.slice("shared/".length)
    : record.startsWith("{{name}}/")
      ? record.slice("{{name}}/".length)
      : record;
  if (emitter.includes(`"${label}"`)) return true;
  const directory = label.includes("/")
    ? label.slice(0, label.indexOf("/"))
    : null;
  return directory === null ? false : emitter.includes(`\`${directory}/\${`);
};

const distinct = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnits);
