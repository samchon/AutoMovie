import path from "node:path";

import { compareCodeUnits } from "./contentIdentity";
import { isAutoMovieProductionArtifactEntry } from "./isAutoMovieProductionArtifactEntry";

/**
 * Plan which entries one mutable open must move to reach the namespaced layout.
 *
 * A registry that predates the namespaced layout is not evidence that the
 * project holds a layout to migrate. A fresh project is created at layout
 * version 0 and owns no legacy tree at all, so an open that decided from the
 * registry version alone staged the output roots of a project that had produced
 * nothing, and carried the tracked render document into an ignored namespace on
 * the way. This plan answers from the project's resident entries instead: an
 * empty plan means there is no legacy layout, and that open adopts the current
 * layout version without staging anything.
 *
 * The fixed candidates are the v0 design and state records, each keeping the
 * place it had in the order a migration published them. The output roots are
 * expanded entry by entry rather than renamed whole, because renaming a root
 * carries everything inside it and the tracked document is inside it. Entries
 * are ordered by code unit so one project plans the same moves whatever order
 * its filesystem enumerates them in.
 *
 * An entry named exactly like the production namespace is refused rather than
 * nested inside itself. The root then holds both a legacy entry and the
 * destination that entry would be published at, and which one is authoritative
 * is the author's answer rather than this plan's.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Places each legacy result under the production namespace that produced it while leaving a tracked document no namespace produced where it already is.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Reads the resident project to decide whether the tracked registration's layout version is merely unadopted or names a layout whose records still have to move.
 */
export const planAutoMovieProductionLayoutMigration = (props: {
  /** Reserved state root of the project being opened. */
  automovieRoot: string;
  /** Design root the project-shared recipes belong at. */
  sharedDesignRoot: string;
  /** Design root the active production's own records belong at. */
  productionDesignRoot: string;
  /** State root the active production's own records belong at. */
  productionStateRoot: string;
  /** Directory segment naming the active production's namespace. */
  productionSegment: string;
  /** Output roots the namespaced layout partitions, in publication order. */
  outputRoots: readonly {
    /** Which output root this is, which decides the entry judgment. */
    directory: "generated" | "renders";
    /** Absolute owned path of that root. */
    root: string;
  }[];
  /** What resides at one output root, reporting a non-directory as absent. */
  outputState: (root: string) =>
    | { kind: "absent" }
    | { kind: "linked" }
    | {
        kind: "entries";
        entries: readonly { name: string; isFile: boolean }[];
      };
  /** Whether one fixed legacy candidate resides in this project. */
  resident: (source: string) => boolean;
}): {
  /** Absolute resident path the migration stages. */
  source: string;
  /** Absolute path under the namespaced layout it is published at. */
  destination: string;
}[] => {
  const designRoot = path.join(props.automovieRoot, "design");
  const candidates: { source: string; destination: string }[] = [];
  for (const directory of ["models", "formations"])
    candidates.push({
      source: path.join(designRoot, directory),
      destination: path.join(props.sharedDesignRoot, directory),
    });
  candidates.push({
    source: path.join(designRoot, "world.json"),
    destination: path.join(props.sharedDesignRoot, "world.json"),
  });
  candidates.push({
    source: path.join(designRoot, "production.json"),
    destination: path.join(props.productionDesignRoot, "production.json"),
  });
  for (const directory of ["shots", "acceptance", "screenplay"])
    candidates.push({
      source: path.join(designRoot, directory),
      destination: path.join(props.productionDesignRoot, directory),
    });
  for (const entry of [
    "revision.json",
    "generated-manifest.json",
    "render-manifest.json",
    "render-manifest-receipt.json",
    "render-receipts",
    "audit",
  ])
    candidates.push({
      source: path.join(props.automovieRoot, entry),
      destination: path.join(props.productionStateRoot, entry),
    });
  const moves = candidates.filter((move) => props.resident(move.source));
  for (const output of props.outputRoots) {
    const state = props.outputState(output.root);
    if (state.kind === "linked")
      throw new Error(
        `Legacy production path "${output.root}" is a symlink or junction. Replace it with project-owned files before migration.`,
      );
    if (state.kind === "absent") continue;
    const namespace = path.join(output.root, props.productionSegment);
    const legacy = state.entries
      .filter((entry) =>
        isAutoMovieProductionArtifactEntry({
          directory: output.directory,
          name: entry.name,
          isFile: entry.isFile,
        }),
      )
      .sort((left, right) => compareCodeUnits(left.name, right.name));
    if (legacy.length === 0) continue;
    if (legacy.some((entry) => entry.name === props.productionSegment))
      throw new Error(
        `Legacy production path "${output.root}" conflicts with namespaced destination "${namespace}". Keep one authoritative copy before reopening the project.`,
      );
    for (const entry of legacy)
      moves.push({
        source: path.join(output.root, entry.name),
        destination: path.join(namespace, entry.name),
      });
  }
  return moves;
};
