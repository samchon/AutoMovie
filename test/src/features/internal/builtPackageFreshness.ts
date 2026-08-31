import fs from "node:fs";
import path from "node:path";

/**
 * Whether a package's build output still answers for its current source.
 *
 * Three fixtures install a built workspace package into a generated consumer,
 * and each decided by asking whether `lib/index.js` exists. It does exist
 * whenever anything was ever built there, so a build left by another branch is
 * used exactly as readily as one built from the source at hand.
 *
 * What that costs is a diagnostic about the wrong thing. Adding one obligation
 * on one branch and running a fixture on another produced:
 *
 * ```
 * obligations/core/common.md H2 inventory changed without graph wiring.
 *   Received [purpose-fit, layer-boundary, ...]
 *   expected [purpose-fit, population-variety, layer-boundary, ...]
 * ```
 *
 * The reader's own source says nothing of the kind, and the search for what
 * they broke starts in the wrong file. CI never meets this: it builds before it
 * tests. The people who meet it are the ones running these fixtures locally
 * while moving between branches, which is most of the work on them.
 *
 * Mtimes rather than digests: this answers "is the build older than the source
 * it claims to be", and a rebuild whose output is byte-identical is cheap
 * enough that distinguishing it would buy nothing.
 */
export const builtOutputIsStale = (props: {
  /** The package directory holding `src` and `lib`. */
  packageRoot: string;
  /** The emitted entry the caller was going to trust. */
  output: string;
}): boolean => {
  if (fs.existsSync(props.output) === false) return true;
  const built = fs.statSync(props.output).mtimeMs;
  const source = path.join(props.packageRoot, "src");
  if (fs.existsSync(source) === false) return false;
  const newest = (directory: string): number => {
    let latest = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      latest = Math.max(
        latest,
        entry.isDirectory() ? newest(target) : fs.statSync(target).mtimeMs,
      );
    }
    return latest;
  };
  return newest(source) > built;
};
