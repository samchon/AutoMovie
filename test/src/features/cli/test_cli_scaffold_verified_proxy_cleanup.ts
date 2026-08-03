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

const verifiedProxyCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "verifiedproxytreelstathook",
    "verifiedproxyinventoryopenhook",
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

export const test_cli_scaffold_verified_proxy_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two verified proxy cleanup lifecycles",
    verifiedProxyCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "verifiedProxyTreeCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1930,
          finallyDigest:
            "d00876a73d3676827029dede236cbe84ef1e558dc5e4b37b774d41db08ed53cf",
          finallySubstantive: {
            digest:
              "1ddd419a3bbd5e5fd81ff927f9fcc84ae3230b225fdce64cbc63f6664c7a58df",
            tokens: 115,
          },
          index: 341,
          preceding:
            "letverifiedProxyTreeCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "ce3268fc7c1fad4e7c34596cf3a3a2c63dc939da651fb661835639e4ac63ebe9",
            tokens: 19,
          },
          tryBody:
            "{verifiedProxyTreeSuccessorRejected=throws(()=>proxyModule.inspectPublishedProxyBundle(verifiedProxyRoot,verifiedProxyBundle,),);}",
          tryDigest:
            "b86be392535b10de1b87f6ca31c414725299bc2bdc09fb45f6cd88abf4012814",
        },
        {
          catchBodies: [
            "verifiedProxyInventoryCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1930,
          finallyDigest:
            "700a1adbe2c656b62d88d2efac6ef77f32b3ef96274b83482763fb3d5ae65c3d",
          finallySubstantive: {
            digest:
              "70b4dbd7cf747cfa0354387023ede667b69c4b1f0af9b3408d37a09a6e4b3f0b",
            tokens: 99,
          },
          index: 352,
          preceding:
            "letverifiedProxyInventoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "e1950d54cb638d63807470a9504cbf95901ba090fc5e7cebb9539fa78a6b410b",
            tokens: 19,
          },
          tryBody:
            "{verifiedProxyLateMutationRejected=throws(()=>proxyModule.inspectPublishedProxyBundle(verifiedProxyRoot,verifiedProxyBundle,),);}",
          tryDigest:
            "0c0ec72321cd2d85c484246cb26eba2170e1d99fb3b0b715d64563a48ee8af03",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
