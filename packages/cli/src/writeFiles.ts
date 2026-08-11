import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertScaffoldPhysicalDirectory,
  ensureScaffoldBaseDirectory,
  ensureScaffoldFileDirectory,
  writeScaffoldFile,
} from "./scaffoldFileSnapshot";

/**
 * Materialize a `{ relativePath: content }` map under `location`, creating
 * parent directories as needed, and return the absolute paths written
 * (sorted).
 *
 * Refuses lexical escapes, colliding targets, linked physical parents, and
 * pathname successors. New files reserve their final slot directly; `force`
 * modifies only the exact captured ordinary single-link file generation.
 * Rendering the map is {@link renderScaffold}'s job; this is its write half.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Repeated explicit writes converge on the same scaffold bytes while an unforced duplicate is refused.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Binds a retry to the same deterministic file map and verifies each resident result.
 * @evidenceExclude requirements/operations-and-recovery/README.md#운영과-복구-요구사항 The README heading indexes all operations; this helper owns exact local scaffold writes only.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Refuses duplicate final paths unless exact replacement is explicitly authorized.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-external-side-effect-outcome This helper performs synchronous local writes with verified readback, not ambiguous remote side effects.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-exactly-once-claim-boundary This helper makes no exactly-once claim; it exposes explicit create or overwrite behavior.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Cross-system compensation is outside local scaffold publication.
 * @evidenceExclude specifications/execution-and-recovery/README.md#실행과-복구-시스템-계약 This topic index spans durable jobs and recovery; the helper owns exact local scaffold writes only.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Resolves an existing target through explicit refusal or exact replacement.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-retry-eligibility-limit Retry policy and attempt limits belong to the caller, not this synchronous write helper.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-retry-backoff-schedule This synchronous local helper owns no retry scheduler.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-external-outcome-reconciliation No remote or ambiguous external outcome is produced here.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-exactly-once-boundary This helper promises verified final bytes, not exactly-once execution.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Cross-system compensation and adoption are outside local scaffold writes.
 * @author Samchon
 */
export const writeFiles = (
  location: string,
  files: Record<string, string>,
  options?: { force?: boolean },
): string[] => {
  const base = path.resolve(process.cwd(), location);
  const entries = scaffoldEntries(base, files);
  const baseOwnership = ensureScaffoldBaseDirectory(base);
  assertScaffoldPhysicalDirectory(baseOwnership);
  if (fs.readdirSync(base).length > 0 && options?.force !== true)
    throw new Error(
      `target directory is not empty: ${base}; pass --force to scaffold into it anyway`,
    );
  assertScaffoldPhysicalDirectory(baseOwnership);

  const written: string[] = [];
  const directories = new Map([[baseOwnership.path, baseOwnership]]);
  for (const entry of entries) {
    const parent = ensureScaffoldFileDirectory({
      base: baseOwnership,
      cache: directories,
      directory: path.dirname(entry.target),
    });
    writeScaffoldFile({
      base: baseOwnership,
      bytes: Buffer.from(entry.content, "utf8"),
      force: options?.force === true,
      parent,
      target: entry.target,
    });
    written.push(entry.target);
  }
  // Code-unit order, not localeCompare: a scaffold must lay files down in the
  // same order on every host (localeCompare varies with host locale/ICU).
  return written.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

interface IScaffoldEntry {
  content: string;
  key: string;
  relative: string;
  target: string;
}

const scaffoldEntries = (
  base: string,
  files: Record<string, string>,
): IScaffoldEntry[] => {
  const entries = Object.entries(files).map(([relative, content]) => {
    if (typeof content !== "string")
      throw new Error(`scaffold content is not text: ${relative}`);
    if (relative.includes("\0"))
      throw new Error(`refusing invalid scaffold path: ${relative}`);
    const target = path.resolve(base, relative);
    const inside = path.relative(base, target);
    if (
      inside.length === 0 ||
      inside === ".." ||
      inside.startsWith(`..${path.sep}`) ||
      path.isAbsolute(inside)
    )
      throw new Error(`refusing to write outside "${base}": ${relative}`);
    return {
      content,
      key: canonicalScaffoldPath(target),
      relative,
      target,
    };
  });
  const ordered = [...entries].sort((left, right) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
  );
  for (let previousIndex = 0; previousIndex < ordered.length; previousIndex++)
    for (
      let currentIndex = previousIndex + 1;
      currentIndex < ordered.length;
      currentIndex++
    ) {
      const previous = ordered[previousIndex]!;
      const current = ordered[currentIndex]!;
      if (
        current.key === previous.key ||
        current.key.startsWith(`${previous.key}${path.sep}`)
      )
        throw new Error(
          `scaffold paths collide: ${previous.relative}, ${current.relative}`,
        );
    }
  return entries;
};

const canonicalScaffoldPath = (value: string): string => value.toLowerCase();
