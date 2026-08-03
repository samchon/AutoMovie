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

const captureMetadataCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = ["capturemetadatalstathook", "capturecorebrowserslstathook"];
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

export const test_cli_scaffold_capture_metadata_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two capture metadata cleanup lifecycles",
    captureMetadataCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "compositeMetadataCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1893,
          finallyDigest:
            "0aa5288af368b96dbae9edb653410c88d2e17bf136e47a8ebe214d85d5d5c77e",
          finallySubstantive: {
            digest:
              "f874d84fa888ef99fe1effbc945cf6152a9830f500b095ef9ff7a48aa354346d",
            tokens: 77,
          },
          index: 496,
          preceding:
            "letcompositeMetadataCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "884210cbfd37f2768b27d3e8dd3b3b959e1844b17a48d1a7bdd31e8add19e834",
            tokens: 7,
          },
          tryBody: "{compositeMetadataRaceRejected=throws(metadataFixture);}",
          tryDigest:
            "84de95fa2ea707d5dd2ca50198bcae29470b6eb0cfc9937bb02026b029d94517",
        },
        {
          catchBodies: ["coreBrowsersCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1893,
          finallyDigest:
            "c448f1fc024246e74a18e9da9a774d11270de00f3f8f59da226a4ec3690f9693",
          finallySubstantive: {
            digest:
              "c9186643a6144facce6a179f20d0666c53acaf0a8ec16a5f05a164991bb1ea89",
            tokens: 77,
          },
          index: 504,
          preceding: "letcoreBrowsersCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "ed4885bd102f2cc7fc3f7ab8751cc0ce1ed4e5fcd5c229a222ee60d68c458292",
            tokens: 7,
          },
          tryBody: "{coreBrowsersRaceRejected=throws(metadataFixture);}",
          tryDigest:
            "9f73593eef6965ec338e636e8423a0c41f7f7290f680edd669a82d6084d3a68f",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
