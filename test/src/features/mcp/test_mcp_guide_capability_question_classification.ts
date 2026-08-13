import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_SANDBOX_CAPABILITY_INDEX,
  AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The question index the corpus teaches is the one the code publishes.
 *
 * `AUTOMOVIE_SANDBOX_CAPABILITY_INDEX` is exported from the package barrel and
 * served by no tool, so prose is the only route by which an authoring agent ever
 * meets it: the corpus republishes the index by hand, and until now nothing
 * compared the two. `test_mcp_guide_capability_question_coverage` does not close
 * this, because it asks only whether each reachable name appears somewhere in
 * call form and whether some one guide names a whole family; both stay true while
 * a question is renamed, invented, or given the wrong member. That was measured
 * rather than assumed: renaming one question, replacing another with a question
 * the product does not publish, and moving `builtEnvironmentElementBounds` into a
 * different family left all five `test_mcp_guide_*` cases green. `bb6b2392` fixed
 * exactly that drift by hand after review caught it, which is the review round the
 * suite owes the author instead.
 *
 * The anchor is the bold lead of a Markdown list item ending in a question mark,
 * read from the served document rather than from disk, together with the code
 * spans in the rest of the item. Both are forms the corpus already commits to:
 * `prompts/README.md` makes a code span the way a guide claims a capability, and
 * the bold lead is the question itself, so an author cannot rewrite the anchor
 * without rewriting the thing being gated. Everything else stays free. Heading
 * text, sentence order, the prose between the names, which guide carries the
 * bullet, and the line it sits on can all change without a red. An item whose
 * spans name no reachable capability is not a capability bullet and is ignored,
 * so an ordinary rhetorical bullet in any guide costs nothing. Families are
 * compared as sets unioned across the corpus, because the order names appear in
 * within one sentence is prose, while the order of the questions is a published
 * fact the index derives from `QUESTION_ORDER`.
 *
 * Scenarios:
 *
 * 1. The questions the corpus publishes are exactly
 *    `AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS`: a question no bullet teaches and a
 *    bullet teaching a question the product does not publish are both reported by
 *    name, so an invented thirteenth question cannot ship as doctrine.
 * 2. The corpus walks those questions in the published reading order, since the
 *    index exists to be walked and an author meets a shape before an assembly.
 *    Measured over the taught questions only, so a membership fault is reported
 *    once rather than twice.
 * 3. Every question's family is exactly the one `QUESTION_OF_EXPORT` assigns,
 *    reported per question as what the bullet omits and what it filed there
 *    wrongly, which is the pair an author needs to fix either side.
 */
export const test_mcp_guide_capability_question_classification = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-question-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectQuestionClassification(
      new AutoMovieApplication({ projectRoot: root }),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const QUESTION_LEAD = /^\s*[-*]\s+\*\*\s*(.+\?)\s*\*\*/u;
const LIST_ITEM = /^\s*[-*]\s+/u;
const FENCE = /^\s*```/u;
const CODE_SPAN = /`([^`\n]+)`/gu;
const LEADING_IDENTIFIER = /^[A-Za-z_$][\w$]*/u;

const REACHABLE: ReadonlySet<string> = new Set(
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
);

/**
 * One guide's list items, each joined into a single string.
 *
 * Fenced blocks are skipped, so a hyphen that opens a line of sample data is
 * never read as a bullet, and a wrapped item is rejoined, so the anchor does not
 * depend on the repository's one-line-per-paragraph convention holding forever.
 */
const listItems = (content: string): readonly string[] => {
  const items: string[] = [];
  let current: string | null = null;
  let fenced: boolean = false;
  const flush = (): void => {
    if (current !== null) items.push(current);
    current = null;
  };
  for (const line of content.split(/\r?\n/u)) {
    if (FENCE.test(line)) {
      flush();
      fenced = fenced === false;
    } else if (fenced === true) continue;
    else if (LIST_ITEM.test(line)) {
      flush();
      current = line;
    } else if (current === null) continue;
    else if (line.trim() === "") flush();
    else current = `${current} ${line.trim()}`;
  }
  flush();
  return items;
};

/** The reachable capabilities one list item names in a code span. */
const namedCapabilities = (item: string): readonly string[] =>
  [...item.matchAll(CODE_SPAN)]
    .map((span) => LEADING_IDENTIFIER.exec(span[1]!)?.[0] ?? "")
    .filter((name) => REACHABLE.has(name));

/** The capability index the served corpus publishes, in the order it teaches it. */
const corpusClassification = (
  application: AutoMovieApplication,
): {
  order: readonly string[];
  families: ReadonlyMap<string, ReadonlySet<string>>;
} => {
  const order: string[] = [];
  const families = new Map<string, Set<string>>();
  for (const name of AUTOMOVIE_PRODUCTION_GUIDE_NAMES)
    for (const item of listItems(
      application.getGuideDocument({ name }).content,
    ))
      inspectItem(item, order, families);
  return { order, families };
};

const inspectItem = (
  item: string,
  order: string[],
  families: Map<string, Set<string>>,
): void => {
  const lead = QUESTION_LEAD.exec(item);
  if (lead === null) return;
  const named = namedCapabilities(item);
  if (named.length === 0) return;
  const question = lead[1]!;
  const family = families.get(question);
  if (family === undefined) {
    order.push(question);
    families.set(question, new Set(named));
  } else for (const name of named) family.add(name);
};

const inspectQuestionClassification = (
  application: AutoMovieApplication,
): void => {
  const { order, families } = corpusClassification(application);
  const published: ReadonlySet<string> = new Set(
    AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS,
  );

  TestValidator.equals(
    "the guide corpus publishes exactly the questions AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS holds: add the invented one to the union in packages/mcp/src/production/sandboxEngineSurface.ts or drop it from the corpus, and give the untaught one a bullet",
    {
      invented: order
        .filter((question) => published.has(question) === false)
        .sort(compareCodeUnits),
      untaught: AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS.filter(
        (question) => families.has(question) === false,
      ),
    },
    { invented: [], untaught: [] },
  );

  TestValidator.equals(
    "the guide corpus walks the questions in the reading order QUESTION_ORDER publishes: move the bullet, or move the question in that record",
    order.filter((question) => published.has(question)),
    AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS.filter((question) =>
      families.has(question),
    ),
  );

  TestValidator.equals(
    "each question bullet names exactly the family QUESTION_OF_EXPORT assigns: name what is missing, and move what is misfiled to the question the record gives it",
    AUTOMOVIE_SANDBOX_CAPABILITY_INDEX.flatMap(({ question, names }) => {
      const taught = families.get(question);
      if (taught === undefined) return [];
      const missing = names.filter((name) => taught.has(name) === false);
      const assigned: ReadonlySet<string> = new Set(names);
      const misfiled = [...taught]
        .filter((name) => assigned.has(name) === false)
        .sort(compareCodeUnits);
      return missing.length === 0 && misfiled.length === 0
        ? []
        : [{ question, missing: [...missing], misfiled }];
    }),
    [],
  );
};
