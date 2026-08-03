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
  TestValidator.predicate(
    "legacy root-swap cleanup preserves failure and resource order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === firstCleanupFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        firstCleanupFailure,
        lastCleanupFailure,
      ]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-2") &&
      multiple.message.includes("resource-1") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        firstCleanupFailure,
        lastCleanupFailure,
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
              "c618c9b581abef3ffdb78b26655cf5cd4938be49ab48fed79fcc3e02f453d2f2",
            tokens: 275,
          },
          tryDigest:
            "2f3e6829c2a44e8ecffa60542d6dfbecb74dd201e66cdaa66df5aaec71f342cb",
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
              "ecf3f0a8aae72f6e4022be2f3ddd82863e23afd41fc1e4ed28807e504ffad578",
            tokens: 44,
          },
          tryDigest:
            "06751c14ce651d3920d7701738856fef3f7d8d2bd055e9111ab8a642d51e1734",
          tryPrefixes: [
            'TestValidator.predicate("arootreplacedimmediatelyafterimportpublicationreceivesnostalecleanup",throws(()=>newAutoMovieLegacyImporter(publishRootSwap.root).apply(),"rootidentity",)&&swapped&&fs.readdirSync(publishRootSwap.root).length===0,);',
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
              "8143575c4ec471e49b38cd11eb8b0d8132e588cf349305e1b7275898b0ae3d8a",
            tokens: 279,
          },
          tryDigest:
            "1e77bc50975cfcf129e38cc43b2472e9a6db8517a2e58973dc3fa1df7b40afe2",
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
              "a50a9c811c741630d15adceaa72df94022765a1245d38e00386adb0778176133",
            tokens: 37,
          },
          tryDigest:
            "cf359750f80222b6be0eb74ce8f8171ccb9da99c39dec7ea870b7d5abb8f1683",
          tryPrefixes: [
            'TestValidator.predicate("rollbackabandonsrestorationwhenthephysicalrootchanges",throws(()=>importer.rollback(),"changedphysicalidentity")&&swapped&&fs.readdirSync(rollbackRootSwap.root).length===0,);',
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
              "1668b9bcf7ea8599fb290a932ac48778692ff1c0fe883e13b65809f5c67418d3",
            tokens: 366,
          },
          tryDigest:
            "2ea908af2601ed4b0a202fe56768987959e227a135bbfe668af63c7b8b683f9a",
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
              "a086f2aee757381a8418698a43de0d2ef7b7d9bc2c544a8c0445017ce7de1419",
            tokens: 69,
          },
          tryDigest:
            "1a624c6219a965350ff55adf271f6df96a56972c6315b9768845c72bad126723",
          tryPrefixes: [
            'TestValidator.predicate("rootreplacementafternamespaceacquisitionisdetectedbeforeimport",throws(()=>newAutoMovieLegacyImporter(replacedDuringAcquire.root).apply(),//Whicheverfencecatchesit,therefusalnamestherootidentity.//Theclaimisthattheswapiscaughtbeforeanyimportwrites,and//theabsentresidentlockbelowiswhatprovesthat."rootidentity",)&&fs.existsSync(path.join(replacementTarget,"revision.lock"))===false&&namespaceLocks.length===2&&namespaceLocks.every((file)=>fs.existsSync(file)===false),);',
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
