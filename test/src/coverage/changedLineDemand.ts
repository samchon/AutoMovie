/**
 * Which coverage positions a change is answerable for.
 *
 * The gate demanded every executable position in any file the change touched.
 * `.agents/skills/development/SKILL.md` said that in its headline and then said
 * something else two paragraphs later -- bring a file to 100% "when your change
 * is what makes them reachable or newly wrong", because inherited gaps should
 * not be "a toll on the next unrelated change". The two readings part company
 * on a real file: `packages/template/scaffold/scripts/capture-browser.ts` took
 * three lines of edit this cycle, one import source and two message strings,
 * and carries 1,322 statements. The headline asked for all 1,322.
 *
 * A toll on unrelated change is not a strict gate; it is a gate that makes the
 * cheapest correct move -- opening a large untested file to fix one line --
 * cost more than leaving the line wrong. That is the behaviour it buys, and it
 * buys it in exchange for nothing, because the 1,319 statements nobody touched
 * are no better tested after the toll is paid than before.
 *
 * So the demand is the lines the change occupies. What the second reading feared
 * losing -- code a change makes newly reachable -- is not lost, and does not
 * need a judgment about reachability that no machine here could make. It falls
 * out of the demand itself: a changed line that routes into code nothing ran
 * before must be covered, in every branch it carries, and covering it runs what
 * it routes into. The transitive case is answered by the direct one.
 *
 * What is genuinely given up is a position that ran before the change and does
 * not run after it, on a line the change did not touch. Detecting that needs a
 * base reading of the same file, which is a second full suite at the merge base
 * -- an hour of CI to catch what a failing test catches first. It is named here
 * rather than left as a silent hole.
 */
export interface IChangeSpan {
  end?: { line?: number };
  start?: { line?: number };
}

/**
 * The changed lines of one file, ordered for range questions.
 *
 * A set rather than any iterable: the ordering is all this does, and taking a
 * sequence would invite a caller to hand over one carrying repeats, which the
 * search below reads correctly and no reader would expect it to.
 */
export const changedOrder = (lines: ReadonlySet<number>): number[] =>
  [...lines].sort((left, right) => left - right);

/**
 * Whether any changed line falls within `[start, end]`.
 *
 * Binary search rather than a walk over either side: a function's span can run
 * the length of a nine-thousand-line file and a cycle's diff can name hundreds
 * of lines, and the product of the two is paid once per position.
 */
export const rangeTouchesChange = (props: {
  end: number;
  order: readonly number[];
  start: number;
}): boolean => {
  let low = 0;
  let high = props.order.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (props.order[middle]! < props.start) low = middle + 1;
    else high = middle;
  }
  const found = props.order[low];
  return found !== undefined && found <= props.end;
};

/**
 * Whether the change is answerable for a position, from the lines it occupies.
 *
 * A position carrying no line at all is demanded rather than excused. An excuse
 * is a claim that the change did not reach this code, and a position nobody can
 * place offers no evidence for that claim; refusing to excuse it keeps the rule
 * a subset of the whole-file demand it replaces in every case, never a superset.
 */
export const spanIsDemanded = (props: {
  order: readonly number[];
  span: IChangeSpan | undefined;
  wholeFile?: boolean;
}): boolean => {
  if (props.wholeFile === true) return true;
  const start = props.span?.start?.line;
  const end = props.span?.end?.line;
  if (typeof start !== "number" && typeof end !== "number") return true;
  const low = typeof start === "number" ? start : end!;
  const high = typeof end === "number" && end >= low ? end : low;
  return rangeTouchesChange({ end: high, order: props.order, start: low });
};

/** Uncovered positions on lines a change did not touch, by kind. */
export interface IInheritedGaps {
  branches: number;
  functions: number;
  statements: number;
}

export const inheritedGapsAreEmpty = (gaps: IInheritedGaps): boolean =>
  gaps.branches === 0 && gaps.functions === 0 && gaps.statements === 0;

/**
 * State an excused population rather than absorbing it.
 *
 * A gate that stops counting something reads exactly like one that counted it
 * and was satisfied. These lines are the difference, and they are printed on a
 * passing run.
 */
export const describeInheritedGaps = (props: {
  file: string;
  gaps: IInheritedGaps;
}): string =>
  `INHERITED GAP: ${props.file} carries ` +
  [
    `${props.gaps.statements} statement${props.gaps.statements === 1 ? "" : "s"}`,
    `${props.gaps.branches} branch${props.gaps.branches === 1 ? "" : "es"}`,
    `${props.gaps.functions} function${props.gaps.functions === 1 ? "" : "s"}`,
  ].join(", ") +
  " uncovered on lines this change did not touch; closing them is its own work";
