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

const writerMutationCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "scaffoldlatecreateopenhook",
    "scaffoldlateforceopenhook",
    "scaffoldfinalcreateopenhook",
    "scaffoldfinalforceopenhook",
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

export const test_cli_scaffold_writer_mutation_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four writer mutation cleanup lifecycles",
    writerMutationCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "lateCreateMutationCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "f67b4c2bd34e98b18375178299e2953f29b5605ebde4daf5ab1983c8a834829b",
          finallySubstantive: {
            digest:
              "d51400177f28d9e908c10ae27a481c310c00c33918290d412e6eca60ffbe2546",
            tokens: 50,
          },
          index: 1850,
          preceding:
            "letlateCreateMutationCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "4e6e830f59b99d9b9557a1cc91afa3917d7f43ccda1d3a2759938237d844f2b1",
            tokens: 21,
          },
          tryBody:
            '{lateCreateMutationRejected=throws(()=>writeFiles(lateCreateMutationBase,{"owned.txt":"scaffoldgeneration",}),);}',
          tryDigest:
            "123267b58a1629c81d7393e1bd93013086b2c643fb35964624625bd5cb96597e",
        },
        {
          catchBodies: [
            "lateForceMutationCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "792ace9b3784dff220b9bdc13343a066d0cfea799dceb9a5785abcffd073c5d9",
          finallySubstantive: {
            digest:
              "d4a30948f625f5ad354536caa2f08ad5890753439cfa4efe3d65f99aa1a164ea",
            tokens: 50,
          },
          index: 1863,
          preceding:
            "letlateForceMutationCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "ce709dd372fb45a84d37c2ad4ed87818f4839b6572982714967090986bade3b3",
            tokens: 27,
          },
          tryBody:
            '{lateForceMutationRejected=throws(()=>writeFiles(lateForceMutationBase,{"owned.txt":"scaffoldgeneration"},{force:true},),);}',
          tryDigest:
            "a7781ede8b175b36359b08ca4e02246c93837fecfbbc9aee87ebc99642c0a59e",
        },
        {
          catchBodies: [
            "finalCreateMutationCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "1ee054979b4e2ea9ad25f87c29b2e69feb7c2953ee49f28931b8153d53b86ba8",
          finallySubstantive: {
            digest:
              "053a12e9e29a5b0894ef21f6e600f389e3b9d48a19c3395aac72a2e8102928d8",
            tokens: 71,
          },
          index: 1876,
          preceding:
            "letfinalCreateMutationCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "11f86871f66655596892ef7dccf0d361461922645a921e85f3d31e0077800bd9",
            tokens: 21,
          },
          tryBody:
            '{finalCreateMutationRejected=throws(()=>writeFiles(finalCreateMutationBase,{"owned.txt":"scaffoldgeneration",}),);}',
          tryDigest:
            "82268124ea176d2db1a4cc0cc9f46a1043dc883056eedf51752f9b5d108fbba5",
        },
        {
          catchBodies: [
            "finalForceMutationCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "daeab11b6674f05f06b125b652250f8dc06116935cb33f377f90ebd8440b9eb4",
          finallySubstantive: {
            digest:
              "28b0f4c18c46e0d9e73dca974dae0d9c4b8e408e6c2038c4cf45ff5ccb5c040e",
            tokens: 71,
          },
          index: 1891,
          preceding:
            "letfinalForceMutationCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "321234335a773c5c8ce6f69ff10e0c282bc5e758ed1ddb6687f778aede744886",
            tokens: 27,
          },
          tryBody:
            '{finalForceMutationRejected=throws(()=>writeFiles(finalForceMutationBase,{"owned.txt":"scaffoldgeneration"},{force:true},),);}',
          tryDigest:
            "1e5476cc2ac59fc17b04c60f7eadac45db7a9490bd98c1b804259017276ca57b",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
