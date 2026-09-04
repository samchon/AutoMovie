import type { AutoMovieGuidePass } from "@automovie/interface";

const PREVIEW_OPTIONS = new Set([
  "--shot",
  "--pass",
  "--time",
  "--width",
  "--height",
]);
const TURNTABLE_OPTIONS = new Set(["--asset", "--width", "--height"]);
const LINT_OPTIONS = new Set(["--scope"]);
const GUIDE_PASSES: readonly AutoMovieGuidePass[] = [
  "beauty",
  "depth",
  "mask",
  "normal",
  "outline",
  "pose",
];

const readValuedOptions = (
  command: string,
  args: readonly string[],
  allowed: ReadonlySet<string>,
): { options: ReadonlyMap<string, string>; positional: readonly string[] } => {
  const options = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < args.length; ++index) {
    const token = args[index]!;
    if (token.startsWith("--") === false) {
      positional.push(token);
      continue;
    }
    if (allowed.has(token) === false)
      throw new Error(`Unknown ${command} option "${token}".`);
    if (options.has(token))
      throw new Error(`${token} may be supplied only once for ${command}.`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${token} requires one value.`);
    options.set(token, value);
  }
  return { options, positional };
};

const requiredTarget = (
  command: "preview" | "turntable",
  option: "--shot" | "--asset",
  named: string | undefined,
  positional: string | undefined,
): string => {
  if (named !== undefined && positional !== undefined)
    throw new Error(
      `${command} cannot combine ${option} with its positional compatibility value.`,
    );
  const value = named ?? positional;
  if (value === undefined || value.trim().length === 0)
    throw new Error(`${command} requires ${option} with one non-blank value.`);
  return value;
};

const optionalPositiveInteger = (
  option: "--width" | "--height",
  value: string | undefined,
): number | undefined => {
  if (value === undefined) return undefined;
  if (/^[1-9][0-9]*$/u.test(value) === false)
    throw new Error(`${option} must be one positive whole number.`);
  const parsed = Number(value);
  if (Number.isSafeInteger(parsed) === false)
    throw new Error(`${option} must be one positive whole number.`);
  return parsed;
};

const finiteNonnegativeTime = (value: string): number => {
  if (value.trim().length === 0)
    throw new Error("--time must be one finite nonnegative number.");
  const parsed = Number(value);
  if (Number.isFinite(parsed) === false || parsed < 0)
    throw new Error("--time must be one finite nonnegative number.");
  return parsed;
};

/** Parse the complete generated preview request without opening the project. */
export const readAutoMoviePreviewArguments = (args: readonly string[]) => {
  const request = readValuedOptions("preview", args, PREVIEW_OPTIONS);
  if (request.positional.length > 2)
    throw new Error(
      `preview accepts at most two positional values; received ${request.positional.length}.`,
    );
  if (request.options.has("--time") && request.positional[0] !== undefined)
    throw new Error(
      "preview cannot combine --time with its positional compatibility value.",
    );
  const shot = requiredTarget(
    "preview",
    "--shot",
    request.options.get("--shot"),
    request.positional[1],
  );
  const passValue = request.options.get("--pass") ?? "beauty";
  if (GUIDE_PASSES.includes(passValue as AutoMovieGuidePass) === false)
    throw new Error(
      `--pass must be one of ${GUIDE_PASSES.join(", ")}; received "${passValue}".`,
    );
  return {
    shot,
    pass: passValue as AutoMovieGuidePass,
    time: finiteNonnegativeTime(
      request.options.get("--time") ?? request.positional[0] ?? "0",
    ),
    width: optionalPositiveInteger("--width", request.options.get("--width")),
    height: optionalPositiveInteger(
      "--height",
      request.options.get("--height"),
    ),
  } as const;
};

/** Parse the complete generated turntable request without opening the project. */
export const readAutoMovieTurntableArguments = (args: readonly string[]) => {
  const request = readValuedOptions("turntable", args, TURNTABLE_OPTIONS);
  if (request.positional.length > 1)
    throw new Error(
      `turntable accepts at most one positional value; received ${request.positional.length}.`,
    );
  return {
    asset: requiredTarget(
      "turntable",
      "--asset",
      request.options.get("--asset"),
      request.positional[0],
    ),
    width: optionalPositiveInteger("--width", request.options.get("--width")),
    height: optionalPositiveInteger(
      "--height",
      request.options.get("--height"),
    ),
  } as const;
};

/** Parse the complete generated lint request without opening the project. */
export const readAutoMovieLintArguments = (args: readonly string[]) => {
  const request = readValuedOptions("lint", args, LINT_OPTIONS);
  if (request.positional.length !== 0)
    throw new Error(
      `lint accepts no positional values; received ${request.positional.length}.`,
    );
  const scope = request.options.get("--scope") ?? "review";
  if (
    scope !== "design" &&
    scope !== "source" &&
    scope !== "review" &&
    scope !== "final"
  )
    throw new Error(
      `Unknown lint scope ${JSON.stringify(scope)}. Use design, source, review, or final.`,
    );
  return { scope } as const;
};

/** Refuse every token for a generated command whose schema has no arguments. */
export const assertAutoMovieNoArguments = (
  command: string,
  args: readonly string[],
): void => {
  if (args.length !== 0)
    throw new Error(
      `${command} takes no arguments; received ${args.map((value) => JSON.stringify(value)).join(", ")}.`,
    );
};
