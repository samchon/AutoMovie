import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { isolatedFileSystemTest } from "../internal/testFileSystem";
import { productionFixture } from "./productionFixtures";

/**
 * A compiler-owned publish survives a held handle, and says so when it cannot.
 *
 * Opening a production writes `automovie/productions.json` through the atomic
 * publish, inside the constructor, so this is the first thing every command
 * that touches a project does. On Windows that publish is a rename onto an
 * existing path, and a rename onto an existing path fails outright while
 * anything else holds a handle on it: a scanner reading what the compiler just
 * wrote, the indexer, a viewer page, a sibling command a second ahead. POSIX
 * renames over an open file without complaint, so nothing on that side of the
 * suite would ever have caught this.
 *
 * It was measured rather than imagined. A compile in a sandbox died on
 * `EPERM: operation not permitted, rename 'automovie/productions.json.tmp.…'`,
 * left the generated manifest describing an input the project no longer had,
 * and the next command refused with `generated-stale` telling the author to run
 * the compile that had just died. One transient collision, one confident and
 * wrong instruction.
 *
 * The publish therefore retries a contended code and gives up on anything else.
 * Both halves are load-bearing: retrying an error the code does not understand
 * would turn a clear refusal into a slow one, and not retrying the contended
 * one leaves a project describing an input it no longer has.
 *
 * Scenarios:
 *
 * 1. A publish that collides twice and then succeeds opens the project, and the
 *    file it published holds the bytes it meant to publish rather than a
 *    half-written temporary.
 * 2. A code outside the contended set is refused on the **first** attempt and
 *    surfaces unchanged, which is the negative twin: the retry must not be a
 *    blanket one. The attempt count is asserted, because an error that merely
 *    survives five attempts and arrives unchanged looks identical here.
 * 3. A contended code that outlives every attempt surfaces as an aggregate that
 *    carries the original error and names the file that did not land, so an
 *    author reads what happened instead of an unhandled stack trace.
 * 4. A final attempt that changes from contention to an unrelated failure
 *    preserves that last refusal instead of misreporting exhausted contention.
 */
const runProjectAtomicContention = (fileSystem: typeof fs): void => {
  const fixture = productionFixture();
  const nativeRename = fs.renameSync;
  try {
    const target = path.resolve(
      path.join(fixture.root, "automovie/productions.json"),
    );
    const isTarget = (destination: fs.PathLike): boolean =>
      path.resolve(destination.toString()) === target;

    const contended = (code: string): NodeJS.ErrnoException =>
      Object.assign(
        new Error(
          `${code}: operation not permitted, rename to ${path.basename(target)}`,
        ),
        { code },
      );

    /**
     * Hold the target's publish `failures` times, then let it through.
     *
     * `attempts` counts every rename onto the target and `landed` records the
     * count at the moment the first one succeeded. Opening a project publishes
     * the registry more than once, so a bare total would pin how many times
     * `open` happens to write rather than the retry policy this case is about.
     */
    const patch = (
      failures: number,
      code: string,
    ): { attempts: () => number; landed: () => number } => {
      let attempts = 0;
      let landed = 0;
      fileSystem.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
        if (isTarget(to) === false) return nativeRename(from, to);
        attempts += 1;
        if (attempts <= failures) throw contended(code);
        if (landed === 0) landed = attempts;
        return nativeRename(from, to);
      }) as typeof fs.renameSync;
      return { attempts: () => attempts, landed: () => landed };
    };

    const survived = patch(2, "EPERM");
    AutoMovieProductionProject.open(fixture.root, PRODUCTION);
    TestValidator.equals(
      "a publish held twice lands on its third attempt",
      survived.landed(),
      3,
    );
    TestValidator.equals(
      "the publish that landed left valid state and no temporary",
      namedFacts([
        [
          "the published file is valid json rather than a torn write",
          () =>
            (
              JSON.parse(fs.readFileSync(target, "utf8")) as {
                productions?: unknown;
              }
            ).productions instanceof Array,
        ],
        [
          "no temporary was left behind",
          () =>
            fs
              .readdirSync(path.dirname(target))
              .some((entry) => entry.includes(".tmp.")) === false,
        ],
      ]),
      {
        "the published file is valid json rather than a torn write": true,
        "no temporary was left behind": true,
      },
    );

    const foreign = patch(Number.MAX_SAFE_INTEGER, "ENOSPC");
    TestValidator.equals(
      "a code the publish does not understand is refused on the first attempt",
      namedFacts([
        [
          "it surfaces unchanged",
          () =>
            refusal(() =>
              AutoMovieProductionProject.open(fixture.root, PRODUCTION),
            )?.code === "ENOSPC",
        ],
        ["it was never retried", () => foreign.attempts() === 1],
      ]),
      { "it surfaces unchanged": true, "it was never retried": true },
    );

    const exhausted = patch(Number.MAX_SAFE_INTEGER, "EBUSY");
    const gave = refusal(() =>
      AutoMovieProductionProject.open(fixture.root, PRODUCTION),
    );
    TestValidator.equals(
      "a contended publish that never lands names the file and keeps the cause",
      namedFacts([
        ["every attempt was spent", () => exhausted.attempts() === 5],
        [
          "it aggregates rather than substitutes",
          () => gave instanceof AggregateError,
        ],
        [
          "the original error is carried",
          () =>
            gave instanceof AggregateError &&
            (gave.errors[0] as NodeJS.ErrnoException | undefined)?.code ===
              "EBUSY",
        ],
        [
          "the message names the file that did not land",
          () => (gave?.message ?? "").includes("productions.json"),
        ],
        [
          "the message says the project may now describe an older input",
          () =>
            (gave?.message ?? "").includes(
              "may still describe an input it no longer has",
            ),
        ],
      ]),
      {
        "every attempt was spent": true,
        "it aggregates rather than substitutes": true,
        "the original error is carried": true,
        "the message names the file that did not land": true,
        "the message says the project may now describe an older input": true,
      },
    );

    let changedAttempts = 0;
    fileSystem.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (isTarget(to) === false) return nativeRename(from, to);
      changedAttempts += 1;
      throw contended(changedAttempts < 5 ? "EBUSY" : "ENOSPC");
    }) as typeof fs.renameSync;
    const changed = refusal(() =>
      AutoMovieProductionProject.open(fixture.root, PRODUCTION),
    );
    TestValidator.equals(
      "a final non-contention failure remains the actual refusal",
      {
        attempts: changedAttempts,
        code: changed?.code,
      },
      { attempts: 5, code: "ENOSPC" },
    );
  } finally {
    fileSystem.renameSync = nativeRename;
    fixture.dispose();
  }
};

export const test_production_project_atomic_contention = isolatedFileSystemTest(
  runProjectAtomicContention,
);

/** The production `productionFixture` renders. */
const PRODUCTION = "fixture-film";

/**
 * The error a call refused with, or `null` when it did not refuse.
 *
 * A case that reads a refusal must fail when the refusal stops happening, and
 * `try`/`catch` around an expression that returns normally would leave the
 * assertion reading a stale value from the previous scenario.
 */
const refusal = (
  call: () => unknown,
): (NodeJS.ErrnoException & { errors?: readonly unknown[] }) | null => {
  try {
    call();
    return null;
  } catch (error) {
    return error as NodeJS.ErrnoException & { errors?: readonly unknown[] };
  }
};
