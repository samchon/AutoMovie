import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionCompilerFixtureCleanup } from "./test_mcp_production_compiler";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenDigest = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): string => {
  const tokens: Array<[ts.SyntaxKind, string]> = [];
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(source);
    if (children.length !== 0) children.forEach(visit);
    else {
      const text = node.getText(source);
      if (text.length !== 0) tokens.push([node.kind, text]);
    }
  };
  nodes.forEach(visit);
  return digestText(JSON.stringify(tokens));
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const lifecycleContract = (
  lifecycle: ts.TryStatement,
  source: ts.SourceFile,
): {
  catchBodies: string[];
  catchVariables: string[];
  finallyBodies: string[];
  tryDigest: string;
  tryStatements: number;
} => ({
  catchBodies: (lifecycle.catchClause?.block.statements ?? []).map(
    (statement) => compact(statement, source),
  ),
  catchVariables:
    lifecycle.catchClause?.variableDeclaration === undefined
      ? []
      : [compact(lifecycle.catchClause.variableDeclaration, source)],
  finallyBodies: (lifecycle.finallyBlock?.statements ?? []).map((statement) =>
    compact(statement, source),
  ),
  tryDigest: digestText(lifecycle.tryBlock.getText(source)),
  tryStatements: lifecycle.tryBlock.statements.length,
});

const productionCompilerFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_compiler.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [
                {
                  arrow: declaration.initializer,
                  name: declaration.name.text,
                },
              ]
            : [],
        )
      : [],
  );
  const owners = arrows.filter(
    (entry) => entry.name === "test_mcp_production_compiler",
  );
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    const outer = body.statements[2];
    if (outer === undefined || ts.isTryStatement(outer) === false) return [];
    const statements = outer.tryBlock.statements;
    const unmanifested = statements[104];
    const noDesign = statements[596];
    if (
      unmanifested === undefined ||
      ts.isTryStatement(unmanifested) === false ||
      noDesign === undefined ||
      ts.isTryStatement(noDesign) === false
    )
      return [];
    const substantive = statements.filter(
      (_, index) => ![102, 104, 594, 596].includes(index),
    );
    return [
      {
        acquisition: compact(body.statements[1]!, source),
        bodyStatements: body.statements.length,
        failureHolder: compact(body.statements[0]!, source),
        index: 2,
        kind: "main",
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        substantiveStatements: substantive.length,
        substantiveTokenDigest: leafTokenDigest(substantive, source),
        ...lifecycleContract(outer, source),
      },
      {
        acquisition: compact(statements[103]!, source),
        bodyStatements: statements.length,
        failureHolder: compact(statements[102]!, source),
        index: 104,
        kind: "unmanifested",
        ownerParameters: [],
        substantiveStatements: unmanifested.tryBlock.statements.length,
        substantiveTokenDigest: leafTokenDigest(
          unmanifested.tryBlock.statements,
          source,
        ),
        ...lifecycleContract(unmanifested, source),
      },
      {
        acquisition: compact(statements[595]!, source),
        bodyStatements: statements.length,
        failureHolder: compact(statements[594]!, source),
        index: 596,
        kind: "no-design",
        ownerParameters: [],
        substantiveStatements: noDesign.tryBlock.statements.length,
        substantiveTokenDigest: leafTokenDigest(
          noDesign.tryBlock.statements,
          source,
        ),
        ...lifecycleContract(noDesign, source),
      },
    ];
  });
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionCompilerFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      bodyDigests: policies.map((entry) =>
        digestText(entry.arrow.body.getText(source)),
      ),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionCompilerFixtureCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { attempts: number; caught: boolean; failure: unknown } => {
  let attempts = 0;
  let caught = false;
  let failure: unknown;
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionCompilerFixtureCleanup(primaryState, (): void => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure.error;
      });
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_production_compiler_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-compiler assertion" };
  const cleanupFailure = { phase: "production-compiler fixture removal" };
  const nestedCleanupFailure = new AggregateError(
    [{ phase: "nested compiler fixture cleanup" }],
    "Nested compiler cleanup failed.",
  );
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
  });
  const combined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
  });
  const nestedCombined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: nestedCleanupFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
  });
  const undefinedCombined = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "production-compiler cleanup preserves nested and outer failures",
    success.caught === false &&
      success.failure === undefined &&
      success.attempts === 1 &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.attempts === 1 &&
      standalone.caught &&
      standalone.failure === cleanupFailure &&
      standalone.attempts === 1 &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        cleanupFailure,
      ]) &&
      combined.attempts === 1 &&
      nestedCombined.caught &&
      aggregateContainsExactly(nestedCombined.failure, [
        nestedCleanupFailure,
        cleanupFailure,
      ]) &&
      nestedCombined.attempts === 1 &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.attempts === 1 &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.attempts === 1 &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.attempts === 1,
  );
  TestValidator.equals(
    "production-compiler test owns all three fixture lifecycles",
    productionCompilerFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_compiler.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            bodyStatements: 3,
            catchBodies: ["productionCompilerFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letproductionCompilerFailure:IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(productionCompilerFailure,()=>fixture.dispose(),);",
            ],
            index: 2,
            kind: "main",
            ownerParameters: [],
            substantiveStatements: 593,
            substantiveTokenDigest:
              "80d8113eaf31b7e7327646708116e038335e5691aa5520b62c369d8efe277492",
            tryDigest:
              "0ff04ca9885e5ea8adbd6ef61e7dc2a2cb7e4b673528bcc9fd99aabfa59e7b7d",
            tryStatements: 597,
          },
          {
            acquisition: "constunmanifestedFixture=productionFixture();",
            bodyStatements: 597,
            catchBodies: ["unmanifestedFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letunmanifestedFixtureFailure:|IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(unmanifestedFixtureFailure,()=>unmanifestedFixture.dispose(),);",
            ],
            index: 104,
            kind: "unmanifested",
            ownerParameters: [],
            substantiveStatements: 9,
            substantiveTokenDigest:
              "8233f5fbc62a185b42637b4c81c49b5e0df0f916397d8a2b012eebdd50d0321f",
            tryDigest:
              "af1c585ae92d76e8145379422e6f30c830317e42add7491c161526511a29bfa6",
            tryStatements: 9,
          },
          {
            acquisition:
              'constnoDesignRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-production-empty-"),);',
            bodyStatements: 597,
            catchBodies: ["noDesignFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letnoDesignFailure:IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(noDesignFailure,()=>fs.rmSync(noDesignRoot,{force:true,recursive:true}),);",
            ],
            index: 596,
            kind: "no-design",
            ownerParameters: [],
            substantiveStatements: 2,
            substantiveTokenDigest:
              "01102e6c4c80a020c1cac8a7866258b39107f65c50742d9311a387f7e4e12654",
            tryDigest:
              "dc10df26cb6d6ded90e12c54fafa708bf3a148b8bda6216f2cb97aca62130f30",
            tryStatements: 2,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionCompilerFixtureCleanupError([failure.error,cleanupFailure],"Production-compilerfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "80d593808f53cbef7efac9a49669a8b6d8b70ff3dc1ea5544c4134a1746131d6",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionCompilerFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
