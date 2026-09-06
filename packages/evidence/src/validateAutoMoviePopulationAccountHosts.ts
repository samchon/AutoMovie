import type { AutoMovieEvidenceStage } from "./createAutoMovieEvidenceConfig";

/**
 * Validates account admission and physical H2 cardinality from an injected read.
 *
 * The reader returns the existing Markdown identity validator's H2 count or
 * undefined for a missing file. Native evidence still owns citation identity,
 * exact target ownership, checklist coverage, and review fingerprints.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Admits only declared account paths and refuses absent or ambiguous physical owners.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Checks shared and local account files with one deterministic allowlist and current H2 counts before native lint.
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
    const owners = props.readH2Count(`docs/${entry.account}`);
    if (owners === undefined)
      throw new Error(
        `${entry.account}: ${entry.layer} cannot enter ${entry.stage} without its population account.`,
      );
    const obligations = props.readH2Count(entry.target);
    if (obligations === undefined)
      throw new Error(
        `${entry.account}: population obligation target ${entry.target} is missing.`,
      );
    if (obligations === 0 || owners !== obligations)
      throw new Error(
        `${entry.account}: population account has ${owners} H2 owners for ${obligations} ${entry.target} obligations.`,
      );
  }
}
