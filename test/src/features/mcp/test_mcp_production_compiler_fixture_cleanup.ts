import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
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
    const noDesign = statements[621];
    if (
      unmanifested === undefined ||
      ts.isTryStatement(unmanifested) === false ||
      noDesign === undefined ||
      ts.isTryStatement(noDesign) === false
    )
      return [];
    const substantive = statements.filter(
      (_, index) => ![102, 104, 619, 621].includes(index),
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
        acquisition: compact(statements[620]!, source),
        bodyStatements: statements.length,
        failureHolder: compact(statements[619]!, source),
        index: 621,
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
  TestValidator.equals(
    "production-compiler cleanup preserves nested and outer failures",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successFailure",
        () => success.caught === false && success.failure === undefined,
      ],
      [
        "successAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1,
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1,
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught,
      ],
      [
        "standaloneFailureCleanupFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure,
      ],
      [
        "standaloneAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure &&
          standalone.attempts === 1,
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure &&
          standalone.attempts === 1 &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
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
          ]),
      ],
      ["combinedAttempts", () => combined.attempts === 1],
      ["nestedCombinedCaught", () => nestedCombined.caught],
      [
        "aggregateContainsExactlyNestedCombinedFailure",
        () =>
          aggregateContainsExactly(nestedCombined.failure, [
            nestedCleanupFailure,
            cleanupFailure,
          ]),
      ],
      ["nestedCombinedAttempts", () => nestedCombined.attempts === 1],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      ["undefinedPrimaryAttempts", () => undefinedPrimary.attempts === 1],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      ["undefinedStandaloneAttempts", () => undefinedStandalone.attempts === 1],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      ["undefinedCombinedAttempts", () => undefinedCombined.attempts === 1],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successAttempts: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyAttempts: true,
      standaloneCaught: true,
      standaloneFailureCleanupFailure: true,
      standaloneAttempts: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedAttempts: true,
      nestedCombinedCaught: true,
      aggregateContainsExactlyNestedCombinedFailure: true,
      nestedCombinedAttempts: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryAttempts: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneAttempts: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedAttempts: true,
    },
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
            substantiveStatements: 618,
            substantiveTokenDigest:
              "571312e1f0b2f67a781ebf248b9770cb656d79b4cc9ccb1b666708d35e33986c",
            tryDigest:
              "edc382047ede4abd7cb8d948c1dd8d35df39e8d3b19d016461a5d6b037344833",
            tryStatements: 622,
          },
          {
            acquisition: "constunmanifestedFixture=productionFixture();",
            bodyStatements: 622,
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
              "2c795f14bf89c64648a19730b8f8fcd2e2ac7c2555ca413275057bd250ac234f",
            tryDigest:
              "c3850b70bbf1d9894979cb6c457b0c5bbee880e67f4f2bb3cafac3e3848f5f71",
            tryStatements: 9,
          },
          {
            acquisition:
              'constnoDesignRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-production-empty-"),);',
            bodyStatements: 622,
            catchBodies: ["noDesignFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letnoDesignFailure:IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(noDesignFailure,()=>fs.rmSync(noDesignRoot,{force:true,recursive:true}),);",
            ],
            index: 621,
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
