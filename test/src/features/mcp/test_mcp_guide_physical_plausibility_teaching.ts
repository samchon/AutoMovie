import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_SANDBOX_MODULE_EXPORTS,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every physical-plausibility check is either run for the author or taught.
 *
 * The `physics` tier is the one that answers whether a roof is held up, whether
 * a foot that was planted stayed planted, and whether two bodies occupy one
 * volume. Eleven engine exports produce those findings. Two are reached
 * automatically because another engine export or the compiler calls them; the
 * other nine only ever run when an author calls them, and at `4e34ed1a` no
 * guide named one of the nine, so an authoring agent could read the whole
 * corpus and never learn that the measurement it was asked to make by eye
 * exists as a number.
 *
 * That silence had a mechanical cause worth stating, because it decides the
 * shape of this case. The tier is opt-in by construction: a stance window, a
 * capsule pair, a support face, and a bearing claim are action semantics the
 * engine cannot infer, so the calls belong to the author rather than to a
 * compile gate. The product is a library an ordinary coding agent writes
 * against, and the MCP surface carries capture and review, so a capability
 * nobody documents is a capability nobody has.
 *
 * Prose call form is not the criterion here, and cannot be. A guide that writes
 * an engine name against `(` claims shot source may call it, which
 * `test_mcp_guide_surface_reachability` enforces, and none of these nine is on
 * the sandbox surface. The corpus's own answer for a script-route capability is
 * the bare name in prose beside an example that imports a package the sandbox
 * does not serve, which is what `SUBJECT_INSPECTION` already does, so that is
 * what this case asks for.
 *
 * Scenarios:
 *
 * 1. The scan finds physics-emitting exports and finds call sites for some of
 *    them, so a broken reader fails the case instead of emptying its population
 *    and passing.
 * 2. Every physics-emitting export nothing in the workspace calls is named in
 *    some served guide's prose.
 * 3. Every guide that names one carries a script example that calls at least
 *    one of them, so the family is shown in the form an author runs it rather
 *    than listed as an inventory. `#1935` is the precedent: a capability that
 *    was published, documented, and read still went uncalled at the moment it
 *    was needed.
 */
export const test_mcp_guide_physical_plausibility_teaching = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-physics-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectPhysicsTeaching(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** The repository root, four levels above `test/src/features/mcp`. */
const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

/**
 * The workspace source a call site could live in.
 *
 * The scaffold is included because a generated project's own scripts are a
 * legitimate place for one of these calls, and a check the scaffold runs is
 * reached by every production stamped from it.
 */
const SOURCE_ROOTS: readonly string[] = [
  "packages/archetypes/src",
  "packages/cli/src",
  "packages/cli/scaffold",
  "packages/engine/src",
  "packages/ingest/src",
  "packages/mcp/src",
  "packages/render/src",
  "packages/viewer/src",
];

/**
 * The generated module that carries the corpus as string literals.
 *
 * It lives under `packages/mcp/src` and contains every guide verbatim, so a
 * scan that read it would count the corpus's own teaching examples as call
 * sites and conclude that a capability nobody runs is already run. Excluded by
 * path rather than by content, because that is the fact about it.
 */
const GUIDE_CONSTANT = path.join(
  REPOSITORY_ROOT,
  "packages/mcp/src/guides/AutoMovieGuideConstant.ts",
);

const walk = (directory: string): string[] =>
  fs.existsSync(directory) === false
    ? []
    : fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? entry.name === "node_modules" || entry.name === "generated"
              ? []
              : walk(path.join(directory, entry.name))
            : entry.name.endsWith(".ts")
              ? [path.join(directory, entry.name)]
              : [],
        );

/**
 * One engine export that reports a physical implausibility.
 *
 * Read from the engine's own source rather than from a list, because a list is
 * the artifact that goes stale on the day a tenth validator lands. A file that
 * writes `"physics"` as a violation kind is emitting into that tier, and every
 * arrow function it exports is a way to reach the emission.
 */
interface IPhysicsExport {
  name: string;
  file: string;
}

