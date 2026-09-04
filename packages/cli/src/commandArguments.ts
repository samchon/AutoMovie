type AutoMovieRenderAction =
  | "all"
  | "plan"
  | "run"
  | "status"
  | "verify"
  | "finalize"
  | "gc";

type AutoMovieRenderOption =
  | "--apply"
  | "--chunk-frames"
  | "--deliverable"
  | "--tier"
  | "--workers";

type AutoMovieCommand =
  | { command: "help" }
  | { command: "version" }
  | {
      command: "start";
      directory: string;
      force: boolean;
      language: "chinese" | "english" | "japanese" | "korean";
    }
  | {
      command: "migrate";
      directory: string;
      mode: "apply" | "dry-run" | "rollback";
    }
  | { command: "contracts"; action: "migrate"; dryRun: boolean }
  | {
      command: "inspect-external";
      path: string;
      profile:
        | "gltf-static-v1"
        | "gltf-humanoid-v1"
        | "gltf-motion-v1"
        | "vrm-humanoid-v1";
    }
  | { command: "toc"; check: boolean }
  | { command: "routes"; kind: "film" | "brief" | "library" }
  | { command: "sync" }
  | { command: "verify" }
  | { command: "render"; arguments: readonly string[] };

const RENDER_ACTIONS = new Set<string>([
  "all",
  "plan",
  "run",
  "status",
  "verify",
  "finalize",
  "gc",
]);

const RENDER_OPTIONS = new Set<string>([
  "--apply",
  "--chunk-frames",
  "--deliverable",
  "--tier",
  "--workers",
]);

const RENDER_ALLOWED_OPTIONS: Record<
  AutoMovieRenderAction,
  ReadonlySet<AutoMovieRenderOption>
> = {
  all: new Set(["--chunk-frames", "--deliverable", "--tier", "--workers"]),
  plan: new Set(["--chunk-frames", "--tier"]),
  run: new Set(["--chunk-frames", "--deliverable", "--tier", "--workers"]),
  status: new Set(["--tier"]),
  verify: new Set(["--tier"]),
  finalize: new Set(["--tier"]),
  gc: new Set(["--apply"]),
};

const nonBlankDirectory = (
  command: string,
  value: string | undefined,
): string => {
  if (value === undefined || value.trim().length === 0)
    throw new Error(`${command} needs one non-blank target directory.`);
  return value;
};

const PRODUCTION_LANGUAGES = new Set([
  "chinese",
  "english",
  "japanese",
  "korean",
]);

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
  if (language === undefined || PRODUCTION_LANGUAGES.has(language) === false)
    throw new Error(
      "start requires --language with one of chinese, english, japanese, or korean.",
    );
  return {
    command: "start",
    directory: nonBlankDirectory("start", positionals[0]),
    force,
    language: language as Extract<
      AutoMovieCommand,
      { command: "start" }
    >["language"],
  };
};

const oneDirectory = (
  command: "start" | "migrate",
  args: readonly string[],
  allowedOptions: ReadonlySet<string>,
): { directory: string; options: ReadonlySet<string> } => {
  const positionals: string[] = [];
  const options = new Set<string>();
  for (const token of args) {
    if (token.startsWith("-")) {
      if (allowedOptions.has(token) === false)
        throw new Error(
          `Unknown or inapplicable ${command} option "${token}".`,
        );
      if (options.has(token))
        throw new Error(`${token} may be supplied only once for ${command}.`);
      options.add(token);
    } else positionals.push(token);
  }
  if (positionals.length > 1)
    throw new Error(
      `${command} accepts exactly one target directory; received ${positionals.length}.`,
    );
  return {
    directory: nonBlankDirectory(command, positionals[0]),
    options,
  };
};

const positiveInteger = (option: string, value: string): void => {
  if (/^[1-9][0-9]*$/u.test(value) === false)
    throw new Error(`${option} must be a positive integer.`);
  if (Number.isSafeInteger(Number(value)) === false)
    throw new Error(`${option} must be a positive integer.`);
};

