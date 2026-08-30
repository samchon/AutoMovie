import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { AutoMovieProductionProject } from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { productionFixture } from "./productionFixtures";

/** Project-relative address of the one design document a library fixture owns. */
export const LIBRARY_DESIGN = "docs/spaces/hall.md";

/** Exact H2 anchor the fixture's source registration realizes. */
export const LIBRARY_ANCHOR = "hall-delivery";

/** Stable owner address every fixture diagnostic and receipt is written at. */
export const LIBRARY_OWNER = `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`;

/** A second H2 on the same design document, for two-owner cases. */
export const LIBRARY_SECOND_ANCHOR = "hall-annex";

/** Stable address of that second owner. */
export const LIBRARY_SECOND_OWNER = `${LIBRARY_DESIGN}#${LIBRARY_SECOND_ANCHOR}`;

/** Adjacent finite observation plan for that owner. */
export const LIBRARY_PLAN = "docs/spaces/hall.review.json";

/** The one source file the fixture's reviewed space branch selects. */
export const LIBRARY_SOURCE = "src/spaces/hall.ts";

/**
 * A library source module publishing one hand-typed building.
 *
 * The record is serialized from the same fixture the envelope derivations are
 * calibrated against rather than retyped here, so the topology a compile
 * publishes and the topology the derivation was proved on cannot drift apart.
 * What the module adds is the part under test: a named export that registers an
 * exact reviewed design owner and returns a contribution.
 */
export const librarySourceModule = (props: {
  design?: string;
  environment?: IAutoMovieBuiltEnvironment;
  environmentId?: string;
  exportName?: string;
  models?: string;
  second?: {
    exportName: string;
    design: string;
    environmentId: string;
    models?: string;
  };
}): string => {
  const owner = (
    name: string,
    design: string,
    id: string,
    models: string,
  ): string =>
    `export const ${name} = {
  design: ${JSON.stringify(design)},
  build: () => ({
    environments: [{ ...HALL, id: ${JSON.stringify(id)} }],
    models: ${models},
  }),
} satisfies IAutoMovieLibrarySourceOwner;`;
  return `import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";

const HALL = ${JSON.stringify(props.environment ?? rectangularBuilding(), null, 2)};

${owner(
  props.exportName ?? "hall",
  props.design ?? LIBRARY_OWNER,
  props.environmentId ?? (props.environment ?? rectangularBuilding()).id,
  props.models ?? "[]",
)}
${
  props.second === undefined
    ? ""
    : owner(
        props.second.exportName,
        props.second.design,
        props.second.environmentId,
        props.second.models ?? "[]",
      )
}
`;
};

/**
 * One minimal reusable model a library owner may publish beside its building.
 *
 * A box is the smallest thing `validateModel` accepts, which is what this is
 * for: the case under test is publication and ownership, not geometry.
 */
export const libraryModelLiteral = (id: string): string =>
  JSON.stringify(
    {
      id,
      name: `library fixture ${id}`,
      origin: "generated",
      skeleton: null,
      materials: [],
      parts: [
        {
          id: "box",
          name: null,
          geometry: {
            type: "primitive",
            shape: { type: "box", width: 1, height: 1, depth: 1 },
          },
          material: null,
          attachedBone: null,
          transform: null,
        },
      ],
      asset: null,
      body: null,
    },
    null,
    2,
  );

/** One reviewed space branch carrying exactly one design owner and source. */
export const libraryAuthoring = (props: {
  root: string;
  design?: string;
  anchor?: string;
  anchors?: readonly string[];
  digest?: string;
  paths?: readonly string[];
}): IAutoMovieProductionEvidence => {
  const sourceBinding = {
    branch: "spaceSources",
    stage: "review",
    enforced: true,
    root: "src",
    files: ["src/spaces/**/*.ts"],
    symbols: ["spaces"],
    paths: props.paths ?? [LIBRARY_SOURCE],
  };
  return {
    root: props.root,
    packageName: "library-fixture",
    description: "library fixture",
    configuration: {},
    manifest: { kind: "library" },
    designBranches: [
      { branch: "spaces", designStage: "review", sourceBinding },
    ],
    designOwners: [
      {
        branch: "spaces",
        path: props.design ?? LIBRARY_DESIGN,
        title: "hall design",
        units: (props.anchors ?? [props.anchor ?? LIBRARY_ANCHOR]).map(
          (anchor) => ({
            anchor,
            title: `${anchor} delivery`,
            digest: props.digest ?? "a".repeat(64),
          }),
        ),
        sourceBinding,
      },
    ],
    contracts: [],
  } as unknown as IAutoMovieProductionEvidence;
};

/**
 * A disposable generated project whose library source is real bytes on disk.
 *
 * The compiler reads, links, transpiles, evaluates and publishes through the
 * project store exactly as a generated project's own compile command does. A
 * reader stubbed in memory would prove the arithmetic and nothing about whether
 * a compile ever writes a file, which is the whole question here.
 */
export const libraryFixture = (
  files: Readonly<Record<string, string>> = {},
): {
  root: string;
  dispose: () => void;
  write: (relative: string, content: string) => void;
  read: (relative: string) => string | null;
  generated: (relative: string) => string | null;
  writeGenerated: (relative: string, content: string) => void;
} => {
  const fixture = productionFixture();
  const write = (relative: string, content: string): void => {
    const file = path.join(fixture.root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  };
  try {
    write(LIBRARY_SOURCE, librarySourceModule({}));
    write(
      LIBRARY_PLAN,
      `${JSON.stringify(
        {
          version: 1,
          units: [
            {
              anchor: LIBRARY_ANCHOR,
              sources: [LIBRARY_SOURCE],
              observations: [
                { id: "plan-section-elevation", evidence: "artifact" },
              ],
              receipts: [],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    for (const [relative, content] of Object.entries(files))
      write(relative, content);
  } catch (error) {
    fixture.dispose();
    throw error;
  }
  // Activate the production once, exactly as a generated project's first
  // command does. Until something opens the project for writing there is no
  // state incarnation, and every read-only reader -- the lint path and the
  // offline observation command both -- refuses by name. Nothing is compiled
  // here: no source has run and no artifact exists yet.
  AutoMovieProductionProject.open(fixture.root);

  // The compiler-owned root is the project store's own answer rather than a
  // path spelled a second time here, so a layout change fails the product's
  // reader instead of quietly pointing this fixture at a directory nobody uses.
  const generatedRoot = (): string =>
    AutoMovieProductionProject.openReadOnly(fixture.root).generatedRoot();
  return {
    root: fixture.root,
    dispose: fixture.dispose,
    write,
    read: (relative) => {
      const file = path.join(fixture.root, ...relative.split("/"));
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    },
    generated: (relative) => {
      const file = path.join(generatedRoot(), ...relative.split("/"));
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    },
    writeGenerated: (relative, content) => {
      const file = path.join(generatedRoot(), ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, "utf8");
    },
  };
};
