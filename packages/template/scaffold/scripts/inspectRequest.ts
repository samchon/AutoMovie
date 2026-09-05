/**
 * What `npm run inspect` was asked for, read out of one argument list.
 *
 * Split from the command so the request can be read without standing up a Vite
 * server and a browser. `inspect.ts` imports the inspection instrument, which
 * imports both at module level, so nothing in this project could load the
 * command to see what it does with a flag; and every refusal below was
 * written and never read.
 *
 * The request is a value, so nothing here draws anything. What it decides is
 * which subject of which shot, and the four overrides that exist for a subject
 * the derived sweep genuinely cannot frame. It does not decide the viewpoints:
 * the service derives the sweep from the subject's own bounds and the topology
 * it belongs to, which is the property that makes an inspection mean something,
 * since an author who could choose the angles could choose flattering ones.
 */
export interface IAutoMovieInspectRequest {
  /** The compiled shot the subject is staged in. */
  shot: string;
  /** The stable `kind:id` the compiled shot queries hand back. */
  subject: string;
  /** How many azimuths to sweep, or undefined to let the service decide. */
  azimuthCount: number | undefined;
  /** Elevations in degrees, or undefined to let the service decide. */
  elevationsDeg: number[] | undefined;
  /** Frame height in pixels, or undefined for the service's own. */
  height: number | undefined;
  /** Frame width in pixels, or undefined for the service's own. */
  width: number | undefined;
}

const INSPECT_OPTIONS = new Set([
  "--shot",
  "--subject",
  "--azimuth-count",
  "--elevations-deg",
  "--height",
  "--width",
]);

/**
 * The one value given for a flag, or undefined when it was not given.
 *
 * A flag repeated is refused rather than resolved by read order: two answers to
 * one question is a mistake in the command line, and picking either one hides
 * it. A flag whose value is missing or is itself another flag is refused for
 * the same reason; `--shot --subject x` would otherwise inspect a shot named
 * `--subject`.
 */
const one = (argv: readonly string[], name: string): string | undefined => {
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

/** One positive whole number, because a fractional or empty sample is not a view. */
const count = (argv: readonly string[], name: string): number | undefined => {
  const value = one(argv, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (
    Number.isFinite(parsed) === false ||
    Number.isInteger(parsed) === false ||
    parsed <= 0
  )
    throw new Error(`${name} must be one positive whole number.`);
  return parsed;
};

/** Read one inspection request, refusing every malformed argument by name. */
export const readAutoMovieInspectRequest = (
  argv: readonly string[],
): IAutoMovieInspectRequest => {
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    if (INSPECT_OPTIONS.has(name) === false)
      throw new Error(`Unknown inspect option ${JSON.stringify(name)}.`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${name} requires one value.`);
  }
  const shot = one(argv, "--shot");
  if (shot === undefined || shot.trim() === "")
    throw new Error("inspect requires --shot <compiled-shot-id>.");
  const subject = one(argv, "--subject");
  if (subject === undefined || subject.trim() === "")
    throw new Error(
      "inspect requires --subject <kind:id>, the same stable id the compiled shot queries hand back.",
    );
  return {
    shot,
    subject,
    azimuthCount: count(argv, "--azimuth-count"),
    elevationsDeg: one(argv, "--elevations-deg")
      ?.split(",")
      .map((value) => {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed === "")
          throw new Error("--elevations-deg must be comma-separated numbers.");
        if (Number.isFinite(parsed) === false)
          throw new Error("--elevations-deg must be comma-separated numbers.");
        return parsed;
      }),
    height: count(argv, "--height"),
    width: count(argv, "--width"),
  };
};
