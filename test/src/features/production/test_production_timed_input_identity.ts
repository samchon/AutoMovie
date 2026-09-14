import {
  type IAutoMovieProductionEvidence,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  type IAutoMovieFingerprintField,
  type IAutoMovieProductionContentInput,
  type IAutoMovieProductionDesignGraph,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const identity = loadSourceModule<{
  authoringEvidenceFingerprintFields(
    evidence: IAutoMovieProductionEvidence | undefined,
  ): IAutoMovieFingerprintField[];
  contentFingerprintFields(
    inputs: readonly IAutoMovieProductionContentInput[],
  ): IAutoMovieFingerprintField[];
  productionBuildInputFingerprint(
    productionId: string,
    graph: IAutoMovieProductionDesignGraph,
    sourceFields: readonly IAutoMovieFingerprintField[],
    contentFields: readonly IAutoMovieFingerprintField[],
  ): AutoMovieContentDigest;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/productionBuildIdentity.ts",
  ),
);

const OPENING = "export const opening = { beats: 3 };\n";
const WINDOWS = "D:\\a\\x";
const POSIX = "/home/b/x";

const graph: IAutoMovieProductionDesignGraph = {
  production: null,
  models: new Map(),
  world: null,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
};

const evidenceAt = (
  root: string,
  anchor: string = "opening",
): IAutoMovieProductionEvidence => ({
  root,
  packageName: "harbor",
  description: "",
  configuration: {
    ...createBlankAutoMovieProductionEvidence(root, "english"),
    kind: "film",
    settings: "review",
    shots: "review",
  },
  manifest: {
    kind: "film",
    language: "english",
    populationScope: { mode: "complete-production" },
    branches: [
      { name: "settings", stage: "review" },
      { name: "shots", stage: "review" },
    ],
    bindings: [],
    localBindings: [],
    localAudits: [],
    topology: { branches: [], expected: [], declarations: [], diagnostics: [] },
  },
  designBranches: [],
  designOwners: [],
  sourceOwners: [
    {
      branch: "shots",
      stage: "review",
      enforced: true,
      relationship: "lineage",
      sourcePath: "src/shots/opening.ts",
      exportName: "opening",
      symbolKind: "property",
      sourceDigest: digestAutoMovieBytes(Buffer.from(OPENING, "utf8")),
      targetPath: "docs/screenplays/001-harbor/001-opening.md",
      targetAnchor: anchor,
      reviewed: true,
    },
  ],
  contracts: [],
  contractRules: [],
  reviewAlarms: { alarms: [], questionPasteChecked: false },
});

const fingerprint = (props: {
  production: string;
  root: string;
  anchor?: string;
  crlf?: boolean;
}): AutoMovieContentDigest =>
  identity.productionBuildInputFingerprint(
    props.production,
    graph,
    identity.authoringEvidenceFingerprintFields(
      evidenceAt(props.root, props.anchor),
    ),
    identity.contentFingerprintFields([
      {
        path: "src/shots/opening.ts",
        source: true,
        render: false,
        bytes: Buffer.from(
          props.crlf === true
            ? `\ufeff${OPENING.replaceAll("\n", "\r\n")}`
            : OPENING,
          "utf8",
        ),
      },
      {
        path: "public/textures/sail.png",
        source: false,
        render: true,
        bytes: Buffer.from([7, 8, 9]),
      },
    ]),
  );

const encoded = (fields: readonly IAutoMovieFingerprintField[]): string[][] =>
  fields.map((field) => [
    field.role,
    field.kind,
    Buffer.from(field.payload).toString("utf8"),
  ]);

/**
 * A timed input identity is checkout-independent and namespace-bound.
 *
 * Film and brief compilation share one builder identity. It already binds the
 * production namespace and reads authoring evidence only through the
 * graph-selected owner edges, so the checkout root and declaration location
 * never reach it. This pins that shape beside the library identity, because a
 * later change to either must keep both answering the same two questions the
 * same way: is this the same work, and is it the same namespace.
 *
 * Scenarios:
 *
 * 1. Repeating the same namespace, design graph, owner edges and content gives
 *    the same fingerprint, and a CRLF and byte-order-mark checkout of the shot
 *    source gives it too.
 * 2. Another namespace with otherwise identical input gives another
 *    fingerprint.
 * 3. Owner-binding fields read from evidence at `D:\a\x` and `/home/b/x` are the
 *    same bytes and give the same fingerprint, while a changed owner anchor
 *    gives another.
 */
export const test_production_timed_input_identity = (): void => {
  const base = fingerprint({ production: "harbor", root: WINDOWS });
  TestValidator.equals(
    "one timed input identity for one input",
    namedFacts([
      [
        "repeated",
        () => fingerprint({ production: "harbor", root: WINDOWS }) === base,
      ],
      [
        "crlfCheckout",
        () =>
          fingerprint({ production: "harbor", root: WINDOWS, crlf: true }) ===
          base,
      ],
    ]),
    { repeated: true, crlfCheckout: true },
  );
  TestValidator.equals(
    "the namespace moves the timed identity",
    fingerprint({ production: "harbor-annex", root: WINDOWS }) !== base,
    true,
  );
  TestValidator.equals(
    "owner-binding fields do not see the checkout",
    encoded(identity.authoringEvidenceFingerprintFields(evidenceAt(POSIX))),
    encoded(identity.authoringEvidenceFingerprintFields(evidenceAt(WINDOWS))),
  );
  TestValidator.equals(
    "checkouts share the timed identity and owner edges still move it",
    {
      posixCheckout:
        fingerprint({ production: "harbor", root: POSIX }) === base,
      ownerAnchor:
        fingerprint({
          production: "harbor",
          root: WINDOWS,
          anchor: "opening-wide",
        }) !== base,
    },
    { posixCheckout: true, ownerAnchor: true },
  );
};
