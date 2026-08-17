import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every authored guide is served, and the constitution routes every served one.
 *
 * A guide reaches an authoring agent through two gates and is invisible when
 * either is open. `build/prompt.mjs` carries an explicit allowlist, so a
 * document added to `packages/mcp/prompts` and not added there is written,
 * reviewed and merged while `getGuideDocument` refuses its name. The build
 * fails loudly on the other direction, an allowlisted name with no file, so
 * only this one is silent.
 *
 * `AUTOMOVIE_OVERALL` is the second gate. `prompts/README.md` states its
 * contract, that an agent which has read only that document must be able to
 * select the next guide, which makes a served guide the constitution never
 * names reachable only by an agent that already knew it existed. That is the
 * same gap `#1948` closed between the sandbox surface and the corpus, one layer
 * up.
 *
 * Scenarios:
 *
 * 1. The authored Markdown corpus and the served guide names are one exact set,
 *    so neither an unserved document nor a served name without prose survives.
 * 2. The constitution names every other served guide in a code span, so no
 *    guide is served without a route to it.
 */
export const test_mcp_guide_corpus_closure = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-closure-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectCorpusClosure(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** The authored corpus, four levels above `test/src/features/mcp`. */
const PROMPT_ROOT = path.resolve(__dirname, "../../../../packages/mcp/prompts");

/**
 * The guide names the corpus directory authors.
 *
 * `README.md` documents the corpus for a contributor rather than teaching an
 * authoring agent, and says so itself, so it is the one Markdown file here that
 * claims no served name.
 */
const authoredGuideNames = (): string[] =>
  walkGuideFiles(PROMPT_ROOT).map(authoredGuideName).sort(compareCodeUnits);

/**
 * The name one authored file serves under.
 *
 * An area's index is `INDEX.md` and serves under the area's own name, so the
 * folder and the guide an agent asks for are one word. The corpus root is the
 * exception, because its index is the constitution and every gate refusal
 * already names it `AUTOMOVIE_OVERALL`.
 */
const authoredGuideName = (file: string): string => {
  const stem = path.basename(file, ".md");
  if (stem !== "INDEX") return stem;
  const area = path.basename(path.dirname(file));
  return area === "prompts"
    ? "AUTOMOVIE_OVERALL"
    : area.replaceAll("-", "_").toUpperCase();
};

/**
 * Every authored guide, wherever its topic folder put it.
 *
 * The corpus is grouped in folders the way the skills are, so a flat read of the
 * root would report the whole set as missing the moment one moved.
 */
const walkGuideFiles = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walkGuideFiles(path.join(directory, entry.name))
        : entry.name.endsWith(".md") && entry.name !== "README.md"
          ? [path.join(directory, entry.name)]
          : [],
    );

const inspectCorpusClosure = (application: AutoMovieApplication): void => {
  TestValidator.equals(
    "the authored corpus and the served guide names are one set",
    authoredGuideNames(),
    [...AUTOMOVIE_PRODUCTION_GUIDE_NAMES].sort(compareCodeUnits),
  );

  const constitution = application.getGuideDocument({
    name: "AUTOMOVIE_OVERALL",
  }).content;
  TestValidator.equals(
    "the constitution routes every other served guide",
    AUTOMOVIE_PRODUCTION_GUIDE_NAMES.filter(
      (name) =>
        name !== "AUTOMOVIE_OVERALL" &&
        constitution.includes(`\`${name}\``) === false,
    ),
    [],
  );
};
