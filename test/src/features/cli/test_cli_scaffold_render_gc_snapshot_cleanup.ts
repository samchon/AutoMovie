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

const renderGcSnapshotCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = ["directrenderfilefsynchook", "directrenderabafsynchook"];
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

export const test_cli_scaffold_render_gc_snapshot_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two render GC snapshot cleanup lifecycles",
    renderGcSnapshotCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "directFileFailureCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1911,
          finallyDigest:
            "7d4ae166a68cfcacd5c2760dfb7047a3c24265054eda53f98b2f81d84b8e9688",
          finallySubstantive: {
            digest:
              "40b0b97a7a1eab41a7a3a02f37a482aa92cdca051b06769430e99e5a537c6e23",
            tokens: 74,
          },
          index: 824,
          preceding:
            "letdirectFileFailureCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "223d4fdf93773ee5192d468750e8641ddac24280d17fdb273d91f019015949c9",
            tokens: 23,
          },
          tryBody:
            '{directFileFailureRejected=throwsWith(()=>renderAttemptGcModule.createRenderGcFileSnapshot(directFileFailureRoot,directFileFailureTarget,directFileFailureBytes,),"changedphysicalidentity",);}',
          tryDigest:
            "9e6233fd9daa9168b6ef11e0a447e8ef7466e6176376150130e2d32ab4f3765e",
        },
        {
          catchBodies: ["directFileAbaCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1911,
          finallyDigest:
            "bf6b1243bdafeb465a8caf9d29cde77e5d68bd389955391471b8e783284cd958",
          finallySubstantive: {
            digest:
              "edd4516383b777a9e6114ea970878184806804d4dbd8e7c8bb67e4e2c32cd410",
            tokens: 50,
          },
          index: 842,
          preceding:
            "letdirectFileAbaCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d4b81b69af3f62ef3a15ea63b4813d5912cdf298cd2bbe0c08a57afb97d740b1",
            tokens: 21,
          },
          tryBody:
            "{directFileAbaRejected=throws(()=>renderAttemptGcModule.createRenderGcFileSnapshot(directFileAbaRoot,directFileAbaTarget,directFileFailureBytes,),);}",
          tryDigest:
            "5c37ebbf45e1e3ff7147fc907473249d297365303165beb8dbaaf3709c57af2f",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
