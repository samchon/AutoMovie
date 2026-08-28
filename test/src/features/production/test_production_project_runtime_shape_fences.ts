import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

interface IFenceCleanupFailure {
  error: unknown;
}

class FenceCleanupError extends AggregateError {}

const preserveFenceCleanup = (
  failure: IFenceCleanupFailure | undefined,
  cleanup: () => void,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new FenceCleanupError(
      [failure.error, cleanupFailure],
      `${resource} cleanup failed after the fence assertion failed.`,
    );
  }
};

const isInputRace = (task: () => unknown): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof AutoMovieProductionInputRaceError;
  }
};

const changedPhysicalIdentity = (task: () => unknown): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      error.message.includes("changed physical identity")
    );
  }
};

/**
 * Exercise optimistic and physical identity fences through real concurrent
 * filesystem states. Replacement namespaces carry sentinel bytes, proving a
 * stale handle refused rather than following or cleaning the new resident.
 *
 * Scenarios:
 *
 * 1. Two sessions demonstrate stale revision refusal, absent losing bytes, and
 *    successful re-read/retry.
 * 2. Incarnation and registry changes invalidate live handles.
 * 3. Generated namespace and whole-project replacement refuse stale reads and
 *    preserve replacement sentinels.
 * 4. Replacement during a guarded commit aggregates the input race with the
 *    physical namespace failure and performs no stale rollback or cleanup.
 */
