import { planAutoMovieReferenceClientConfiguration } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieMaintenanceObservation,
  type IAutoMovieReferenceClientSynchronizationIO,
  synchronizeAutoMovieReferenceClients,
} from "automovie";
import path from "node:path";

import {
  contractMaintenanceFailure,
  createContractMaintenanceHarness,
  failContractMaintenanceEvent,
} from "../internal/contractMaintenanceHarness";

const fixture = (sources: Record<string, string> = {}) => {
  const harness = createContractMaintenanceHarness(sources);
  const root = {
    path: path.resolve("reference-project"),
    real: path.resolve("reference-project"),
    identity: "root-1",
  };
  let assertions = 0;
  let failAdmission = false;
  const io: IAutoMovieReferenceClientSynchronizationIO = {
    nodeExecutable: path.resolve("node.exe"),
    observe: ({ root: selected, paths }) => {
      if (typeof selected !== "string")
        TestValidator.equals("retains original root", selected, root);
      const observation: IAutoMovieMaintenanceObservation = {
        root,
        directories: [root],
        files: Object.fromEntries(
          paths.map((relative) => {
            const resident = harness.read(relative);
            return [
              relative,
              resident === null
                ? null
                : {
                    path: path.join(root.path, relative),
                    identity: resident.identity,
                    version: `${resident.version}:ctime`,
                  },
            ];
          }),
        ),
        descriptors: Object.fromEntries(
          paths.map((relative) => {
            const resident = harness.read(relative);
            return [
              relative,
              resident === null
                ? null
                : {
                    identity: resident.identity,
                    version: `${resident.version}:ctime`,
                  },
            ];
          }),
        ),
        sources: Object.fromEntries(
          paths.flatMap((relative) => {
            const resident = harness.read(relative);
            return resident === null ? [] : [[relative, resident.source]];
          }),
        ),
      };
      return observation;
    },
    assert: (observation) => {
      assertions++;
      if (failAdmission) throw new Error("changed configuration generation");
      return observation;
    },
    transaction: (_observation, kind) => {
      TestValidator.equals(
        "private registration kind",
        kind,
        "reference-clients",
      );
      return harness.io;
    },
    pending: () => harness.state.pending,
  };
  return {
    harness,
    root,
    io,
    assertions: () => assertions,
    refuse: () => {
      failAdmission = true;
    },
  };
};

/** Both local clients preserve user settings and use one physical, private publication. */
export const test_cli_reference_client_synchronization = (): void => {
  verifyRefusals();
  const input = {
    ".mcp.json": '{"custom":{"secret":"preserve-me"}}\n',
    ".codex/config.toml": 'model = "user-choice"\n',
  };
  const state = fixture(input);
  TestValidator.equals(
    "both registrations published",
    synchronizeAutoMovieReferenceClients(state.root, state.io),
    [".mcp.json", ".codex/config.toml"],
  );
  const plan = planAutoMovieReferenceClientConfiguration({
    root: state.root.path,
    nodeExecutable: state.io.nodeExecutable,
    claude: input[".mcp.json"],
    codex: input[".codex/config.toml"],
  });
  TestValidator.equals(
    "Claude unrelated settings remain",
    state.harness.read(".mcp.json")!.source,
    plan.claude.content,
  );
  TestValidator.equals(
    "Codex unrelated bytes remain",
    state.harness.read(".codex/config.toml")!.source,
    plan.codex.content,
  );
  TestValidator.predicate(
    "archive never enters tracked contracts",
    [...state.harness.files.keys()]
      .filter((file) => file.startsWith("automovie/"))
      .every((file) =>
        file.startsWith("automovie/reference-client-maintenance/"),
      ),
  );
  const before = [...state.harness.files.entries()];
  const writes = state.harness.events.filter((event) =>
    ["stage", "record", "replace", "begin"].includes(event.operation),
  ).length;
  TestValidator.equals(
    "idempotent no-write retry",
    synchronizeAutoMovieReferenceClients(state.root, state.io),
    [],
  );
  TestValidator.equals(
    "retry preserves every generation",
    [...state.harness.files.entries()],
    before,
  );
  TestValidator.equals(
    "retry has no publication calls",
    state.harness.events.filter((event) =>
      ["stage", "record", "replace", "begin"].includes(event.operation),
    ).length,
    writes,
  );
  TestValidator.equals("retry still freshly admitted", state.assertions(), 2);
};

/** Refusals leave unrelated settings and competing maintenance untouched. */
const verifyRefusals = (): void => {
  const conflict = fixture({
    ".mcp.json":
      '{"mcpServers":{"automovie_reference":{"command":"user-owned"}}}',
  });
  const before = [...conflict.harness.files.entries()];
  TestValidator.predicate(
    "owned-entry conflict refuses",
    contractMaintenanceFailure(() =>
      synchronizeAutoMovieReferenceClients(conflict.root, conflict.io),
    ) instanceof Error,
  );
  TestValidator.equals(
    "conflict causes no changes",
    [...conflict.harness.files.entries()],
    before,
  );
  const pending = fixture({
    "automovie/contract-maintenance.pending.json": "pending-contract",
  });
  TestValidator.predicate(
    "other namespace blocks",
    contractMaintenanceFailure(() =>
      synchronizeAutoMovieReferenceClients(pending.root, pending.io),
    ) instanceof Error,
  );
  TestValidator.equals(
    "other pending is preserved",
    pending.harness.files.size,
    1,
  );
  const changed = fixture();
  changed.refuse();
  TestValidator.predicate(
    "late change refuses before preparation",
    contractMaintenanceFailure(() =>
      synchronizeAutoMovieReferenceClients(changed.root, changed.io),
    ) instanceof Error,
  );
  TestValidator.equals(
    "no candidate after failed admission",
    changed.harness.files.size,
    0,
  );
  const failed = fixture();
  const fired = failContractMaintenanceEvent(
    failed.harness,
    "replace",
    ".mcp.json",
    "before",
  );
  TestValidator.predicate(
    "publication failure is not success",
    contractMaintenanceFailure(() =>
      synchronizeAutoMovieReferenceClients(failed.root, failed.io),
    ) instanceof Error,
  );
  TestValidator.predicate("requested fault reached", fired());
  TestValidator.equals(
    "failed new target remains absent",
    failed.harness.read(".mcp.json"),
    null,
  );
  const blank = fixture();
  TestValidator.equals(
    "fresh creation works with lexical entry",
    synchronizeAutoMovieReferenceClients(blank.root.path, blank.io),
    [".mcp.json", ".codex/config.toml"],
  );
};
