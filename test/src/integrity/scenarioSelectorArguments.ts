export interface IScenarioSelectorArguments {
  include: string[];
  exclude: string[];
}

export class ScenarioSelectorArgumentError extends Error {}

type ScenarioSelectorGroup = keyof IScenarioSelectorArguments;

const groupOf = (argument: string): ScenarioSelectorGroup | null =>
  argument === "--include"
    ? "include"
    : argument === "--exclude"
      ? "exclude"
      : null;

const equalGroupOf = (
  argument: string,
): { group: ScenarioSelectorGroup; value: string } | null => {
  for (const group of ["include", "exclude"] as const) {
    const prefix = `--${group}=`;
    if (argument.startsWith(prefix))
      return { group, value: argument.slice(prefix.length) };
  }
  return null;
};

const requireTerm = (option: string, term: string): string => {
  const normalized = term.trim();
  if (normalized.length === 0)
    throw new ScenarioSelectorArgumentError(
      `${option} requires at least one nonblank scenario term`,
    );
  return normalized;
};

/** Parse the complete test-selector argv before scenario discovery begins. */
export const parseScenarioSelectorArguments = (
  argv: readonly string[],
): IScenarioSelectorArguments => {
  const parsed: IScenarioSelectorArguments = { include: [], exclude: [] };
  for (let index = 0; index < argv.length; ) {
    const argument = argv[index]!;
    const equal = equalGroupOf(argument);
    if (equal !== null) {
      parsed[equal.group].push(requireTerm(`--${equal.group}`, equal.value));
      ++index;
      continue;
    }
    const group = groupOf(argument);
    if (group === null)
      throw new ScenarioSelectorArgumentError(
        argument.startsWith("--")
          ? `unknown test selector option "${argument}"`
          : `scenario term "${argument}" appears outside --include or --exclude`,
      );
    const option = `--${group}`;
    const start = ++index;
    while (index < argv.length && argv[index]!.startsWith("--") === false) {
      parsed[group].push(requireTerm(option, argv[index]!));
      ++index;
    }
    if (index === start)
      throw new ScenarioSelectorArgumentError(
        `${option} requires at least one nonblank scenario term`,
      );
  }
  return parsed;
};
