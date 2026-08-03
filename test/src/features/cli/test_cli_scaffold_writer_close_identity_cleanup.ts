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

const writerCloseIdentityCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "scaffoldclosetargetopenhook",
    "scaffoldforceclosetargetopenhook",
    "scaffoldcloseparentopenhook",
    "scaffoldcloserootopenhook",
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

export const test_cli_scaffold_writer_close_identity_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four writer close identity cleanup lifecycles",
    writerCloseIdentityCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["closeTargetCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1940,
          finallyDigest:
            "52e67f87dfae7d03dd506e455a713573833027768e97767664b3166cdc24c078",
          finallySubstantive: {
            digest:
              "ca4c3ac43982ad9a05bcad4072de4c15561a2bdb2ab6c9ae8d352f946286decd",
            tokens: 50,
          },
          index: 1902,
          preceding: "letcloseTargetCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "217bf95e42840af13a6eaee373880e8d8390c2c7035d7ae3bb3bc0dda6980791",
            tokens: 20,
          },
          tryBody:
            '{closeTargetRejected=throws(()=>writeFiles(closeTargetBase,{"owned.txt":"scaffoldgeneration"}),);}',
          tryDigest:
            "4449d5fc284a96e969939f967372bb0486403bb92a089e64fc8e3475e8fda61c",
        },
        {
          catchBodies: [
            "forceCloseTargetCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1940,
          finallyDigest:
            "d16a1386f2ad61146e107c837fe3e6991847916d672d1ec378f7e9a08b52223e",
          finallySubstantive: {
            digest:
              "30e37c1353efda8eac83094a6d3b950f94ecd27ccdcdd3a83c3272bd42cc0482",
            tokens: 50,
          },
          index: 1915,
          preceding:
            "letforceCloseTargetCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "8dad24288fc32f054d3c399ecc94c126168a449a379d464a305c3454a18831ee",
            tokens: 27,
          },
          tryBody:
            '{forceCloseTargetRejected=throws(()=>writeFiles(forceCloseTargetBase,{"owned.txt":"forcedscaffoldgeneration"},{force:true},),);}',
          tryDigest:
            "b357b28dbcbce69e96dc64cab282555f593c423e0e1d744d6e7eb1c79ec72a81",
        },
        {
          catchBodies: ["closeParentCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1940,
          finallyDigest:
            "78b50ae43ea6548ed997f9445f4a672ffd7c0cd00d2045e6db7aac2f3cb2e679",
          finallySubstantive: {
            digest:
              "0f7b08030b7c4e01ed05de783028451c100be8604ddce8a2fe9a4bf6c52fbab9",
            tokens: 50,
          },
          index: 1927,
          preceding: "letcloseParentCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "db18b8af75829158461dcf235be40dc358d275b39c9771e344c85a127fcb8c86",
            tokens: 21,
          },
          tryBody:
            '{closeParentRejected=throws(()=>writeFiles(closeParentBase,{"nested/owned.txt":"scaffoldgeneration",}),);}',
          tryDigest:
            "49d34574ed18ae185fb0bc6312038073e40f55ae791b6f023a728d296b01a07d",
        },
        {
          catchBodies: ["closeRootCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1940,
          finallyDigest:
            "a71853ca57f34eeb330845011da025a34b5807a752c04e9477800184071e26e9",
          finallySubstantive: {
            digest:
              "ce88db1ec456c8f1a6f8f93714cc8f7f5fc1085bb136d6fb73ab9d37bcb25453",
            tokens: 50,
          },
          index: 1938,
          preceding: "letcloseRootCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "6a68c7e5af6e81bdd16883facb24394ab0e6efbd74b06cdcb07e918c717ef9d6",
            tokens: 20,
          },
          tryBody:
            '{closeRootRejected=throws(()=>writeFiles(closeRootBase,{"owned.txt":"scaffoldgeneration"}),);}',
          tryDigest:
            "56f3d7f7070546cad064fb53cf1425b66a3d1debbdff16d176680a7816b813c2",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
