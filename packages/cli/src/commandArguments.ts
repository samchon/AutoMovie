import {
  type AutoMovieProductionLanguage,
  isAutoMovieProductionLanguage,
} from "@automovie/evidence";
import {
  AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES,
  type AutoMovieExternalModelIngestProfile,
  isAutoMovieExternalModelIngestProfile,
} from "@automovie/ingest";
import {
  AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS,
  type AutoMovieAuthoringProductionKind,
  isAutoMovieAuthoringProductionKind,
} from "@automovie/template";

type AutoMovieCommand =
  | { command: "help" }
  | { command: "version" }
  | {
      command: "start";
      directory: string;
      force: boolean;
      language: AutoMovieProductionLanguage;
    }
  | {
      command: "inspect-external";
      path: string;
      profile: AutoMovieExternalModelIngestProfile;
    }
  | { command: "toc"; check: boolean }
  | { command: "routes"; kind: AutoMovieAuthoringProductionKind }
  | { command: "sync" };

const nonBlankDirectory = (
  command: string,
  value: string | undefined,
): string => {
  if (value === undefined || value.trim().length === 0)
    throw new Error(`${command} needs one non-blank target directory.`);
  return value;
};

const startArguments = (
  args: readonly string[],
): Extract<AutoMovieCommand, { command: "start" }> => {
  const positionals: string[] = [];
  let force = false;
  let language: string | undefined;
  for (let index = 0; index < args.length; ++index) {
    const token = args[index]!;
    if (token === "--force") {
      if (force)
        throw new Error("--force may be supplied only once for start.");
      force = true;
    } else if (token === "--language") {
      if (language !== undefined)
        throw new Error("--language may be supplied only once for start.");
      language = args[++index];
      if (language === undefined || language.startsWith("-"))
        throw new Error("--language requires a value.");
    } else if (token.startsWith("-"))
      throw new Error(`Unknown or inapplicable start option "${token}".`);
    else positionals.push(token);
  }
  if (positionals.length > 1)
    throw new Error(
      `start accepts exactly one target directory; received ${positionals.length}.`,
    );
  if (isAutoMovieProductionLanguage(language) === false)
    throw new Error(
      "start requires --language with one of chinese, english, japanese, or korean.",
    );
  return {
    command: "start",
    directory: nonBlankDirectory("start", positionals[0]),
    force,
    language,
  };
};

/**
 * Resolve one complete CLI request into a closed command-specific operation
 * plan before any target, project, migration, or generated script is opened.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work Refuses ambiguous or unconsumed command input before work starts.
 * @evidence specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision Produces the typed admission plan that is the only input to dispatch.
 */
export const readAutoMovieCommandArguments = (
  args: readonly string[],
): AutoMovieCommand => {
  if (
    args.length === 0 ||
    (args.length === 1 && ["-h", "--help"].includes(args[0]!))
  )
    return { command: "help" } as const;
  if (args.length === 1 && ["-v", "--version"].includes(args[0]!))
    return { command: "version" } as const;

  const [command, ...rest] = args;
  if (command === "start") return startArguments(rest);
  if (command === "toc") {
    if (rest.some((option) => option !== "--check") || rest.length > 1)
      throw new Error("toc accepts --check at most once.");
    return { command, check: rest.includes("--check") } as const;
  }
  if (command === "inspect-external") {
    const positionals: string[] = [];
    let profile: string | undefined;
    for (let index = 0; index < rest.length; ++index) {
      const token = rest[index]!;
      if (token === "--profile") {
        if (profile !== undefined)
          throw new Error("--profile may be supplied only once.");
        profile = rest[++index];
        if (profile === undefined || profile.startsWith("-"))
          throw new Error("--profile requires a value.");
      } else if (token.startsWith("-"))
        throw new Error(
          `Unknown or inapplicable inspect-external option "${token}".`,
        );
      else positionals.push(token);
    }
    if (positionals.length !== 1)
      throw new Error(
        `inspect-external accepts exactly one source path; received ${positionals.length}.`,
      );
    if (isAutoMovieExternalModelIngestProfile(profile) === false)
      throw new Error(
        `inspect-external requires --profile naming one supported ingest profile: ${AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES.join(", ")}.`,
      );
    return {
      command,
      path: positionals[0]!,
      profile,
    } as const;
  }
  if (command === "routes") {
    const kind = rest[0];
    if (rest.length !== 1 || isAutoMovieAuthoringProductionKind(kind) === false)
      throw new Error(
        `routes needs exactly one of ${AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS.join(", ")}.`,
      );
    return { command, kind } as const;
  }
  if (command === "sync") {
    if (rest.length !== 0) throw new Error(`${command} takes no arguments.`);
    return { command } as const;
  }
  throw new Error(`Unknown command ${JSON.stringify(command ?? "")}.`);
};

/**
 * Invoke a dispatcher only after the complete command request has been
 * admitted, leaving invalid input with no opportunity to perform side effects.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work Prevents rejected argv from reaching a stateful successor.
 * @evidence specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision Makes successful parsing the predecessor of every dispatched operation.
 */
export const dispatchAutoMovieCommandArguments = <Output>(
  args: readonly string[],
  dispatch: (
    command: ReturnType<typeof readAutoMovieCommandArguments>,
  ) => Output,
): Output => dispatch(readAutoMovieCommandArguments(args));
