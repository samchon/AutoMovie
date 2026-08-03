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

const proxyPublicationSingleCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "proxyemptysuccessormkdirhook",
    "proxyexactsuccessormkdirhook",
    "proxyparentswapopenhook",
    "proxyrootswapopenhook",
    "proxypartialsuccessoropenhook",
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
        compact(node.finallyBlock!, source).toLowerCase().includes(anchor),
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

export const test_cli_scaffold_proxy_publication_single_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns five proxy publication single-hook cleanup lifecycles",
    proxyPublicationSingleCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["emptySuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "fc97051e3b37056de4addcdb8df9b4d939eaa392c4b76bb1b028162ce9deabeb",
          finallySubstantive: {
            digest:
              "ea22d472b63e7fb7b10bebb1cb0d99e975cc1f7d497858d5b5a3994218cfbe70",
            tokens: 29,
          },
          index: 168,
          preceding:
            "letemptySuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "47da9c33d7fbbd811aed26b2b25e2fdb3d7c9e7e820d5583f3bd5c599758a148",
            tokens: 35,
          },
          tryBody:
            "{proxyPublisherModule.publishProxyBundle({expected:proxyPublishFiles,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target:emptySuccessorTarget,});emptySuccessorCompleted=true;}",
          tryDigest:
            "0307f1647f4fa257df3a611fba87a338b8da7370e331d1d76621eae36d9c2f11",
        },
        {
          catchBodies: ["exactSuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "6c9fc37a863b442f1f2bcaaa9787d1cbb842fab73519efe210c6dbdb8b03afb7",
          finallySubstantive: {
            digest:
              "f09c9cfa21bd89ade69b79d4fe575bfcf696cc8c826133122953404f74a7928a",
            tokens: 29,
          },
          index: 176,
          preceding:
            "letexactSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "e2f2714ad19c599e425c68a930b912e85f08b4460a3ead2f6e107bc5497cbb5b",
            tokens: 35,
          },
          tryBody:
            "{proxyPublisherModule.publishProxyBundle({expected:proxyPublishFiles,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target:exactSuccessorTarget,});exactSuccessorAccepted=true;}",
          tryDigest:
            "143906e97d34a077f28ce53545214a40a59b647015c05c23b541f6f7c20b5af8",
        },
        {
          catchBodies: [
            "proxyParentSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "067a617e605d0a76545f310bdb5f6142fa2706438bbbbe5d93d785da9191778b",
          finallySubstantive: {
            digest:
              "3779691d5b4e90a9af5ca524860b4007d1d90ef96d7c85dbde7b481492c777a2",
            tokens: 29,
          },
          index: 184,
          preceding:
            "letproxyParentSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "c20c7a99ec3f950ba9bc6a16409a848c04df24f3adc9cd754812ad3ca8d8bbe6",
            tokens: 40,
          },
          tryBody:
            "{proxyParentSwapRejected=throws(()=>proxyPublisherModule.publishProxyBundle({expected:proxyPublishFiles,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target:parentSwapTarget,}),);}",
          tryDigest:
            "f8f4623951c97236f26c34452360f47f847215a90d26fec1d1e3243a54aaf333",
        },
        {
          catchBodies: ["proxyRootSwapCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "1885008df301204a283cf4690885af4c8efb553753f101d40313cd408060978d",
          finallySubstantive: {
            digest:
              "1ddaa3c2c9a90ab922db7898759cc8a2d76e1540ebafc58ea119911373ed748b",
            tokens: 29,
          },
          index: 194,
          preceding:
            "letproxyRootSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "6a358cc9e5c8ff2c5eb22d65819cf8fef0654af8b551dc61ece727cedf30f129",
            tokens: 40,
          },
          tryBody:
            "{proxyRootSwapRejected=throws(()=>proxyPublisherModule.publishProxyBundle({expected:proxyPublishFiles,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target:rootSwapTarget,}),);}",
          tryDigest:
            "8a9cf60854f63d66a35f9549a88d0e819566cea8da66c79f87658257952934a6",
        },
        {
          catchBodies: [
            "partialSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "f31b2a0be5053ffecd6b4f4c08ba003d903350d5515fac41b3a5048a34f91c57",
          finallySubstantive: {
            digest:
              "28b8295ccb4f0ca5693a6cdbb7c435bb6fbc8355f03c1539ea7ff14d7289a5b7",
            tokens: 29,
          },
          index: 205,
          preceding:
            "letpartialSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "6739c2ca504ca41437c448c11ae2063ca82443843b5906677ac52079d4d65f22",
            tokens: 40,
          },
          tryBody:
            "{partialSuccessorRejected=throws(()=>proxyPublisherModule.publishProxyBundle({expected:proxyPublishFiles,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target:partialSuccessorTarget,}),);}",
          tryDigest:
            "e032f18ace912f16bc42aabddebe745dc2bc0b36c4c98bd68ee754e7d4a6a8d2",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
