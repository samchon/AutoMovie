import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectTransactionSwapCleanup } from "./test_mcp_project_transactions";

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

const transactionRootSwapCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_transactions.ts",
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
        "preserveProjectTransactionSwapCleanup(",
      ) &&
      (compact(node.finallyBlock, source).match(/resource:/g)?.length ?? 0) >
        1 &&
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
    (entry) => entry.name === "preserveProjectTransactionSwapCleanup",
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
        statement.name?.text === "ProjectTransactionSwapCleanupError"
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
      preserveProjectTransactionSwapCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 3 }, (_, index) => ({
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

export const test_mcp_project_transaction_root_swap_cleanup = (): void => {
  const primaryFailure = { phase: "transaction root-swap guard" };
  const removalFailure = { phase: "active replacement removal" };
  const restorationFailure = { phase: "parked original restoration" };
  const cleanupFailures = [
    { error: removalFailure, present: true as const },
    undefined,
    { error: restorationFailure, present: true as const },
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
  TestValidator.predicate(
    "transaction root-swap cleanup preserves failure and resource order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === removalFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        removalFailure,
        restorationFailure,
      ]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-2") &&
      multiple.message.includes("resource-1") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        removalFailure,
        restorationFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
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
    "project transactions own one nested root-swap cleanup lifecycle",
    transactionRootSwapCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_transactions.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["rootSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 136,
          failureHolder:
            "letrootSwapFailure:IProjectTransactionFixtureFailure|undefined;",
          finallyDigest:
            "bc1e1cd39f318422533d3ccdde2c2e0e42b5b2dda3508b9db970e20e9ed8de65",
          finallySubstantive: {
            digest:
              "c7f5ad93986760f2738617e8cd8719ff529db09f0b8223a99e45393de7a4f441",
            tokens: 58,
          },
          index: 134,
          substantive: {
            digest:
              "3f2a22009e12d466fd4f481141257f97fe60b6a99a669de07f394c14681e3756",
            tokens: 63,
          },
          tryBody:
            '{replacedReadRejected=throwsError(()=>a.writableSlate(),["root","changedphysicalidentity","Discardthisprojecthandle"],);replacedMutationRejected=throwsError(()=>a.saveSlate(slateOf("mustnotenterreplacement")),["root","changedphysicalidentity","Discardthisprojecthandle"],);replacementUntouched=fs.readdirSync(root).length===0;}',
          tryDigest:
            "a4e3c83e51697694af9c60f2e7ec8d2d54c2e116829b7b543515ea55761144df",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProjectTransactionSwapCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Project-transactionroot-swapcleanupfailed$" +
            '{failure===undefined?"":"aftertheguardedcheckfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProjectTransactionFixtureFailure|undefined",
            "resources:readonlyIProjectTransactionSwapCleanup[]",
          ],
        ],
      },
    },
  );
};
