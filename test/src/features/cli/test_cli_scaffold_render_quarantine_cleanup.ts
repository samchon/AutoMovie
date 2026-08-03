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

const renderQuarantineCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderquarantinemarkeropenhook",
    "renderquarantineevidenceopenhook",
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

export const test_cli_scaffold_render_quarantine_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two render quarantine cleanup lifecycles",
    renderQuarantineCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "workerMarkerSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1935,
          finallyDigest:
            "80967258ea864f6ca74d5fac7ca56c4078e07de131f1ae61d1e5349af97bda9e",
          finallySubstantive: {
            digest:
              "7efa04d234ccca5f485ce3ae00b3dafd09b1537db02cbe36b1bcdd39a5ab8f32",
            tokens: 50,
          },
          index: 1533,
          preceding:
            "letworkerMarkerSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "c7ca74f39ff1476fe3a010808c522f1b46cb01d1425ab6c3bded0aff2d18c100",
            tokens: 33,
          },
          tryBody:
            "{workerMarkerSwapRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerMarkerSwapDestination,isolated:workerMarkerSwapIsolated,quarantine:workerPreserved,snapshot:workerMarkerSwapSnapshot,}),);}",
          tryDigest:
            "0d2f35cdb0767d40169fe8099b24fd07588868c0906f89b63a0d5b3fa63fb698",
        },
        {
          catchBodies: [
            "workerEvidenceSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1935,
          finallyDigest:
            "8d66835203d10753324ef175833749373493fdf76cdcdac27668ec33883b3607",
          finallySubstantive: {
            digest:
              "7096c29ee32ce1631058c7aca855ed40821a500998aa136516a2f4cc45a1799c",
            tokens: 50,
          },
          index: 1548,
          preceding:
            "letworkerEvidenceSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "f5ca90f0650b0b7e29c4893a2dd3c69b99039f3e3b6fa107b1f39afb52e72a4d",
            tokens: 33,
          },
          tryBody:
            "{workerEvidenceSwapRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerEvidenceSwapDestination,isolated:workerEvidenceSwapIsolated,quarantine:workerPreserved,snapshot:workerEvidenceSwapSnapshot,}),);}",
          tryDigest:
            "58e5e273541aca21f0bcd43197caf8644b53aa9a022da4c1a47cc4b37b3605d0",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
