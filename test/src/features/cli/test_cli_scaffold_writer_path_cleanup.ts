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

const writerPathCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "scaffoldwritersplitidentitylstathook",
    "scaffoldwriternonemptybasemkdirhook",
    "scaffoldwriternonemptyparentmkdirhook",
    "scaffoldwriterno-forcecompetitoropenhook",
    "scaffoldwriterforcesuccessoropenhook",
    "scaffoldwriterrootsuccessoropenhook",
    "scaffoldwriterparentsuccessoropenhook",
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

export const test_cli_scaffold_writer_path_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns seven writer path cleanup lifecycles",
    writerPathCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["splitIdentityCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "03c112bc81313496c606221c1f95d3abc741e37a077287d95f9251ee5f3d1ebb",
          finallySubstantive: {
            digest:
              "ddc18e787b25622c3ff2ef59b3cfcbbf8f7990c19e3d3d62a0036ca27845ba64",
            tokens: 29,
          },
          index: 1705,
          preceding:
            "letsplitIdentityCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d63f90c5e54e95e209ca5c36a0e770e88cf17492fa676cbc10af6e6886ed0f23",
            tokens: 15,
          },
          tryBody:
            '{writeFiles(splitIdentityScaffold,{"owned.txt":"scaffoldidentity"});splitIdentityWritten=true;}',
          tryDigest:
            "ff130d47acb157e7badb4bdde29cbe1dfb00db20d48665cf3ba6cf8602085aa1",
        },
        {
          catchBodies: [
            "nonemptyBaseSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "14d6aa765dbd554bb41b494400aa183db5cc345e38b3a253b2ac7964d6b1c94e",
          finallySubstantive: {
            digest:
              "a468b13c0219872a3b92feceae32b31e3789b8ebc1d641f8dcb5cfce40c3fa5c",
            tokens: 29,
          },
          index: 1722,
          preceding:
            "letnonemptyBaseSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "bc26006f6f78d7a0f62dc719b360ce106d268ea7563a3556890d0eaaa0b21060",
            tokens: 27,
          },
          tryBody:
            '{nonemptyBaseSuccessorRejected=throws(()=>writeFiles(nonemptySuccessorBase,{"owned.txt":"scaffoldbytes"},{force:true},),);}',
          tryDigest:
            "2288e390c98370b0fd0281128a392f6a4a6141002eea44b7a7961b55b09153ab",
        },
        {
          catchBodies: [
            "nonemptyParentSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "612226db6726a0312e6a3fe5161a4bcfdeb518ce9d55a5ce3dc0245f48aeddbe",
          finallySubstantive: {
            digest:
              "9d7bbbf34eef931d341367bfeb35461adb125b21f907dc0b5bf407dd8a03862d",
            tokens: 29,
          },
          index: 1732,
          preceding:
            "letnonemptyParentSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "5aa2c846c085d9d7ad8be0eccfdd5369817aae9e60f2227ccf6309e9147518fd",
            tokens: 21,
          },
          tryBody:
            '{nonemptyParentSuccessorRejected=throws(()=>writeFiles(nonemptyParentSuccessorBase,{"nested/owned.txt":"scaffoldbytes",}),);}',
          tryDigest:
            "90eb8b8d17dfc1f4a5c8568424ee5a7a71ba67f083d77389628858959f6941ee",
        },
        {
          catchBodies: [
            "noForceCompetitorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "73edd59c7008be18d02b2b659ab103d02f4a5b7ca9149f34b0b6843a84f9ffce",
          finallySubstantive: {
            digest:
              "156354e862c9be9232c3ecb24bf3b0474d8ee1d18278f52414251225535880c7",
            tokens: 29,
          },
          index: 1767,
          preceding:
            "letnoForceCompetitorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "eabbbffda6ca8a03969c5d9629bdcd2526eba1db54eb47a66007d742af6481e0",
            tokens: 20,
          },
          tryBody:
            '{noForceCompetitorRejected=throws(()=>writeFiles(noForceRaceBase,{"winner.txt":"scaffoldbytes"}),);}',
          tryDigest:
            "74cc6b0dea19d7021d3a441315164c3bdabf1524adabab3715721f5fae04e411",
        },
        {
          catchBodies: ["forceSuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "d8abc97b4fbcc795e002519cfd2885b7efe0556c024f992aa587ed9507418b69",
          finallySubstantive: {
            digest:
              "62dfc0688e9b7606fb3b4aec0e2bf848b34192378e3eeae3eb810d2e69f38f1b",
            tokens: 29,
          },
          index: 1778,
          preceding:
            "letforceSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "2dd7ab0dc872a1347f766043e816a1024ebf13986837309ac10d01d8105e24e8",
            tokens: 27,
          },
          tryBody:
            '{forceSuccessorRejected=throws(()=>writeFiles(forceRaceBase,{"owned.txt":"scaffoldbytes"},{force:true},),);}',
          tryDigest:
            "24ac7ad0ad691b20b8edd2df5b36df3147e1a53d55bd2d34b37ff5fee3d6cdd8",
        },
        {
          catchBodies: ["scaffoldRootCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "630d8b539fcd5187cb6b2dfc615fe08aee16b327428ecce3fbe4ea8b56003edb",
          finallySubstantive: {
            digest:
              "ffb034e277f4daa4cd1e35d28cbbcb2f0505c9cde2ba56f6b7b0c411c8318b4d",
            tokens: 29,
          },
          index: 1788,
          preceding: "letscaffoldRootCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d221ba6f3298e6b956de95d976a033a644b707172f7e297a0774e70803d0f2ea",
            tokens: 20,
          },
          tryBody:
            '{scaffoldRootRejected=throws(()=>writeFiles(rootRaceBase,{"created.txt":"scaffoldbytes"}),);}',
          tryDigest:
            "aa2caeb6add25d64b115133b4ad80383b6c37e5bc4df77b097a4119b877ad577",
        },
        {
          catchBodies: ["scaffoldParentCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "97884fec49029073a4ba75dec1c1948ebad99383c080bb3e87de9022745d34cb",
          finallySubstantive: {
            digest:
              "747cc8b7cd334bbc1e4dae8f5dbf78cb8224294bbd0ce0ca848773aeef9e370a",
            tokens: 29,
          },
          index: 1799,
          preceding:
            "letscaffoldParentCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "32c3b287b7783d7936d5ab692bb68d9a05308acfee7d3a7dcfbace90044d3952",
            tokens: 27,
          },
          tryBody:
            '{scaffoldParentRejected=throws(()=>writeFiles(parentRaceBase,{"nested/created.txt":"scaffoldbytes"},{force:true},),);}',
          tryDigest:
            "34f1ce3c2dfa9da2bd70fb97bb4f6ebd9e6c455dca49c6c73335a9d6b3c56d5d",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
