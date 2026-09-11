import { TestValidator } from "@nestia/e2e";

import {
  GENERATED_STALE,
  SOURCE_FAILURE,
  answerOf,
  createSourceStatusWorld,
  runsPerCall,
} from "./sourceStatusFixtures";

/** Run one status call and return what it threw, or `undefined`. */
const thrownBy = (task: () => unknown): unknown => {
  try {
    task();
    return undefined;
  } catch (error) {
    return error;
  }
};

/**
 * A failed, thrown or unobservable gate answer is never reused.
 *
 * Reuse is a claim that the current project still passes the gate. A failure
 * carries the diagnostics an author corrects from, so it must come from a run at
 * every boundary rather than from memory. An exception carries its own cause and
 * must propagate as itself. A snapshot the project refuses to give, or cannot
 * give completely, proves nothing about the inputs, so it can only run the gate.
 *
 * Scenarios:
 *
 * 1. An invalid source runs the gate and returns its diagnostic at each of three
 *    boundaries.
 * 2. After a reused success, an invalid edit returns the new failure rather than
 *    the reused success, and the next boundary runs the gate again.
 * 3. A gate exception propagates as the same error object, and the next boundary
 *    over the original inputs runs the gate again instead of returning the
 *    answer reused before the exception.
 * 4. A refused project read beside a gate that refuses the same way propagates
 *    the gate's error. A refused read beside a gate success returns that success
 *    at every boundary without reusing it, until a complete read lets it be
 *    reused.
 * 5. A snapshot that cannot be completed runs the gate at every boundary.
 * 6. A success that executed a project module outside the fingerprinted content
 *    runs the gate at every boundary, and the same success without that module
 *    is reused.
 */
export const test_production_source_status_refusal = (): void => {
  const invalid = createSourceStatusWorld();
  invalid.state.valid = false;
  const failing = runsPerCall(invalid, invalid.status(), 3);
  const failure = answerOf(invalid.state, [SOURCE_FAILURE]);
  TestValidator.equals(
    "an invalid source runs the gate and reports it at every boundary",
    failing,
    { runs: [1, 1, 1], answers: [failure, failure, failure] },
  );

  const broken = createSourceStatusWorld();
  const brokenStatus = broken.status();
  const reused = runsPerCall(broken, brokenStatus, 2);
  broken.state.source = "export const opening = defineShot(undefined);\n";
  broken.state.valid = false;
  const afterEdit = runsPerCall(broken, brokenStatus, 2);
  const brokenAnswer = answerOf(broken.state, [
    SOURCE_FAILURE,
    GENERATED_STALE,
  ]);
  TestValidator.equals(
    "an invalid edit never inherits the reused success",
    { reused: reused.runs, afterEdit },
    {
      reused: [1, 0],
      afterEdit: { runs: [1, 1], answers: [brokenAnswer, brokenAnswer] },
    },
  );

  const crashing = createSourceStatusWorld();
  const crashingStatus = crashing.status();
  crashingStatus();
  const original = crashing.state.source;
  const crash = new Error("shot program threw while the gate ran");
  crashing.state.source = "export const opening = explode();\n";
  crashing.hooks.beforeRead = () => {
    throw crash;
  };
  const thrown = thrownBy(crashingStatus);
  crashing.hooks.beforeRead = () => undefined;
  crashing.state.source = original;
  const recovered = runsPerCall(crashing, crashingStatus, 2);
  TestValidator.equals(
    "a gate exception propagates and drops the reused answer",
    { sameError: thrown === crash, recovered: recovered.runs },
    { sameError: true, recovered: [1, 0] },
  );

  const replaced = createSourceStatusWorld();
  const replacedStatus = replaced.status();
  replacedStatus();
  const race = new Error("Production project root identity changed.");
  replaced.hooks.acquire = () => {
    throw race;
  };
  replaced.hooks.beforeRead = () => {
    throw race;
  };
  const refusedTogether = thrownBy(replacedStatus);
  replaced.hooks.beforeRead = () => undefined;
  const refusedRead = runsPerCall(replaced, replacedStatus, 2);
  replaced.hooks.acquire = () => undefined;
  const readRestored = runsPerCall(replaced, replacedStatus, 2);
  const success = answerOf(replaced.state, []);
  TestValidator.equals(
    "a refused project read only ever runs the gate",
    {
      sameError: refusedTogether === race,
      refusedRead,
      readRestored: readRestored.runs,
    },
    {
      sameError: true,
      refusedRead: { runs: [1, 1], answers: [success, success] },
      readRestored: [1, 0],
    },
  );

  const incomplete = createSourceStatusWorld();
  const incompleteStatus = incomplete.status();
  incompleteStatus();
  incomplete.state.incomplete = true;
  TestValidator.equals(
    "an incomplete snapshot runs the gate at every boundary",
    runsPerCall(incomplete, incompleteStatus, 2).runs,
    [1, 1],
  );

  const undeclared = createSourceStatusWorld();
  undeclared.state.undeclaredModules = ["lint.config.ts"];
  const undeclaredStatus = undeclared.status();
  const withUndeclared = runsPerCall(undeclared, undeclaredStatus, 3).runs;
  undeclared.state.undeclaredModules = [];
  TestValidator.equals(
    "an executed module outside the fingerprinted content blocks reuse",
    {
      withUndeclared,
      declared: runsPerCall(undeclared, undeclaredStatus, 2).runs,
    },
    { withUndeclared: [1, 1, 1], declared: [1, 0] },
  );
};