const renderArguments = (args: readonly string[]): readonly string[] => {
  const action = args[0];
  if (action === undefined || RENDER_ACTIONS.has(action) === false)
    throw new Error(
      `render needs one of all, plan, run, status, verify, finalize, or gc; received ${JSON.stringify(action ?? "")}.`,
    );
  const allowed = RENDER_ALLOWED_OPTIONS[action as AutoMovieRenderAction];
  const seen = new Set<AutoMovieRenderOption>();
  for (let index = 1; index < args.length; ++index) {
    const token = args[index]!;
    if (RENDER_OPTIONS.has(token) === false) {
      if (token.startsWith("--"))
        throw new Error(`Unknown render option "${token}".`);
      throw new Error(`Unexpected render argument "${token}".`);
    }
    const option = token as AutoMovieRenderOption;
    if (allowed.has(option) === false)
      throw new Error(`${option} is not valid for render ${action}.`);
    if (seen.has(option))
      throw new Error(`${option} may be supplied only once.`);
    seen.add(option);
    if (option === "--apply") continue;
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${option} requires a value.`);
    if (option === "--chunk-frames" || option === "--workers")
      positiveInteger(option, value);
    else if (option === "--deliverable") {
      if (value.trim().length === 0 || value.trim() !== value)
        throw new Error(
          "--deliverable must be a non-blank, unpadded deliverable id.",
        );
    } else if (value !== "proxy" && value !== "final")
      throw new Error('--tier must be either "proxy" or "final".');
  }
  return [...args];
};

/**
 * Resolve one complete CLI request into a closed command-specific operation
 * plan before any target, project, migration, or generated script is opened.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work Refuses ambiguous or unconsumed command input before work starts.
 * @evidence specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision Produces the typed admission plan that is the only input to dispatch.
 * @evidencePart specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision::admission-decision
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
  if (command === "migrate") {
    const request = oneDirectory(
      "migrate",
      rest,
      new Set(["--dry-run", "--rollback"]),
    );
    if (request.options.has("--dry-run") && request.options.has("--rollback"))
      throw new Error("migrate accepts only one of --dry-run or --rollback.");
    return {
      command,
      directory: request.directory,
      mode: request.options.has("--rollback")
        ? ("rollback" as const)
        : request.options.has("--dry-run")
          ? ("dry-run" as const)
          : ("apply" as const),
    } as const;
  }
  if (command === "contracts") {
    const [action, ...options] = rest;
    if (action !== "migrate")
      throw new Error('contracts needs the "migrate" action.');
    if (
      options.some((option) => option !== "--dry-run") ||
      options.filter((option) => option === "--dry-run").length > 1
    )
      throw new Error("contracts migrate accepts --dry-run at most once.");
    return {
      command,
      action,
      dryRun: options.includes("--dry-run"),
    } as const;
  }
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
    const profiles = new Set([
      "gltf-static-v1",
      "gltf-humanoid-v1",
      "gltf-motion-v1",
      "vrm-humanoid-v1",
    ]);
    if (profile === undefined || profiles.has(profile) === false)
      throw new Error(
        "inspect-external requires --profile with one supported ingest profile.",
      );
    return {
      command,
      path: positionals[0]!,
      profile: profile as Extract<
        AutoMovieCommand,
        { command: "inspect-external" }
      >["profile"],
    } as const;
  }
  if (command === "routes") {
    if (
      rest.length !== 1 ||
      (rest[0] !== "film" && rest[0] !== "brief" && rest[0] !== "library")
    )
      throw new Error("routes needs exactly one of film, brief, or library.");
    return { command, kind: rest[0] } as const;
  }
  if (command === "sync" || command === "verify") {
    if (rest.length !== 0) throw new Error(`${command} takes no arguments.`);
    return { command } as const;
  }
  if (command === "render")
    return { command, arguments: renderArguments(rest) } as const;
  throw new Error(`Unknown command ${JSON.stringify(command ?? "")}.`);
};

/**
 * Invoke a dispatcher only after the complete command request has been
 * admitted, leaving invalid input with no opportunity to perform side effects.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work Prevents rejected argv from reaching a stateful successor.
 * @evidence specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision Makes successful parsing the predecessor of every dispatched operation.
 * @evidencePart specifications/execution-and-recovery/state-machine-and-admission.md#execution-admission-decision::admission-decision
 */
export const dispatchAutoMovieCommandArguments = <Output>(
  args: readonly string[],
  dispatch: (
    command: ReturnType<typeof readAutoMovieCommandArguments>,
  ) => Output,
): Output => dispatch(readAutoMovieCommandArguments(args));