const physicsExports = (): IPhysicsExport[] => {
  const found: IPhysicsExport[] = [];
  for (const file of walk(path.join(REPOSITORY_ROOT, "packages/engine/src"))) {
    const text = fs.readFileSync(file, "utf8");
    if (/"physics",/u.test(text) === false) continue;
    for (const match of text.matchAll(/^export const (\w+) = \(/gmu))
      found.push({ name: match[1]!, file });
  }
  return found;
};

/** Whether any workspace source outside its own module calls this export. */
const isCalledInWorkspace = (
  entry: IPhysicsExport,
  sources: ReadonlyMap<string, string>,
): boolean => {
  const call = new RegExp(`(?:^|[^\\w$.])${entry.name}\\(`, "u");
  for (const [file, text] of sources)
    if (file !== entry.file && call.test(text)) return true;
  return false;
};

/**
 * One guide separated into its prose and its fenced TypeScript examples.
 *
 * The same split `#1919` reads, for the same reason: prose names a capability
 * in sentences and an example writes the imports a file would carry, so judging
 * them together would read a backtick as code and a call as a mention.
 */
const splitGuide = (
  content: string,
): { prose: string; examples: readonly string[] } => {
  const prose: string[] = [];
  const examples: string[] = [];
  let open: string[] | null = null;
  let language = "";
  for (const line of content.split("\n")) {
    if (line.startsWith("```") === false) {
      (open ?? prose).push(line);
      continue;
    }
    if (open === null) {
      language = line.slice(3).trim();
      open = [];
    } else {
      if (language === "ts") examples.push(open.join("\n"));
      open = null;
    }
  }
  return { prose: prose.join("\n"), examples };
};

/**
 * Whether this example says it runs outside the shot-source sandbox.
 *
 * An example naming a package the sandbox does not serve is the corpus's way of
 * saying the snippet is a project script, which is exactly where these calls
 * belong: they read a compiled artifact, and a build function is what produces
 * one. Reading the marker off the import list keeps the judgment mechanical
 * rather than resting on where the fence happens to sit in the document.
 */
const isScriptExample = (example: string): boolean =>
  [...example.matchAll(/^import[\s\S]*?from "([^"]+)";/gmu)].some(
    (match) =>
      AUTOMOVIE_SANDBOX_MODULE_EXPORTS.has(match[1]!) === false &&
      match[1] !== "@automovie/interface",
  );

const distinct = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnits);

const inspectPhysicsTeaching = (application: AutoMovieApplication): void => {
  const sources = new Map(
    SOURCE_ROOTS.flatMap((relative) =>
      walk(path.join(REPOSITORY_ROOT, relative)),
    )
      .filter((file) => file !== GUIDE_CONSTANT)
      .map((file) => [file, fs.readFileSync(file, "utf8")] as const),
  );
  const exports = physicsExports();
  const uncalled = exports.filter(
    (entry) => isCalledInWorkspace(entry, sources) === false,
  );

  TestValidator.equals(
    "the scan reads a populated engine and finds both kinds of physics export",
    {
      found: exports.length > 0,
      called: exports.length > uncalled.length,
      uncalled: uncalled.length > 0,
    },
    { found: true, called: true, uncalled: true },
  );

  const guides = AUTOMOVIE_PRODUCTION_GUIDE_NAMES.map((name) => ({
    name,
    ...splitGuide(application.getGuideDocument({ name }).content),
  }));
  const names = new Set(uncalled.map((entry) => entry.name));
  const mentions = (text: string): string[] =>
    [...names].filter((name) =>
      new RegExp(`(?:^|[^\\w$.])${name}(?![\\w$])`, "u").test(text),
    );

  TestValidator.equals(
    "every physics check nothing runs is named by a guide",
    distinct(
      [...names].filter(
        (name) =>
          guides.some((guide) => mentions(guide.prose).includes(name)) ===
          false,
      ),
    ),
    [],
  );

  TestValidator.equals(
    "every guide that names one shows one being called from a script",
    distinct(
      guides
        .filter(
          (guide) =>
            mentions(guide.prose).length > 0 &&
            guide.examples.some(
              (example) =>
                isScriptExample(example) && mentions(example).length > 0,
            ) === false,
        )
        .map((guide) => guide.name),
    ),
    [],
  );
};
