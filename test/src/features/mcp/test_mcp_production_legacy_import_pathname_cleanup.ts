import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

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

const legacyPathnameCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows: Array<{ arrow: ts.ArrowFunction; name: string }> = [];
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
  const ownedResource = (node: ts.Block): boolean => {
    const body = node.getText(source);
    return ["plan-read", "plan read hook", "legacy-lock", "applied-plan"].some(
      (resource) => body.includes(resource),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      arrows.push({ arrow: node.initializer, name: node.name.text });
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, source).includes(
        "preserveLegacyImportFixtureCleanup(",
      ) &&
      ownedResource(node.finallyBlock) &&
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
  const policies = arrows.filter(
    (entry) => entry.name === "preserveLegacyImportFixtureCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "LegacyImportFixtureCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      count: policies.length,
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; message: string; order: string[] } => {
  let caught = false;
  let failure: unknown;
  let message = "";
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 5 }, (_, index) => ({
          resource: `resource-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
    if (error instanceof Error) message = error.message;
  }
  return { caught, failure, message, order };
};

export const test_mcp_production_legacy_import_pathname_cleanup = (): void => {
  const primaryFailure = { phase: "legacy pathname guard" };
  const hookFailure = { phase: "legacy hook restoration" };
  const residentFailure = { phase: "legacy resident restoration" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    undefined,
    undefined,
    undefined,
    { error: residentFailure, present: true as const },
  ];
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
  });
  const multiple = captureCleanup({ cleanupFailures });
  const combined = captureCleanup({
    cleanupFailures,
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2,cleanup-3,cleanup-4";
  TestValidator.predicate(
    "legacy pathname cleanup preserves failure and resource order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === hookFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        hookFailure,
        residentFailure,
      ]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-4") &&
      multiple.message.includes("resource-1") === false &&
      multiple.message.includes("resource-2") === false &&
      multiple.message.includes("resource-3") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        residentFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.order.join(",") === fullOrder &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === fullOrder &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === fullOrder,
  );
  TestValidator.equals(
    "legacy import owns six pathname-swap cleanup lifecycles",
    legacyPathnameCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["planReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 5,
          finallyDigest:
            "7cda45fd80dac27af6f81dd7116bbd01c831cb881aa84b8ab1aa3f3fc674e012",
          finallySubstantive: {
            digest:
              "5933651165be827dc2922c101e269d0100f919b8454c2dfc4892c557b322b1c8",
            tokens: 54,
          },
          index: 4,
          preceding:
            "letplanReadFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "23e454e089113f598a98eea55483248f3e204e1e25039dec7906d1e45fb5512b",
            tokens: 17,
          },
          tryBody: "{returnReflect.apply(nativePlanRead,fs,[file,...args]);}",
          tryDigest:
            "9a6699e31ec17bebc9c91bc612c369545b8af3acf2ed5629ea9ef92f63a6f28a",
        },
        {
          catchBodies: ["planFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 34,
          finallyDigest:
            "d30c79dab7416b3aac0ac6d224dacb66392e90ac01caab9ebf72678b39b10e93",
          finallySubstantive: {
            digest:
              "78b8eb70d849c218490dece9fe2a7de4c22c10280133c0124f7dc5a4a844b64a",
            tokens: 160,
          },
          index: 15,
          preceding: "letplanFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "6aba856a5159c027206cb689acea87d45f69d781236a0bd4bc3783790217e856",
            tokens: 8,
          },
          tryBody: "{plan=importer.plan();}",
          tryDigest:
            "4c22bb10db0f323363a3d0a0e9d4d4129418900b24197073a3364cff71b8b5a1",
        },
        {
          catchBodies: ["legacyLockReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 5,
          finallyDigest:
            "51334b0afc262e22d11663e8c8f8b0f054a814b65426239f4a2d9cf442c6e37e",
          finallySubstantive: {
            digest:
              "99d27281482e099af28816548d3cbe688339222396fec6355e983ba2e8e3737f",
            tokens: 48,
          },
          index: 4,
          preceding:
            "letlegacyLockReadFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "466ae7768a3a47dc7789d41370818f458c0f0f47945d151768fce6bced619253",
            tokens: 17,
          },
          tryBody:
            "{returnReflect.apply(nativeLegacyLockRead,fs,[file,...args]);}",
          tryDigest:
            "79ce1405cbef7bb42743c97335b50e90173773d1fbf36f0d038e87f1f58bbde4",
        },
        {
          catchBodies: ["legacyApplyFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 2,
          finallyDigest:
            "f167d65fb90831b76e39ab967f1217c6ee85d06d0a6148696316167da940f967",
          finallySubstantive: {
            digest:
              "7d86a61ad405a829ea83a30d3d5e60a336fabe2198d806147faf8f90dd640993",
            tokens: 99,
          },
          index: 1,
          preceding:
            "letlegacyApplyFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "e8537d80ba98ea25be5a29c751e414e9532372a6f3225964d18ab30f26ab0970",
            tokens: 7,
          },
          tryBody: "{returnimporter.apply();}",
          tryDigest:
            "7b77183fafb1abe71c6e2e69cbd3d63bc81f2d21a310c307ec84f01e361e9861",
        },
        {
          catchBodies: ["appliedPlanReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 5,
          finallyDigest:
            "2f863e07e6da13285d920149474fb276619760fcd0c8193ab08c107d52bd4444",
          finallySubstantive: {
            digest:
              "c9e41e1f34c2ef68975ed358db3c12bee3c0315cd7107dd861d5caba270c8744",
            tokens: 48,
          },
          index: 4,
          preceding:
            "letappliedPlanReadFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "23b83871bd7f4e125b8fbda4d866fe511fba8f1f6f6694d9a7d3cc70a1cf986b",
            tokens: 17,
          },
          tryBody:
            "{returnReflect.apply(nativeAppliedPlanRead,fs,[file,...args]);}",
          tryDigest:
            "db0df5999c18af23e42db51d6c19a21b75564e6bc0cc706606992394a9babaf6",
        },
        {
          catchBodies: ["repeatedRejected=true;"],
          catchVariables: [],
          containerKind: "TryStatement",
          containerStatements: 34,
          finallyDigest:
            "7aa049d04acff5609cc5284ce98d307825b17a2185cf017a4159821c81ec06ed",
          finallySubstantive: {
            digest:
              "cff77eb1e59c0779ac1b5aa2a23a33f75dc5a65a95cd9530a5ce7fb6c812e31d",
            tokens: 99,
          },
          index: 31,
          preceding: "letrepeatedRejected=false;",
          substantive: {
            digest:
              "5bf5aaf60d31334fb06da148a3e91ce59eeffbf883e748051009ac5630d9c4f9",
            tokens: 8,
          },
          tryBody: "{repeated=importer.apply();}",
          tryDigest:
            "37a3c49b472866974023d37c54d72e29a82aad88473b9c5edbd999017fb5a0de",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewLegacyImportFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Legacy-importfixturecleanupfailed\${failure===undefined?"":"afterthetestfailed"}:\${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:ILegacyImportFixtureFailure|undefined",
            "resources:readonlyILegacyImportFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
