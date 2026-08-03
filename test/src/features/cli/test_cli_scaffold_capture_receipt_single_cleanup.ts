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

const captureReceiptSingleCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "capturereceiptparentswapopenhook",
    "captureforeignreceiptopenhook",
    "capturereceiptsegmentstathook",
    "capturereceiptrootswapopenhook",
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

export const test_cli_scaffold_capture_receipt_single_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four capture receipt single-hook cleanup lifecycles",
    captureReceiptSingleCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "receiptParentSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "60a847debefc4d5cd8e5456376d28eea0ac053c0f5b65946e9faa284da06f6d2",
          finallySubstantive: {
            digest:
              "667f03143daa4a914699abfa8adac3cc34feac843208b8ff5f576c64fe4927fd",
            tokens: 29,
          },
          index: 631,
          preceding:
            "letreceiptParentSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "0f7fa2ab8ec01668f3a70bd2575bb9125f37dc64830e612d19375c6385b0d27f",
            tokens: 24,
          },
          tryBody:
            "{receiptParentSwapRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(receiptParentSwapProject,nextCaptureReceipt,()=>undefined,),);}",
          tryDigest:
            "b53f2409be596e6c5c41fef9ab0e9c438f725b0eba50644ebcac12ded9eadf81",
        },
        {
          catchBodies: ["foreignReceiptCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "7d83a451aa90abb6575b45dd70ac59e4cc74e1581589f17b5d24ef3fa64253ef",
          finallySubstantive: {
            digest:
              "3ebb81ea26340d427fd8d9b6772bf27cde79e9b474b12bcb7c6c5efe7cb51a4b",
            tokens: 29,
          },
          index: 641,
          preceding:
            "letforeignReceiptCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "6873f59f8953eb3761e3b9aa715b5a00c3fcd36a8beb7e48d6b2001d0a31e2a8",
            tokens: 24,
          },
          tryBody:
            "{foreignReceiptRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(foreignReceiptProject,nextCaptureReceipt,()=>undefined,),);}",
          tryDigest:
            "19072fb4c1950e3cf03ad6056d7c5544063f52d3c702428f6ebfdcd465bcb499",
        },
        {
          catchBodies: ["receiptSegmentCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "5b18bd2c6986af9966f9b6e43211f40653f6feabf0854dbdf4770fd1e1956a05",
          finallySubstantive: {
            digest:
              "f4f8f08cc3124762ba53d55ee9d119670e771c627f2f1d466657e9442d9ed625",
            tokens: 29,
          },
          index: 711,
          preceding:
            "letreceiptSegmentCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "12d59664e311406e6ad3ad9f24f3c924302c6ba01d719dbf427fba9d87d40648",
            tokens: 24,
          },
          tryBody:
            "{receiptSegmentRaceRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(segmentReceiptProject,nextCaptureReceipt,()=>undefined,),);}",
          tryDigest:
            "74c072576fc507846a76e94a3ce82145bd2421556d8844a83e38fc835fdac0c5",
        },
        {
          catchBodies: ["receiptRootCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "8b0c484c31978fa0ee66dc681f6a520351cbb95c45fad37b7d06a4e34704cbc3",
          finallySubstantive: {
            digest:
              "7db57acdaf3a11f4566a549cf535893beedfe1ac9d4ee6b3759add1b2f0fdfe6",
            tokens: 29,
          },
          index: 722,
          preceding: "letreceiptRootCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "acf76d723c47371a0f44c629e0956bf4122118c3ad4eb12c5f3dc76e8bb1a96c",
            tokens: 24,
          },
          tryBody:
            "{receiptRootRaceRejected=throws(()=>captureBrowserModule.publishCaptureInstallReceipt(captureProject,captureReceiptValue,()=>undefined,),);}",
          tryDigest:
            "85ad5d7163e74074ab777fe47c8dee058e354cde9be46cac0b48e5ad1ef70b84",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