export const test_production_project_runtime_shape_fences = (): void => {
  const staleRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-project-stale-revision-"),
  );
  let staleFailure: IFenceCleanupFailure | undefined;
  try {
    const first = AutoMovieProductionProject.open(staleRoot, "alpha");
    const second = AutoMovieProductionProject.open(staleRoot, "alpha");
    second.commitProductionDeliverableFiles(
      "winner",
      new Map([["winner.txt", Buffer.from("winner")]]),
    );
    TestValidator.predicate(
      "stale writer refuses after a sibling session commits",
      isInputRace(() =>
        first.commitProductionDeliverableFiles(
          "loser",
          new Map([["loser.txt", Buffer.from("loser")]]),
        ),
      ),
    );
    TestValidator.equals(
      "stale refusal publishes no losing bytes",
      fs.existsSync(
        path.join(staleRoot, "renders/alpha/deliverables/loser/loser.txt"),
      ),
      false,
    );
    first.revision();
    const rebased = first.commitProductionDeliverableFiles(
      "loser",
      new Map([["loser.txt", Buffer.from("rebased")]]),
    );
    TestValidator.predicate(
      "re-read negative twin commits the same addressed write",
      rebased.revision > 0 &&
        Buffer.from(first.readRenderFile(rebased.paths[0]!)).toString(
          "utf8",
        ) === "rebased",
    );
  } catch (error) {
    staleFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(
      staleFailure,
      () => fs.rmSync(staleRoot, { force: true, recursive: true }),
      "Stale-revision fixture",
    );
  }

  const incarnation = productionFixture();
  let incarnationFailure: IFenceCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      incarnation.root,
      "fixture-film",
    );
    const file = path.join(incarnation.root, "automovie/incarnation.json");
    fs.writeFileSync(
      file,
      `${JSON.stringify({
        version: 1,
        id: "00000000-0000-4000-8000-000000000001",
      })}\n`,
    );
    TestValidator.predicate(
      "changed state incarnation invalidates the live handle",
      isInputRace(() => project.revision()),
    );
  } catch (error) {
    incarnationFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(
      incarnationFailure,
      incarnation.dispose,
      "Incarnation fixture",
    );
  }

  const registry = productionFixture();
  let registryFailure: IFenceCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      registry.root,
      "fixture-film",
    );
    const file = path.join(registry.root, "automovie/productions.json");
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as {
      productions: string[];
      incarnations: Record<string, string>;
    };
    value.productions = [];
    value.incarnations = {};
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    TestValidator.predicate(
      "unregistered production invalidates its live handle",
      isInputRace(() => project.revision()),
    );
  } catch (error) {
    registryFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(registryFailure, registry.dispose, "Registry fixture");
  }

  const namespace = productionFixture();
  let namespaceFailure: IFenceCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      namespace.root,
      "fixture-film",
    );
    const resident = project.generatedRoot();
    const original = `${resident}.original`;
    fs.renameSync(resident, original);
    fs.mkdirSync(resident);
    fs.writeFileSync(path.join(resident, "replacement.txt"), "replacement");
    TestValidator.predicate(
      "replaced generated namespace invalidates the live handle",
      changedPhysicalIdentity(() => project.generatedRoot()),
    );
    TestValidator.equals(
      "stale handle leaves replacement namespace untouched",
      fs.readFileSync(path.join(resident, "replacement.txt"), "utf8"),
      "replacement",
    );
  } catch (error) {
    namespaceFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(
      namespaceFailure,
      namespace.dispose,
      "Namespace fixture",
    );
  }

  const replacedRoot = productionFixture();
  let rootFailure: IFenceCleanupFailure | undefined;
  const displaced = `${replacedRoot.root}.displaced`;
  try {
    const project = AutoMovieProductionProject.open(
      replacedRoot.root,
      "fixture-film",
    );
    fs.renameSync(replacedRoot.root, displaced);
    fs.mkdirSync(replacedRoot.root);
    fs.writeFileSync(
      path.join(replacedRoot.root, "replacement.txt"),
      "new root",
    );
    TestValidator.predicate(
      "replaced physical project root invalidates the live handle",
      isInputRace(() => project.revision()),
    );
    TestValidator.equals(
      "root identity refusal leaves replacement sentinel untouched",
      fs.readFileSync(path.join(replacedRoot.root, "replacement.txt"), "utf8"),
      "new root",
    );
  } catch (error) {
    rootFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(
      rootFailure,
      () => {
        fs.rmSync(replacedRoot.root, { force: true, recursive: true });
        fs.rmSync(displaced, { force: true, recursive: true });
      },
      "Root-replacement fixture",
    );
  }

  const guardedRoot = productionFixture();
  let guardedFailure: IFenceCleanupFailure | undefined;
  const guardedDisplaced = `${guardedRoot.root}.displaced`;
  try {
    const project = AutoMovieProductionProject.open(
      guardedRoot.root,
      "fixture-film",
    );
    const bytes = Buffer.from("guarded generated output\n");
    let calls = 0;
    let refusal: unknown;
    try {
      project.commitGenerated(
        new Map([["guarded.txt", bytes]]),
        {
          version: 1,
          compiler: {
            packageVersion: "runtime-shape-test",
            protocolVersion: "runtime-shape-test.v1",
          },
          inputFingerprint: digestAutoMovieBytes(Buffer.from("guarded input")),
          files: [
            {
              path: "guarded.txt",
              owner: "compiler",
              digest: digestAutoMovieBytes(bytes),
              sourceTargets: ["production:fixture-film"],
            },
          ],
        },
        () => {
          ++calls;
          if (calls === 2) {
            fs.renameSync(guardedRoot.root, guardedDisplaced);
            fs.mkdirSync(guardedRoot.root);
            fs.writeFileSync(
              path.join(guardedRoot.root, "replacement.txt"),
              "replacement survives",
            );
            return false;
          }
          return true;
        },
      );
    } catch (error) {
      refusal = error;
    }
    const aggregateErrors =
      refusal instanceof AggregateError ? refusal.errors : [];
    TestValidator.predicate(
      "guarded commit reports primary and identity fence failures together",
      refusal instanceof AggregateError &&
        calls === 2 &&
        aggregateErrors.length === 2 &&
        aggregateErrors[0] instanceof AutoMovieProductionInputRaceError &&
        (aggregateErrors[0] as Error).message.includes(
          "inputs changed while the guarded commit was being applied",
        ) &&
        aggregateErrors[1] instanceof Error &&
        (aggregateErrors[1] as Error).message.includes(
          "root identity or namespace fence changed",
        ),
    );
    TestValidator.equals(
      "failed stale rollback never enters replacement root",
      fs.readFileSync(path.join(guardedRoot.root, "replacement.txt"), "utf8"),
      "replacement survives",
    );
  } catch (error) {
    guardedFailure = { error };
    throw error;
  } finally {
    preserveFenceCleanup(
      guardedFailure,
      () => {
        fs.rmSync(guardedRoot.root, { force: true, recursive: true });
        fs.rmSync(guardedDisplaced, { force: true, recursive: true });
      },
      "Guarded root-replacement fixture",
    );
  }
};
