import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const { readProductionEntryPresence } = loadSourceModule<{
  readProductionEntryPresence(props: {
    root: string;
    relative: string;
    assertCurrent: () => void;
    assertParent: (parent: string) => void;
    exists: (file: string) => boolean;
  }): boolean;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/readProductionEntryPresence.ts",
  ),
);

/**
 * Recovery presence is a physical entry observation, not a nullable text read.
 *
 * Scenarios:
 * 1. Present and absent entries both revalidate current root and parent twice.
 * 2. Root/parent replacement and unreadable entry errors propagate unchanged.
 * 3. Root aliases and lexical escapes are refused before any entry is read.
 */
export const test_production_entry_presence = (): void => {
  const root = path.resolve("entry-project");
  for (const present of [false, true]) {
    const events: string[] = [];
    const result = readProductionEntryPresence({
      root,
      relative: "docs/models/hero.review.json.pending",
      assertCurrent: () => {
        events.push("current");
      },
      assertParent: (parent) => {
        events.push(
          `parent:${path.relative(root, parent).split(path.sep).join("/")}`,
        );
      },
      exists: (file) => {
        events.push(`entry:${path.basename(file)}`);
        return present;
      },
    });
    TestValidator.equals("actual presence retained", result, present);
    TestValidator.equals("observation is bracketed", events, [
      "current",
      "parent:docs/models",
      "entry:hero.review.json.pending",
      "parent:docs/models",
      "current",
    ]);
  }
  const props = {
    root,
    relative: "docs/pending",
    assertCurrent: () => {},
    assertParent: (_parent: string) => {},
    exists: (_file: string) => false,
  };
  for (const relative of [
    ".",
    "..",
    "../outside",
    path.resolve(root, "../outside"),
  ])
    TestValidator.predicate(
      "escape rejected",
      throwsError(() => readProductionEntryPresence({ ...props, relative })),
    );
  for (const point of ["assertCurrent", "assertParent", "exists"] as const)
    for (const failAt of point === "exists" ? [1] : [1, 2]) {
      let calls = 0;
      TestValidator.predicate(
        `${point} failure ${failAt} propagates`,
        throwsError(() =>
          readProductionEntryPresence({
            ...props,
            [point]: () => {
              if (++calls === failAt) throw new Error("changed or unreadable");
              return false;
            },
          }),
        ),
      );
    }
};
