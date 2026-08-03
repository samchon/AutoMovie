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

const renderPlanCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderplanexactcompetitoropenhook",
    "renderplanforeigncompetitoropenhook",
    "renderplanrootswapopenhook",
    "renderplantraversallstathook",
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

export const test_cli_scaffold_render_plan_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns four render plan cleanup lifecycles",
    renderPlanCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["exactPlanCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1957,
          finallyDigest:
            "709ac636f3f741cd1aafd479d10ee85d7fb3c576dd7f52429411026203a4c85a",
          finallySubstantive: {
            digest:
              "1da4ce746d51a76236832bbac69a155796152571ff621a92bdcd940f535b6dd0",
            tokens: 29,
          },
          index: 983,
          preceding: "letexactPlanCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "fb61557861cb2cf535a09d5e2dc4413b00308df29b390a0949906879a8b3c6a3",
            tokens: 40,
          },
          tryBody:
            '{exactPlanAccepted=awaitrenderPlanModule.publishRenderPlan({base:exactPlanRoot,inputCurrent:async()=>undefined,plan:planFixture("exact-competitor",48),predecessor:null,target:exactPlanTarget,});}',
          tryDigest:
            "dd972d27eb0e1d3048476405564366f37560bf23c6a7f0245023516001e9bb47",
        },
        {
          catchBodies: [
            "foreignPlanRejected=true;",
            "foreignPlanCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1957,
          finallyDigest:
            "1b83cf07a900e4b6e86311596e2d6b3fc54bdf7b6b37f1aa86be4d1975eb7b35",
          finallySubstantive: {
            digest:
              "d4119e0080381c56768f090b7773cbdb7fc9f2eddbd6c9a4b8921f5a841c5733",
            tokens: 29,
          },
          index: 994,
          preceding: "letforeignPlanCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "aefbd85cf5c01ef71fd33b0e3f91252ef1a27d62d5d40fe2ff2a5fbe5b4c06e6",
            tokens: 38,
          },
          tryBody:
            '{awaitrenderPlanModule.publishRenderPlan({base:foreignPlanRoot,inputCurrent:async()=>undefined,plan:planFixture("local",48),predecessor:null,target:foreignPlanTarget,});}',
          tryDigest:
            "99c0560b7a42fac022f472ec06644c0829ecac6414cc45aa7221180a6754a076",
        },
        {
          catchBodies: [
            "planRootSwapRejected=true;",
            "planRootSwapCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1957,
          finallyDigest:
            "c30ce33c112121613ce4b1a18bb579ed23055722cc75c8713972c7507f7cae01",
          finallySubstantive: {
            digest:
              "70fbdf3f4413dd466208feb3628b28806778ae1e4c04367f8e64492686ac4746",
            tokens: 29,
          },
          index: 1005,
          preceding: "letplanRootSwapCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "66dbe56df85b7a7fc2b46de83e89228763890356b6def5bd4b76855cc5c347c7",
            tokens: 38,
          },
          tryBody:
            '{awaitrenderPlanModule.publishRenderPlan({base:rootSwapPlanRoot,inputCurrent:async()=>undefined,plan:planFixture("root-swap",48),predecessor:null,target:rootSwapPlanTarget,});}',
          tryDigest:
            "cad2d1d138a103ff18fc0519b69014aa499e200f0707fe7e1ea82775d4127d9c",
        },
        {
          catchBodies: [
            "traversalDirectoryRejected=true;",
            "traversalDirectoryCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1957,
          finallyDigest:
            "dd2168825844fd9d4de95c19d3137305a711309dd1f399bed9240d299909e54f",
          finallySubstantive: {
            digest:
              "90f385a36e0cfafbb55132b73e57aaf098c49bfa37f1bb3a0c3583aaf815b245",
            tokens: 29,
          },
          index: 1048,
          preceding:
            "lettraversalDirectoryCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "cbc75243388564f6860242c969f4c146dd7fa75703c5020b2b8fa476af767a5c",
            tokens: 10,
          },
          tryBody:
            "{renderPlanModule.captureRenderPlan(traversalPlanRoot,traversalPlanTarget,);}",
          tryDigest:
            "86b7edb58861729794f5fd239414520ceab50217775f5345c3f8ca559d63efc0",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
