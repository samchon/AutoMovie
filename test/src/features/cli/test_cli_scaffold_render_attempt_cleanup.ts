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

const renderAttemptCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderattempttransitionrenamehook",
    "renderattemptcompletionrenamehook",
    "renderattemptcompetitoropenhook",
    "renderattemptpost-publicationlstathook",
    "renderattemptparentopenhook",
    "renderattemptrootopenhook",
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

export const test_cli_scaffold_render_attempt_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns six render attempt cleanup lifecycles",
    renderAttemptCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "transitionSuccessorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "1a52b11c7f8b87aeea9d640f69b6bb69d4a717e4696b2e9957ebd80e383513c6",
          finallySubstantive: {
            digest:
              "f84f9d820a5ca5e21bbdac311577bbc2262b77b2d9082ac1a4d2f96be0e8557f",
            tokens: 29,
          },
          index: 897,
          preceding:
            "lettransitionSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "b5ad66518f250382364fbdb38beea412413c07b539dd494cad6c971829ecb308",
            tokens: 25,
          },
          tryBody:
            '{transitionSuccessorRejected=throws(()=>renderAttemptModule.failRenderAttempt({attempt:transitionAttempt,correction:"mustnotoverwritesuccessor",}),);}',
          tryDigest:
            "36a45a47603f6357c1370f7b7d4db582bbfb422ed85a8d35f08e5058d785648a",
        },
        {
          catchBodies: ["completionCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "d48016f975aac3312553269c482415529a0fe682395b8a35c1651ec3561c3aab",
          finallySubstantive: {
            digest:
              "72d37e755be4bf2c8060f8dd0e84b3917dc946776dbc98932a8f160156112423",
            tokens: 29,
          },
          index: 905,
          preceding: "letcompletionCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "cf9baed49dc183b9a25e34962a63eb6de83e9193330ff6d4a36709b6118eca5e",
            tokens: 11,
          },
          tryBody:
            "{renderAttemptModule.completeRenderAttempt(completionAttempt);completionAccepted=true;}",
          tryDigest:
            "d16d6f5e52c89d13f1f2e098ab208225ac05c31c324050119fcfebad09bba3e9",
        },
        {
          catchBodies: [
            "targetCompetitorCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "210f47c6cbf38f0fb79e2f5f49300cf5ac87683bb07ae06fe7311ec54e0f59e9",
          finallySubstantive: {
            digest:
              "268dd0f2e12cda62b52b9db5cf77bfbe12996aced5170b79f1b0b38478bd853b",
            tokens: 29,
          },
          index: 913,
          preceding:
            "lettargetCompetitorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "22dd1eb886a286d555226e1efa3df678112a518e027193f1772badf93290b269",
            tokens: 52,
          },
          tryBody:
            '{targetCompetitorRejected=throws(()=>renderAttemptModule.beginRenderAttempt({base:attemptRoot,chunk:attemptChunk,lock:targetCompetitorLock,pid:32011,processAlive:()=>false,slot:"slot-0001",target:attemptTarget,token:firstAttemptToken,}),);}',
          tryDigest:
            "efd3c83aa1828db58b048b20aff10f5dbe3406ef787fee28d2a63bd321c43eb3",
        },
        {
          catchBodies: [
            "postPublicationCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "519a708c0c53e1b1f08f1ccdb79fb33840b81d204ee3bbc64cd2a192a73ce6a3",
          finallySubstantive: {
            digest:
              "a3e1a4a33a1ba91f8c7cf152aef9f9e206dac9c06145a80b02faa14c825e9a54",
            tokens: 29,
          },
          index: 924,
          preceding:
            "letpostPublicationCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "72835fe266e1ea9bbecbc3f933d70e4634550db4f84b5b000033cc8fa9c332cb",
            tokens: 61,
          },
          tryBody:
            '{postPublicationRejected=messagesOf(captureFailure(()=>renderAttemptModule.beginRenderAttempt({base:attemptRoot,chunk:attemptChunk,lock:postPublicationLock,pid:32012,processAlive:()=>false,slot:"slot-0001",target:attemptTarget,token:secondAttemptToken,}),),).join("|");}',
          tryDigest:
            "1b6e5e63244daf7a17cb755dbc1af5316d95f880be138e1c993c6573cfc922f7",
        },
        {
          catchBodies: ["attemptParentCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "c0bd3ac1589a54709429e5c07836349f948471d74029dd57b993d04ee308a8dc",
          finallySubstantive: {
            digest:
              "a9ec4a1e6fa4425ed65ef12f64fb9e3be097c79745ba24d8fef6d95a98b1713a",
            tokens: 29,
          },
          index: 935,
          preceding:
            "letattemptParentCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "f92a8e2ef52ae22cb7e8ae7a6331e6518d34b1412565990481d4246866ed1f51",
            tokens: 52,
          },
          tryBody:
            '{attemptParentRejected=throws(()=>renderAttemptModule.beginRenderAttempt({base:attemptRoot,chunk:attemptChunk,lock:parentFenceLock,pid:32009,processAlive:()=>false,slot:"slot-0001",target:attemptTarget,token:firstAttemptToken,}),);}',
          tryDigest:
            "0422fc950c78ed7801c6eef55269bded70d7158fd9b7d3a810d9d020cc0e51e8",
        },
        {
          catchBodies: ["attemptRootCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "a3ee49cc566c95b99fbfa9e6164570d950c508c22071a1b97164c5ee9b306782",
          finallySubstantive: {
            digest:
              "2737475cfcf849ec29116bc1b0d415c9fd63a5a3021ea402ed886e68507d6c98",
            tokens: 29,
          },
          index: 947,
          preceding: "letattemptRootCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "41ce27ba8a2ae5e3974dbfce067860bfc1b78ba8fd58237cc21792305e42d959",
            tokens: 52,
          },
          tryBody:
            '{attemptRootRejected=throws(()=>renderAttemptModule.beginRenderAttempt({base:attemptRoot,chunk:attemptChunk,lock:rootFenceLock,pid:32010,processAlive:()=>false,slot:"slot-0001",target:attemptTarget,token:secondAttemptToken,}),);}',
          tryDigest:
            "1e6f1529b2a95d817ff425ec6a468296b904ef6416bc975db3d13cd6d9ce4f57",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
