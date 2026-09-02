/**
 * Refuse a scenario filter that selected nothing.
 *
 * `--include test_this_does_not_exist` printed `0/0 passed`, `All tests
 * passed`, and exited 0. A caller asking for a named subset must not receive a
 * green result when that subset does not exist.
 *
 * Each requested term is judged on its own rather than the selection as a
 * whole, because `--include a b` where only `a` matches still runs something
 * and still means `b` was a typo. The population compared against is every name
 * the discovery walked, not the surviving one, so an `--exclude` term that
 * excludes nothing is caught by the same rule.
 */
export interface IScenarioSelection {
  /** Every scenario name the discovery offered, before filtering. */
  discovered: readonly string[];
  /** Terms requested with `--exclude`. */
  exclude: readonly string[];
  /** Terms requested with `--include`. */
  include: readonly string[];
  /** How many scenarios actually ran. */
  selected: number;
}

export const scenarioSelectionDiagnostics = (
  selection: IScenarioSelection,
): string[] => {
  const diagnostics: string[] = [];
  const unmatched = (terms: readonly string[]): string[] =>
    terms.filter(
      (term) =>
        selection.discovered.some((name) => name.includes(term)) === false,
    );
  for (const term of unmatched(selection.include))
    diagnostics.push(
      `--include ${term} names no scenario among the ${selection.discovered.length} discovered; correct the term or restore the scenario`,
    );
  for (const term of unmatched(selection.exclude))
    diagnostics.push(
      `--exclude ${term} names no scenario among the ${selection.discovered.length} discovered, so it excluded nothing`,
    );
  // A filter was asked for and everything it left was removed by the other
  // half. Each term matched something, so no term is wrong; the combination is.
  if (
    diagnostics.length === 0 &&
    selection.selected === 0 &&
    (selection.include.length !== 0 || selection.exclude.length !== 0)
  )
    diagnostics.push(
      `the requested filter selected none of the ${selection.discovered.length} discovered scenarios`,
    );
  return diagnostics;
};
