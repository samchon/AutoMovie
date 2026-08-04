import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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

const renderReadCleanupContract = (text: string): unknown => {
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
    "crossApiIdentityFailure",
    "descriptorRaceFailure",
    "ancestryRaceFailure",
    "afterReadFailure",
    "deniedOpenFailure",
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
      Array.from({ length: props.resources ?? 4 }, (_, index) => ({
        resource: `render-read-${index}`,
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

const capturePartialSwapCleanup = (props: {
  active: boolean;
  parked: boolean;
  primaryFailure: unknown;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup({ error: props.primaryFailure }, [
      {
        resource: "partial-swap hook",
        cleanup: () => order.push("hook"),
      },
      ...(props.parked
        ? [
            {
              resource: "partial-swap active replacement",
              cleanup: (): void => {
                order.push("active-check");
                if (props.active) order.push("active-remove");
              },
            },
            {
              resource: "partial-swap parked file",
              cleanup: () => order.push("parked-restore"),
            },
          ]
        : []),
      {
        resource: "partial-swap directory",
        cleanup: () => order.push("directory"),
      },
    ]);
    throw props.primaryFailure;
  } catch (error) {
    failure = error;
  }
  return { failure, order };
};

export const test_mcp_production_project_render_read_cleanup = (): void => {
  const primaryFailure = { phase: "render-read assertion" };
  const hookFailure = { phase: "render-read hook restoration" };
  const activeFailure = { phase: "render-read active replacement" };
  const parkedFailure = { phase: "render-read parked resident" };
  const directoryFailure = { phase: "render-read directory" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: hookFailure, present: true }],
  });
  const multiple = captureCleanup({
    cleanupFailures: [
      { error: hookFailure, present: true },
      { error: activeFailure, present: true },
      { error: parkedFailure, present: true },
      { error: directoryFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: hookFailure, present: true },
      { error: activeFailure, present: true },
      { error: parkedFailure, present: true },
      { error: directoryFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const noSwap = capturePartialSwapCleanup({
    active: true,
    parked: false,
    primaryFailure,
  });
  const parkedWithoutActive = capturePartialSwapCleanup({
    active: false,
    parked: true,
    primaryFailure,
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "render-read cleanup preserves failure and recovery order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      ["successFailure", () => success.failure === undefined],
      [
        "successOrder",
        () =>
          success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      [
        "primaryOnlyOrder",
        () =>
          primaryOnly.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["standaloneCaught", () => standalone.caught],
      ["standaloneFailure", () => standalone.failure === hookFailure],
      [
        "standaloneOrder",
        () =>
          standalone.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultiple",
        () =>
          aggregateContainsExactly(multiple.failure, [
            hookFailure,
            activeFailure,
            parkedFailure,
            directoryFailure,
          ]),
      ],
      [
        "multipleOrder",
        () =>
          multiple.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            hookFailure,
            activeFailure,
            parkedFailure,
            directoryFailure,
          ]),
      ],
      [
        "combinedOrder",
        () =>
          combined.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["partialSetupCaught", () => partialSetup.caught],
      ["partialSetupFailure", () => partialSetup.failure === primaryFailure],
      ["partialSetupOrder", () => partialSetup.order.join(",") === "cleanup-0"],
      ["noSwapFailure", () => noSwap.failure === primaryFailure],
      ["noSwapOrder", () => noSwap.order.join(",") === "hook,directory"],
      [
        "parkedWithoutActiveFailure",
        () => parkedWithoutActive.failure === primaryFailure,
      ],
      [
        "parkedWithoutActiveOrder",
        () =>
          parkedWithoutActive.order.join(",") ===
          "hook,active-check,parked-restore,directory",
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrder",
        () =>
          undefinedStandalone.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombined",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedOrder",
        () =>
          undefinedCombined.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrder: true,
      primaryOnlyCaught: true,
      primaryOnlyFailure: true,
      primaryOnlyOrder: true,
      standaloneCaught: true,
      standaloneFailure: true,
      standaloneOrder: true,
      multipleCaught: true,
      aggregateContainsExactlyMultiple: true,
      multipleOrder: true,
      combinedCaught: true,
      aggregateContainsExactlyCombined: true,
      combinedOrder: true,
      partialSetupCaught: true,
      partialSetupFailure: true,
      partialSetupOrder: true,
      noSwapFailure: true,
      noSwapOrder: true,
      parkedWithoutActiveFailure: true,
      parkedWithoutActiveOrder: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrder: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombined: true,
      undefinedCombinedOrder: true,
    },
  );
  TestValidator.equals(
    "production-project test owns five render-read cleanup lifecycles",
    renderReadCleanupContract(
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
            catchBodies: ["crossApiIdentityFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 53,
            failureHolder:
              "letcrossApiIdentityFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "fa9410ef860f83ff4209f724f6df89e6840416a23204912fce02ec2b58d0bbf9",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "fb54996b314ee20523bd16e9d896f7a6c71d953e52d2bea648b3ad1b6ee65cc4",
              tokens: 48,
            },
            index: 21,
            substantive: {
              digest:
                "fa453b50850e30cec338bfebe67a00f32802891cae04cace9accba8a43747779",
              tokens: 33,
            },
            tryDigest:
              "cf38a97978a60b57546a679df8c60d18022eae5b631e5d217bd0281ef2385565",
            tryStatements: 2,
          },
          {
            catchBodies: ["descriptorRaceFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 12,
            failureHolder:
              "letdescriptorRaceFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "3c44350dd392a1dfe3208b9fceb1acae5409a1249034dd11a12331ceca420352",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "c1d6b9c2761d9dd666433817cc62996ccecbe4cf22685a30285124e449280c1c",
              tokens: 172,
            },
            index: 10,
            substantive: {
              digest:
                "6bd96bd5181431bbc16c4be8519514aa980ffce5abf7db267797f70533ab97f6",
              tokens: 28,
            },
            tryDigest:
              "1b68bba13fbc38fb7839e443b13633fb36fabe7c5ff11feb7787835da73a3676",
            tryStatements: 1,
          },
          {
            catchBodies: ["ancestryRaceFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 12,
            failureHolder:
              "letancestryRaceFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "261fbbdba3ad90db6e50384795b9bc2e5aea43a9155815aec9d967804e80a849",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "f9d1394ff36c4219dbaea78ea5c7472247eda7c7c60e3ec8d268100a446c7fda",
              tokens: 173,
            },
            index: 10,
            substantive: {
              digest:
                "6bd96bd5181431bbc16c4be8519514aa980ffce5abf7db267797f70533ab97f6",
              tokens: 28,
            },
            tryDigest:
              "1b68bba13fbc38fb7839e443b13633fb36fabe7c5ff11feb7787835da73a3676",
            tryStatements: 1,
          },
          {
            catchBodies: ["afterReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 53,
            failureHolder:
              "letafterReadFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "0e601e3cbf55079dbf2f185d05de3ddf14b7d25e05d2d2d92ff13fcccf0900ec",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "9f499cb33746711aaaafeb515dc5c44688ba1df8913a9001c361c0b887a99bc6",
              tokens: 152,
            },
            index: 44,
            substantive: {
              digest:
                "0f1d22a7c94012eac1153a2416b050ed0a3610762114a5ee3441ebd70257df3c",
              tokens: 16,
            },
            tryDigest:
              "7b99b3142ee3bb5ecf82c3de835bd53b3e12c54c1ae7de0256d6444cc02c6194",
            tryStatements: 1,
          },
          {
            catchBodies: ["deniedOpenFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 53,
            failureHolder:
              "letdeniedOpenFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "5026616bc75ba839022ada212b12616d0942e576efd6bfdd6a32714d2ac70e0c",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "82566c571292e19e48cf14900ef66b3f7159d263eac5e8851ff51fe62c97bf34",
              tokens: 48,
            },
            index: 51,
            substantive: {
              digest:
                "0330906d698f68948a9e5b9ce4a1fb209e37f414fcf5ce43ac56a0331dec5d93",
              tokens: 16,
            },
            tryDigest:
              "01e70871088c155fc8cf5a4fe53dcdac39df0ccd9c10c9024991ab4970979fbb",
            tryStatements: 1,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
