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
  fs
    .readdirSync(PROMPT_ROOT)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => file.slice(0, -".md".length))
    .sort(compareCodeUnits);

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
