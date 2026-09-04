import assert from "node:assert/strict";

import type { AutoMoviePopulationLayer } from "../src/AutoMoviePopulationLayer";
import type { AutoMoviePopulationScope } from "../src/AutoMoviePopulationScope";
import { createAutoMoviePopulationFiles } from "../src/createAutoMoviePopulationFiles";

/**
 * The canonical population selector keeps one vertical slice exact without
 * pretending treatments own the delivery partition.
 *
 * Scenarios:
 * 1. complete-production and reset modes select the flat treatment sequence
 *    and every partitioned script and screenplay delivery group;
 * 2. a first pilot leaves treatments flat and selects exactly the same
 *    `001-*` group in scripts and screenplays; and
 * 3. malformed, non-first, or glob-bearing group identities and unknown modes
 *    fail where declared instead of selecting an empty or widened population.
 */
const testCreateAutoMoviePopulationFiles = (): void => {
  for (const mode of [
    "complete-production",
    "complete-production-reset",
  ] as const) {
    const scope = { mode } as AutoMoviePopulationScope;
    assert.deepEqual(createAutoMoviePopulationFiles("treatments", scope), [
      "treatments/???-*.md",
    ]);
    assert.deepEqual(createAutoMoviePopulationFiles("scripts", scope), [
      "scripts/*/???-*.md",
    ]);
    assert.deepEqual(createAutoMoviePopulationFiles("screenplays", scope), [
      "screenplays/*/???-*.md",
    ]);
  }

  const pilot: AutoMoviePopulationScope = {
    mode: "first-pilot",
    partitionGroup: "001-first-crossing",
  };
  assert.deepEqual(createAutoMoviePopulationFiles("treatments", pilot), [
    "treatments/???-*.md",
  ]);
  assert.deepEqual(createAutoMoviePopulationFiles("scripts", pilot), [
    "scripts/001-first-crossing/???-*.md",
  ]);
  assert.deepEqual(createAutoMoviePopulationFiles("screenplays", pilot), [
    "screenplays/001-first-crossing/???-*.md",
  ]);
  assert.deepEqual(
    createAutoMoviePopulationFiles("treatments", { mode: "first-pilot" }),
    ["treatments/???-*.md"],
    "a flat layer must not invent or require a partition selector",
  );

  for (const partitionGroup of [
    "002-second-group",
    "001",
    "001-",
    "001-First-Group",
    "001-first_group",
    "001-first--group",
    "001-*",
    "001-first/group",
  ])
    assert.throws(
      () =>
        createAutoMoviePopulationFiles("scripts", {
          mode: "first-pilot",
          partitionGroup,
        } as AutoMoviePopulationScope),
      /exact 001-lower-kebab-case/u,
      `${partitionGroup} must not become a pilot population`,
    );

  assert.throws(
    () =>
      createAutoMoviePopulationFiles("screenplays", {
        mode: "first-pilot",
      }),
    /requires one exact 001-lower-kebab-case/u,
    "a shape-neutral pilot without a real partition cannot select film groups",
  );

  assert.throws(
    () =>
      createAutoMoviePopulationFiles("scripts", {
        mode: "unknown",
      } as unknown as AutoMoviePopulationScope),
    /Unsupported authored population scope unknown/u,
  );
  assert.throws(
    () =>
      createAutoMoviePopulationFiles(
        "settings" as AutoMoviePopulationLayer,
        pilot,
      ),
    /Unsupported scoped authored layer settings/u,
  );
};

testCreateAutoMoviePopulationFiles();
process.stdout.write("production population selector canaries passed\n");
