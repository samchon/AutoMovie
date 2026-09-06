/**
 * A complete request, before any scenario discovery or execution.
 *
 * @author Samchon
 */
export interface IScenarioSelection {
  include: string[];
  exclude: string[];
}

/**
 * Admit each argv token without silently widening an incomplete request.
 *
 * Space-separated groups require at least one term per occurrence. Equals
 * options carry exactly one term, and repeated groups accumulate in order.
 */
export const parseScenarioSelection = (
  argv: readonly string[],
): IScenarioSelection => {
  const selection: IScenarioSelection = { include: [], exclude: [] };
  let group: "include" | "exclude" | undefined;
  let count = 0;
  const finishGroup = (): void => {
    if (group !== undefined && count === 0)
      throw new Error(`--${group} requires at least one nonblank term.`);
  };
  const append = (key: "include" | "exclude", value: string): void => {
    if (value.trim().length === 0 || value.startsWith("-"))
      throw new Error(
        `--${key} requires a nonblank term, not ${JSON.stringify(value)}.`,
      );
    selection[key].push(value);
  };
  for (const argument of argv) {
    if (argument.startsWith("-")) {
      finishGroup();
      const option = /^--(include|exclude)(?:=([\s\S]*))?$/u.exec(argument);
      if (option === null)
        throw new Error(`Unexpected argument ${JSON.stringify(argument)}.`);
      const key = option[1] as "include" | "exclude";
      if (option[2] !== undefined) {
        append(key, option[2]);
        group = undefined;
      } else {
        group = key;
        count = 0;
      }
    } else {
      if (group === undefined)
        throw new Error(`Unexpected argument ${JSON.stringify(argument)}.`);
      append(group, argument);
      ++count;
    }
  }
  finishGroup();
  return selection;
};

/** Every requested term must name a discovered module, and some module must remain. */
export const selectScenarioNames = (
  selection: IScenarioSelection,
  names: readonly string[],
): Set<string> => {
  for (const key of ["include", "exclude"] as const)
    for (const term of selection[key])
      if (names.some((name) => name.includes(term)) === false)
        throw new Error(
          `--${key} term ${JSON.stringify(term)} matched no scenario.`,
        );
  const selected = new Set(
    names.filter(
      (name) =>
        (selection.include.length === 0 ||
          selection.include.some((term) => name.includes(term))) &&
        selection.exclude.every((term) => !name.includes(term)),
    ),
  );
  if (selected.size === 0)
    throw new Error("The scenario selection matched nothing.");
  return selected;
};

/**
 * Resolve one admitted request through a discovery-only basename filter.
 *
 * Returning false to discovery prevents module imports under the executor's
 * public filter contract. The second pass may execute only the frozen selection.
 */
export const prepareScenarioFilter = async (
  argv: readonly string[],
  discover: (filter: (name: string) => boolean) => Promise<unknown>,
): Promise<(name: string) => boolean> => {
  const selection = parseScenarioSelection(argv);
  const names: string[] = [];
  await discover((name) => {
    names.push(name);
    return false;
  });
  const selected = selectScenarioNames(selection, names);
  return (name) => selected.has(name);
};
