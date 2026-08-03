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

const renderGcWorkerCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "rendergcworkerdestinationopenhook",
    "rendergcworkerparentabaopenhook",
    "rendergcworkerrootabaopenhook",
    "rendergcworkerpartialrenamehook",
    "rendergcdecisionsuccessoropenhook",
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

export const test_cli_scaffold_render_gc_worker_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns five render GC worker cleanup lifecycles",
    renderGcWorkerCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "workerDestinationCompetitorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "66af3665fc09cc3d9707a19a5f4cf1f0d9d2670a4c98f32fe5f77621645a4c16",
          finallySubstantive: {
            digest:
              "b712de7eed3339e023273a6bcd9832136fca16bae7d763459ef993745b3b3687",
            tokens: 29,
          },
          index: 1547,
          preceding:
            "letworkerDestinationCompetitorCleanupFailure:|{error:unknown}|undefined;",
          substantive: {
            digest:
              "decfc3ede5b6f474ee13f00c548fd1724961751431b3d2b9fec88ed802372ea8",
            tokens: 33,
          },
          tryBody:
            "{workerDestinationCompetitorRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerCompetitorDestination,isolated:workerCompetitorIsolated,quarantine:workerPreserved,snapshot:workerCompetitorSnapshot,}),);}",
          tryDigest:
            "951c2e8f614f2c158888098ccc9dd26e4d78273cd10ef605a90d17968386e9e1",
        },
        {
          catchBodies: [
            "workerParentAbaCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "131276a5da58029f39e751e36c61f91c72b89bae7ea4099163885665dac3c5da",
          finallySubstantive: {
            digest:
              "c8d31c48c58e2975b999f5e3216077a9c67fce4d9a12acf07284fd8d57b27400",
            tokens: 29,
          },
          index: 1589,
          preceding:
            "letworkerParentAbaCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "556128e41431e46b169490f6df9fcab18bb2e5786f5c006d50883d9a135bdcb7",
            tokens: 33,
          },
          tryBody:
            "{workerParentAbaRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerParentAbaDestination,isolated:workerParentAbaIsolated,quarantine:workerPreserved,snapshot:workerParentAbaSnapshot,}),);}",
          tryDigest:
            "b13c8ce73cd49377dacfd6cfcf88303ee7e5f1013bffc20098150cf0165e2f04",
        },
        {
          catchBodies: ["workerRootAbaCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "c8815adaf921ee0bf803dcf1db71d6b50fbddd6ab80c6c17b0c640e5bbdf9e62",
          finallySubstantive: {
            digest:
              "266a6fc53c91654964a9d4e46de3b5bf011cf606e81b3a41a49df2d68118dda9",
            tokens: 29,
          },
          index: 1606,
          preceding:
            "letworkerRootAbaCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "57da0d4d9f3a9b88ae526162b3d57b95520bdbb9124eda3fc6a14bf9810be628",
            tokens: 33,
          },
          tryBody:
            "{workerRootAbaRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerRootAbaDestination,isolated:workerRootAbaIsolated,quarantine:workerPreserved,snapshot:workerRootAbaSnapshot,}),);}",
          tryDigest:
            "d0c1e3e447d598d086fd0ec58c99db445e2fd3122c9b243d343bb267c24b32d7",
        },
        {
          catchBodies: ["workerPartialCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "8c12354a37a7e1f78961b4cb2dd6f2ffab3e86f8bd32636e0d6c97c515806514",
          finallySubstantive: {
            digest:
              "93898e4b8f9c5c9ba886c4c536cf4e0f6538268958c0d0430687468063dcb4e5",
            tokens: 29,
          },
          index: 1624,
          preceding:
            "letworkerPartialCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1608ddb51cca4b6eaa6f8d79a557c7643f80010c1556299234d98b25e54b5735",
            tokens: 33,
          },
          tryBody:
            "{workerPartialRejected=throws(()=>renderGcModule.quarantineCapturedRenderTarget({destination:workerPartialDestination,isolated:workerPartialIsolated,quarantine:workerPreserved,snapshot:workerPartialSnapshot,}),);}",
          tryDigest:
            "2b5dde45602e1161182d043aedd93e8f9ac5a1f9e40113ebbee27b3fc7a428bd",
        },
        {
          catchBodies: [
            "decisionSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "42d716e5b06a855a76f54bd253295c75337c84fb99488ad899a0e7c224bd5853",
          finallySubstantive: {
            digest:
              "2c25f23e18b759c10222e957ed1bbed0e1bed30cebeaeb2f6f6a9d00d8eeb717",
            tokens: 29,
          },
          index: 1655,
          preceding:
            "letdecisionSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "8d3102682fa7dae0a17155de1e6878511fb59e5a3e2c5f8692eb0d0daf475faa",
            tokens: 20,
          },
          tryBody:
            "{decisionSuccessorRejected=throws(()=>renderGcModule.readCapturedRenderGcFile(heldClaimSnapshot,1024*1024),);}",
          tryDigest:
            "beede6847e73658e6303e9eb1907873481db4d057ca478c38af3af28bf8d6d08",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
