import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

interface IEntry {
  name: string;
  isFile: boolean;
}

type IOutputState =
  | { kind: "absent" }
  | { kind: "linked" }
  | { kind: "entries"; entries: readonly IEntry[] };

interface IMove {
  source: string;
  destination: string;
}

const { planAutoMovieProductionLayoutMigration: plan } = loadSourceModule<{
  planAutoMovieProductionLayoutMigration: (props: {
    automovieRoot: string;
    sharedDesignRoot: string;
    productionDesignRoot: string;
    productionStateRoot: string;
    productionSegment: string;
    outputRoots: readonly {
      directory: "generated" | "renders";
      root: string;
    }[];
    outputState: (root: string) => IOutputState;
    resident: (source: string) => boolean;
  }) => IMove[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/planAutoMovieProductionLayoutMigration.ts",
  ),
);

const root = path.resolve("layout-project");
const automovieRoot = path.join(root, "automovie");
const generatedRoot = path.join(root, "generated");
const renderRoot = path.join(root, "renders");
const segment = "film";
const readme: IEntry = { name: "README.md", isFile: true };

const designEntry = (name: string): string =>
  path.join(automovieRoot, "design", name);

const run = (props: {
  resident?: readonly string[];
  generated?: IOutputState;
  renders?: IOutputState;
}): IMove[] =>
  plan({
    automovieRoot,
    sharedDesignRoot: path.join(automovieRoot, "design", "shared"),
    productionDesignRoot: path.join(automovieRoot, "design", segment),
    productionStateRoot: path.join(automovieRoot, "productions", segment),
    productionSegment: segment,
    outputRoots: [
      { directory: "generated", root: generatedRoot },
      { directory: "renders", root: renderRoot },
    ],
    outputState: (target) =>
      target === generatedRoot
        ? (props.generated ?? { kind: "absent" })
        : (props.renders ?? { kind: "absent" }),
    resident: (source) => (props.resident ?? []).includes(source),
  });

/**
 * A legacy layout migration targets the records a project actually holds, and
 * never the document version control tracks for it.
 *
 * The registration's layout version says which layout a project was written
 * against, not that it holds records to move. A project created at version 0
 * holds none, so the plan it produces is empty and the open that consumes it
 * adopts the version without staging anything. A project that does hold the old
 * layout moves record by record, and the output roots are expanded entry by
 * entry because renaming a root carries the tracked render document with it.
 *
 * The plan also fixes the shape of every move it can emit. Each destination
 * sits under the shared design root, the production's own design or state root,
 * or the production namespace inside an output root, so no move ever publishes
 * an entry inside its own source. An entry spelled exactly like the namespace
 * would be the one exception, and it is refused instead, because a root holding
 * both a legacy entry and the destination that entry would be published at is
 * an ambiguity only the author can settle.
 *
 * Scenarios:
 *
 * 1. Fresh project: no resident record, an empty generated root and a render
 *    root holding only the tracked README plan no move at all, and so do two
 *    absent output roots. A plan this empty never reaches the namespace
 *    conflict check below.
 * 2. Legacy project: resident design and state records plus generated files and
 *    render bundles plan the design, state, generated and render moves in that
 *    order, each output entry ordered by code unit rather than by the order the
 *    directory reported it (`Final` before `preview`, which a locale collation
 *    reverses), and no move publishes an entry inside its own source.
 * 3. Document exception: a directory borrowing the `README.md` name moves, and
 *    a `README.md` file under generated output moves, because only a regular
 *    file directly inside the render root is the tracked document.
 * 4. Mixed project: a render root holding only the tracked README contributes
 *    nothing while the project's resident design record still moves.
 * 5. Occupied namespace: an entry named exactly like the production segment is
 *    refused in either output root, naming the root, the namespaced
 *    destination, and the one authoritative copy to keep.
 * 6. Linked output root: a root that is a link is refused before it is read.
 */
