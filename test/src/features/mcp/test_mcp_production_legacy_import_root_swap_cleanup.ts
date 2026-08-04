import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

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

const legacyRootSwapCleanupContract = (text: string): unknown => {
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
    tryDigest: string;
    tryPrefixes: string[];
  }> = [];
  const ownedRootSwap = (node: ts.Block): boolean =>
    [
      "publish root-swap rename hook",
      "publish root-swap legacy fixture",
      "rollback root-swap rmdir hook",
      "rollback root-swap legacy fixture",
      "acquire root-swap write hook",
      "acquire root-swap legacy fixture",
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
      ownedRootSwap(node.finallyBlock) &&
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
        tryDigest: digestText(node.tryBlock.getText(source)),
        tryPrefixes: [...node.tryBlock.statements]
          .slice(0, 2)
          .map((statement) => compact(statement, source)),
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
        Array.from({ length: 3 }, (_, index) => ({
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

export const test_mcp_production_legacy_import_root_swap_cleanup = (): void => {
  const primaryFailure = { phase: "legacy root-swap guard" };
  const firstCleanupFailure = { phase: "first root-swap cleanup" };
  const lastCleanupFailure = { phase: "last root-swap cleanup" };
  const cleanupFailures = [
    { error: firstCleanupFailure, present: true as const },
    undefined,
    { error: lastCleanupFailure, present: true as const },
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
  TestValidator.equals(
    "legacy root-swap cleanup preserves failure and resource order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      ["successFailure", () => success.failure === undefined],
      ["successOrder", () => success.order.join(",") === fullOrder],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      ["primaryOnlyOrder", () => primaryOnly.order.join(",") === fullOrder],
      ["standaloneCaught", () => standalone.caught],
      ["standaloneFailure", () => standalone.failure === firstCleanupFailure],
      ["standaloneOrder", () => standalone.order.join(",") === fullOrder],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultiple",
        () =>
          aggregateContainsExactly(multiple.failure, [
            firstCleanupFailure,
            lastCleanupFailure,
          ]),
      ],
      ["multipleMessage", () => multiple.message.includes("resource-0")],
      ["multipleMessage2", () => multiple.message.includes("resource-2")],
      [
        "multipleMessage3",
        () => multiple.message.includes("resource-1") === false,
      ],
      ["multipleOrder", () => multiple.order.join(",") === fullOrder],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            firstCleanupFailure,
            lastCleanupFailure,
          ]),
      ],
      ["combinedOrder", () => combined.order.join(",") === fullOrder],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrder",
        () => undefinedPrimary.order.join(",") === fullOrder,
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrder",
        () => undefinedStandalone.order.join(",") === fullOrder,
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
        () => undefinedCombined.order.join(",") === fullOrder,
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
      multipleMessage: true,
      multipleMessage2: true,
      multipleMessage3: true,
      multipleOrder: true,
      combinedCaught: true,
      aggregateContainsExactlyCombined: true,
      combinedOrder: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrder: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrder: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombined: true,
      undefinedCombinedOrder: true,
    },
  );
  TestValidator.equals(
    "legacy import owns six root-swap cleanup lifecycles",
    legacyRootSwapCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["publishRootSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "Block",
          containerStatements: 2,
          finallyDigest:
            "8509aa31f4f2264ebef890afef2b1ba96d3a125f9981ae102e46fca90fbe590c",
          finallySubstantive: {
            digest:
              "3bbc76a870383c894cbdae8fb58f482638bfabca94369101b5410dbea855f5c1",
            tokens: 68,
          },
          index: 1,
          preceding:
            "letpublishRootSwapFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "f4ffa88055d72e586769219a75201954c3458a4cb9c2a517102c682c011292d6",
            tokens: 319,
          },
          tryDigest:
            "7408521bffe416dfe1309a82f74a4f8032bc1fa4f3c6bc4afd2714beaa75baf4",
          tryPrefixes: [
            'conststateRoot=path.join(publishRootSwap.root,".automovie");',
            "constnativeRename=fs.renameSync;",
          ],
        },
        {
          catchBodies: [
            "publishRootSwapRecoveryFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 6,
          finallyDigest:
            "6e52b60e0c8bd01b793e014c684f8271897115bf98cb806dd23ee2999c973364",
          finallySubstantive: {
            digest:
              "c767fc539fe70eb602070552ff41e8721f585bb0275ddfed24acffc8858fea41",
            tokens: 96,
          },
          index: 5,
          preceding:
            "letpublishRootSwapRecoveryFailure:|ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "6c44339e29798720c47c4f1cf3172f92c39c40d43b4f461882a0533c3b219ebb",
            tokens: 88,
          },
          tryDigest:
            "cb36a12184924e2707446855e68880b38e50644e19f51297ab495e6ad9283d53",
          tryPrefixes: [
            'TestValidator.equals("arootreplacedimmediatelyafterimportpublicationreceivesnostalecleanup",namedFacts([["rejected",()=>throws(()=>newAutoMovieLegacyImporter(publishRootSwap.root).apply(),"rootidentity",),],["swapped",()=>swapped],["publishRootSwapCount",()=>fs.readdirSync(publishRootSwap.root).length===0,],]),{rejected:true,swapped:true,publishRootSwapCount:true,},);',
          ],
        },
        {
          catchBodies: ["rollbackRootSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "Block",
          containerStatements: 2,
          finallyDigest:
            "cbcf69548569058a2c4a29b7f3e9116b2bb9e03e7b258e47d8eccd42dad552cd",
          finallySubstantive: {
            digest:
              "dc1aabc95c2adc089fbec85c3e869603648ea840f8c7c9424a5ab76e606f33df",
            tokens: 68,
          },
          index: 1,
          preceding:
            "letrollbackRootSwapFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "3057e4cdf6632e6cfcf2853c642b7a0d55f6dbb6b40aac0dc1c4d9d50e6c3f3e",
            tokens: 323,
          },
          tryDigest:
            "2c532133847e3685208196192595a89533abf57844253fe28860ffcf19e12502",
          tryPrefixes: [
            "constimporter=newAutoMovieLegacyImporter(rollbackRootSwap.root);",
            "constplan=importer.plan();",
          ],
        },
        {
          catchBodies: [
            "rollbackRootSwapRecoveryFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 9,
          finallyDigest:
            "12c037b9646c4c3ee293cc71bf693307716393dda652f90a15fd842a6992e671",
          finallySubstantive: {
            digest:
              "a1f3c46618bbb189a2e1391be7fadb6b3e08637db33474135eef1ecd04a62ab1",
            tokens: 98,
          },
          index: 8,
          preceding:
            "letrollbackRootSwapRecoveryFailure:|ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "3c747c51bec843ea359f466206d4f8bb9527652ef47c191d2a44285d62413acf",
            tokens: 81,
          },
          tryDigest:
            "e54dd59ddc2048307ddd0a4ab21071e8541622f1a26c5a864c1ac3fff1f90404",
          tryPrefixes: [
            'TestValidator.equals("rollbackabandonsrestorationwhenthephysicalrootchanges",namedFacts([["rejected",()=>throws(()=>importer.rollback(),"changedphysicalidentity"),],["swapped",()=>swapped],["rollbackRootSwapCount",()=>fs.readdirSync(rollbackRootSwap.root).length===0,],]),{rejected:true,swapped:true,rollbackRootSwapCount:true,},);',
          ],
        },
        {
          catchBodies: ["acquireRootSwapFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "Block",
          containerStatements: 2,
          finallyDigest:
            "118c8267d25153816c921f996016a3c54726a2aa53053d302bea04069c759bf3",
          finallySubstantive: {
            digest:
              "0eae6b262648bd7f51bc9cb2949f5c8d82aed99a4d5cf54ea0fdc893ea7cbbd1",
            tokens: 96,
          },
          index: 1,
          preceding:
            "letacquireRootSwapFailure:ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "39578c6e95813f97d611557181920c5bf4289bb42ed3fa1388de0fd450b584d8",
            tokens: 423,
          },
          tryDigest:
            "c2a1e6426d4e828304f6b5290f30003c191507f8663b0e13ad6758057300bb3c",
          tryPrefixes: [
            "constnamespaceLocks:string[]=[];",
            "constnativeWrite=fs.writeFileSync;",
          ],
        },
        {
          catchBodies: [
            "acquireRootSwapRecoveryFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 6,
          finallyDigest:
            "a1e6176199d4f7272de1bad228e08db25cb2255a23451bbde8bc66adbe47b507",
          finallySubstantive: {
            digest:
              "865a4b5d8cc535ab23d4796107918d7df15fbe188ce52bb821a87e33d0fd70ac",
            tokens: 103,
          },
          index: 5,
          preceding:
            "letacquireRootSwapRecoveryFailure:|ILegacyImportFixtureFailure|undefined;",
          substantive: {
            digest:
              "5d02e59d9674cfc9323cd93fa1c5cc56dae8863aa1abc6610347dffb2e3b679d",
            tokens: 126,
          },
          tryDigest:
            "7e77769db9d55a3a9e801411b1a3d01b66f1bbd6cc912f5ba00b6d37e9c83cb7",
          tryPrefixes: [
            'TestValidator.equals("rootreplacementafternamespaceacquisitionisdetectedbeforeimport",namedFacts([["rejected",()=>throws(()=>newAutoMovieLegacyImporter(replacedDuringAcquire.root,).apply(),//Whicheverfencecatchesit,therefusalnamestherootidentity.//Theclaimisthattheswapiscaughtbeforeanyimportwrites,and//theabsentresidentlockbelowiswhatprovesthat."rootidentity",),],["replacementTargetResident",()=>fs.existsSync(path.join(replacementTarget,"revision.lock"))===false,],["namespaceLocksCount",()=>namespaceLocks.length===2],["namespaceLocksFile",()=>namespaceLocks.every((file)=>fs.existsSync(file)===false),],]),{rejected:true,replacementTargetResident:true,namespaceLocksCount:true,namespaceLocksFile:true,},);',
          ],
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
