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

const dialogueCacheCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "dialoguecachereuseabaopenhook",
    "dialoguecachepcmsuccessoropenhook",
    "dialoguecachereceiptsuccessoropenhook",
    "dialoguecachecaptureabaopenhook",
    "dialoguecacherootswapopenhook",
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

export const test_cli_scaffold_dialogue_cache_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns five dialogue cache cleanup lifecycles",
    dialogueCacheCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "reuseAbaDialogueCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "82bf93a82d33ec9ccaca05ef1eca7b6d82d09a43898eea6c1487d3b2fc347bc7",
          finallySubstantive: {
            digest:
              "963f2002e93878118f29f2436906b1631b831b1b071efca48858b6baac002abe",
            tokens: 29,
          },
          index: 748,
          preceding:
            "letreuseAbaDialogueCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b93bd0ccefdd3bc81846f2bc0af680a8fe9c335460fca5453e12d3f8449bde35",
            tokens: 33,
          },
          tryBody:
            "{reuseAbaDialogueRejected=throws(()=>dialogueCacheModule.publishDialogueCache({base:dialogueRoot,pcm:dialoguePcm,receipt:dialogueReceipt,target:reuseAbaDialogueTarget,}),);}",
          tryDigest:
            "faa71140ec597b2587718f2c053b5bd969654782fc95b3829fd748d2d67701e9",
        },
        {
          catchBodies: ["pcmSuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "6ee43ae006515e8527df651f5618a54280b360654bc91c996e70bc159e4c6764",
          finallySubstantive: {
            digest:
              "96b4562a838bf89876b5e15033c63cb81a6a57901070c3e0baa675f195f33f4b",
            tokens: 29,
          },
          index: 773,
          preceding: "letpcmSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "450e2295d0292e9126ebdfea78602df97473c9d3a5bfe722ad4307dd9811d38e",
            tokens: 33,
          },
          tryBody:
            "{pcmSuccessorRejected=throws(()=>dialogueCacheModule.publishDialogueCache({base:dialogueRoot,pcm:dialoguePcm,receipt:dialogueReceipt,target:pcmSuccessorTarget,}),);}",
          tryDigest:
            "9913015203577f67613a8eeab37bc6df52fbf000155bf7dd598e95c163f9332a",
        },
        {
          catchBodies: [
            "receiptSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "015266ad94bd00d0338147a13ee22386a127037b73f44a7d0b1f66d12f742fa5",
          finallySubstantive: {
            digest:
              "b6297913e6371d2a09a94ec3a82e8630b06e5d33dba143c1b788ed653098d5f8",
            tokens: 29,
          },
          index: 782,
          preceding:
            "letreceiptSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "26ec295eb026b6930a7ef50b9d650b5a3a3500fadf01c3018bb910d6872fcfb6",
            tokens: 33,
          },
          tryBody:
            "{receiptSuccessorRejected=throws(()=>dialogueCacheModule.publishDialogueCache({base:dialogueRoot,pcm:dialoguePcm,receipt:dialogueReceipt,target:receiptSuccessorTarget,}),);}",
          tryDigest:
            "978ce6b8abcd0f686b7abf6c0d9a870d12cb3d943d2607185f9aa9b3ff9b0aca",
        },
        {
          catchBodies: ["abaDialogueCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "967b7d5e8cbca269410064ba269d1de0d41d68ce87a5a68dcd6c768ba2b204d5",
          finallySubstantive: {
            digest:
              "637869f8d9b7a70bc6eb13e6b8fd50188338ef44a4179a699556730ce465ee12",
            tokens: 29,
          },
          index: 801,
          preceding: "letabaDialogueCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "3afd973b3941b6514459c10bd38cb663ba4e14e866b27f48737e7c8815b6a8ad",
            tokens: 19,
          },
          tryBody:
            "{abaDialogueRejected=throws(()=>dialogueCacheModule.captureDialogueCache(dialogueRoot,abaDialogueTarget,),);}",
          tryDigest:
            "a2c903328eb02bcedac3c1f2e21277c57c47ed5d42af6bd11a02814b8976e337",
        },
        {
          catchBodies: [
            "dialogueRootSwapCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1981,
          finallyDigest:
            "f508077e4f310325dd66c62d2f159326ccb30722f7016fcbf9d725c7e186794d",
          finallySubstantive: {
            digest:
              "c385783bf222f334b1ad64295c688d12b40dcc0ce709cd73ac0d275cf6395e57",
            tokens: 29,
          },
          index: 812,
          preceding:
            "letdialogueRootSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "8b6fd6e02fa2a9593e371bbfbce1badf37c7c06bd8c2c1cd97d9dc8780459681",
            tokens: 33,
          },
          tryBody:
            "{dialogueRootSwapRejected=throws(()=>dialogueCacheModule.publishDialogueCache({base:rootDialogueRoot,pcm:dialoguePcm,receipt:dialogueReceipt,target:rootDialogueTarget,}),);}",
          tryDigest:
            "c4a00b529562e68e0af9a6aa642aa34c74c8387881730dd18230caf39d6137e0",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
