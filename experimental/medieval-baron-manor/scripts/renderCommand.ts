export type ProductionRenderAction =
  | "all"
  | "plan"
  | "run"
  | "status"
  | "verify"
  | "finalize"
  | "gc";

export interface IProductionRenderCommand {
  action: ProductionRenderAction;
  apply: boolean;
  chunkFrames: number;
  deliverable: string | undefined;
  tier: "final" | "proxy";
  workers: number;
}

type ProductionRenderOption =
  | "--apply"
  | "--chunk-frames"
  | "--deliverable"
  | "--tier"
  | "--workers";

const ACTIONS = new Set<string>([
  "all",
  "plan",
  "run",
  "status",
  "verify",
  "finalize",
  "gc",
]);

const OPTIONS = new Set<string>([
  "--apply",
  "--chunk-frames",
  "--deliverable",
  "--tier",
  "--workers",
]);

const ALLOWED_OPTIONS: Record<
  ProductionRenderAction,
  ReadonlySet<ProductionRenderOption>
> = {
  all: new Set(["--chunk-frames", "--deliverable", "--tier", "--workers"]),
  plan: new Set(["--chunk-frames", "--tier"]),
  run: new Set(["--chunk-frames", "--deliverable", "--tier", "--workers"]),
  status: new Set(["--tier"]),
  verify: new Set(["--tier"]),
  finalize: new Set(["--tier"]),
  gc: new Set(["--apply"]),
};

const readAction = (
  args: readonly string[],
): { action: ProductionRenderAction; offset: number } => {
  const first = args[0];
  if (first === undefined || first.startsWith("--"))
    return { action: "all", offset: 0 };
  if (ACTIONS.has(first) === false)
    throw new Error(
      `Unknown render action "${first}". Use all, plan, run, status, verify, finalize, or gc.`,
    );
  return { action: first as ProductionRenderAction, offset: 1 };
};

const positiveInteger = (name: string, value: string): number => {
  if (/^[1-9][0-9]*$/u.test(value) === false)
    throw new Error(`${name} must be a positive integer.`);
  const parsed = Number(value);
  if (Number.isSafeInteger(parsed) === false)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

const readValuedOption = (
  args: readonly string[],
  index: number,
  option: ProductionRenderOption,
): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`${option} requires a value.`);
  return value;
};

/** Parse and execute the exact command surface shared by CLI and direct hosts. */
export const runProductionRenderCommand = async <Output>(
  args: readonly string[],
  execute: (command: IProductionRenderCommand) => Output | Promise<Output>,
): Promise<Output> => {
  const selected = readAction(args);
  const allowed = ALLOWED_OPTIONS[selected.action];
  const seen = new Set<ProductionRenderOption>();
  let apply = false;
  let chunkFrames = 48;
  let deliverable: string | undefined;
  let tier: "final" | "proxy" = "final";
  let workers = 1;
  for (let index = selected.offset; index < args.length; ++index) {
    const token = args[index]!;
    if (OPTIONS.has(token) === false) {
      if (token.startsWith("--"))
        throw new Error(`Unknown render option "${token}".`);
      throw new Error(`Unexpected render argument "${token}".`);
    }
    const option = token as ProductionRenderOption;
    if (allowed.has(option) === false)
      throw new Error(`${option} is not valid for render ${selected.action}.`);
    if (seen.has(option))
      throw new Error(`${option} may be supplied only once.`);
    seen.add(option);
    if (option === "--apply") {
      apply = true;
      continue;
    }
    const value = readValuedOption(args, index, option);
    ++index;
    if (option === "--chunk-frames")
      chunkFrames = positiveInteger(option, value);
    else if (option === "--deliverable") {
      if (value.trim().length === 0 || value.trim() !== value)
        throw new Error(
          "--deliverable must be a non-blank, unpadded deliverable id.",
        );
      deliverable = value;
    } else if (option === "--workers") workers = positiveInteger(option, value);
    else {
      if (value !== "proxy" && value !== "final")
        throw new Error('--tier must be either "proxy" or "final".');
      tier = value;
    }
  }
  return execute({
    action: selected.action,
    apply,
    chunkFrames,
    deliverable,
    tier,
    workers,
  });
};
