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

const commitLockSingleHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_commit_lock.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const owners = new Map<string, ts.ArrowFunction>();
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
        )
          owners.set(declaration.name.text, declaration.initializer);
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
    tryBody: string;
    tryDigest: string;
    trySubstantive: { digest: string; tokens: number };
  }> = [];
  const replacements: Array<{ end: number; start: number; text: string }> = [];
  const anchors = [
    "split-path lstat hook",
    "release-rename hook",
    "release-snapshot lstat hook",
  ];
  for (const [owner, arrow] of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        node.finallyBlock.statements.length === 1 &&
        anchors.some((anchor) =>
          compact(node.finallyBlock!, source).includes(
            anchor.replace(/\s+/g, ""),
          ),
        ) &&
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
          const resource = (call.arguments[1] as ts.ArrayLiteralExpression)
            .elements[0]!;
          if (ts.isObjectLiteralExpression(resource)) {
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
                  helper: call.expression.getText(source),
                  index,
                  owner,
                  resource: label.initializer.text,
                  tryBody: compact(node.tryBlock, source),
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
    parentDigest: digestText(parent.replace(/\s+/g, "")),
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    rootDigest: digestText(text.replace(/\s+/g, "")),
    rows,
  };
};

export const test_mcp_commit_lock_single_hook_cleanup = (): void => {
  const text = fs.readFileSync(
    path.join(__dirname, "test_mcp_commit_lock.ts"),
    "utf8",
  );
  const expected = {
    parentDigest:
      "cce6dd2ec5e2c89775fcc78115e1b3c4f33e7cf179154d0d91e928e845f72e3d",
    parseDiagnostics: [],
    rootDigest:
      "221a871edb6930dfd6e607b5d701ad33fb7a8a284bdf9de42b42c17efcde8790",
    rows: [
      {
        catchBodies: ["splitPathFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{mutableFs.lstatSync=nativeLstat;}",
        containerKind: "ArrowFunction",
        containerStatements: 7,
        failureHolder:
          "letsplitPathFailure:ICommitLockFixtureFailure|undefined;",
        finallyDigest:
          "cceb6f5815a6d24d92d3a8c6ed12105d0daeb210e8fd2e34baf14c07de9a9eb3",
        finallySubstantive: {
          digest:
            "8d3111a07f5588671e0254e4d51c86a98c404e5ef533e385a5d85f0cf88f5147",
          tokens: 29,
        },
        helper: "preserveCommitLockHookCleanup",
        index: 5,
        owner: "exerciseSplitPathDescriptorIdentity",
        resource: "split-path lstat hook",
        tryBody: "{releaseCommitLock(lockPath,token);}",
        tryDigest:
          "400953d6e86c6f537977fa50a7da85bfcca26a413a949f315823a774e04e0cd4",
        trySubstantive: {
          digest:
            "e40ed689023450420ad65c5771e181f5eb103cae212a60d9f2274e8a8a1f605c",
          tokens: 7,
        },
      },
      {
        catchBodies: ["releaseRenameFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{fs.renameSync=nativeRename;}",
        containerKind: "ArrowFunction",
        containerStatements: 30,
        failureHolder:
          "letreleaseRenameFailure:ICommitLockFixtureFailure|undefined;",
        finallyDigest:
          "621cf8cc75cbc65e9a1322dde426247c0f68b56260059c12646fc2e4d4d36de1",
        finallySubstantive: {
          digest:
            "09dd38c054f280899d2581cc525e5acd6c9b45bd34d4fb249f1d74bd1df180d6",
          tokens: 29,
        },
        helper: "preserveCommitLockHookCleanup",
        index: 6,
        owner: "exerciseReleaseFailures",
        resource: "release-rename hook",
        tryBody: "{releaseCommitLock(renamePath,renameToken);}",
        tryDigest:
          "a0d5c1914c406ce7aece36f5f941ee4f1ab5f7827275d6e2a414cb9d5588d6d3",
        trySubstantive: {
          digest:
            "de09fef66906eb208b704d697ed5ed773a5df67cb690e1ba69f9c1898309b29b",
          tokens: 7,
        },
      },
      {
        catchBodies: ["releaseSnapshotFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>{mutableFs.lstatSync=nativeLstat;}",
        containerKind: "ArrowFunction",
        containerStatements: 30,
        failureHolder:
          "letreleaseSnapshotFailure:ICommitLockFixtureFailure|undefined;",
        finallyDigest:
          "7fc19cbf5ff0ab54d8e838b29158c0f3aa97fd3e419b9824a5cf0733c66b893b",
        finallySubstantive: {
          digest:
            "7f4555c3e252ed53691fef996bf69e33a5e2ad54c53eb122c12437ba6b5db96b",
          tokens: 29,
        },
        helper: "preserveCommitLockHookCleanup",
        index: 27,
        owner: "exerciseReleaseFailures",
        resource: "release-snapshot lstat hook",
        tryBody: "{releaseCommitLock(snapshotPath,snapshotToken);}",
        tryDigest:
          "a7465d7280cfa055bcef4e1e9eeda00aec26ee49f19bb379c461e060eb11214a",
        trySubstantive: {
          digest:
            "0f9289acf151ce2c648d7ec0d85942f51270e7fa89bc3cce6bd39470c6546d13",
          tokens: 7,
        },
      },
    ],
  };
  TestValidator.equals(
    "commit-lock protects three single-hook cleanup lifecycles",
    commitLockSingleHookCleanupContract(text),
    expected,
  );
  TestValidator.predicate(
    "commit-lock single-hook contract rejects every label mutation",
    expected.rows.every((row) => {
      const mutated = text.replace(
        `resource: "${row.resource}"`,
        `resource: "${row.resource} mutated"`,
      );
      return (
        mutated !== text &&
        JSON.stringify(commitLockSingleHookCleanupContract(mutated)) !==
          JSON.stringify(expected)
      );
    }),
  );
};