export const test_production_layout_migration_targets = (): void => {
  TestValidator.equals(
    "a fresh project plans no move",
    run({
      generated: { kind: "entries", entries: [] },
      renders: { kind: "entries", entries: [readme] },
    }),
    [],
  );
  TestValidator.equals("absent output roots plan no move", run({}), []);

  const legacy = run({
    resident: [
      designEntry("models"),
      designEntry("production.json"),
      path.join(automovieRoot, "revision.json"),
    ],
    generated: {
      kind: "entries",
      entries: [
        { name: "shots.ts", isFile: true },
        { name: "film.ts", isFile: true },
      ],
    },
    renders: {
      kind: "entries",
      entries: [
        readme,
        { name: "preview", isFile: false },
        { name: "Final", isFile: false },
      ],
    },
  });
  TestValidator.equals(
    "a legacy layout moves its own records and namespaces each output entry",
    legacy,
    [
      {
        source: designEntry("models"),
        destination: path.join(automovieRoot, "design", "shared", "models"),
      },
      {
        source: designEntry("production.json"),
        destination: path.join(
          automovieRoot,
          "design",
          segment,
          "production.json",
        ),
      },
      {
        source: path.join(automovieRoot, "revision.json"),
        destination: path.join(
          automovieRoot,
          "productions",
          segment,
          "revision.json",
        ),
      },
      {
        source: path.join(generatedRoot, "film.ts"),
        destination: path.join(generatedRoot, segment, "film.ts"),
      },
      {
        source: path.join(generatedRoot, "shots.ts"),
        destination: path.join(generatedRoot, segment, "shots.ts"),
      },
      {
        source: path.join(renderRoot, "Final"),
        destination: path.join(renderRoot, segment, "Final"),
      },
      {
        source: path.join(renderRoot, "preview"),
        destination: path.join(renderRoot, segment, "preview"),
      },
    ],
  );
  TestValidator.equals(
    "no planned move publishes an entry inside its own source",
    legacy.filter((move) => path.dirname(move.destination) === move.source),
    [],
  );

  TestValidator.equals(
    "a directory borrowing the render document name still moves",
    run({
      renders: { kind: "entries", entries: [{ ...readme, isFile: false }] },
    }),
    [
      {
        source: path.join(renderRoot, "README.md"),
        destination: path.join(renderRoot, segment, "README.md"),
      },
    ],
  );
  TestValidator.equals(
    "generated output reserves no document name",
    run({ generated: { kind: "entries", entries: [readme] } }),
    [
      {
        source: path.join(generatedRoot, "README.md"),
        destination: path.join(generatedRoot, segment, "README.md"),
      },
    ],
  );

  TestValidator.equals(
    "the tracked render document alone keeps the render root out of a real migration",
    run({
      resident: [designEntry("production.json")],
      renders: { kind: "entries", entries: [readme] },
    }),
    [
      {
        source: designEntry("production.json"),
        destination: path.join(
          automovieRoot,
          "design",
          segment,
          "production.json",
        ),
      },
    ],
  );

  TestValidator.predicate(
    "a render entry named like the namespace is refused",
    throwsError(
      () =>
        run({
          renders: {
            kind: "entries",
            entries: [readme, { name: segment, isFile: false }],
          },
        }),
      [
        renderRoot,
        path.join(renderRoot, segment),
        "Keep one authoritative copy",
      ],
    ),
  );
  TestValidator.predicate(
    "a generated entry named like the namespace is refused",
    throwsError(
      () =>
        run({
          generated: {
            kind: "entries",
            entries: [{ name: segment, isFile: true }],
          },
        }),
      [
        generatedRoot,
        path.join(generatedRoot, segment),
        "Keep one authoritative copy",
      ],
    ),
  );

  TestValidator.predicate(
    "a linked output root is refused before it is read",
    throwsError(
      () => run({ renders: { kind: "linked" } }),
      [renderRoot, "symlink or junction"],
    ),
  );
};
