import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const rootCoordinationHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const owners = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "test_mcp_production_project" &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
  const holderNames = [
    "parentSwapFailure",
    "replacementParentFailure",
    "coordinationMkdirFailure",
    "coordinationCollisionFailure",
    "deniedRootLstatFailure",
    "coordinationChmodFailure",
    "partialCoordinateFailure",
  ] as const;
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallyStatements: number;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        const failureHolder = compact(statements[index - 1]!, source);
        if (holderNames.some((name) => failureHolder.startsWith(`let${name}:`)))
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
            failureHolder,
            finallyDigest: digestText(node.finallyBlock.getText(source)),
            finallyStatements: node.finallyBlock.statements.length,
            finallySubstantive: leafTokenContract(
              node.finallyBlock.statements,
              source,
            ),
            index,
            substantive: leafTokenContract(node.tryBlock.statements, source),
            tryDigest: digestText(node.tryBlock.getText(source)),
            tryStatements: node.tryBlock.statements.length,
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.body);
  }
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.body) ? [owner.body.statements.length] : [],
      ),
    },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
  };
};

const captureCleanup = (props: {
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      [
        {
          resource: "root-coordination hook",
          cleanup: (): void => {
            order.push("hook");
            if (props.cleanupFailure !== undefined)
              throw props.cleanupFailure.error;
          },
        },
      ],
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_project_root_coordination_hook_cleanup =
  (): void => {
    const primaryFailure = { phase: "root-coordination assertion" };
    const cleanupFailure = { phase: "root-coordination hook restoration" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailure: { error: cleanupFailure, present: true },
    });
    const combined = captureCleanup({
      cleanupFailure: { error: cleanupFailure, present: true },
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedStandalone = captureCleanup({
      cleanupFailure: { error: undefined, present: true },
    });
    const undefinedCombined = captureCleanup({
      cleanupFailure: { error: undefined, present: true },
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.predicate(
      "root-coordination hooks preserve primary and restoration failures",
      success.caught === false &&
        success.failure === undefined &&
        success.order.join(",") === "hook" &&
        primaryOnly.caught &&
        primaryOnly.failure === primaryFailure &&
        primaryOnly.order.join(",") === "hook" &&
        standalone.caught &&
        standalone.failure === cleanupFailure &&
        standalone.order.join(",") === "hook" &&
        combined.caught &&
        aggregateContainsExactly(combined.failure, [
          primaryFailure,
          cleanupFailure,
        ]) &&
        combined.order.join(",") === "hook" &&
        undefinedStandalone.caught &&
        undefinedStandalone.failure === undefined &&
        undefinedStandalone.order.join(",") === "hook" &&
        undefinedCombined.caught &&
        aggregateContainsExactly(undefinedCombined.failure, [
          undefined,
          undefined,
        ]) &&
        undefinedCombined.order.join(",") === "hook",
    );
    TestValidator.equals(
      "production-project test owns seven root-coordination hook cleanup lifecycles",
      rootCoordinationHookCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_project.ts"),
          "utf8",
        ),
      ),
      {
        owner: {
          count: 1,
          lifecycles: [
            {
              catchBodies: ["parentSwapFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letparentSwapFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "8807eb573f652a063498f49a1f8c7c73382d2ff5a660dcbb93f3e02ed15d296f",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "f0334f257cb1c1db8f34cabc1728970b1664920a8239851ca5b82a08e76f60b7",
                tokens: 29,
              },
              index: 102,
              substantive: {
                digest:
                  "c479b72f1e900c5c2f3c1d10fea9bc6d5dd028cafbe35abc57d7fca99c3b86d7",
                tokens: 18,
              },
              tryDigest:
                "e6e42736d73f96f130b029e5bbf3a8f525b8dc5e4ac606684272c87406fd82d5",
              tryStatements: 1,
            },
            {
              catchBodies: ["replacementParentFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "ForOfStatement",
              containerStatements: 11,
              failureHolder:
                "letreplacementParentFailure:|IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "40c43c02ee2b16196ec74433670cecdebf232629ae61646fb1e172b65c085d23",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "d83ec2a74ba3dbe647f064589e875c9529ee1404e30097623e73236d1501854c",
                tokens: 31,
              },
              index: 9,
              substantive: {
                digest:
                  "50bbc6baa018b0b6d34f5e3860fca5cf53ae1b0d26122e1afda8897899398e58",
                tokens: 18,
              },
              tryDigest:
                "1cee9b66e20071f6699c2f5e12002e80159550d600e375ef938571e73c5cc6d0",
              tryStatements: 1,
            },
            {
              catchBodies: ["coordinationMkdirFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letcoordinationMkdirFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "4057211d59e45161b7f0bdcb882bc81856aff01badb325dd3c27a06ce0fb6b4f",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "1eea9705598f3f70da68eb81e0cf487efb5828413d4a7af461d7519760b6f1f1",
                tokens: 29,
              },
              index: 108,
              substantive: {
                digest:
                  "a6edb73b7c29d891b5e4de8472642d2721010433fda68278cbc4f6567f441cf9",
                tokens: 24,
              },
              tryDigest:
                "f23218ddd88c4a440c516164ac047fef2aff7a7be000b55642ef5025f0347ea2",
              tryStatements: 1,
            },
            {
              catchBodies: [
                "coordinationCollisionFailure={error};",
                "throwerror;",
              ],
              catchVariables: ["error"],
              containerKind: "ForOfStatement",
              containerStatements: 3,
              failureHolder:
                "letcoordinationCollisionFailure:|IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "7164febd0e8b85e9f685a0cb345b0bfcb3e7196e18b5ec6ec14ae6b35e43939d",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "55b2c79fc20abbd83b652afb50755f59a75e09b55335ca9e2cd240c5f915fe3a",
                tokens: 31,
              },
              index: 2,
              substantive: {
                digest:
                  "8a8a007b47a6eda32d00be9e15d2e174207af36b432b15a86699131d43cad55c",
                tokens: 26,
              },
              tryDigest:
                "d04d9065359e6c7e046072a86e66e1e2791340cfd8b9fcc4f6cd040ae93d66cc",
              tryStatements: 1,
            },
            {
              catchBodies: ["deniedRootLstatFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letdeniedRootLstatFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "d4a85146403df83d536442473c0f9bd3aa96baf339db3d50fd1d8450a101a67b",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "c71e51a4ad9263cf673465c6f30ee131ca483f3678ab4bd53f905a4a9e5eaade",
                tokens: 31,
              },
              index: 116,
              substantive: {
                digest:
                  "53ee05c8c2383b8370f0fa6de53970ccc9ee3161286105a3e9b031afe1a50228",
                tokens: 24,
              },
              tryDigest:
                "debd32bdbdc0223c625548191686813f22a7541c4f25ba19abe20217cd32d9e7",
              tryStatements: 1,
            },
            {
              catchBodies: ["coordinationChmodFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letcoordinationChmodFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "b788bb0430806f22e40a23d224027659d67d1fe4b7d34ff3aefe6512a29522e4",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "32e15267074805754bdd085575ceb17929346f4feb535774d38955976bdb8c6a",
                tokens: 29,
              },
              index: 120,
              substantive: {
                digest:
                  "6c74696b06c39577bc4dbe62477338211104677c0fb4b00b13315940e000989a",
                tokens: 24,
              },
              tryDigest:
                "f468176561b33243438655a0b82c6b35443b9a42770da74420d59ca8752e1d1e",
              tryStatements: 1,
            },
            {
              catchBodies: ["partialCoordinateFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letpartialCoordinateFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "48c0003e2ba14c7f5d96d54c8d8605ea19864605fc640adbb118b15e94952adc",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "69dd4e7ba9f5c5c031d8e52a9f293719f71fc2c72381ccb09fb7793ea8cd4b01",
                tokens: 29,
              },
              index: 125,
              substantive: {
                digest:
                  "d020ca4a7c34d38ab8275576953988e180eb24310644171a5a945ae67f00ac1f",
                tokens: 49,
              },
              tryDigest:
                "fde000a27de637c6d4f25e1e9ced8dbf4433cb2b58c4ea4cd1e34eb3e7ab455d",
              tryStatements: 1,
            },
          ],
          statementCounts: [23],
        },
        parseDiagnostics: [],
      },
    );
  };
