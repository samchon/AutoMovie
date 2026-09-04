import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import {
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  normalizeAutoMovieSource,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import { drawingBoxModel } from "../internal/drawingFixtures";
import { rectangularBuilding } from "../internal/envelopeFixtures";
import { productionFixture } from "./productionFixtures";

/** Project-relative address of the one design document a library fixture owns. */
export const LIBRARY_DESIGN = "docs/spaces/hall.md";

/** Exact H2 anchor the fixture's source registration realizes. */
export const LIBRARY_ANCHOR = "hall-delivery";

/**
 * One model this library owner delivers, so a plan can observe it.
 *
 * A turntable observation is the only kind that names a model, and it is the
 * only path on which the compiler asks its own binding whether that model
 * exists. Without a delivered model no fixture reaches that question, and the
 * library compile path's binding sits beside the film path's -- covered --
 * looking exactly like it and never running.
 */
export const LIBRARY_MODEL = "hall-bench";

/** Stable owner address every fixture diagnostic and receipt is written at. */
export const LIBRARY_OWNER = `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`;

/** A second H2 on the same design document, for two-owner cases. */
export const LIBRARY_SECOND_ANCHOR = "hall-annex";

/** Stable address of that second owner. */
export const LIBRARY_SECOND_OWNER = `${LIBRARY_DESIGN}#${LIBRARY_SECOND_ANCHOR}`;

/** Adjacent finite observation plan for that owner. */
export const LIBRARY_PLAN = "docs/spaces/hall.review.json";

/** The design host of the opt-in models branch. */
export const LIBRARY_MODEL_DESIGN = "docs/models/bench.md";

/** The reviewed delivery anchor that models design host publishes. */
export const LIBRARY_MODEL_ANCHOR = "bench-delivery";

/** The address the models design owner is registered and diagnosed at. */
export const LIBRARY_MODEL_OWNER = `${LIBRARY_MODEL_DESIGN}#${LIBRARY_MODEL_ANCHOR}`;

/** Where that owner's review plan and its receipts live. */
export const LIBRARY_MODEL_PLAN = "docs/models/bench.review.json";

/** The source file the models design owner binds. */
export const LIBRARY_MODEL_SOURCE = "src/models/bench.ts";

/** The one source file the fixture's reviewed space branch selects. */
export const LIBRARY_SOURCE = "src/spaces/hall.ts";

/** The map design host used by context-only contribution scenarios. */
export const LIBRARY_MAP_DESIGN = "docs/maps/site.md";

/** The reviewed map H2 that owns the fixture context. */
export const LIBRARY_MAP_ANCHOR = "site-context";

/** Exact map owner address. */
export const LIBRARY_MAP_OWNER = `${LIBRARY_MAP_DESIGN}#${LIBRARY_MAP_ANCHOR}`;

/** Adjacent map owner used by duplicate-context cases. */
export const LIBRARY_MAP_SECOND_ANCHOR = "site-annex";

/** Exact adjacent map owner address. */
export const LIBRARY_MAP_SECOND_OWNER = `${LIBRARY_MAP_DESIGN}#${LIBRARY_MAP_SECOND_ANCHOR}`;

/** The map source selected independently from the spaces source. */
export const LIBRARY_MAP_SOURCE = "src/maps/site.ts";

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
  /** Raw literal for the first owner's adopted worlds, when it adopts any. */
  contexts?: string;
  /** Raw literal for the first owner's built environments. */
  environments?: string;
  models?: string;
  second?: {
    exportName: string;
    design: string;
    environmentId: string;
    /** Raw literal for the second owner's built environments. */
    environments?: string;
    models?: string;
    /** Raw literal for the second owner's adopted worlds. */
    contexts?: string;
  };
}): string => {
  const owner = (
    name: string,
    design: string,
    environments: string,
    models: string,
    contexts = "",
  ): string =>
    `export const ${name} = {
  design: ${JSON.stringify(design)},
  build: () => ({
    environments: ${environments},
    models: ${models},${contexts}
  }),
} satisfies IAutoMovieLibrarySourceOwner;`;
  return `import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";

const HALL = ${JSON.stringify(props.environment ?? rectangularBuilding(), null, 2)};

const BENCH = ${JSON.stringify(
    drawingBoxModel({
      id: LIBRARY_MODEL,
      shape: { type: "box", width: 1.6, height: 0.45, depth: 0.4 },
      material: "bench-oak",
    }),
    null,
    2,
  )};

${owner(
  props.exportName ?? "hall",
  props.design ?? LIBRARY_OWNER,
  props.environments ??
    `[{ ...HALL, id: ${JSON.stringify(
      props.environmentId ?? (props.environment ?? rectangularBuilding()).id,
    )} }]`,
  props.models ?? "[]",
  props.contexts === undefined
    ? ""
    : `${String.fromCharCode(10)}    contexts: ${props.contexts},`,
)}
${
  props.second === undefined
    ? ""
    : owner(
        props.second.exportName,
        props.second.design,
        props.second.environments ??
          `[{ ...HALL, id: ${JSON.stringify(props.second.environmentId)} }]`,
        props.second.models ?? "[]",
        props.second.contexts === undefined
          ? ""
          : `${String.fromCharCode(10)}    contexts: ${props.second.contexts},`,
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

/** One models-branch owner that publishes only its semantic model carrier. */
export const libraryModelSourceModule = (props: {
  models: string;
  design?: string;
  exportName?: string;
}): string => `import type { IAutoMovieLibrarySourceOwner } from "@automovie/interface";

export const ${props.exportName ?? "models"} = {
  design: ${JSON.stringify(props.design ?? LIBRARY_MODEL_OWNER)},
  build: () => ({ environments: [], models: ${props.models} }),
} satisfies IAutoMovieLibrarySourceOwner;
`;

/** One reviewed space branch carrying exactly one design owner and source. */
export const libraryAuthoring = (props: {
  root: string;
  branch?: "maps" | "spaces";
  design?: string;
  anchor?: string;
  anchors?: readonly string[];
  digest?: string;
  paths?: readonly string[];
  /**
   * What the design owner's own source binding is, when it is not the ordinary
   * one.
   *
   * `none` is a branch whose source has not been started, and `empty` is a
   * binding whose selector matches no file. Both are states the compiler skips
   * rather than charges, and neither had a fixture until #2196.
   */
  binding?: "empty" | "none";
  /**
   * Whether a models design branch joins the spaces one.
   *
   * Only a models owner may plan a turntable observation; every other branch is
   * refused that evidence kind by domain. The library compile path binds its
   * own `modelExists`, `rigged`, and `fingerprint` for exactly that case, and
   * with no models branch anywhere in the fixtures those three bindings were
   * asserted by nothing.
   */
  models?: boolean;
}): IAutoMovieProductionEvidence => {
  const branch = props.branch ?? "spaces";
  const design =
    props.design ?? (branch === "maps" ? LIBRARY_MAP_DESIGN : LIBRARY_DESIGN);
  const source = branch === "maps" ? LIBRARY_MAP_SOURCE : LIBRARY_SOURCE;
  const sourceBranch = branch === "maps" ? "mapSources" : "spaceSources";
  const modelSourceBinding = {
    branch: "modelSources",
    stage: "review",
    enforced: true,
    root: "src",
    files: ["src/models/**/*.ts"],
    symbols: ["models"],
    paths: [LIBRARY_MODEL_SOURCE],
  };
  const sourceBinding = {
    branch: sourceBranch,
    stage: "review",
    enforced: true,
    root: "src",
    files: [branch === "maps" ? "src/maps/**/*.ts" : "src/spaces/**/*.ts"],
    symbols: [branch],
    paths: props.paths ?? [source],
  };
  const anchors = props.anchors ?? [
    props.anchor ?? (branch === "maps" ? LIBRARY_MAP_ANCHOR : LIBRARY_ANCHOR),
  ];
  const ownerAddresses = new Set(
    anchors.map((anchor) => `${design}#${anchor}`),
  );
  const sourceOwners = [
    ...(props.binding === "none" || props.binding === "empty"
      ? []
      : sourceOwnerFixtures({
          root: props.root,
          source,
          sourceBranch,
          owners: ownerAddresses,
        })),
    ...(props.models === true
      ? sourceOwnerFixtures({
          root: props.root,
          source: LIBRARY_MODEL_SOURCE,
          sourceBranch: "modelSources",
          owners: new Set([LIBRARY_MODEL_OWNER]),
        })
      : []),
  ];
  return {
    root: props.root,
    packageName: "library-fixture",
    description: "library fixture",
    configuration: {},
    manifest: { kind: "library" },
    designBranches: [
      { branch, designStage: "review", sourceBinding },
      ...(props.models === true
        ? [
            {
              branch: "models",
              designStage: "review",
              sourceBinding: modelSourceBinding,
            },
          ]
        : []),
    ],
    designOwners: [
      {
        branch,
        path: design,
        title: "hall design",
        units: anchors.map((anchor) => ({
          anchor,
          title: `${anchor} delivery`,
          digest: props.digest ?? "a".repeat(64),
        })),
        sourceBinding:
          props.binding === "none"
            ? null
            : props.binding === "empty"
              ? { ...sourceBinding, paths: [] }
              : sourceBinding,
      },
      ...(props.models === true
        ? [
            {
              branch: "models",
              path: LIBRARY_MODEL_DESIGN,
              title: "bench design",
              units: [
                {
                  anchor: LIBRARY_MODEL_ANCHOR,
                  title: `${LIBRARY_MODEL_ANCHOR} delivery`,
                  digest: "b".repeat(64),
                },
              ],
              sourceBinding: modelSourceBinding,
            },
          ]
        : []),
    ],
    sourceOwners,
    contracts: [],
  } as unknown as IAutoMovieProductionEvidence;
};

