import type { AutoMovieEvidenceStage } from "./createAutoMovieEvidenceConfig";

/**
 * Validates declared optional account paths and active obligation targets.
 *
 * The reader returns a contract's H2 count or undefined for a missing target.
 * Authored H2s and aggregate accounts share ordinary coverage in native lint.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Admits declared account paths and refuses ambiguous ownership or absent active contract targets.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Checks shared and local account declarations through one allowlist and validates their current contract targets before native lint.
 */
export function validateAutoMoviePopulationAccountHosts(props: {
  accounts: readonly {
    layer: string;
    stage: AutoMovieEvidenceStage;
    account: string;
    target: string;
    enabled: boolean;
  }[];
  residents: readonly string[];
  supplemental: readonly { file: string; stage: AutoMovieEvidenceStage }[];
  readH2Count: (projectRelative: string) => number | undefined;
}): void {
  const allowed = new Map<string, AutoMovieEvidenceStage>();
  for (const entry of props.supplemental) allowed.set(entry.file, entry.stage);
  const targets = new Set<string>();
  for (const entry of props.accounts) {
    if (allowed.has(entry.account))
      throw new Error(
        `${entry.account}: population account has multiple declarations or collides with a reserved account.`,
      );
    allowed.set(entry.account, entry.stage);
    const identity = `${entry.layer}:${entry.target}`;
    if (targets.has(identity))
      throw new Error(
        `${entry.account}: ${entry.target} already has a population account in ${entry.layer}.`,
      );
    targets.add(identity);
  }
  for (const resident of props.residents) {
    const stage = allowed.get(resident);
    if (stage === undefined)
      throw new Error(
        `${resident}: population accounts contain an unowned file.`,
      );
    if (stage === "disabled")
      throw new Error(
        `${resident}: a disabled layer cannot retain a population account.`,
      );
  }
  for (const entry of props.accounts) {
    if (!entry.enabled) continue;
    const obligations = props.readH2Count(entry.target);
    if (obligations === undefined)
      throw new Error(
        `${entry.account}: population obligation target ${entry.target} is missing.`,
      );
    if (obligations === 0)
      throw new Error(
        `${entry.account}: population obligation target ${entry.target} has no H2 obligations.`,
      );
  }
}
