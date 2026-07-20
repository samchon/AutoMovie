import { AutoMovieContext, IAutoMovieMcpMotion } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const clip = (id: string, duration: number): IAutoMovieMcpMotion => ({
  id,
  skeleton: "skeleton-1",
  duration,
  loop: false,
  keyframes: [],
});

/**
 * The session-only geometry memory's beat-less UNION view (#1091, #1040): a
 * query without a beat unions all beats' motion snapshots and DROPS any id
 * whose content differs across beats, an ambiguous id must miss (the
 * downstream reason names the fix: pass the beat) rather than sample whichever
 * beat committed last. Project re-activation with the same root keeps the live
 * memory; a different root clears it.
 *
 * Scenarios:
 *
 * 1. The same id with IDENTICAL content in two beats survives the union (negative
 *    twin of the drop).
 * 2. The same id with DIFFERING content is dropped from the beat-less view while
 *    each beat's own snapshot still resolves it.
 * 3. A third beat re-encountering the already-ambiguous id cannot resurrect it
 *    (the ambiguity is sticky across the walk).
 * 4. Re-activating the SAME project root keeps the remembered memory; a DIFFERENT
 *    root clears it.
 */
export const test_mcp_geometry_memory_union = (): void => {
  // 1-3. union semantics
  const context = new AutoMovieContext();
  context.rememberGeometryModels([{ id: "actor-model", skeleton: null }]);
  context.rememberGeometryMotions(
    { a: clip("shared", 1), b: clip("stable", 2) },
    "beat-1",
  );
  context.rememberGeometryMotions(
    { a: clip("shared", 9), b: clip("stable", 2) },
    "beat-2",
  );

  const union = context.geometryMemory();
  TestValidator.equals(
    "identical content survives the beat-less union",
    union.motions["stable"]?.duration,
    2,
  );
  TestValidator.equals(
    "differing content is dropped from the beat-less union",
    union.motions["shared"],
    undefined,
  );
  TestValidator.equals(
    "each beat's own snapshot still resolves the ambiguous id",
    [
      context.geometryMemory("beat-1").motions["shared"]?.duration,
      context.geometryMemory("beat-2").motions["shared"]?.duration,
    ],
    [1, 9],
  );

  // 3. a third beat cannot resurrect the ambiguous id
  context.rememberGeometryMotions({ a: clip("shared", 9) }, "beat-3");
  TestValidator.equals(
    "a later matching beat cannot resurrect an ambiguous id",
    context.geometryMemory().motions["shared"],
    undefined,
  );

  // 4. same-root re-activation keeps memory; a new root clears it
  const rootA = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ctx-a-"));
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ctx-b-"));
  try {
    const resident = new AutoMovieContext(undefined, rootA);
    resident.rememberGeometryModels([{ id: "kept", skeleton: null }]);
    resident.activateProject(rootA);
    TestValidator.equals(
      "re-activating the same root keeps the remembered models",
      resident.geometryMemory().models,
      [{ id: "kept", skeleton: null }],
    );
    resident.activateProject(rootB);
    TestValidator.equals(
      "activating a different root clears the memory",
      resident.geometryMemory().models,
      [],
    );
  } finally {
    fs.rmSync(rootA, { recursive: true, force: true });
    fs.rmSync(rootB, { recursive: true, force: true });
  }
};
