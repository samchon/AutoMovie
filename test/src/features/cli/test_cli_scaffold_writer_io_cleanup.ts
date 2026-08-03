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

const writerIoCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "scaffoldwriterpartialwritehook",
    "scaffoldwriterfsynchook",
    "scaffoldwriterreadstallhook",
    "scaffoldwritermismatchreadhook",
    "scaffoldwritershortreadhook",
    "scaffoldwriterprimary-onlywritehook",
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

export const test_cli_scaffold_writer_io_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns six writer I/O cleanup lifecycles",
    writerIoCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["partialWriteCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "0a151e02cfc830392ec63ca6a918dd6818243798f17d47cc5fee947854e5d847",
          finallySubstantive: {
            digest:
              "0ab96182d834ed54be1d273be1664cbcb8de6e9f6034785ba12770825852f5ac",
            tokens: 29,
          },
          index: 1793,
          preceding: "letpartialWriteCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "ed13ab304751d3f1db4ff50f765c5e52d60c3b8a74b03351d9ebc37cb316e1d4",
            tokens: 20,
          },
          tryBody:
            '{partialWriteRejected=throws(()=>writeFiles(partialWriteBase,{"partial.txt":"partialevidence"}),);}',
          tryDigest:
            "d4456b1e09673899ea25cc38fae198c826228490ca36baf03b25babddbb00f94",
        },
        {
          catchBodies: ["fsyncFailureCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "ac40b6ee7872ca480591ef274d6960d06068f9883b3647daa5ee8ea59a7936a5",
          finallySubstantive: {
            digest:
              "abd32d245a97be6397972ea7fadccbeb076d9f0b4acf5ad6cc99e530e4ab1698",
            tokens: 29,
          },
          index: 1801,
          preceding: "letfsyncFailureCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "89d231e46607ae2f680a48c426a4f83b9873d1474610d39008439122b5bd8959",
            tokens: 20,
          },
          tryBody:
            '{fsyncFailureRejected=throws(()=>writeFiles(fsyncFailureBase,{"complete.txt":"completeevidence"}),);}',
          tryDigest:
            "5d0c6f7aafc9b006ad8ac808f8337522f4be2daa8d302e755d36661973d00efa",
        },
        {
          catchBodies: ["readFailureCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "5f70f77aff507b601d1cdd66ce72964e0ed89469e1efacdcd6865779da9f2f5d",
          finallySubstantive: {
            digest:
              "9911b6b3aa06c6ca0ccf26d1d95b8a319e3734f46d00b72e4514e11af83990d6",
            tokens: 29,
          },
          index: 1809,
          preceding: "letreadFailureCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "48e3c79cb64b8e3e9cc0db3f3b0c9c273c5121e9ee71b4ffb2d2898fb442327c",
            tokens: 20,
          },
          tryBody:
            '{readFailureRejected=throws(()=>writeFiles(readFailureBase,{"complete.txt":"readevidence"}),);}',
          tryDigest:
            "5d241c53e5057072ca6880f3e746080e9094d4ce02d930684faed8bb7bab383b",
        },
        {
          catchBodies: ["mismatchCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "789da64a344004bcfb07e26d78a34a21112287d3b00f2de05591ca036e5ff083",
          finallySubstantive: {
            digest:
              "21a6bd9a1d348ea46ea144d6d8db11f9672717634d542bb710830533aec133b2",
            tokens: 29,
          },
          index: 1817,
          preceding: "letmismatchCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "3ae2aba4b459cf59f260b35275f74f3659fa67c8dde582e3c04dab59e6f8e42a",
            tokens: 20,
          },
          tryBody:
            '{mismatchRejected=throws(()=>writeFiles(mismatchBase,{"complete.txt":"mismatchevidence"}),);}',
          tryDigest:
            "d187a9b744160acb0662a84a7c35162d45735d28bca80923dfe25922a3c08b79",
        },
        {
          catchBodies: ["shortReadCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "c839f99ea9b3bc2ef6d85633e6efdbb566b3c68a0f297e51c76eea79545496f1",
          finallySubstantive: {
            digest:
              "1b430b4ea0b63d256545e8c9e61f17b800302a52b2a7ab7302212d8f81c9bcaa",
            tokens: 29,
          },
          index: 1825,
          preceding: "letshortReadCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1e178081d11494b4779b574d2ca365dc9cc9e1912288126909dbe493a54a5611",
            tokens: 21,
          },
          tryBody:
            '{shortReadAccepted=!throws(()=>writeFiles(shortReadBase,{"complete.txt":"shortreads"}),);}',
          tryDigest:
            "4ff5d5b46c5ff08a3f46bf1b615062dd05740e4cd6607e5d0652b2a969a6c382",
        },
        {
          catchBodies: [
            "preservedPrimaryOnlyFailure=error;",
            "primaryOnlyCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1985,
          finallyDigest:
            "32f032637da212ec0e184608500ffda23e3e97ba7e726ac0a31f4e52421b96f4",
          finallySubstantive: {
            digest:
              "1c2bb217744d17edbf79fdd4232ca424552ce28665463f8abd74f1a721f0eded",
            tokens: 29,
          },
          index: 1895,
          preceding: "letprimaryOnlyCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "57483b702ff26ad6458ee96e9314d3f60b6d5bdda08f567d353a57afdaf5afb9",
            tokens: 12,
          },
          tryBody:
            '{writeFiles(primaryOnlyFailureBase,{"partial.txt":"primary-onlyevidence",});}',
          tryDigest:
            "23922af85dfd092fb1d87617000734d38b7de60d95efc62d656b5fa7053a8cb6",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
