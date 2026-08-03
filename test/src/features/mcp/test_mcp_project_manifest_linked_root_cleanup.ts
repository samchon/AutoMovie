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

const linkedRootCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_manifest.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
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
    resource: string;
    tryBody: string;
    tryDigest: string;
    trySubstantive: { digest: string; tokens: number };
  }> = [];
  const replacements: Array<{ end: number; start: number; text: string }> = [];
  let outer: unknown = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "test_mcp_project_manifest" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer) &&
      ts.isBlock(node.initializer.body)
    ) {
      const lifecycle = node.initializer.body.statements.find(
        (statement): statement is ts.TryStatement =>
          ts.isTryStatement(statement) &&
          statement.finallyBlock
            ?.getText(source)
            .includes("preserveProjectManifestFixtureCleanup") === true,
      );
      if (lifecycle !== undefined)
        outer = {
          substantive: leafTokenContract(lifecycle.tryBlock.statements, source),
          tryDigest: digestText(lifecycle.tryBlock.getText(source)),
          tryStatements: lifecycle.tryBlock.statements.length,
        };
    }
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      node.finallyBlock.statements.length === 1 &&
      compact(node.finallyBlock, source).includes("linkedprojectroot") &&
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
              lifecycles.push({
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
  visit(source);
  let parent = text;
  for (const replacement of replacements.sort(
    (left, right) => right.start - left.start,
  ))
    parent = `${parent.slice(0, replacement.start)}${replacement.text}${parent.slice(replacement.end)}`;
  return {
    lifecycles,
    outer,
    parentDigest: digestText(parent.replace(/\s+/g, "")),
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    rootDigest: digestText(text.replace(/\s+/g, "")),
  };
};

export const test_mcp_project_manifest_linked_root_cleanup = (): void => {
  const text = fs.readFileSync(
    path.join(__dirname, "test_mcp_project_manifest.ts"),
    "utf8",
  );
  const expected = {
    lifecycles: [
      {
        catchBodies: ["linkedRootFailure={error};", "throwerror;"],
        catchVariables: ["error"],
        cleanup: "()=>fs.unlinkSync(linkedRoot)",
        containerKind: "TryStatement",
        containerStatements: 49,
        failureHolder:
          "letlinkedRootFailure:IProjectManifestFixtureFailure|undefined;",
        finallyDigest:
          "5f4c2f59fd3c90d250babf8398c79213c61043d00e05ffaac4b60661c7fc354d",
        finallySubstantive: {
          digest:
            "57a114e304de1240b1d51e982f2563bf919781ca8d064e530be480b1113ee74c",
          tokens: 27,
        },
        helper: "preserveProjectManifestRaceCleanup",
        index: 48,
        resource: "linked project root",
        tryBody:
          '{TestValidator.predicate("projectrootsrejectsymlinksbeforecreatingresidentstate",throwsError(()=>AutoMovieProject.open(linkedRoot),["AutoMovieprojectroot","symboliclink"],),);}',
        tryDigest:
          "648226e094a218b546022240fb3adedf1238a0d9cffcbc5766543ceb904aa644",
        trySubstantive: {
          digest:
            "9951bc77d97d1efcfb838b393087b22cfedaf532e67fd597f440e889a6315c47",
          tokens: 28,
        },
      },
    ],
    outer: {
      substantive: {
        digest:
          "4ccc401e5f1759e8bc75b4c663914cf388b9b9d336683e498977ae683edf1b43",
        tokens: 1384,
      },
      tryDigest:
        "506f26f1f9a584006bf271f586790d5edcb03fb2bbcb6ca356dd35e252ab6e97",
      tryStatements: 49,
    },
    parentDigest:
      "1d9d16eb79efeb07215db69c5460c754d99f6a930df48779cced1a566bca0e56",
    parseDiagnostics: [],
    rootDigest:
      "7a8837dcc034d79285739ff8183cebbbaabee23414ac9b7aa6f9e49a24d4dc1e",
  };
  TestValidator.equals(
    "project-manifest protects linked-root cleanup",
    linkedRootCleanupContract(text),
    expected,
  );
  const mutated = text.replace(
    'resource: "linked project root"',
    'resource: "linked project root mutated"',
  );
  TestValidator.predicate(
    "project-manifest linked-root contract rejects its label mutation",
    mutated !== text &&
      JSON.stringify(linkedRootCleanupContract(mutated)) !==
        JSON.stringify(expected),
  );
};
