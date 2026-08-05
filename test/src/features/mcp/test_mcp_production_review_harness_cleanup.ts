import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionReviewHarnessCleanup } from "./test_mcp_production_review";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenContract = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): { digest: string; tokens: number } => {
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
  return {
    digest: digestText(JSON.stringify(tokens)),
    tokens: tokens.length,
  };
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const productionReviewHarnessCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_review.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows: Array<{ arrow: ts.ArrowFunction; name: string }> = [];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      arrows.push({ arrow: node.initializer, name: node.name.text });
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, source).includes(
        "preserveProductionReviewHarnessCleanup(",
      ) &&
      ts.isBlock(node.parent)
    ) {
      const statements = [...node.parent.statements];
      const index = statements.indexOf(node);
      lifecycles.push({
        catchBodies: node.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          node.catchClause.variableDeclaration === undefined
            ? []
            : [compact(node.catchClause.variableDeclaration, source)],
        containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
        containerStatements: statements.length,
        failureHolder: compact(statements[index - 1]!, source),
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionReviewHarnessCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionReviewHarnessCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      count: policies.length,
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; message: string; order: string[] } => {
  let caught = false;
  let failure: unknown;
  let message = "";
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionReviewHarnessCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 2 }, (_, index) => ({
          resource: `resource-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
    if (error instanceof Error) message = error.message;
  }
  return { caught, failure, message, order };
};

export const test_mcp_production_review_harness_cleanup = (): void => {
  const primaryFailure = { phase: "review submit" };
  const hookFailure = { phase: "commit-review hook restoration" };
  const sourceFailure = { phase: "source restoration" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    { error: sourceFailure, present: true as const },
  ];
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
  });
  const multiple = captureCleanup({ cleanupFailures });
  const combined = captureCleanup({
    cleanupFailures,
    primaryFailure: { error: primaryFailure, present: true },
  });
  const selective = captureCleanup({
    cleanupFailures: [cleanupFailures[0], undefined, cleanupFailures[1]],
    resources: 3,
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  const fullOrder = "cleanup-0,cleanup-1";
  TestValidator.predicate(
    "production-review harness cleanup preserves failure and restoration order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === hookFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        hookFailure,
        sourceFailure,
      ]) &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        sourceFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
      selective.caught &&
      aggregateContainsExactly(selective.failure, [
        hookFailure,
        sourceFailure,
      ]) &&
      selective.message.includes("resource-0") &&
      selective.message.includes("resource-2") &&
      selective.message.includes("resource-1") === false &&
      selective.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.order.join(",") === fullOrder &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === fullOrder &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === fullOrder,
  );
  TestValidator.equals(
    "production-review test owns two commit-race cleanup lifecycles",
    productionReviewHarnessCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_review.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["shortenedSourceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 355,
          failureHolder:
            "letshortenedSourceFailure:IProductionReviewFixtureFailure|undefined;",
          finallyDigest:
            "4dd9897010b12a91b191804e3cd29ed76401febc69f64b4d0aeddcdae80b2b0a",
          finallySubstantive: {
            digest:
              "81f5103d8d75f9048a9450fc8a828507628be79e7c357d9e5550e1290a3b2b6f",
            tokens: 29,
          },
          index: 219,
          substantive: {
            digest:
              "a1c3de0aafa63a2a6df6a031f82f4b8622f2d3590671cb509d0191ab9cd76269",
            tokens: 14,
          },
          tryBody:
            "{shortenedSource=review.submit(worksheet(project,sourcePrepared));}",
          tryDigest:
            "fefc8412001513663bfcc6b23406fc98cb9cb9e3f5e0eadd154e864628f8c2b0",
        },
        {
          catchBodies: ["racedSubmissionFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 355,
          failureHolder:
            "letracedSubmissionFailure:IProductionReviewFixtureFailure|undefined;",
          finallyDigest:
            "ee6c30f1be82acc1ef4a9fcd7122beb86692881200c2edf2147878d4c14e4092",
          finallySubstantive: {
            digest:
              "cf19c355a3de64cad02e885a0050d809e54a5e9e9283a662adfe92bb406c3b4a",
            tokens: 32,
          },
          index: 229,
          substantive: {
            digest:
              "1727a6cd05214ed215715cb6d2911306cd1d8b30fdc51d9d5e14b1f5f5aa3856",
            tokens: 28,
          },
          tryBody:
            "{constracedPrepared=racingReview.prepare({target:shotTarget});racedSubmission=racingReview.submit(worksheet(project,racedPrepared));}",
          tryDigest:
            "a855bcb127a79404f5e7bc4aba42c221e38cfbedcc18d29c20d08f9bb73aaa03",
        },
        {
          catchBodies: ["shotCommitRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 355,
          failureHolder:
            "letshotCommitRaceFailure:IProductionReviewFixtureFailure|undefined;",
          finallyDigest:
            "e172dad57543bf24b4156b2806d1508f91558ec6e528547dd7c9ed03dcb42e40",
          finallySubstantive: {
            digest:
              "9936ef82e2e0585d260eb2bea817304f894170b09d04261027166053534be2e9",
            tokens: 53,
          },
          index: 240,
          substantive: {
            digest:
              "f882404d2adb78528e533a0f71f1f2a15c6c914e6bf5d6fe00e1366fdbe31046",
            tokens: 15,
          },
          tryBody:
            "{commitBoundarySubmission=review.submit(worksheet(project,commitBoundaryPrepared),);}",
          tryDigest:
            "0882dcf578ba436f60da4285b619ef740f010888907580acfc182ec22b16201d",
        },
        {
          catchBodies: ["filmCommitRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 355,
          failureHolder:
            "letfilmCommitRaceFailure:IProductionReviewFixtureFailure|undefined;",
          finallyDigest:
            "d3ead3fd9046046cd2fc0c45749d84f31bc39282d08532ef5536733cd7ec39fd",
          finallySubstantive: {
            digest:
              "65b882b614126085108eb44926fc1cf4c3535a2ba678ff179afec7df6abe02cc",
            tokens: 53,
          },
          index: 327,
          substantive: {
            digest:
              "b16980cf80d3f785fe617b72e6a0273c73e3a9947669dbe2d2bd8e95e249424e",
            tokens: 15,
          },
          tryBody:
            "{filmCommitSubmission=review.submit(worksheet(project,filmCommitPrepared),);}",
          tryDigest:
            "40d3815024f49eab466dd71f9b7e7ba95dfaba754ffa3d838411a67f13c31c8c",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionReviewHarnessCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Productionreviewharnesscleanupfailed${failure===undefined?"":"afterthereviewfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProductionReviewFixtureFailure|undefined",
            "resources:readonlyIProductionReviewHarnessCleanup[]",
          ],
        ],
      },
    },
  );
};
