import * as AutoMovieEngine from "@automovie/engine";
import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every reachable capability is taught in the form an author would call it.
 *
 * `#1919` asked the guide-to-surface direction: a name a guide writes in call
 * form must be reachable. `#1935` asked the return direction with a weaker
 * question — whether some guide's code span contains the name at all. A name
 * parked in an inventory satisfies that question while teaching nothing, and
 * `builtEnvironmentSpaceNodes` is the proof it is not enough: it was on the
 * surface, documented, and read by an observer in the first hour of a campaign,
 * and still went uncalled at the moment it was needed, after which five
 * consecutive reports said the population it answers for did not exist.
 *
 * So this asks the return direction at the same strength as the outbound one,
 * with call form as the criterion on both sides. Prose only, because a call
 * buried in a fenced example is found by an author who already knows the name,
 * which is the author this gate is not for.
 *
 * Silence is not declarable here, and that is the design. A reachable name that
 * no guide should teach as callable would need a list of such names, and a list
 * of excused entries is the artifact that never shrinks. The excuse is derived
 * from the name's own runtime shape instead: the surface publishes arrow
 * functions an author calls and base classes an author extends, and nothing
 * else. An undeclared silence therefore cannot exist — a function no guide calls
 * fails scenario 1, and a new shape on the surface fails scenario 3.
 *
 * Scenarios:
 *
 * 1. Every reachable engine function appears in call form in some served
 *    guide's prose, so no capability is reachable, named, and untaught.
 * 2. No reachable base class appears in call form anywhere in the corpus. The
 *    two are abstract, so a guide writing `AutoMovieSubject(` would be teaching
 *    a call that cannot compile, and would also be buying scenario 1's pass
 *    with the wrong currency.
 * 3. The names exempt from scenario 1 are exactly the two subject base classes.
 *    This pins the discriminator itself: a future class, object, or table added
 *    to the surface goes red here rather than landing quietly in the bucket that
 *    owes no call form.
 */
export const test_mcp_guide_surface_teaching = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-teaching-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectSurfaceTeaching(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const CODE_SPAN = /`([^`\n]+)`/gu;

const CALL_FORM = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\(/gu;

/**
 * One guide's prose, with every fenced block removed.
 *
 * The same separation `#1919` reads, for the same reason: a fenced example
 * writes the import statement a source file would carry and is judged as code,
 * while prose names a capability in sentences. Here it also carries the
 * stricter meaning — an example is read by an author who already arrived, so a
 * call that appears only inside one has not taught the name to anybody.
 */
const guideProse = (content: string): string => {
  const prose: string[] = [];
  let fenced = false;
  for (const line of content.split("\n")) {
    if (line.startsWith("```")) {
      fenced = fenced === false;
      continue;
    }
    if (fenced === false) prose.push(line);
  }
  return prose.join("\n");
};

/** The bare names one guide's prose writes immediately against `(`. */
const proseCalls = (prose: string): string[] =>
  [...prose.matchAll(CODE_SPAN)].flatMap((span) =>
    [...span[1].matchAll(CALL_FORM)].map((call) => call[1]!),
  );

/**
 * Whether the engine publishes this reachable name as something an author calls.
 *
 * Read from the value rather than from a list. Every callable on the surface is
 * an arrow function, which carries no `prototype`, and the two subject bases are
 * classes, which do. That makes "this name is extended, not called" a fact the
 * engine states about itself, so no guide author and no reviewer has to remember
 * an exception, and a name whose shape changes stops being excused on the next
 * run rather than on the next audit.
 */
const isCallable = (name: string): boolean => {
  const value = (AutoMovieEngine as Record<string, unknown>)[name];
  return (
    typeof value === "function" &&
    (value as { prototype?: unknown }).prototype === undefined
  );
};

const inspectSurfaceTeaching = (application: AutoMovieApplication): void => {
  const called: ReadonlySet<string> = new Set(
    AUTOMOVIE_PRODUCTION_GUIDE_NAMES.flatMap((name) =>
      proseCalls(guideProse(application.getGuideDocument({ name }).content)),
    ),
  );

  TestValidator.equals(
    "every reachable engine function is written in call form by some guide",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
      (name) => isCallable(name) && called.has(name) === false,
    ).sort(compareCodeUnits),
    [],
  );

  TestValidator.equals(
    "no reachable base class is written in call form",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
      (name) => isCallable(name) === false && called.has(name),
    ).sort(compareCodeUnits),
    [],
  );

  TestValidator.equals(
    "only the subject base classes are excused from being taught as callable",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
      (name) => isCallable(name) === false,
    ).sort(compareCodeUnits),
    ["AutoMovieSubject", "AutoMovieSubjectGroup"],
  );
};
