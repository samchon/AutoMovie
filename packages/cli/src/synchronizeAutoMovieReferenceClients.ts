import { planAutoMovieReferenceClientConfiguration } from "@automovie/mcp";
import type { IScaffoldPhysicalDirectory } from "@automovie/template";

import {
  assertAutoMovieMaintenanceObservation,
  observeAutoMovieMaintenanceFiles,
} from "./contractMaintenanceFileSystem";
import {
  createAutoMovieMaintenanceTransactionIO,
  readAutoMoviePendingMaintenance,
} from "./contractMaintenanceRuntime";
import {
  publishAutoMovieProjectMaintenance,
  recoverAutoMovieProjectMaintenance,
} from "./publishAutoMovieProjectMaintenance";

/**
 * Explicit registration capabilities, separate from every read-only reference request.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Preserves user configuration through observed candidate publication.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Keeps project registration outside the provider and its transports.
 */
export interface IAutoMovieReferenceClientSynchronizationIO {
  /** Observe ordinary files under the original physical root. */
  observe: typeof observeAutoMovieMaintenanceFiles;
  /** Revalidate the complete configuration observation. */
  assert: typeof assertAutoMovieMaintenanceObservation;
  /** Bind durable publication to the same physical observation. */
  transaction: typeof createAutoMovieMaintenanceTransactionIO;
  /** Read the pending registration journal, if any. */
  pending: typeof readAutoMoviePendingMaintenance;
  /** Absolute Node executable recorded as the launch command; a changed one republishes. */
  nodeExecutable: string;
}

const synchronizationIO: IAutoMovieReferenceClientSynchronizationIO = {
  observe: observeAutoMovieMaintenanceFiles,
  assert: assertAutoMovieMaintenanceObservation,
  transaction: createAutoMovieMaintenanceTransactionIO,
  pending: readAutoMoviePendingMaintenance,
  nodeExecutable: process.execPath,
};

/**
 * Synchronize only the two owned local MCP entries, preserving competitors.
 * Configuration predecessors and recovery records remain in an ignored private
 * namespace because unrelated client settings may contain secrets.
 * "Private" names Git exclusion, not a new filesystem permission boundary.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Registers the installed server without replacing unrelated settings or granting client trust.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Publishes exact observed candidates and refuses interrupted or competing configuration generations.
 * @evidenceExclude requirements/agent-authoring/reference-navigation.md#agent-reference-selection Registration does not discover authored files or headings; the installed reference provider owns selection.
 * @evidenceExclude requirements/agent-authoring/reference-navigation.md#agent-reference-source Registration does not project authored bytes or revisions; the installed reference provider owns source preservation.
 * @evidenceExclude requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Registration does not budget reference responses or classify read failures; the installed reference provider owns those requests.
 * @evidenceExclude requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Registration is an explicit client-configuration mutation, not a reference request; the provider owns its read-only root boundary.
 * @evidenceExclude specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection The provider, not the registration publisher, resolves authored file and section addresses.
 * @evidenceExclude specifications/authoring-and-authority/reference-navigation.md#spec-reference-source The provider, not the registration publisher, computes comment-free source projection and revisions.
 * @evidenceExclude specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds The provider, not the registration publisher, admits bounded read requests and continuation.
 * @evidenceExclude specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation The provider, not this intentional configuration writer, supplies physically confined read-only operations.
 */
export const synchronizeAutoMovieReferenceClients = (
  root: string | IScaffoldPhysicalDirectory,
  io: IAutoMovieReferenceClientSynchronizationIO = synchronizationIO,
): string[] => {
  const initial = io.observe({ root, paths: [] });
  const transaction = io.transaction(initial, "reference-clients");
  if (transaction.read("automovie/contract-maintenance.pending.json") !== null)
    throw new Error(
      "Recover pending contract or TOC maintenance before synchronizing reference clients.",
    );
  recoverAutoMovieProjectMaintenance({
    pending: io.pending(transaction, "reference-clients"),
    kind: "reference-clients",
    mutate: true,
    io: transaction,
  });
  const observation = io.observe({
    root: initial.root,
    paths: [".mcp.json", ".codex/config.toml"],
  });
  const plan = planAutoMovieReferenceClientConfiguration({
    root: observation.root.path,
    nodeExecutable: io.nodeExecutable,
    claude: observation.sources[".mcp.json"],
    codex: observation.sources[".codex/config.toml"],
  });
  const candidates = [plan.claude, plan.codex];
  const changed = candidates.filter(
    (candidate) => observation.sources[candidate.path] !== candidate.content,
  );
  io.assert(observation);
  if (changed.length === 0) return [];
  publishAutoMovieProjectMaintenance({
    observation,
    kind: "reference-clients",
    successors: Object.fromEntries(
      candidates.map((candidate) => [candidate.path, candidate.content]),
    ),
    baselinePath: null,
    receipts: [],
    io: io.transaction(observation, "reference-clients"),
  });
  return changed.map((candidate) => candidate.path);
};
