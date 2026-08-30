import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  GRAPH_DEFINITIONS,
  evidenceCarriers,
  graphEnabledPackages,
  inspectRepositoryEvidencePopulations,
  reportRepositoryEvidencePopulations,
  runRepositoryEvidencePopulationGate,
} from "../../integrity/repositoryEvidencePopulation";

interface IScenario {
  name: string;
  run: () => unknown;
}

const scenarios: IScenario[] = [];
const test = (name: string, run: () => unknown): void => {
  scenarios.push({ name, run });
};

interface ILintConfigModule {
  default?: { rules?: Record<string, unknown> };
  rules?: Record<string, unknown>;
}

const fixture = () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-evidence-population-"),
  );
  const source = path.join(root, "packages", "sample", "src");
  const contracts = path.join(root, "docs", "requirements");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(contracts, { recursive: true });
  fs.writeFileSync(
    path.join(contracts, "sample.md"),
    "# Sample\n\n### Unit {#unit}\n\n### Other {#other}\n",
  );
  fs.writeFileSync(
    path.join(root, "packages", "sample", "lint.config.ts"),
    'const files = ["src/**/*.ts"];\nexport default { rules: { "evidence/graph": "error" }, name: "sample claim", contract: "requirements/sample.md" };\n',
  );
  fs.writeFileSync(
    path.join(source, "surface.ts"),
    "/**\n * Sample.\n * @evidence requirements/sample.md#unit Implements the sample.\n * @evidenceExclude requirements/sample.md#other The other unit is upstream.\n */\nexport const sample = 1;\n",
  );
  fs.writeFileSync(path.join(source, "notes.md"), "not a source\n");
  return root;
};

const definition = {
  package: "sample",
  excludeIndex: false,
  sourceGlob: 'files = ["src/**/*.ts"]',
  claims: [{ name: "sample claim", contracts: ["requirements/sample.md"] }],
};

test("reports the real production and playground populations", () => {
  const root = path.resolve(__dirname, "../../../..");
  const result = inspectRepositoryEvidencePopulations(root, GRAPH_DEFINITIONS);
  const output: string[] = [];
  reportRepositoryEvidencePopulations(result, (line) => output.push(line));
  console.log(output.join("\n"));
  assert.deepEqual(result.diagnostics, []);
  // Every package that runs this graph, not the two the definitions name. The
  // other eleven enabled it and went unmeasured, which is the opaque boolean
  // this guard exists to prevent arrived at from the other side.
  assert.deepEqual(
    result.graphs.map((graph) => graph.package),
    [
      "production",
      "playground",
      ...graphEnabledPackages(root).filter(
        (name) => name !== "production" && name !== "playground",
      ),
    ],
  );
  assert.deepEqual(graphEnabledPackages(root), [
    "archetypes",
    "cli",
    "create-automovie",
    "engine",
    "evidence",
    "face",
    "ingest",
    "interface",
    "playground",
    "production",
    "render",
    "template",
    "viewer",
  ]);
  // The ratio the gate now prints. It refuses only a package that selected no
  // host at all, because selection is not obligation -- but an eleven-of-
  // fifty-eight population is a fact a reader should meet without asking.
  assert.deepEqual(
    result.graphs
      .filter((graph) => graph.package === "production")
      .map((graph) => [graph.sources, graph.carrierFiles]),
    [[58, 11]],
  );
  // The gate's accepting exit, pinned beside the refusals below. A gate only
  // ever watched refusing is one nobody has watched agree, and this is the
  // status the CI lane reads.
  assert.equal(
    runRepositoryEvidencePopulationGate(root, () => undefined),
    0,
  );

  // And the refusal the widening adds, produced rather than assumed: a package
  // whose configured graph selected no citation host at all. Read against a
  // tree carrying one, because a rule that has never refused is a rule nobody
  // has watched work.
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-graph-pop-"));
  try {
    const silent = path.join(tree, "packages", "quiet", "src");
    fs.mkdirSync(silent, { recursive: true });
    fs.writeFileSync(
      path.join(tree, "packages", "quiet", "lint.config.ts"),
      ['export default { rules: { "evidence/graph": [] } };', ""].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(silent, "value.ts"),
      ["export const value = 1;", ""].join("\n"),
      "utf8",
    );
    assert.deepEqual(
      inspectRepositoryEvidencePopulations(tree, []).diagnostics,
      ["quiet: evidence/graph is enabled and selected no citation host"],
    );
    // A root with no packages at all answers with none rather than throwing:
    // the derivation is asked about whatever root the caller points at.
    assert.deepEqual(graphEnabledPackages(path.join(tree, "elsewhere")), []);
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
  }
});

