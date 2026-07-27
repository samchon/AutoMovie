import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  productionDesign,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

const diagnosticCodes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

/** Source compilation is sandboxed, recoverable and stable after reopen. */
export const test_mcp_production_compiler = (): void => {
  const fixture = productionFixture();
  const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
  const original = fs.readFileSync(sourcePath, "utf8");
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const review = new AutoMovieProductionReviewService(project);
    const compiler = new AutoMovieProductionCompiler(project, () =>
      review.queue(),
    );

    const designOnly = compiler.lint({ scope: "design" });
    TestValidator.predicate(
      "read-only design lint does not materialize",
      designOnly.success && designOnly.materialized.length === 0,
    );
    const first = compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "starter source compiles",
      first.success &&
        first.materialized.some(
          (file) =>
            file.path === "shots/opening.json" && file.status === "created",
        ) &&
        first.reviews.entries.every(
          (entry) => entry.currentFingerprint !== null,
        ),
    );
    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/generated-manifest.json",
    );
    const generatedBeforeDesignGate = fs.readFileSync(
      generatedManifestPath,
      "utf8",
    );
    const compileDesignOnly = compiler.compile({ scope: "design" });
    TestValidator.predicate(
      "design scope never replaces current generated source output",
      compileDesignOnly.success &&
        compileDesignOnly.materialized.length === 0 &&
        fs.readFileSync(generatedManifestPath, "utf8") ===
          generatedBeforeDesignGate &&
        fs.existsSync(path.join(fixture.root, "generated/shots/opening.json")),
    );
    const reopened = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "reopen preserves identity and unchanged status",
      reopened.compiler.inputFingerprint === first.compiler.inputFingerprint &&
        reopened.materialized.every((file) => file.status === "unchanged"),
    );

    const generatedShot = path.join(
      fixture.root,
      "generated/shots/opening.json",
    );
    fs.writeFileSync(generatedShot, "{}\n");
    const tamperedLint = compiler.lint({ scope: "source" });
    TestValidator.predicate(
      "lint refuses direct generated edits",
      tamperedLint.success === false &&
        diagnosticCodes(tamperedLint).has("generated-tampered"),
    );
    const repaired = compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "compile repairs a declared generated file",
      repaired.success &&
        repaired.diagnostics.some(
          (item) =>
            item.code === "generated-tampered" && item.category === "warning",
        ) &&
        JSON.parse(fs.readFileSync(generatedShot, "utf8")).shot.id ===
          "opening",
    );
    fs.rmSync(generatedShot);
    TestValidator.predicate(
      "lint also rejects a missing declared generated file",
      compiler
        .lint({ scope: "source" })
        .diagnostics.some(
          (item) =>
            item.code === "generated-tampered" && item.message.includes("null"),
        ) && compiler.compile({ scope: "source" }).success,
    );
    const unowned = path.join(fixture.root, "generated/hand-edited.json");
    fs.writeFileSync(unowned, "{}\n");
    TestValidator.predicate(
      "unowned generated output blocks compilation",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "generated-unowned",
      ),
    );
    fs.rmSync(unowned);

    fs.rmSync(sourcePath);
    TestValidator.predicate(
      "missing bound source is diagnosed",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-path-missing",
      ),
    );
    fs.writeFileSync(sourcePath, original);
    const outside = {
      ...shotContract(),
      source: { module: "../outside.ts", export: "opening" },
    };
    project.setShotContract(outside);
    TestValidator.predicate(
      "source traversal is diagnosed",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-path-outside-root",
      ),
    );
    project.setShotContract(shotContract());

    fs.writeFileSync(
      sourcePath,
      [
        'import fs from "node:fs";',
        "export const opening = { build() {",
        'void import("node:path");',
        "Math.random(); Math.random(); Date.now(); performance.now(); crypto.randomUUID();",
        'process.cwd(); require("x"); fetch("x");',
        "({ process: 1 }).process;",
        "setTimeout(() => {}, 0); setInterval(() => {}, 0);",
        "return {};",
        "} };",
      ].join("\n"),
    );
    const capabilities = diagnosticCodes(compiler.compile({ scope: "source" }));
    TestValidator.predicate(
      "runtime imports, entropy and ambient capabilities are rejected",
      capabilities.has("source-import-unsupported") &&
        capabilities.has("source-nondeterministic") &&
        capabilities.has("source-capability-forbidden"),
    );
    fs.writeFileSync(
      sourcePath,
      original.replace(
        "build: (context) => {",
        [
          "build: (context) => {",
          '    context.engine.distance.constructor("return process")();',
        ].join("\n"),
      ),
    );
    TestValidator.predicate(
      "VM source cannot climb through an injected host function constructor",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-failed",
      ),
    );

    fs.writeFileSync(sourcePath, "export const somethingElse = 1;\n");
    TestValidator.predicate(
      "missing named build export is rejected",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-missing",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      "export const opening = { build() { return Promise.resolve({}); } };\n",
    );
    TestValidator.predicate(
      "async source is rejected",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-invalid",
      ),
    );
    for (const expression of ["{}", "undefined"]) {
      fs.writeFileSync(
        sourcePath,
        `export const opening = { build() { return ${expression}; } };\n`,
      );
      TestValidator.predicate(
        `structurally invalid source result ${expression} is rejected`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-export-invalid",
        ),
      );
    }
    fs.writeFileSync(
      sourcePath,
      'export const opening = { build() { throw "boom"; } };\n',
    );
    TestValidator.predicate(
      "source exceptions are isolated",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-failed",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      'export const opening = { build() { throw { message: "object boom" }; } };\n',
    );
    TestValidator.predicate(
      "object-shaped source exceptions retain their message",
      compiler
        .compile({ scope: "source" })
        .diagnostics.some((item) => item.message.includes("object boom")),
    );
    for (const expression of ["null", "{}"]) {
      fs.writeFileSync(
        sourcePath,
        `export const opening = { build() { throw ${expression}; } };\n`,
      );
      TestValidator.predicate(
        `source exception ${expression} is stringified`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-execution-failed",
        ),
      );
    }
    fs.writeFileSync(
      sourcePath,
      "export const opening = { build() { while (true) {} } };\n",
    );
    TestValidator.predicate(
      "source execution has a hard timeout",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-timeout",
      ),
    );
    const getterSource = original
      .replace(
        "    return {\n      models: [model],",
        "    const output = {\n      models: [model],",
      )
      .replace(
        "\n    };\n  },\n};\n",
        [
          "",
          "    };",
          '    Object.defineProperty(output, "shot", {',
          "      get() { while (true) {} },",
          "    });",
          "    return output;",
          "  },",
          "};",
          "",
        ].join("\n"),
      );
    fs.writeFileSync(sourcePath, getterSource);
    TestValidator.predicate(
      "returned getters are snapshotted inside the VM timeout",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-timeout",
      ),
    );
    fs.writeFileSync(sourcePath, "export const opening = { build: ( => 1 };\n");
    TestValidator.predicate(
      "transpile failures are source diagnostics",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-transpile-failed",
      ),
    );

    const instrumented = original.replace(
      "build: (context) => {",
      [
        "build: (context) => {",
        "    console.log(context.engine.distance(",
        "      { x: 0, y: 0, z: 0 },",
        "      { x: 3, y: 4, z: 0 },",
        "    ));",
        "    console.warn(context.engine.groundHeight({ x: 1, z: 1 }));",
        "    console.error(context.engine.groundHeight({ x: 99, z: 99 }));",
      ].join("\n"),
    );
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "constant ground geometry is available in the source oracle",
      compiler.compile({ scope: "source" }).success,
    );
    project.setWorldDesign({
      ...worldDesign(),
      surfaces: [
        {
          ...worldDesign().surfaces[0]!,
          height: {
            kind: "plane",
            originHeight: 1,
            slopeX: 0.1,
            slopeZ: 0.2,
          },
        },
      ],
    });
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "explicit geometry helpers run in the frozen sandbox",
      compiler.compile({ scope: "source" }).success,
    );
    project.setWorldDesign(worldDesign());
    fs.writeFileSync(sourcePath, original);

    fs.writeFileSync(
      sourcePath,
      original.replace(
        "skeleton: skeleton.id,\n      duration:",
        'skeleton: "missing-skeleton",\n      duration:',
      ),
    );
    TestValidator.predicate(
      "motion skeleton references are compiler gates",
      compiler
        .compile({ scope: "source" })
        .diagnostics.some(
          (item) =>
            item.code === "engine-validation-failed" &&
            item.message.includes("missing skeleton"),
        ),
    );
    fs.writeFileSync(
      sourcePath,
      original.replace(
        "skeleton,\n      body:",
        "skeleton: null,\n      body:",
      ),
    );
    TestValidator.predicate(
      "skeleton-free compiled models still traverse engine validation",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "engine-validation-failed",
      ),
    );
    fs.writeFileSync(sourcePath, original);

    const residentReadSource = project.readSource;
    project.readSource = (() => {
      const iterator = (function* (): Generator<void> {
        yield;
      })();
      iterator.next();
      return iterator.throw("non-error source failure") as never;
    }) as typeof project.readSource;
    TestValidator.predicate(
      "non-Error source failures remain actionable diagnostics",
      compiler
        .compile({ scope: "source" })
        .diagnostics.some((item) =>
          item.message.includes("non-error source failure"),
        ),
    );
    project.readSource = residentReadSource;
    const residentReadGenerated = project.readGeneratedFile;
    project.readGeneratedFile = (() => {
      const iterator = (function* (): Generator<void> {
        yield;
      })();
      iterator.next();
      return iterator.throw("non-error generated failure") as never;
    }) as typeof project.readGeneratedFile;
    TestValidator.predicate(
      "non-Error generated path failures remain actionable diagnostics",
      compiler
        .lint({ scope: "source" })
        .diagnostics.some(
          (item) =>
            item.code === "generated-path-outside" &&
            item.message.includes("unsafe"),
        ),
    );
    project.readGeneratedFile = residentReadGenerated;

    const durationNeedle = "duration: context.contract.durationSeconds,";
    const durationIndex = original.lastIndexOf(durationNeedle);
    const wrongIdentity = `${original
      .slice(0, durationIndex)
      .replace(
        "id: context.contract.id,",
        'id: "wrong-shot",',
      )}duration: context.contract.durationSeconds - 1,${original.slice(
      durationIndex + durationNeedle.length,
    )}`;
    fs.writeFileSync(sourcePath, wrongIdentity);
    TestValidator.predicate(
      "compiled shot identity and duration are engine gates",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "engine-validation-failed",
      ),
    );
    fs.writeFileSync(sourcePath, original);

    const fingerprints = {
      currentFingerprint: null,
      storedFingerprint: null,
    } as const;
    const reviewGate = new AutoMovieProductionCompiler(project, () => ({
      entries: [
        {
          target: { kind: "source", path: "src/shots/opening.ts" },
          state: "missing",
          ...fingerprints,
        },
        {
          target: { kind: "shot", id: "opening" },
          state: "stale",
          ...fingerprints,
        },
        {
          target: { kind: "film", id: "fixture-film" },
          state: "revise",
          ...fingerprints,
        },
        {
          target: {
            kind: "design",
            design: { kind: "model", id: "sentinel" },
          },
          state: "incomplete",
          ...fingerprints,
        },
        {
          target: {
            kind: "design",
            design: { kind: "production" },
          },
          state: "complete",
          ...fingerprints,
        },
        {
          target: { kind: "design", design: { kind: "world" } },
          state: "complete",
          ...fingerprints,
        },
      ],
    }));
    const reviewCodes = diagnosticCodes(
      reviewGate.compile({ scope: "review" }),
    );
    TestValidator.predicate(
      "review compile maps every queue state to a hard gate",
      [
        "review-missing",
        "review-stale",
        "review-revise",
        "review-incomplete",
      ].every((code) => reviewCodes.has(code)),
    );

    project.setProductionDesign({
      ...productionDesign(),
      deliverables: [
        { id: "required-feature", kind: "feature", required: true },
      ],
    });
    const finalCompiler = new AutoMovieProductionCompiler(project);
    const missingRender = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(
      path.join(fixture.root, ".automovie/render-manifest.json"),
      "{}",
    );
    const staleRender = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(
      path.join(fixture.root, ".automovie/render-manifest.json"),
      "{bad",
    );
    const malformedRender = finalCompiler.compile({ scope: "final" });
    fs.rmSync(path.join(fixture.root, ".automovie/render-manifest.json"));
    fs.mkdirSync(path.join(fixture.root, ".automovie/render-manifest.json"));
    const unsafeRender = finalCompiler.compile({ scope: "final" });
    fs.rmdirSync(path.join(fixture.root, ".automovie/render-manifest.json"));
    fs.writeFileSync(
      path.join(fixture.root, ".automovie/render-manifest.json"),
      JSON.stringify({
        compileFingerprint: staleRender.compiler.inputFingerprint,
      }),
    );
    TestValidator.predicate(
      "final compile requires a structurally current aggregate render",
      diagnosticCodes(missingRender).has("render-deliverable-missing") &&
        diagnosticCodes(staleRender).has("render-deliverable-stale") &&
        diagnosticCodes(malformedRender).has("render-deliverable-stale") &&
        diagnosticCodes(unsafeRender).has("render-deliverable-stale") &&
        finalCompiler.compile({ scope: "final" }).success,
    );
    project.eraseDesignArtifact({ kind: "production" });
    TestValidator.predicate(
      "final diagnostics tolerate an absent production while design owns error",
      diagnosticCodes(finalCompiler.compile({ scope: "final" })).has(
        "design-missing",
      ),
    );
    TestValidator.predicate(
      "mutation consequences retain a film target without production metadata",
      project
        .setWorldDesign(worldDesign())
        .consequences.staleReviews.some(
          (target) => target.kind === "film" && target.id === "film",
        ),
    );
    project.setProductionDesign(productionDesign());

    project.eraseDesignArtifact({ kind: "world" });
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "missing world uses the bounded empty source context before design refusal",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "design-missing",
      ),
    );
    fs.writeFileSync(sourcePath, original);
    project.setWorldDesign(worldDesign());

    const noDesignRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-production-empty-"),
    );
    try {
      const empty = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(noDesignRoot),
      ).compile({ scope: "design" });
      TestValidator.predicate(
        "empty repository reports all required design classes",
        empty.success === false &&
          empty.diagnostics.filter((item) => item.code === "design-missing")
            .length === 3,
      );
    } finally {
      fs.rmSync(noDesignRoot, { force: true, recursive: true });
    }
  } finally {
    fixture.dispose();
  }
};
