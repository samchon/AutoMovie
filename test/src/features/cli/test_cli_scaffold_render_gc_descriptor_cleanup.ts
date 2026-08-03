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

const renderGcDescriptorCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "rendergcstandaloneopenhook",
    "rendergcprimary-onlyopenhook",
    "rendergccombinedopenhook",
    "rendergccreateopenhook",
    "rendergcnestedopenhook",
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

export const test_cli_scaffold_render_gc_descriptor_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns five render GC descriptor cleanup lifecycles",
    renderGcDescriptorCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "standaloneRenderGcCloseError=error;",
            "standaloneRenderGcHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "2a9944070d82bed555181099bdd1a318d6b339e47539a7736415848457017d71",
          finallySubstantive: {
            digest:
              "87993a4f3441b48c952b6f46f64edf37326c2de90b302489fccfc5216a825a90",
            tokens: 50,
          },
          index: 1151,
          preceding:
            "letstandaloneRenderGcHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b13e8a6419a33e2ab4a7162c54084e2e1703a7b883f066b83725dfb405e7cf81",
            tokens: 9,
          },
          tryBody:
            "{renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot,1024);}",
          tryDigest:
            "98aaf663117e9cfe2cf90c85a8c359382a4f0d41c61433ecef997acf4bf94670",
        },
        {
          catchBodies: [
            "preservedPrimaryOnlyRenderGcFailure=error;",
            "primaryOnlyRenderGcHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "4a22ec047a926dadf2a201c13ccdee1576cbed299982087e811d9cce9580ad90",
          finallySubstantive: {
            digest:
              "149431daeb3ed3561cb658e429eb1279d9acccc3673afebb78b167bd2f7b9478",
            tokens: 50,
          },
          index: 1158,
          preceding:
            "letprimaryOnlyRenderGcHarnessCleanupFailure:|{error:unknown}|undefined;",
          substantive: {
            digest:
              "b13e8a6419a33e2ab4a7162c54084e2e1703a7b883f066b83725dfb405e7cf81",
            tokens: 9,
          },
          tryBody:
            "{renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot,1024);}",
          tryDigest:
            "98aaf663117e9cfe2cf90c85a8c359382a4f0d41c61433ecef997acf4bf94670",
        },
        {
          catchBodies: [
            "combinedRenderGcFailure=error;",
            "combinedRenderGcHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "e045cfeb4b5f91a00e06aecd20b2f9595f443e3105acf87e54109a5baee33e07",
          finallySubstantive: {
            digest:
              "2f577e4f64cd7497594cc5a5fe5b23245fd360d9dad7ecb33901f13528b38ec9",
            tokens: 71,
          },
          index: 1167,
          preceding:
            "letcombinedRenderGcHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b13e8a6419a33e2ab4a7162c54084e2e1703a7b883f066b83725dfb405e7cf81",
            tokens: 9,
          },
          tryBody:
            "{renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot,1024);}",
          tryDigest:
            "98aaf663117e9cfe2cf90c85a8c359382a4f0d41c61433ecef997acf4bf94670",
        },
        {
          catchBodies: [
            "combinedRenderGcCreateFailure=error;",
            "renderGcCreateHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "e967432aed91bfa40ad068334a5a9743a12cdfc7b73aa82619b64a82f74ac498",
          finallySubstantive: {
            digest:
              "57d79a891064d0d85352a5f403f7b628f30597aa15ee375c4fed18cb719c4e9b",
            tokens: 71,
          },
          index: 1177,
          preceding:
            "letrenderGcCreateHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "a9b075af011c47ea8ae357c8b86664c7b976c614a26196594b8de1a9e628a2f1",
            tokens: 17,
          },
          tryBody:
            '{renderGcModule.createRenderGcFileSnapshot(renderGcCleanupRoot,failedRenderGcCreate,Buffer.from("failedcreationbytes"),);}',
          tryDigest:
            "0639691c27aeafed08c33d93c14064437982405251133ad708ce45f17d7a9a0c",
        },
        {
          catchBodies: [
            "combinedNestedRenderGcFailure=error;",
            "nestedRenderGcHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "e78a963517ca712885dc497298981265fae2ab5fca31f8fbf38fed23d2807803",
          finallySubstantive: {
            digest:
              "bd1664a072f342b680b78d2c1c6051cfff76a9ff1d76f0493c6eae593db3ccc4",
            tokens: 71,
          },
          index: 1189,
          preceding:
            "letnestedRenderGcHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "44a8f581c968a32c9c08aff676bd6a1aaefb416a99e58daae922b33bfe2fc58b",
            tokens: 17,
          },
          tryBody:
            '{renderGcModule.createRenderGcFileSnapshot(renderGcCleanupRoot,nestedRenderGcCreate,Buffer.from("nestedcreationbytes"),);}',
          tryDigest:
            "29989171efd24a6a4113cbf2a5dd866ed9e4857ca604c011e0ff5273ef5225ae",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
