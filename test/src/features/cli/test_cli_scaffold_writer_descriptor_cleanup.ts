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

const writerDescriptorCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "scaffoldstandaloneopenhook",
    "scaffoldcreatedoubleopenhook",
    "scaffoldoverwritedoubleopenhook",
    "scaffoldnesteddescriptoropenhook",
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

export const test_cli_scaffold_writer_descriptor_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four writer descriptor cleanup lifecycles",
    writerDescriptorCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "standaloneScaffoldCloseError=error;",
            "standaloneScaffoldHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1975,
          finallyDigest:
            "0e423586e3a6b89ec0a28e9aa5371254be28eb1a946eeafec0713daff2dc78aa",
          finallySubstantive: {
            digest:
              "dbe6880b4145fea9973da5053a4a60c3114e959115c6c9241fba979d511c761a",
            tokens: 50,
          },
          index: 1879,
          preceding:
            "letstandaloneScaffoldHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "41fca2be99c34f557229d0f6f826f10eb63ae2a17309f69ff54e89384532ab31",
            tokens: 11,
          },
          tryBody:
            '{writeFiles(closeFailureBase,{"complete.txt":"closeevidence"});}',
          tryDigest:
            "25468f5cb041d542dd1afd99e0e49176078aa654285bd2ded230c8e2ba6cd536",
        },
        {
          catchBodies: [
            "combinedDoubleFailure=error;",
            "doubleFailureHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1975,
          finallyDigest:
            "903daf3528f7e750d53c3fe62c1077e494e6003d323de55b1897ca1dc013cc23",
          finallySubstantive: {
            digest:
              "6f94ec7030cbf3f2a8fc6a79c167f9acf0fe017010817b4944dff56bfcc95caf",
            tokens: 71,
          },
          index: 1897,
          preceding:
            "letdoubleFailureHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d439e63f8d14a87686be77030f7a11bd538a1742e102ac1d3332f59a46663506",
            tokens: 11,
          },
          tryBody:
            '{writeFiles(doubleFailureBase,{"partial.txt":"doubleevidence"});}',
          tryDigest:
            "7e103e1b4fe15e91717537b76a34ab2d652043fe24fe8c36874fb2944c08cd58",
        },
        {
          catchBodies: [
            "combinedOverwriteDoubleFailure=error;",
            "overwriteDoubleFailureHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1975,
          finallyDigest:
            "ab395882c726decd4351299602bf69784115042f82479d6a53e7b8cedf5a4664",
          finallySubstantive: {
            digest:
              "406ee4dac892e791fbdee311ac74edb44889463fcc278215e99e9bea3893ec0e",
            tokens: 71,
          },
          index: 1911,
          preceding:
            "letoverwriteDoubleFailureHarnessCleanupFailure:|{error:unknown}|undefined;",
          substantive: {
            digest:
              "5922cfc2766242306fadf700583ef88d0566cd54d2872d601cad94398ec2ceaf",
            tokens: 18,
          },
          tryBody:
            '{writeFiles(overwriteDoubleFailureBase,{"partial.txt":"replacementevidence"},{force:true},);}',
          tryDigest:
            "87bf9a71a21763a6507896b52535aa6216a953abc3f86043cf68355bb5ab8935",
        },
        {
          catchBodies: [
            "combinedNestedDescriptorFailure=error;",
            "nestedDescriptorHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1975,
          finallyDigest:
            "73a8c47e4d40b564edc1b30d7ae4a9cbb760c833a5527d9a38f36e5020aa7df3",
          finallySubstantive: {
            digest:
              "a2a15303a61ce48d2fad36c2ede9e533752aa4af186cceea37c8ae03b28b1ab1",
            tokens: 71,
          },
          index: 1926,
          preceding:
            "letnestedDescriptorHarnessCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "c19a60f4507a5572da3d4e16a258565aa4e177f1edfb74cf24f301a057cb245d",
            tokens: 12,
          },
          tryBody:
            '{writeFiles(nestedDescriptorFailureBase,{"owned.txt":"nesteddescriptorevidence",});}',
          tryDigest:
            "52ca6ac0338832ea77b4ffc26cd83ae80cc39e71a88ec371c5ec8a9ec9b78c46",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
