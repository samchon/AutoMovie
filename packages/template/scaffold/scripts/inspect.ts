import {
  AutoMovieProductionContext,
  AutoMovieProductionSubjectInspectionService,
  findAutoMovieProjectRoot,
} from "@automovie/production";

import { inspectProductionSubject } from "./inspectSubject";
import { readAutoMovieProjectProductionId } from "./projectIdentity";

/**
 * Open one compiled subject and answer what it is, from viewpoints it derives.
 *
 * ## Why this command exists
 *
 * The inspection service refuses when a project supplies no instrument, and its
 * refusal names this project's own file: "The scaffold ships one at
 * `scripts/inspectSubject.ts`; pass that, or another
 * `AutoMovieProductionSubjectInspection`, to the call that reached here."
 *
 * Nothing passed it. The instrument shipped, the seat that takes it shipped,
 * and no command in this project handed one to the other, so the sentence the
 * product prints was an instruction with no way to follow it. This is that way:
 * ten lines that bind the shipped instrument to the shipped service, changing
 * no contract and no type.
 *
 * ## What it does not do
 *
 * It does not decide viewpoints. The service derives the sweep from the
 * subject's own bounds and the topology it belongs to, which is the property
 * that makes an inspection mean something: an author who could choose the
 * angles could choose flattering ones. The optional overrides below exist for
 * a subject the derived sweep genuinely cannot frame, and every one of them
 * has a working default.
 *
 * It writes nothing itself. The service publishes observation bytes under
 * `automovie/inspections`, outside the render root a delivery review reads,
 * because an inspection is not a frame and must never be mistaken for one.
 */
const projectRoot = findAutoMovieProjectRoot(process.cwd());
const productionId = readAutoMovieProjectProductionId(projectRoot);

const one = (name: string): string | undefined => {
  const argv = process.argv.slice(2);
  const found: string[] = [];
  for (let index = 0; index < argv.length; index += 1)
    if (argv[index] === name) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${name} requires one value.`);
      found.push(value);
      index += 1;
    }
  if (found.length > 1)
    throw new Error(`${name} may be supplied exactly once.`);
  return found[0];
};

const count = (name: string): number | undefined => {
  const value = one(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isFinite(parsed) === false || Number.isInteger(parsed) === false)
    throw new Error(`${name} must be one whole number.`);
  return parsed;
};

const shot = one("--shot");
if (shot === undefined || shot.trim() === "")
  throw new Error("inspect requires --shot <compiled-shot-id>.");
const subject = one("--subject");
if (subject === undefined || subject.trim() === "")
  throw new Error(
    "inspect requires --subject <kind:id>, the same stable id the compiled shot queries hand back.",
  );

// The capture host is left unset on purpose. This command draws through the
// inspection instrument, not through the delivery frame capture, and handing
// the context a capture would offer a second way to photograph the same
// subject whose bytes a delivery review must never accept.
const context = new AutoMovieProductionContext(
  undefined,
  projectRoot,
  productionId,
);
const inspection = new AutoMovieProductionSubjectInspectionService(
  inspectProductionSubject,
);
const answer = await inspection.inspect(context.forProduction(productionId), {
  shot,
  subject,
  azimuthCount: count("--azimuth-count"),
  elevationsDeg: one("--elevations-deg")
    ?.split(",")
    .map((value) => {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed) === false)
        throw new Error("--elevations-deg must be comma-separated numbers.");
      return parsed;
    }),
  height: count("--height"),
  width: count("--width"),
});
process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
// The verdict is the exit code, so a shell that runs this in a chain stops on a
// refusal rather than reading a printed failure as a success.
if (answer.inspected === false) process.exitCode = 1;
