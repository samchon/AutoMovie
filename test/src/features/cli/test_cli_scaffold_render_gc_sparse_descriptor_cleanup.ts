import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";

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
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    helper: string;
    resource: string;
    tryBody: string;
    tryDigest: string;
    trySubstantive: { digest: string; tokens: number };
  }> = [];
  const visit = (node: ts.Node): void => {
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
                failureHolder: compact(failureHolder, source),
                finallyDigest: digestText(node.finallyBlock.getText(source)),
                finallySubstantive: leafTokenContract(
                  node.finallyBlock.statements,
                  source,
                ),
                helper: call.expression.getText(source),
                resource: label.initializer.text,
                tryBody: compact(node.tryBlock, source),
                tryDigest: digestText(node.tryBlock.getText(source)),
                trySubstantive: leafTokenContract(
                  node.tryBlock.statements,
                  source,
                ),
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // The guarded body, its teardown and the helper that preserves the failure --
  // and nothing about the file around them. A digest of the whole owner, or of
  // the owner with this guard stripped out, moves whenever any of the two
  // thousand statements beside it is edited, which says nothing about whether
  // this descriptor is closed.
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
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
      parseDiagnostics: [],
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
    TestValidator.equals(
      "CLI sparse descriptor contract rejects its resource-label mutation",
      namedFacts([
        ["labelMutated", () => mutated !== text],
        [
          "mutationRejected",
          () =>
            JSON.stringify(sparseDescriptorCleanupContract(mutated)) !==
            JSON.stringify(expected),
        ],
      ]),
      { labelMutated: true, mutationRejected: true },
    );
  };
