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

const sparseDescriptorCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
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
  let outerDigest = "";
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "test_cli_scaffold" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer) &&
      ts.isBlock(node.initializer.body)
    ) {
      const outer = node.initializer.body.statements.find(
        (statement): statement is ts.TryStatement =>
          ts.isTryStatement(statement) &&
          statement.finallyBlock
            ?.getText(source)
            .includes("preserveCliRootFixtureCleanup") === true,
      );
      if (outer !== undefined)
        outerDigest = digestText(outer.tryBlock.getText(source));
    }
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      node.finallyBlock.statements.length === 1 &&
      compact(node.finallyBlock, source).includes(
        "renderGCsparsepublicationdescriptor",
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
    outerDigest,
    parentDigest: digestText(parent.replace(/\s+/g, "")),
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    rootDigest: digestText(text.replace(/\s+/g, "")),
  };
};

export const test_cli_scaffold_render_gc_sparse_descriptor_cleanup =
  (): void => {
    const text = fs.readFileSync(
      path.join(__dirname, "test_cli_scaffold.ts"),
      "utf8",
    );
    const expected = {
      lifecycles: [
        {
          catchBodies: ["gcSparseDescriptorFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          cleanup: "()=>fs.closeSync(gcSparseDescriptor)",
          containerKind: "TryStatement",
          containerStatements: 1986,
          failureHolder:
            "letgcSparseDescriptorFailure:{error:unknown}|undefined;",
          finallyDigest:
            "c7949519c5a01f65169febf8d8af7e775ff81a20ba0ebc0a8eb2c166e24b30b6",
          finallySubstantive: {
            digest:
              "bed1764ac1d40585d4d7a2e04a3ca64aa8e4272dfbeb3133fd17cb5a83690452",
            tokens: 27,
          },
          helper: "preserveCliHarnessCleanup",
          index: 1422,
          resource: "render GC sparse publication descriptor",
          tryBody: "{fs.ftruncateSync(gcSparseDescriptor,gcSparseBytes);}",
          tryDigest:
            "bc302737dca8b1e3efaea3ab4de45315e7a11579b6be7a30f5025dccc1bada5e",
          trySubstantive: {
            digest:
              "fff8de2db91198f493e714cdbb3382bea85da0dc50ffc4fa255b920d7b0b1e31",
            tokens: 9,
          },
        },
      ],
      outerDigest:
        "7712c278fd48f96012192007fa33d73df219898e9418cf8d0e50ad1f371dd67b",
      parentDigest:
        "ca04e18882789990fd7e7fb5e4fa7c5536ac2ac0092a2accda6b2b5a9f250055",
      parseDiagnostics: [],
      rootDigest:
        "ed783597848b5aed2e4c65f9f8ffdb547101ab08c9173e3559b20491d3735aef",
    };
    TestValidator.equals(
      "CLI scaffold protects sparse publication descriptor cleanup",
      sparseDescriptorCleanupContract(text),
      expected,
    );
    const mutated = text.replace(
      'resource: "render GC sparse publication descriptor"',
      'resource: "render GC sparse publication descriptor mutated"',
    );
    TestValidator.predicate(
      "CLI sparse descriptor contract rejects its resource-label mutation",
      mutated !== text &&
        JSON.stringify(sparseDescriptorCleanupContract(mutated)) !==
          JSON.stringify(expected),
    );
  };
