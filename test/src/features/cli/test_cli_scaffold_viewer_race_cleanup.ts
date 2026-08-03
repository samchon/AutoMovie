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

const viewerRaceCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "viewerancestorlstathook",
    "viewerartifactlstathook",
    "viewerledgerlstathook",
    "viewermodellstathook",
    "viewerinventoryreaddirhook",
    "viewerassetlstathook",
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
        compact(node.finallyBlock!, source).includes(anchor),
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

export const test_cli_scaffold_viewer_race_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns six viewer race fixture cleanup lifecycles",
    viewerRaceCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["ancestorRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "79be2444a4921a3048dc93ec4a73aab02b57515f9f1c0343e915bdbdc4595a6f",
          finallySubstantive: {
            digest:
              "7a1b35e0689ade53aa176ac19900c3757410b2836ba371d060ff33ee671009fe",
            tokens: 113,
          },
          index: 69,
          preceding: "letancestorRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "7c72f1693597684b3abea3f454fd2c8e7b82eb2511f41e133372cdea4ae7d144",
            tokens: 18,
          },
          tryBody:
            '{middleware?.({url:"/__automovie/shots/race.json"},ancestorResponse,()=>undefined,);}',
          tryDigest:
            "6664989fa07c6591c995f1cbf203e89ddd70df9037801a26ab99d3f2d60350a7",
        },
        {
          catchBodies: ["artifactRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "348d543079155e35b90bb1c0f0112561e8ba6273b29c00fe493e8d0ac18185a7",
          finallySubstantive: {
            digest:
              "36edaab589c1f84e488a0e750d7126c867ebee89103d61f78ed2b185a922f6ad",
            tokens: 77,
          },
          index: 76,
          preceding: "letartifactRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "d5be68cdac965bb4302ca55c8da25507cd2ab287c2bf4872db6939aa3680eca4",
            tokens: 18,
          },
          tryBody:
            '{middleware?.({url:"/__automovie/shots/race.json"},viewerResponse,()=>undefined,);}',
          tryDigest:
            "e92850e1f7bf90a3a2f613c841546bcfade6ad9f7ee1780b85def729072f7d7c",
        },
        {
          catchBodies: ["ledgerRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "2e74f40dd2c237b508abc3fb69932d474c11872e8e8c7e8cd4c0671898d53ddf",
          finallySubstantive: {
            digest:
              "4945926d6e2afc5fac4a6bce09191982470c3a3027a1659a8ee6cbab6b2f3f99",
            tokens: 77,
          },
          index: 95,
          preceding: "letledgerRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "42ee9b4a8c18157f373f58cc5d7041d8db6bcbc324df88929fd4d1e606e59dae",
            tokens: 6,
          },
          tryBody: "{ledgerResponse=requestRegisteredAsset();}",
          tryDigest:
            "7cf02b09e1908721cac21df4c2a67c23c1cedda38ad781abb68d14ffade98dc4",
        },
        {
          catchBodies: ["modelRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "d58362fc72ab44a081cdba00f71240a5b198212bc860987308d84331af4c59e3",
          finallySubstantive: {
            digest:
              "9d08e258f8e3354bc8af0f2044b3adfc0f99dd477321de86c1877fdf38451a51",
            tokens: 77,
          },
          index: 103,
          preceding: "letmodelRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "2283d259b80d053140dfb4104eab1de8a82cc1b1d04fe0fbc3c92cbe19b79bdc",
            tokens: 6,
          },
          tryBody: "{modelResponse=requestRegisteredAsset();}",
          tryDigest:
            "ae8fb14cb849abee5f612ca3b7cf67551f83a3f838b9067ffeec48b86d1f2296",
        },
        {
          catchBodies: ["inventoryRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "b8b24aff509ffca14288f4adc74df66e29f4635c345912cc057fae715a018883",
          finallySubstantive: {
            digest:
              "726dee4cf9439c1e7475cd0b3467ed0dce26fb8d561a98c5e054b101412e7ae5",
            tokens: 57,
          },
          index: 112,
          preceding:
            "letinventoryRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "7252ffd1ad4fef4ec828841fd4847eae6d7c3d1c4f31fc2b555804fe60f1096e",
            tokens: 6,
          },
          tryBody: "{inventoryResponse=requestRegisteredAsset();}",
          tryDigest:
            "5099063f577f4fc2e225ad5dc80d5c4a236a8d9b5ae2d3ba5ada72080b8bbd4b",
        },
        {
          catchBodies: ["assetRaceCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "716d7864a47395a399ed02c0be44c5b96e9e3c0dc121ac0ea19e65d71d2d1644",
          finallySubstantive: {
            digest:
              "36701ed599f06a9bbdc3bf8e0e55c1fbae681c3dc2ddc80e9e531e668e41f250",
            tokens: 77,
          },
          index: 119,
          preceding: "letassetRaceCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "15bb66cb0c151c061cb67bfdce8b9ecdf329a418ccda75b5d06999cd9529c5d2",
            tokens: 18,
          },
          tryBody:
            '{middleware?.({url:"/__automovie/assets/public/audio/starter-tone.json"},assetResponse,()=>undefined,);}',
          tryDigest:
            "0d15418d4f739fa530c50ca16bf267ed2945d4a472940e4a7a3245c6077255fd",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
