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

const residentReadCleanupContract = (text: string): unknown => {
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
    "sourceTransientReadFailure",
    "sourceReadFailure",
    "stateTransientReadFailure",
    "stateReadFailure",
    "generatedTransientReadFailure",
    "generatedReadFailure",
    "generatedManifestTransientReadFailure",
    "generatedManifestReadFailure",
    "contentTransientReadFailure",
    "contentReadFailure",
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
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 3 }, (_, index) => ({
        resource: `resident-read-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure.error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_project_resident_read_cleanup = (): void => {
  const primaryFailure = { phase: "resident-read operation" };
  const firstCleanupFailure = { phase: "native read hook" };
  const secondCleanupFailure = { phase: "transient replacement" };
  const thirdCleanupFailure = { phase: "parked resident" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: firstCleanupFailure, present: true }],
  });
  const multiple = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
      { error: thirdCleanupFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
      { error: thirdCleanupFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "resident-read cleanup preserves failure and recovery order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      standalone.caught &&
      standalone.failure === firstCleanupFailure &&
      standalone.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        firstCleanupFailure,
        secondCleanupFailure,
        thirdCleanupFailure,
      ]) &&
      multiple.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        firstCleanupFailure,
        secondCleanupFailure,
        thirdCleanupFailure,
      ]) &&
      combined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      partialSetup.caught &&
      partialSetup.failure === primaryFailure &&
      partialSetup.order.join(",") === "cleanup-0" &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
  );
  TestValidator.equals(
    "production-project test owns ten resident-read cleanup lifecycles",
    residentReadCleanupContract(
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
            catchBodies: ["sourceTransientReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letsourceTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "479b3a2aa54e2b7dd9d88a5422c8492a220565659bd18dfb500acbe413b5928b",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "e5cbbfa10a3cb95368b62198b64ec5865d5b33fd0fb9228007618bd16e5ed53c",
              tokens: 48,
            },
            index: 4,
            substantive: {
              digest:
                "0ee7ec367f2ba933c13029d6787dc6534e7ab0e8309a8f6643a8a6fdbb57a992",
              tokens: 17,
            },
            tryDigest:
              "d16b8fecaf3216a21d199fa0cd2fcd18c63491f556839cdd3999f18d5b277df5",
            tryStatements: 1,
          },
          {
            catchBodies: ["sourceReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letsourceReadFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "ba848875a0883b2396c83b421c0a3b603922e9555e30952a8343e2fcd8488132",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "282de8b4528eb719ff9c803e8734dec8216a53c630a3e45dd18c9b7e0efa7aa5",
              tokens: 96,
            },
            index: 38,
            substantive: {
              digest:
                "3e7e6fad0b11262ed180be32e466b32f6472debe9e62c22367de9763104fe553",
              tokens: 9,
            },
            tryDigest:
              "9cc29f75d906c4a98e848066a480fb8639938b12d502b36825933c3dc50817d9",
            tryStatements: 1,
          },
          {
            catchBodies: ["stateTransientReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 6,
            failureHolder:
              "letstateTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "955cf129daf6aa81c9c19dd56974390765d970006df04d14fc5888778421de9f",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "1908e159f9938fd10271bb649aea0c466ddee4b5c736a35e98f10f3e70046414",
              tokens: 52,
            },
            index: 5,
            substantive: {
              digest:
                "9609a4ef1d0c62bb6403e1c1240f06baa15ddc57e903ab3743c1b09a1ff7a915",
              tokens: 17,
            },
            tryDigest:
              "6db36a1e60024bc096ee81e9d6a6aa6c6bd9c9fdf3b9b8ac81074cbdf93c1539",
            tryStatements: 1,
          },
          {
            catchBodies: ["stateReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letstateReadFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "f066898fcb62c6038f2f4146ce58772e7caa4a1d1c8b3254da6c7f234d36ac24",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "89646163854dda759e3d0dcbdafabad1f2d5e7ced992a53f102ce675985aac7a",
              tokens: 120,
            },
            index: 51,
            substantive: {
              digest:
                "6a47d56c775c373c710b9396a65c353038f71deb1c1e9d5d0668f36fcd36225d",
              tokens: 28,
            },
            tryDigest:
              "815c53fd3e0dad902d61576a9df148013085bb3158810f249efecb5d5f89ebab",
            tryStatements: 3,
          },
          {
            catchBodies: [
              "generatedTransientReadFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letgeneratedTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "580b52bd66a9351db08ecfc1a317addc52975944aaae7c1bda8692a330b284e2",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "6c148c0023bd04f51da1c7ef06ca188fd8ccdb34a196f1d937946c0665f780ec",
              tokens: 49,
            },
            index: 4,
            substantive: {
              digest:
                "9a620e999651f159dfc153af27eed55dc4b66ea565c16c0886ff6606e23fcc5b",
              tokens: 17,
            },
            tryDigest:
              "a84a3abb0a01e850eda761000250226c6b8a7813be7083c475cfcdcee983918b",
            tryStatements: 1,
          },
          {
            catchBodies: ["generatedReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letgeneratedReadFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "df973064064ec24513b65779d3293966bfeb18247ec9e8a93786a953f20535e5",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "3f27e62d564d04124e447ec858fbf010aa7c8c724999fb816c4d56585b8d6b14",
              tokens: 96,
            },
            index: 147,
            substantive: {
              digest:
                "fd6aa8469045ca0720857b8bcd3f655fdebea21b895a863bff4abcb9f14ae880",
              tokens: 9,
            },
            tryDigest:
              "5701ebf8bcf4ddffc7777264f0819f095b370b7c64d6845fa3d914217a7f45c0",
            tryStatements: 1,
          },
          {
            catchBodies: [
              "generatedManifestTransientReadFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letgeneratedManifestTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "206859f7e649a5c89d054f11e6bd640b23f50c0e462ea9172ff3cff90863503b",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "83c507029ca09299c5e05548fc865f22a43bd5c31a36a748abca239245f91b53",
              tokens: 49,
            },
            index: 4,
            substantive: {
              digest:
                "b74a1187a45eafeb4948e17d400dba369a8d5de0d6d13d6fe257c0ae45ed7234",
              tokens: 18,
            },
            tryDigest:
              "b5fb5cddf3258b5f4aade62522af85d3f1843143e702c54f289ce4960a00fbd2",
            tryStatements: 1,
          },
          {
            catchBodies: [
              "generatedManifestReadFailure={error};",
              "stableGeneratedCommitRejected=true;",
            ],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letgeneratedManifestReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "018175369ec3614b368b022936ff11527a69f42507b560ff2d2927ce8669d042",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "896810f9e1f03de912077add384e80d7dbfb1f6cb2d387ccc7a7e57d7e55051a",
              tokens: 97,
            },
            index: 178,
            substantive: {
              digest:
                "bfef2759b9870a89c3737506040e0ae7d4259aca73bf915d54de01f6531207a1",
              tokens: 12,
            },
            tryDigest:
              "d71c81d8928cd56328023a847256737a7304896a7137ffc7591252ac378d3728",
            tryStatements: 1,
          },
          {
            catchBodies: [
              "contentTransientReadFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 6,
            failureHolder:
              "letcontentTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "47a83777417262f768bd8490693f2108992d35099c8854861bc2dd6ef4ba2940",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "a9bf2338133488cb34d16d4b0c0281ea1b335f9391166948cb60199272e4d792",
              tokens: 52,
            },
            index: 5,
            substantive: {
              digest:
                "7a646f7e9a21f6a3ab1b3b4c1e654dd393694c073da2a3b7e89cca16c132690c",
              tokens: 17,
            },
            tryDigest:
              "1214f3302f1c3de24ed247c664053aa63ee2d800a5c1108b478f6c6bdac25d42",
            tryStatements: 1,
          },
          {
            catchBodies: ["contentReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 20,
            failureHolder:
              "letcontentReadFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "5c3890a28cf24d8c0551092440a692030c9d0477d17785a0a2582c05e7bc5c83",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "62c8b7fa36581e5e644506ec93c3025eb7accd7c3700ff4749ac70262920098c",
              tokens: 120,
            },
            index: 12,
            substantive: {
              digest:
                "e7615cbaead604f1abe41ce97cca90fafd9402c21a1e7b9694b2a8ab03e04a64",
              tokens: 8,
            },
            tryDigest:
              "4130445b290e64d81e553d3ea7d1cf5e6577c8dfe38defc5abb88f0d002ce99a",
            tryStatements: 1,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
