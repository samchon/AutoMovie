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

const captureReceiptCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "capturereceiptlstathook",
    "capturereceiptpartialopenhook",
    "capturereceiptoversizedopenhook",
    "capturereceipttargetopenhook",
    "capturereceiptdirectorylstathook",
    "capturereceiptrootlstathook",
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

export const test_cli_scaffold_capture_receipt_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns six capture receipt cleanup lifecycles",
    captureReceiptCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["captureReceiptCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "4fe618160bd4a8229abdecbbc18400cd3c0e20afeef9fbd9d60385bc7118ff82",
          finallySubstantive: {
            digest:
              "1f42780f9842a1a5fd1a472827ec4962996d31441da3025d7d98c0bc48c14a76",
            tokens: 77,
          },
          index: 557,
          preceding:
            "letcaptureReceiptCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1825f7007352b14e998c89490858e9942ac2133badadb453a0fff26e547497f4",
            tokens: 16,
          },
          tryBody:
            "{captureReceiptRaceRejected=throws(()=>captureBrowserModule.readCaptureInstallReceipt(captureProject),);}",
          tryDigest:
            "27c17ae2df106c8914175baf3d4e14f4841dd5fa5ca6319de41685b374e0a1d0",
        },
        {
          catchBodies: ["partialReceiptCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "b284e20cf2755e35b20b8a6ca3167e13010fbd6327d41c227db2fc0206af3772",
          finallySubstantive: {
            digest:
              "8a0f86b604004fee057791bae97ee3a6a7aacac627caa32f6e620714f9e36930",
            tokens: 50,
          },
          index: 580,
          preceding:
            "letpartialReceiptCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "68aea749eac6d6da2995f92136ebb42186e273275996a8b6b23711fd3bbef4ea",
            tokens: 24,
          },
          tryBody:
            "{partialReceiptRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(partialReceiptProject,nextCaptureReceipt,()=>undefined,),);}",
          tryDigest:
            "057b8823e587d39a3dc40d9a5975dbdc65f8c6f399902cc10474be2c9f4486b9",
        },
        {
          catchBodies: [
            "oversizedReceiptCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "8268d8fcbc7589dc275b36fdcebdd35d28c9883ff7451c6eb772c6b48203586a",
          finallySubstantive: {
            digest:
              "80a0d580be81df99eee20b3c37206d075d08c87ddf39ddbaf9ef3c98abab5ffd",
            tokens: 50,
          },
          index: 604,
          preceding:
            "letoversizedReceiptCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "e445d1acede5834ad309d4c40b7d2f95ef40b711ed939dbf9b308943a8b9af89",
            tokens: 45,
          },
          tryBody:
            '{oversizedReceiptReadRejected=throwsWith(()=>captureBrowserModule.readCaptureInstallReceipt(oversizedReceiptProject,),"exceedsitsmaximumbytelength",);oversizedReceiptPublishRejected=throwsWith(()=>captureBrowserModule.publishCaptureInstallReceipt(oversizedReceiptProject,nextCaptureReceipt,()=>undefined,),"Manuallyadjudicate",);}',
          tryDigest:
            "5dfbb8d067b17f2fadc0889b6733d3b74accde8a76472705b58946f9feb061d7",
        },
        {
          catchBodies: [
            "receiptTargetSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "3b129d59eb2805ac04b03ed1da557b09ab657b6d0505bcd0605915e2ae13311f",
          finallySubstantive: {
            digest:
              "02e7ff5a09439c462fa1be924045ca0d265a805ead9491bedf59eb79fcf270c1",
            tokens: 50,
          },
          index: 615,
          preceding:
            "letreceiptTargetSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1e5a131c3aa9cb45a58fd2c0809868314910198d668b05d6dadaeb827a99828f",
            tokens: 24,
          },
          tryBody:
            "{receiptTargetSwapRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(receiptTargetSwapProject,nextCaptureReceipt,()=>undefined,),);}",
          tryDigest:
            "8f4c6e749dc76e42c2d03339c82f60f7d5d3a0e8bb8a8268592336749e4cb4dc",
        },
        {
          catchBodies: [
            "receiptReadDirectoryCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "0d60c16ccb2344e7c27369368b361367c29720d4333008fc4cba433fc5595035",
          finallySubstantive: {
            digest:
              "19e679ab5f04fb7c9e0c1cfdb50fd936deb4e92a8811e7b320343e8e9ec0e112",
            tokens: 85,
          },
          index: 654,
          preceding:
            "letreceiptReadDirectoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "2ba1f922204655b3f5f9c9fa2ebb851f2b299850892e2161bca60db5f504fe52",
            tokens: 16,
          },
          tryBody:
            "{receiptReadDirectoryRejected=throws(()=>captureBrowserModule.readCaptureInstallReceipt(captureProject),);}",
          tryDigest:
            "550ae2c36cfc29f42f888bea176760c7945df3265ba77df9d925301296d0528f",
        },
        {
          catchBodies: [
            "receiptReadRootCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1921,
          finallyDigest:
            "b6d7fa6450a72b69e5b2387c5ba5881f934cd85b0f5cba8cf05c21428d520577",
          finallySubstantive: {
            digest:
              "aacf8cb3b0c8c72b76039f985a638dd85816a41f8017742cb39617ee0b57c9e0",
            tokens: 83,
          },
          index: 665,
          preceding:
            "letreceiptReadRootCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "c72b65ff85c48b91b1a233792bcf8a0e9198bf0a01bc63c02603c63d3b103de7",
            tokens: 16,
          },
          tryBody:
            "{receiptReadRootRejected=throws(()=>captureBrowserModule.readCaptureInstallReceipt(captureProject),);}",
          tryDigest:
            "24b3e3a54025c459039eb39e61281a6750a38988714d1eec37bb4a985c640445",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
