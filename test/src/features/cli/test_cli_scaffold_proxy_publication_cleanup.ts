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

const proxyPublicationCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "proxygcabasuccessortarget",
    "proxyscalelstathook",
    "proxymedialstathook",
    "proxydirectorylstathook",
    "proxyinventorylstathook",
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
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
  };
};

export const test_cli_scaffold_proxy_publication_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns five proxy publication cleanup lifecycles",
    proxyPublicationCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "gcAbaJudgeCleanupFailure={error};",
            "gcAbaJudgment=errorinstanceofError?error.message:String(error);",
            "returnfalse;",
          ],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 4,
          finallyDigest:
            "c880292843706f4309ac38037361032c9934315f0d7c6a97c543fa446dfddbe6",
          finallySubstantive: {
            digest:
              "4de1e3985e1ee1956a7a431b71ba9c9a873a0cf802869f875d0c6ad7a09c7503",
            tokens: 53,
          },
          index: 3,
          preceding: "letgcAbaJudgeCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "9845ffb7280876f4b371c88e6c6a00f9d858f76f9858a8586139df8efbed6268",
            tokens: 57,
          },
          tryBody:
            "{constreceipt=proxyModule.inspectCapturedProxyBundle(snapshot,evidence,);gcAbaJudgment={compile:receipt.compileFingerprint,edit:receipt.editFingerprint,publication:receipt.publicationFingerprint,};return(receipt.publicationFingerprint===gcAbaPublication&&receipt.compileFingerprint===gcAbaCompile&&receipt.editFingerprint===gcAbaEdit);}",
          tryDigest:
            "7532ad282014eb54ef31e83f13d33adb38d7daaa4aa01e161962494adac16d84",
        },
        {
          catchBodies: ["scaleCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 9,
          finallyDigest:
            "a650574d2a794dcc54e39ad5dafe516b285174a1ae5e2b9a65ff5f9d63d8d9e9",
          finallySubstantive: {
            digest:
              "897625c74157c7385c10d1e4561c99c80f4c80f3479e40ea1c46f3c1e907ab1e",
            tokens: 50,
          },
          index: 7,
          preceding: "letscaleCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "22b0817ea1ee5bc4d18dc80b7573c59fb46749e8dee5b539b1485237303c96b5",
            tokens: 29,
          },
          tryBody:
            "{proxyPublisherModule.publishProxyBundle({expected:entries,parent:proxyPublishParent,processAlive:()=>false,renderRoot:proxyPublishRoot,target,});}",
          tryDigest:
            "f6ed11ef237417fc2b6d39b74bb8288d1f0a2898563428d3147012c91eb1a051",
        },
        {
          catchBodies: ["proxyMediaCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "336d561f3977f4f70c9c466b439a71475977b26f816dd39d5a6741a29e100901",
          finallySubstantive: {
            digest:
              "bd271a550085c118abb12e96c7dafefa650fc32b0d8d6b0e726f16ab2dd2192c",
            tokens: 77,
          },
          index: 241,
          preceding: "letproxyMediaCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "36d8a11cdd802083f4fa08a3ae1e39b89a3af8ecbcfc6d2a845c0e7d78823565",
            tokens: 18,
          },
          tryBody:
            "{proxyRaceRejected=throws(()=>proxyModule.assertPublishedProxyBundle(proxy,proxyFiles),);}",
          tryDigest:
            "2c9762a7c23888586dead353860bf0366b92a5af33c63cc21210bcd1fb120a43",
        },
        {
          catchBodies: ["proxyDirectoryCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "7df6ead084071ac936ca19cc7a04d8c226a343f6ecbeab5b4d97be6d747341ab",
          finallySubstantive: {
            digest:
              "bd15a15073ea7d1dcc9d669772b0dbfd31cc335c6a1640ecb9b448f22fbc69a8",
            tokens: 115,
          },
          index: 253,
          preceding:
            "letproxyDirectoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d7261520bc3a5f7fc43be80091f66ae28488188ed765e12f70e0d94248beb395",
            tokens: 18,
          },
          tryBody:
            "{proxyDirectoryRaceRejected=throws(()=>proxyModule.assertPublishedProxyBundle(proxy,proxyFiles),);}",
          tryDigest:
            "e9ce493067a4fa4df5951bd75eeb548678623b67a55a0940f2a4d64983d39bae",
        },
        {
          catchBodies: ["proxyInventoryCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "f25be1e62a4c8cbfffbffb7a2d9d3747e7097015180c1b25cb3c2b2be57971f6",
          finallySubstantive: {
            digest:
              "0d3dcc8e981dd047aff55d6162bdb8a780c3702601563e862d5f01620b84b1f9",
            tokens: 57,
          },
          index: 261,
          preceding:
            "letproxyInventoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b7e79ac9819f518464e4e8a10acafcb937ccb5a28dd8f8d0745cec04ceb10c10",
            tokens: 18,
          },
          tryBody:
            "{proxyInventoryRaceRejected=throws(()=>proxyModule.assertPublishedProxyBundle(proxy,proxyFiles),);}",
          tryDigest:
            "75eb19f38866fe4490f969eefae268acbffd6cb6a6d0297a7eaf463a3e4ed053",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
