import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieMaintenanceObservation,
  planAutoMoviePhysicalMaintenanceChanges,
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieProjectMaintenance,
  recoverAutoMovieProjectMaintenance,
} from "automovie";
import path from "node:path";

import {
  contractMaintenanceFailure,
  createContractMaintenanceHarness,
  failContractMaintenanceEvent,
} from "../internal/contractMaintenanceHarness";

const fixture = () => {
  const harness = createContractMaintenanceHarness({ "a.md": "before" });
  const original = harness.read("a.md")!;
  const root = {
    path: path.resolve("maintenance-project"),
    real: path.resolve("maintenance-project"),
    identity: "root-1",
  };
  const observation: IAutoMovieMaintenanceObservation = {
    root,
    directories: [root],
    files: {
      "a.md": {
        path: path.join(root.path, "a.md"),
        identity: "pathname-identity",
        version: "pathname:version",
      },
      "new.md": null,
    },
    descriptors: {
      "a.md": {
        identity: original.identity,
        version: `${original.version}:ctime`,
      },
      "new.md": null,
    },
    sources: { "a.md": original.source },
  };
  return { harness, observation };
};

/** Command integration binds descriptor bytes, not a reapproved pathname resident. */
export const test_cli_project_maintenance_integration = (): void => {
  verifyAdmission();
  verifyRecoveryAdmission();
  const state = fixture();
  const successors = { "a.md": "after", "new.md": "new" };
  const changes = planAutoMoviePhysicalMaintenanceChanges(
    state.observation,
    successors,
  );
  TestValidator.equals(
    "descriptor authority wins",
    changes[0]!.before,
    state.harness.read("a.md"),
  );
  TestValidator.equals("absence remains explicit", changes[1]!.before, null);
  const result = publishAutoMovieProjectMaintenance({
    observation: state.observation,
    kind: "toc",
    successors,
    baselinePath: null,
    receipts: [],
    io: state.harness.io,
  });
  TestValidator.equals(
    "complete publication result",
    result.status,
    "completed",
  );
  TestValidator.equals(
    "observed successor installed",
    state.harness.read("a.md")!.source,
    "after",
  );
  TestValidator.equals(
    "new observed absence installed",
    state.harness.read("new.md")!.source,
    "new",
  );
  TestValidator.equals(
    "no pending recovery is no-op",
    recoverAutoMovieProjectMaintenance({
      pending: null,
      kind: "toc",
      mutate: false,
      io: state.harness.io,
    }),
    null,
  );
};

/** Invalid authority and rolled-back requests never return command success. */
const verifyAdmission = (): void => {
  const state = fixture();
  const refuses = (
    observation: IAutoMovieMaintenanceObservation,
    successors: Record<string, string | null>,
  ): boolean =>
    contractMaintenanceFailure(() =>
      planAutoMoviePhysicalMaintenanceChanges(observation, successors),
    ) instanceof Error;
  TestValidator.predicate(
    "unobserved target refuses",
    refuses(state.observation, { "unknown.md": "new" }),
  );
  TestValidator.predicate(
    "absence with bytes refuses",
    refuses(
      { ...state.observation, sources: { "new.md": "not absent" } },
      { "new.md": "new" },
    ),
  );
  TestValidator.predicate(
    "absence with descriptor refuses",
    refuses(
      {
        ...state.observation,
        descriptors: {
          ...state.observation.descriptors,
          "new.md": { identity: "other", version: "other:ctime" },
        },
      },
      { "new.md": "new" },
    ),
  );
  TestValidator.predicate(
    "existing without descriptor refuses",
    refuses({ ...state.observation, descriptors: {} }, { "a.md": "after" }),
  );
  TestValidator.predicate(
    "existing without source refuses",
    refuses({ ...state.observation, sources: {} }, { "a.md": "after" }),
  );
  const failed = fixture();
  const fired = failContractMaintenanceEvent(
    failed.harness,
    "replace",
    "a.md",
    "before",
  );
  const failure = contractMaintenanceFailure(() =>
    publishAutoMovieProjectMaintenance({
      observation: failed.observation,
      kind: "toc",
      successors: { "a.md": "after" },
      baselinePath: null,
      receipts: [],
      io: failed.harness.io,
    }),
  );
  TestValidator.predicate(
    "rolled-back command fails",
    failure instanceof Error && failure.message.includes("rolled-back"),
  );
  TestValidator.predicate("intended fault reached", fired());
  TestValidator.equals(
    "predecessor preserved",
    failed.harness.read("a.md")!.source,
    "before",
  );
};

/** Recovery is explicit, kind-bound, and reports retained recovery causes. */
const verifyRecoveryAdmission = (): void => {
  const state = fixture();
  const journal = prepareAutoMovieMaintenanceTransaction({
    kind: "toc",
    rootIdentity: "root-1",
    changes: planAutoMoviePhysicalMaintenanceChanges(state.observation, {
      "a.md": "after",
    }),
    baselinePath: null,
    receipts: [],
    io: state.harness.io,
  });
  TestValidator.predicate(
    "different operation cannot recover",
    contractMaintenanceFailure(() =>
      recoverAutoMovieProjectMaintenance({
        pending: journal,
        kind: "contracts",
        mutate: true,
        io: state.harness.io,
      }),
    ) instanceof Error,
  );
  TestValidator.predicate(
    "dry-run cannot recover",
    contractMaintenanceFailure(() =>
      recoverAutoMovieProjectMaintenance({
        pending: journal,
        kind: "toc",
        mutate: false,
        io: state.harness.io,
      }),
    ) instanceof Error,
  );
  const failure = contractMaintenanceFailure(() =>
    recoverAutoMovieProjectMaintenance({
      pending: journal,
      kind: "toc",
      mutate: true,
      io: {
        ...state.harness.io,
        assertRoot: () => {
          // eslint-disable-next-line typescript/only-throw-error -- preserve a non-Error boundary failure through recovery diagnostics
          throw "root changed";
        },
      },
    }),
  );
  TestValidator.predicate(
    "recovery failure reports cause",
    failure instanceof Error &&
      failure.message.includes("recovery-required") &&
      failure.message.includes("root changed"),
  );
  const restored = recoverAutoMovieProjectMaintenance({
    pending: journal,
    kind: "toc",
    mutate: true,
    io: state.harness.io,
  });
  TestValidator.equals(
    "explicit recovery restores predecessor",
    restored?.status,
    "rolled-back",
  );
};
