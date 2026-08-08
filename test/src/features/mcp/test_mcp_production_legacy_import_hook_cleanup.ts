import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
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

const legacyHookCleanupContract = (text: string): unknown => {
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
  const ownedHookGroup = (node: ts.Block): boolean =>
    [
      "planning write hook",
      "import cleanup rename hook",
      "rollback rmdir hook",
      "incomplete restoration rmdir hook",
      "restoration cleanup rmdir hook",
      "preserved quarantine rmdir hook",
      "revision-after-read open hook",
    ].some((resource) => node.getText(source).includes(resource));
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
      ownedHookGroup(node.finallyBlock) &&
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
        Array.from({ length: 4 }, (_, index) => ({
          resource: `hook-${index}`,
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

export const test_mcp_production_legacy_import_hook_cleanup = (): void => {
  const primaryFailure = { phase: "legacy hook guard" };
  const firstHookFailure = { phase: "first hook restoration" };
  const lastHookFailure = { phase: "last hook restoration" };
  const cleanupFailures = [
    { error: firstHookFailure, present: true as const },
    undefined,
    undefined,
    { error: lastHookFailure, present: true as const },
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2,cleanup-3";
  TestValidator.equals(
    "legacy hook cleanup preserves failure and restoration order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successFailure",
        () => success.caught === false && success.failure === undefined,
      ],
      [
        "successOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder,
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      [
        "primaryOnlyFailurePrimaryFailure",
        () => primaryOnly.failure === primaryFailure,
      ],
      ["primaryOnlyOrderJoin", () => primaryOnly.order.join(",") === fullOrder],
      ["standaloneCaught", () => standalone.caught],
      [
        "standaloneFailureFirstHookFailure",
        () => standalone.failure === firstHookFailure,
      ],
      ["standaloneOrderJoin", () => standalone.order.join(",") === fullOrder],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          aggregateContainsExactly(multiple.failure, [
            firstHookFailure,
            lastHookFailure,
          ]),
      ],
      ["multipleMessageIncludes", () => multiple.message.includes("hook-0")],
      ["multipleMessageIncludes2", () => multiple.message.includes("hook-3")],
      [
        "multipleMessageIncludes3",
        () => multiple.message.includes("hook-1") === false,
      ],
      [
        "multipleMessageIncludes4",
        () => multiple.message.includes("hook-2") === false,
      ],
      ["multipleOrderJoin", () => multiple.order.join(",") === fullOrder],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            firstHookFailure,
            lastHookFailure,
          ]),
      ],
      ["combinedOrderJoin", () => combined.order.join(",") === fullOrder],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrderJoin",
        () => undefinedPrimary.order.join(",") === fullOrder,
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () => undefinedStandalone.order.join(",") === fullOrder,
      ],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedOrderJoin",
        () => undefinedCombined.order.join(",") === fullOrder,
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrderJoin: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyOrderJoin: true,
      standaloneCaught: true,
      standaloneFailureFirstHookFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
      multipleMessageIncludes: true,
      multipleMessageIncludes2: true,
      multipleMessageIncludes3: true,
      multipleMessageIncludes4: true,
      multipleOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrderJoin: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedOrderJoin: true,
    },
  );
  TestValidator.equals(
    "legacy import owns seven multi-hook cleanup lifecycles",
    legacyHookCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["combinedPlanningHookFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 17,
          finallyDigest:
            "79910de95a56489ab3a38c2b8c4572ba9dafc3da6e46c585a70cfccfa2965d6e",
          finallySubstantive: {
            digest:
              "6faca8c8688989a3be5c5b1bac4af88d420c41ace2aeee8c8e2dc966a4dadccb",
            tokens: 50,
          },
          index: 15,
          preceding:
            "letcombinedPlanningHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "5dde71ee5b986834fa7ebbe1d375b86ff1fe9233e1f1b8ee329a1d9ab22df995",
            tokens: 14,
          },
          tryBody: "{combinedCaught=captureFailure(()=>importer.plan());}",
          tryDigest:
            "97e7135aaa63b0c80dd5482bae4610bbd47f520aa7b9bc8821d630ab71ff2944",
        },
        {
          catchBodies: ["importCleanupHookFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 10,
          finallyDigest:
            "72e1f930cc0ab8d2e0ad2249f72e56dceb44a098db1978a8c8d4b7c5b1b22c1e",
          finallySubstantive: {
            digest:
              "00f2c137127591858ca756f94213817f4b8474ac5cfc1385220fa113201fa555",
            tokens: 50,
          },
          index: 8,
          preceding:
            "letimportCleanupHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "8de1884b20c5dec5ff25dae7164fdc93a20d57ac9a458ec58696a9966bb1895a",
            tokens: 21,
          },
          tryBody:
            "{caught=captureFailure(()=>newAutoMovieLegacyImporter(importCleanupFailure.root).apply(),);}",
          tryDigest:
            "a1c3d5c0c07e34fe1028c532105a40b998ac089cf1d2fe6f21346efe2095cdf2",
        },
        {
          catchBodies: ["rollbackHookFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 18,
          finallyDigest:
            "2e01a396bcf50ac81a9a89a8afc43bf26b79ceee18a61ae5839b6d5f08a01a95",
          finallySubstantive: {
            digest:
              "86dd22661243e593c0cb991f4311582642a217d57b1193af603df4632c26721a",
            tokens: 92,
          },
          index: 16,
          preceding:
            "letrollbackHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "35f79c505335c7074fcf8b80bab535b6ac7943b179a18b3fa9c2d0b29c4f5b3a",
            tokens: 50,
          },
          tryBody:
            '{TestValidator.predicate("apartialrollbackfailurerestoresthecompleteappliedstate",throws(()=>importer.rollback(),"statewasrestored")&&fs.existsSync(path.join(rollbackFailure.root,".automovie"))&&importer.apply().status==="unchanged"&&quarantineCleanupDenied,);}',
          tryDigest:
            "8d0d834ea3fe16c11f20efa94a3c67afe14915cffeb6b53ec1f91550956a53f2",
        },
        {
          catchBodies: [
            "incompleteRestorationHookFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 15,
          finallyDigest:
            "13f8fb4d406c0c9eddeb4892b5261860dc5141ec05e02f8887f2cf7af3a820fa",
          finallySubstantive: {
            digest:
              "d9c328d0b79a7784b56ce55594b08f22400a0c76da7514ac7df9a34c1d36976b",
            tokens: 71,
          },
          index: 14,
          preceding:
            "letincompleteRestorationHookFailure:|ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "e1a00307075a32ab7a020c1269bddd4212a0005ae41eb95f46fd4b319497c91d",
            tokens: 22,
          },
          tryBody:
            '{TestValidator.predicate("rollbackreportseveryfailedstateandowned-directoryrestoration",throws(()=>importer.rollback(),"restorationwasincomplete"),);}',
          tryDigest:
            "afe98d526fef1f8cb4e973639b02a2e8fc5b60a09f426cd60d8a6aab00925a4b",
        },
        {
          catchBodies: [
            "restorationCleanupHookFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 22,
          finallyDigest:
            "ef86e0d7d1e4a65bafb75289629498a605bc58b755e07866568a10a74e3d9b72",
          finallySubstantive: {
            digest:
              "da09a57361a5e39020919e648d46028fb8d1cfa366748d6552292f5fb859fc19",
            tokens: 71,
          },
          index: 18,
          preceding:
            "letrestorationCleanupHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "f0d5e18693d578de797e9ec6f46bce76c79bff4d24ed0e6bf6e596b45d9a3e9f",
            tokens: 14,
          },
          tryBody: "{caught=captureFailure(()=>importer.rollback());}",
          tryDigest:
            "650da155e1ebaa3a71e4fbfafed04f2edf33b658df99ed6168ee0de192cc93f7",
        },
        {
          catchBodies: [
            "preservedQuarantineHookFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 12,
          finallyDigest:
            "497adf36d8bd97d754457e27df0c295055ed665400c2721895814c37e354f4b4",
          finallySubstantive: {
            digest:
              "eccb421ad5f8087ccd0eb079ebc648c13c35d4f751eaf003b0aa435d3c6a246c",
            tokens: 50,
          },
          index: 11,
          preceding:
            "letpreservedQuarantineHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "e2a2a296d1bb7bd24b3d281087df6845d6df7cf3801bbe0c9bd59087c58990ec",
            tokens: 22,
          },
          tryBody:
            '{TestValidator.predicate("rollbackreportsanauthoritativequarantinewhenrestorationcannotpublish",throws(()=>importer.rollback(),"remainspreserved"),);}',
          tryDigest:
            "1021afcf73d250d085817f7a2b0cd00b06cbda64f5840e0adc9f4ea2052e7255",
        },
        {
          catchBodies: ["revisionAfterReadHookFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 9,
          finallyDigest:
            "7fb3aa178d89b8349cd63023eb9a6aab45e13d86d2985dcb99a138ecdfc47957",
          finallySubstantive: {
            digest:
              "c75623ccf3bbf7f1587d1f4091fa81486a781fc3c696ded0788655cbff53ea03",
            tokens: 50,
          },
          index: 8,
          preceding:
            "letrevisionAfterReadHookFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "9712a4f503dc16b1ac9582404735b6af3fc953fb06e7b9bcfd04e10308dd90df",
            tokens: 31,
          },
          tryBody:
            '{TestValidator.predicate("arevisionchangedafteritsdescriptorreadcannotblessamixedimportplan",throws(()=>newAutoMovieLegacyImporter(revisionAfterReadRace.root).plan(),"revisionchanged",)&&changedAfterRead,);}',
          tryDigest:
            "4618ec08f7e230baf65e28e1b1ac875d899b59ea402b6ea4284c196d724c1b0f",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewLegacyImportFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Legacy-importfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
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
