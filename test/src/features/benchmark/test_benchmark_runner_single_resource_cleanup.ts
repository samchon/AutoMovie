import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

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

const benchmarkRunnerSingleResourceCleanupContract = (
  text: string,
): unknown => {
  const source = ts.createSourceFile(
    "test_benchmark_runner.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = new Map<string, ts.ArrowFunction>();
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
        )
          arrows.set(declaration.name.text, declaration.initializer);
  const rows: Array<{
    catchBodies: string[];
    catchVariables: string[];
    cleanup: string;
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    helper: string;
    index: number;
    owner: string;
    resource: string;
    tryDigest: string;
    trySubstantive: { digest: string; tokens: number };
  }> = [];
  const replacements: Array<{ end: number; start: number; text: string }> = [];
  for (const owner of [
    "exerciseArchivePublicationRaces",
    "exerciseInputAndFilesystemFences",
    "exerciseSnapshotLink",
  ] as const) {
    const arrow = arrows.get(owner);
    if (arrow === undefined) continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        node.finallyBlock.statements.length === 1 &&
        ts.isBlock(node.parent)
      ) {
        const statement = node.finallyBlock.statements[0]!;
        if (
          ts.isExpressionStatement(statement) &&
          ts.isCallExpression(statement.expression) &&
          statement.expression.arguments.length === 2 &&
          ts.isArrayLiteralExpression(statement.expression.arguments[1]!) &&
          (statement.expression.arguments[1] as ts.ArrayLiteralExpression)
            .elements.length === 1
        ) {
          const call = statement.expression;
          const helper = call.expression.getText(source);
          const resource = (call.arguments[1] as ts.ArrayLiteralExpression)
            .elements[0]!;
          if (
            (helper === "preserveBenchmarkRunnerHookCleanup" ||
              helper === "preserveBenchmarkRunnerResidentCleanup") &&
            ts.isObjectLiteralExpression(resource)
          ) {
            const label = resource.properties.find(
              (property): property is ts.PropertyAssignment =>
                ts.isPropertyAssignment(property) &&
                property.name.getText(source) === "resource" &&
                ts.isStringLiteral(property.initializer),
            );
            const cleanup = resource.properties.find(
              (property): property is ts.PropertyAssignment =>
                ts.isPropertyAssignment(property) &&
                property.name.getText(source) === "cleanup" &&
                ts.isArrowFunction(property.initializer),
            );
            if (
              label !== undefined &&
              ts.isStringLiteral(label.initializer) &&
              cleanup !== undefined &&
              ts.isArrowFunction(cleanup.initializer)
            ) {
              const statements = [...node.parent.statements];
              const index = statements.indexOf(node);
              const failureHolder = statements[index - 1];
              if (failureHolder !== undefined) {
                const cleanupBody = cleanup.initializer.body;
                const originalCleanup = ts.isBlock(cleanupBody)
                  ? cleanupBody.statements
                      .map((entry) => entry.getText(source))
                      .join("\n")
                  : `${cleanupBody.getText(source)};`;
                rows.push({
                  catchBodies: node.catchClause.block.statements.map((entry) =>
                    compact(entry, source),
                  ),
                  catchVariables:
                    node.catchClause.variableDeclaration === undefined
                      ? []
                      : [compact(node.catchClause.variableDeclaration, source)],
                  cleanup: compact(cleanup.initializer, source),
                  containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
                  containerStatements: statements.length,
                  failureHolder: compact(failureHolder, source),
                  finallyDigest: digestText(node.finallyBlock.getText(source)),
                  finallySubstantive: leafTokenContract(
                    node.finallyBlock.statements,
                    source,
                  ),
                  helper,
                  index,
                  owner,
                  resource: label.initializer.text,
                  tryDigest: digestText(node.tryBlock.getText(source)),
                  trySubstantive: leafTokenContract(
                    node.tryBlock.statements,
                    source,
                  ),
                });
                replacements.push({
                  end: node.end,
                  start: failureHolder.getStart(source),
                  text: `try ${node.tryBlock.getText(source)} finally {\n${originalCleanup}\n}`,
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(arrow.body);
  }
  let parent = text;
  for (const replacement of replacements.sort(
    (left, right) => right.start - left.start,
  ))
    parent = `${parent.slice(0, replacement.start)}${replacement.text}${parent.slice(replacement.end)}`;
  return {
    count: rows.length,
    parentDigest: digestText(parent.replace(/\s+/g, "")),
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    rootDigest: digestText(text.replace(/\s+/g, "")),
    rows,
  };
};

export const test_benchmark_runner_single_resource_cleanup = (): void => {
  const text = fs.readFileSync(
    path.join(__dirname, "test_benchmark_runner.ts"),
    "utf8",
  );
  const expected = {
    count: 2,
    parentDigest:
      "db0e499fe1b83153931efe95e31d4a4af2cac381810527e06e00888059cee089",
    parseDiagnostics: [],
    rootDigest:
      "b237eba03682d508886052bccdc9d14457a15218fa6ce24888964d3b1b445dd0",
    rows: [
      {
        catchBodies: ["archivePublicationFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.renameSync=nativeRename;}",
        containerKind: "ForOfStatement",
        containerStatements: 16,
        failureHolder:
          "letarchivePublicationFailure:IBenchmarkRunnerFixtureFailure|undefined;",
        finallyDigest:
          "1da5c1c10225852d380f7153cea4186354371f79d98024dc7f68c32f0bd3575e",
        finallySubstantive: {
          digest:
            "5a2eb4bf55d076120c1585114a4ea5f2f4d7d3e66430416e57a474b82dafe22d",
          tokens: 29,
        },
        helper: "preserveBenchmarkRunnerHookCleanup",
        index: 9,
        owner: "exerciseArchivePublicationRaces",
        resource: "archive-publication rename hook",
        tryDigest:
          "2818a403719df4e0516cf15d889b4d3f01230e382e9129a7c51c6ff5b177415d",
        trySubstantive: {
          digest:
            "1f51faea90730746a189434b4057a72d363bd1edde3f79f8b59843a76dcdfe78",
          tokens: 20,
        },
      },
      {
        catchBodies: ["snapshotLinkFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>fs.unlinkSync(linked)",
        containerKind: "ArrowFunction",
        containerStatements: 9,
        failureHolder:
          "letsnapshotLinkFailure:IBenchmarkRunnerFixtureFailure|undefined;",
        finallyDigest:
          "0ccc916645ed087770f2587c4938d639b942f940001490090b15a3abb0fa0db5",
        finallySubstantive: {
          digest:
            "1cead8907a9004e02b95d7d5559012378cbbdd0c11a267cad3a9695f87c9ef11",
          tokens: 27,
        },
        helper: "preserveBenchmarkRunnerResidentCleanup",
        index: 8,
        owner: "exerciseSnapshotLink",
        resource: "snapshot linked view",
        tryDigest:
          "b68513b4bf533a55f09cf457b9fa9800b3407beed6c76160a3d59f20d3b3e060",
        trySubstantive: {
          digest:
            "f1047515a6befc0e22ffbeb244a199acaf3c6d7654a115b03745ac1a361bf81e",
          tokens: 453,
        },
      },
    ],
  };
  TestValidator.equals(
    "benchmark runner protects two single-resource cleanup lifecycles",
    benchmarkRunnerSingleResourceCleanupContract(text),
    expected,
  );
  TestValidator.predicate(
    "benchmark runner single-resource contract rejects every label mutation",
    expected.rows.every((row) => {
      const mutated = text.replace(
        `resource: "${row.resource}"`,
        `resource: "${row.resource} mutated"`,
      );
      return (
        mutated !== text &&
        JSON.stringify(
          benchmarkRunnerSingleResourceCleanupContract(mutated),
        ) !== JSON.stringify(expected)
      );
    }),
  );
};