test("executes both real evidence graph configurations", () => {
  const root = path.resolve(__dirname, "../../../..");
  for (const name of ["playground", "production"]) {
    const loaded = require(
      path.join(root, "packages", name, "lint.config.ts"),
    ) as ILintConfigModule;
    const config = loaded.default ?? loaded;
    assert.ok(Array.isArray(config.rules?.["evidence/graph"]));
  }
});

test("each real graph turns red when one required citation target is invalid", () => {
  const root = path.resolve(__dirname, "../../../..");
  const probes: Array<{
    package: string;
    reference: string;
    source: string;
  }> = [
    {
      package: "production",
      source: "packages/production/src/production/AutoMovieProductionBinder.ts",
      reference:
        "requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables",
    },
    {
      package: "playground",
      source: "packages/playground/src/film-view.ts",
      reference:
        "requirements/product/prototype-quality.md#product-prototype-geometry",
    },
  ];
  for (const probe of probes) {
    const definition_ = GRAPH_DEFINITIONS.find(
      (candidate) => candidate.package === probe.package,
    );
    assert.ok(definition_);
    const claim = definition_.claims[0];
    assert.ok(claim);
    const target = path.join(root, probe.source);
    let removals = 0;
    const result = inspectRepositoryEvidencePopulations(
      root,
      [definition_],
      (file) => {
        const text = fs.readFileSync(file, "utf8");
        if (path.resolve(file) !== path.resolve(target)) return text;
        const citation = `@evidence ${probe.reference}`;
        if (text.includes(citation) === false)
          throw new Error(`${probe.source} does not carry ${citation}`);
        removals++;
        return text.replace(citation, `${citation}-probe-that-does-not-exist`);
      },
    );
    assert.equal(removals, 1);
    assert.ok(
      result.diagnostics.includes(
        `${probe.package}: claim '${claim.name}' cites missing reference '${probe.reference}-probe-that-does-not-exist'`,
      ),
    );
    assert.deepEqual(
      inspectRepositoryEvidencePopulations(root, [definition_]).diagnostics,
      [],
    );
  }
});

test("reports actual carrier and claim populations", () => {
  const root = fixture();
  try {
    const result = inspectRepositoryEvidencePopulations(root, [definition]);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.graphs, [
      {
        package: "sample",
        sources: 1,
        carrierFiles: 1,
        carriers: 1,
        claims: [
          {
            name: "sample claim",
            hosts: 1,
            citations: 2,
            positive: 1,
            exclusions: 1,
          },
        ],
      },
    ]);
    const output: string[] = [];
    reportRepositoryEvidencePopulations(result, (line) => output.push(line));
    assert.match(output.join("\n"), /1 hosts, 2 citations/u);
    assert.equal(evidenceCarriers(root, definition).carriers.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuses an empty, disconnected, or incomplete graph", () => {
  const root = fixture();
  try {
    fs.writeFileSync(
      path.join(root, "packages", "sample", "lint.config.ts"),
      "export default {};\n",
    );
    fs.writeFileSync(
      path.join(root, "packages", "sample", "src", "surface.ts"),
      "export const sample = 1;\n",
    );
    const result = inspectRepositoryEvidencePopulations(root, [definition]);
    assert.deepEqual(result.diagnostics, [
      "sample: evidence/graph is not enabled",
      'sample: configured source population is not the reviewed files = ["src/**/*.ts"]',
      "sample: evidence carrier population is empty",
      "sample: missing graph claim 'sample claim'",
      "sample: claim 'sample claim' omits 'requirements/sample.md'",
      "sample: claim 'sample claim' has no citation host",
      "sample: claim 'sample claim' has no positive citation",
    ]);
    const output: string[] = [];
    reportRepositoryEvidencePopulations(result, (line) => output.push(line));
    assert.match(output.at(-1) ?? "", /^ERROR:/u);
    assert.equal(
      runRepositoryEvidencePopulationGate(root, () => undefined),
      1,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuses a missing graph config and an empty source population", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-evidence-empty-"),
  );
  try {
    fs.mkdirSync(path.join(root, "packages", "sample", "src"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "docs", "requirements"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "docs", "requirements", "sample.md"),
      "# Sample\n\n### Unit {#unit}\n\n### Other {#other}\n",
    );
    const missing = inspectRepositoryEvidencePopulations(root, [definition]);
    assert.deepEqual(missing.diagnostics, ["sample: missing lint.config.ts"]);

    fs.writeFileSync(
      path.join(root, "packages", "sample", "lint.config.ts"),
      'const files = ["src/**/*.ts"];\nexport default { rules: { "evidence/graph": "error" }, name: "sample claim", contract: "requirements/sample.md" };\n',
    );
    const empty = inspectRepositoryEvidencePopulations(root, [definition]);
    assert.ok(empty.diagnostics.includes("sample: source population is empty"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** Repository graphs expose their real populations and refuse disconnection. */
export const test_evidence_repository_graph_population =
  async (): Promise<void> => {
    for (const scenario of scenarios) await scenario.run();
  };