/** Build exact graph-edge fixtures from named owner exports in one source. */
const sourceOwnerFixtures = (props: {
  root: string;
  source: string;
  sourceBranch: string;
  owners: ReadonlySet<string>;
}): IAutoMovieProductionEvidence["sourceOwners"] => {
  const file = path.join(props.root, ...props.source.split("/"));
  if (!fs.existsSync(file)) return [];
  const bytes = normalizeAutoMovieSource(fs.readFileSync(file));
  const text = Buffer.from(bytes).toString("utf8");
  const output: IAutoMovieProductionEvidence["sourceOwners"][number][] = [];
  const declarations =
    /export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\{\s*design:\s*("(?:[^"\\]|\\.)*")/gu;
  for (const match of text.matchAll(declarations)) {
    const owner = JSON.parse(match[2]!) as string;
    if (!props.owners.has(owner)) continue;
    const separator = owner.lastIndexOf("#");
    output.push({
      branch: props.sourceBranch,
      stage: "review",
      enforced: true,
      relationship: "lineage",
      sourcePath: props.source,
      exportName: match[1]!,
      symbolKind: "property",
      sourceDigest: digestAutoMovieBytes(bytes),
      targetPath: owner.slice(0, separator),
      targetAnchor: owner.slice(separator + 1),
      reviewed: true,
    });
  }
  return output;
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
