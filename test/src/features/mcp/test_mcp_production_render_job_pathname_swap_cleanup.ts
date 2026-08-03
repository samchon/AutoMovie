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

const pathnameSwapCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_render_job.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  let policyCount = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "preserveRenderJobFixtureCleanup" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      ++policyCount;
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      node.tryBlock.statements.length === 1 &&
      ts.isReturnStatement(node.tryBlock.statements[0]!) &&
      compact(node.tryBlock, source).includes("Reflect.apply(nativeRead,fs,") &&
      compact(node.finallyBlock, source).includes(
        "preserveRenderJobFixtureCleanup(",
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
        failureHolder: compact(statements[index - 1]!, source),
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
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
    policyCount,
  };
};

export const test_mcp_production_render_job_pathname_swap_cleanup =
  (): void => {
    TestValidator.equals(
      "render-job regression owns one pathname-swap cleanup lifecycle",
      pathnameSwapCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_render_job.ts"),
          "utf8",
        ),
      ),
      {
        lifecycles: [
          {
            catchBodies: ["pathnameReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letpathnameReadFailure:IRenderJobFixtureFailure|undefined;",
            finallyDigest:
              "aad51cf2dc598a6c2d1c078d244d049d16871e089f221898c4fd4e6a154514f7",
            finallySubstantive: {
              digest:
                "e98d7d23bd3fee4e07b4db4999cabdae530b74faa86799fe2e6c84f9c63afaaa",
              tokens: 50,
            },
            index: 4,
            substantive: {
              digest:
                "cca07b695c50f7aafe5df33f8663e1b95cbc766d530d79500c27249855e4ef78",
              tokens: 19,
            },
            tryBody:
              "{returnReflect.apply(nativeRead,fs,[file,...args])asunknown;}",
            tryDigest:
              "c09c15bcd7293316ba8f083c740e8cfa425b689f8f17c12ed9428a8b3a7a11f0",
          },
        ],
        parseDiagnostics: [],
        policyCount: 1,
      },
    );
  };
