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

const runtimePackageCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "runtimemanifestlstathook",
    "runtimeentrylstathook",
    "runtimeinventoryreaddirhook",
  ];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    preceding: string;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      anchors.some((anchor) =>
        compact(node.finallyBlock!, source).includes(anchor),
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
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        preceding: compact(statements[index - 1]!, source),
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    lifecycles,
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
  };
};

export const test_cli_scaffold_runtime_package_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns three runtime package cleanup lifecycles",
    runtimePackageCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "runtimeManifestCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1913,
          finallyDigest:
            "e52a087bacf5f1a99cb27b855ed82acb6b02faca8f7a15e8b9d3af1d001feba6",
          finallySubstantive: {
            digest:
              "5e161ce5989d1165cb7acf34a0311a9704ffd6f893fd3b222b8e7f6b4ec89f20",
            tokens: 77,
          },
          index: 370,
          preceding:
            "letruntimeManifestCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "516409df9aeb8ca02873a426ad4db504d0c3eedf1b067c43a87981326542d3c9",
            tokens: 7,
          },
          tryBody:
            "{runtimeManifestRaceRejected=throws(snapshotRuntimeFixture);}",
          tryDigest:
            "89eab1fff629884860fc7a47074ace56ff84612cc2f89d1e4070b9b5fadbaef8",
        },
        {
          catchBodies: ["runtimeEntryCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1913,
          finallyDigest:
            "966469116e2c84ee8efa23eb5170eb602f9744c74b4acf7df16e4ace28ed334a",
          finallySubstantive: {
            digest:
              "c80183210cb73942cfccc780198e8be202fdaabd0730d0b241b89b16d4d88b1d",
            tokens: 77,
          },
          index: 377,
          preceding: "letruntimeEntryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "e3e3c9c03e10ab7227b37014e99c37dbdb048cd00d4587c6f843e70a36cbf0b8",
            tokens: 7,
          },
          tryBody: "{runtimeEntryRaceRejected=throws(snapshotRuntimeFixture);}",
          tryDigest:
            "864648d0e12d9f97c6572c0faa4ab9b9933ce18fe1378b61a7d796f5826ec885",
        },
        {
          catchBodies: [
            "runtimeInventoryCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1913,
          finallyDigest:
            "668754d6e71a2ddb2f509639f44fded1911cc61dc0015b653c9fe4e19ef71da2",
          finallySubstantive: {
            digest:
              "bca2541427e5391902b0dbfa59bf8ebe8dcc23a7179740574cb25fd2eadbe85f",
            tokens: 57,
          },
          index: 385,
          preceding:
            "letruntimeInventoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "25c7abd712c8477187a4a94f109bec5a99f600208c6176ec7c949c799c54a5fa",
            tokens: 7,
          },
          tryBody:
            "{runtimeInventoryRaceRejected=throws(snapshotRuntimeFixture);}",
          tryDigest:
            "dfbd7dbc8bcc4b0743446e8d257efb500ca6a1830f1093368f258ce5f4a7ea94",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
