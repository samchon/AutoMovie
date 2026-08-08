import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * Every legacy-import lifecycle whose protected cleanup disposes exactly one
 * fixture.
 *
 * The paired fixture/outside-root lifecycles and the multi-hook lifecycles
 * carry more than one resource, so this selection reaches only the single
 * disposals that used to run as raw calls in `finally`.
 */
export const legacyImportDisposalContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
  }> = [];
  const singleDisposal = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    if (
      statement === undefined ||
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isIdentifier(statement.expression.expression) === false ||
      statement.expression.expression.text !==
        "preserveLegacyImportFixtureCleanup" ||
      statement.expression.arguments.length !== 2
    )
      return false;
    const resources = statement.expression.arguments[1];
    if (
      resources === undefined ||
      ts.isArrayLiteralExpression(resources) === false ||
      resources.elements.length !== 1
    )
      return false;
    return /^\{resource:"[^"]+",cleanup:\(\)=>[A-Za-z_$][\w$]*\.dispose\(\),\}$/u.test(
      compact(resources.elements[0]!, source),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      singleDisposal(node.finallyBlock) &&
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
        containerStatements: statements.length,
        finallyBodies: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: statements
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(node.tryBlock, source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const labels = lifecycles.flatMap((lifecycle) =>
    lifecycle.finallyBodies.flatMap((body) => {
      const found = /resource:"([^"]+)"/u.exec(body);
      return found === null ? [] : [found[1]!];
    }),
  );
  return {
    count: lifecycles.length,
    // A label is how a cleanup failure names itself in the aggregate, so two
    // lifecycles sharing one would make the report ambiguous.
    duplicateLabels: labels.filter(
      (label, index) => labels.indexOf(label) !== index,
    ),
    lifecycles,
    // No disposal may be left running as a raw call in `finally`.
    rawDisposals: [
      ...text.matchAll(
        /finally\s*\{\s*([A-Za-z_$][\w$]*)\.dispose\(\);\s*\}/gu,
      ),
    ].map((found) => found[1]!),
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
    preserveLegacyImportFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 1 }, (_, index) => ({
        resource: `resource-${index}`,
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

export const test_mcp_production_legacy_import_disposal_cleanup = (): void => {
  const primaryFailure = { phase: "legacy-import regression" };
  const disposalFailure = { phase: "legacy fixture disposal" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: disposalFailure, present: true }],
  });
  const combined = captureCleanup({
    cleanupFailures: [{ error: disposalFailure, present: true }],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "single legacy-import disposal preserves the guarded failure first",
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
          success.order.join(",") === "cleanup-0",
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0",
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught,
      ],
      [
        "standaloneFailureDisposalFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure,
      ],
      [
        "standaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0",
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            disposalFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            disposalFailure,
          ]) &&
          combined.order.join(",") === "cleanup-0",
      ],
      [
        "undefinedPrimaryCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            disposalFailure,
          ]) &&
          combined.order.join(",") === "cleanup-0" &&
          undefinedPrimary.caught,
      ],
      [
        "undefinedPrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            disposalFailure,
          ]) &&
          combined.order.join(",") === "cleanup-0" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined,
      ],
      [
        "undefinedPrimaryOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "cleanup-0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "cleanup-0" &&
          standalone.caught &&
          standalone.failure === disposalFailure &&
          standalone.order.join(",") === "cleanup-0" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            disposalFailure,
          ]) &&
          combined.order.join(",") === "cleanup-0" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "cleanup-0",
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
      standaloneFailureDisposalFailure: true,
      standaloneOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
    },
  );
  TestValidator.equals(
    "legacy-import regression protects every single fixture disposal",
    legacyImportDisposalContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    CONTRACT,
  );
};

const CONTRACT = {
  count: 34,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["fixtureFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 3,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(fixtureFailure,[{resource:"tamperedrollbackbaselinelegacyfixture",cleanup:()=>fixture.dispose(),},]);',
      ],
      index: 2,
      prefixes: [
        "constfixture=createLegacy();",
        "letfixtureFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "151a5041f6957872ada70a54a367b3e3dbe14196c0890c8694eba99e9716f3fe",
    },
    {
      catchBodies: ["fixtureFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(fixtureFailure,[{resource:"appliedprovenancelegacyfixture",cleanup:()=>fixture.dispose(),},]);',
      ],
      index: 2,
      prefixes: [
        "constfixture=createLegacy();",
        "letfixtureFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "5cbd92c1376ea638fadbc555537f811205bb496fb00e9e7e2b757e72521070d9",
    },
    {
      catchBodies: ["untouchedFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(untouchedFailure,[{resource:"untouchedlegacyfixture",cleanup:()=>untouched.dispose(),},]);',
      ],
      index: 5,
      prefixes: [
        "constuntouched=createLegacy();",
        "letuntouchedFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "c016dd073fca1f3d35ce345d09b398bca1c0e87455d23af89c5abf0f09df58fd",
    },
    {
      catchBodies: ["actorlessFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(actorlessFailure,[{resource:"actorlesslegacyfixture",cleanup:()=>actorless.dispose(),},]);',
      ],
      index: 8,
      prefixes: [
        "constactorless=createLegacy();",
        "letactorlessFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "1e6a353407fed485b03fe9504df5f288f21244a0a600f3974bd354d7188176df",
    },
    {
      catchBodies: ["planningCleanupFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(planningCleanupFailure,[{resource:"planningcleanuplegacyfixture",cleanup:()=>planningCleanup.dispose(),},]);',
      ],
      index: 17,
      prefixes: [
        "constplanningCleanup=createLegacy();",
        "letplanningCleanupFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "f234868b066454d79d6e152f2e2d4896aa861f4776f2e9ed40339b104c6a58ae",
    },
    {
      catchBodies: ["collisionsFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(collisionsFailure,[{resource:"collisionslegacyfixture",cleanup:()=>collisions.dispose(),},]);',
      ],
      index: 20,
      prefixes: [
        "constcollisions=createLegacy();",
        "letcollisionsFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "eb21fea486cd79f9ebc4038955fda5509f154b882721fa252561e33d57daeade",
    },
    {
      catchBodies: ["renameFailureDisposal={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(renameFailureDisposal,[{resource:"renamefailurelegacyfixture",cleanup:()=>renameFailure.dispose(),},]);',
      ],
      index: 23,
      prefixes: [
        "constrenameFailure=createLegacy();",
        "letrenameFailureDisposal:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "a80f113d015561932a729bab018493da4e930a2be06d26bde8dc58a2253f7727",
    },
    {
      catchBodies: ["importCleanupFailureDisposal={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(importCleanupFailureDisposal,[{resource:"importcleanupfailurelegacyfixture",cleanup:()=>importCleanupFailure.dispose(),},]);',
      ],
      index: 26,
      prefixes: [
        "constimportCleanupFailure=createLegacy();",
        "letimportCleanupFailureDisposal:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "4e8efc43405866ba53cecea3cd928eb963108c84ef4cf8cc00956a4b8e0a34e2",
    },
    {
      catchBodies: ["tamperedFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(tamperedFailure,[{resource:"tamperedlegacyfixture",cleanup:()=>tampered.dispose(),},]);',
      ],
      index: 32,
      prefixes: [
        "consttampered=createLegacy();",
        "lettamperedFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "1741d6f46fd49a3b17f0621c8a6eabec60ccf2dd27360f7548c0b23f1d31c9b3",
    },
    {
      catchBodies: ["tamperedStateFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(tamperedStateFailure,[{resource:"tamperedstatelegacyfixture",cleanup:()=>tamperedState.dispose(),},]);',
      ],
      index: 38,
      prefixes: [
        "consttamperedState=createLegacy();",
        "lettamperedStateFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "f9ee1793a23e3471bdbf4f4f0b9de394ebf947e99e82b697d890c2851631480d",
    },
    {
      catchBodies: ["productionWorkFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(productionWorkFailure,[{resource:"productionworklegacyfixture",cleanup:()=>productionWork.dispose(),},]);',
      ],
      index: 41,
      prefixes: [
        "constproductionWork=createLegacy();",
        "letproductionWorkFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "1f9df4c3d79dcf11f8b7cb23c82a9e72ec7ff56f509092254280a5aa81f8e3cf",
    },
    {
      catchBodies: ["preexistingSourceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(preexistingSourceFailure,[{resource:"preexistingsourcelegacyfixture",cleanup:()=>preexistingSource.dispose(),},]);',
      ],
      index: 44,
      prefixes: [
        "constpreexistingSource=createLegacy();",
        "letpreexistingSourceFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "5958713b4859f38b9e6511038e17239876a89c28e606aa77f5a6b4176674765f",
    },
    {
      catchBodies: ["missingPreexistingSourceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(missingPreexistingSourceFailure,[{resource:"missingpreexistingsourcelegacyfixture",cleanup:()=>missingPreexistingSource.dispose(),},]);',
      ],
      index: 47,
      prefixes: [
        "constmissingPreexistingSource=createLegacy();",
        "letmissingPreexistingSourceFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "c1c6571964fac595c2f2428533fcec63288ea7200942f6fa50dedf7aa176b78c",
    },
    {
      catchBodies: ["deniedImportStateFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(deniedImportStateFailure,[{resource:"deniedimportstatelegacyfixture",cleanup:()=>deniedImportState.dispose(),},]);',
      ],
      index: 50,
      prefixes: [
        "constdeniedImportState=createLegacy();",
        "letdeniedImportStateFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "681383da495f3297735679a4b407b0953cbca33f70fa52ee64cda13fecc5bf14",
    },
    {
      catchBodies: ["emptyDirectoryTopologyFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(emptyDirectoryTopologyFailure,[{resource:"emptydirectorytopologylegacyfixture",cleanup:()=>emptyDirectoryTopology.dispose(),},]);',
      ],
      index: 53,
      prefixes: [
        "constemptyDirectoryTopology=createLegacy();",
        "letemptyDirectoryTopologyFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "069d05b8cbf95f0c7b4634b474163178f7f7a57979c8c029e54e86308a8ad8b8",
    },
    {
      catchBodies: [
        "sortedEmptyDirectoryTopologyFailure={error};",
        "throwerror;",
      ],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(sortedEmptyDirectoryTopologyFailure,[{resource:"sortedemptydirectorytopologylegacyfixture",cleanup:()=>sortedEmptyDirectoryTopology.dispose(),},]);',
      ],
      index: 56,
      prefixes: [
        "constsortedEmptyDirectoryTopology=createLegacy();",
        "letsortedEmptyDirectoryTopologyFailure:|ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "052031d1679453862f051684777feb11662a057bd13af2627108337a694bf97d",
    },
    {
      catchBodies: ["rollbackFailureDisposal={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(rollbackFailureDisposal,[{resource:"rollbackfailurelegacyfixture",cleanup:()=>rollbackFailure.dispose(),},]);',
      ],
      index: 59,
      prefixes: [
        "constrollbackFailure=createLegacy();",
        "letrollbackFailureDisposal:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "5cfde0a61f8645d05ef36006881b124cf0b01a3c54ed8fbabe8986910df16e82",
    },
    {
      catchBodies: ["incompleteRestorationFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(incompleteRestorationFailure,[{resource:"incompleterestorationlegacyfixture",cleanup:()=>incompleteRestoration.dispose(),},]);',
      ],
      index: 65,
      prefixes: [
        "constincompleteRestoration=createLegacy();",
        "letincompleteRestorationFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "13a13712d020a74348c8e6bb0d78794aa037515585b9b3f1aaf0d9f1a0582b7f",
    },
    {
      catchBodies: [
        "restorationCleanupFailureDisposal={error};",
        "throwerror;",
      ],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(restorationCleanupFailureDisposal,[{resource:"restorationcleanupfailurelegacyfixture",cleanup:()=>restorationCleanupFailure.dispose(),},]);',
      ],
      index: 68,
      prefixes: [
        "constrestorationCleanupFailure=createLegacy();",
        "letrestorationCleanupFailureDisposal:|ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "f0d86d810b8a8cdc566e5c07f7375c94099bfd7575f4995988bb791b11334502",
    },
    {
      catchBodies: ["preservedQuarantineFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(preservedQuarantineFailure,[{resource:"preservedquarantinelegacyfixture",cleanup:()=>preservedQuarantine.dispose(),},]);',
      ],
      index: 71,
      prefixes: [
        "constpreservedQuarantine=createLegacy();",
        "letpreservedQuarantineFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "9b715bec5e37f72fdd84524ef7aa5740b34b6557ee3e146dd57e46bd17592bd5",
    },
    {
      catchBodies: ["incarnationRaceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(incarnationRaceFailure,[{resource:"incarnationracelegacyfixture",cleanup:()=>incarnationRace.dispose(),},]);',
      ],
      index: 74,
      prefixes: [
        "constincarnationRace=createLegacy();",
        "letincarnationRaceFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "b20e5c89cd3f3a9a848f17fe0bad2e2876eb7413e099fbe18a2a29e0a14fc2fd",
    },
    {
      catchBodies: ["extraStateFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(extraStateFailure,[{resource:"extrastatelegacyfixture",cleanup:()=>extraState.dispose(),},]);',
      ],
      index: 77,
      prefixes: [
        "constextraState=createLegacy();",
        "letextraStateFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "24f8a6de7d1cb2baa796d6ae180bec9319cf6efc23afa2ff6018d969db29739b",
    },
    {
      catchBodies: ["malformedAppliedStateFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(malformedAppliedStateFailure,[{resource:"malformedappliedstatelegacyfixture",cleanup:()=>malformedAppliedState.dispose(),},]);',
      ],
      index: 80,
      prefixes: [
        "constmalformedAppliedState=createLegacy();",
        "letmalformedAppliedStateFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "6f14d478af2bba3441a425b636f89e7592a675a752f29ee8418836e4273a65b0",
    },
    {
      catchBodies: ["activeCommitFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(activeCommitFailure,[{resource:"activecommitlegacyfixture",cleanup:()=>activeCommit.dispose(),},]);',
      ],
      index: 83,
      prefixes: [
        "constactiveCommit=createLegacy();",
        "letactiveCommitFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "e5f68d6c7280f97cd13da0b19807d84345e946bfa5c176d2a0e8bd28a5e44a15",
    },
    {
      catchBodies: ["revisionRaceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(revisionRaceFailure,[{resource:"revisionracelegacyfixture",cleanup:()=>revisionRace.dispose(),},]);',
      ],
      index: 102,
      prefixes: [
        "constrevisionRace=createLegacy();",
        "letrevisionRaceFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "42c4b968ea69bbd88d5a79ecade09eb25a4929bf28a16b772bc15816d919a759",
    },
    {
      catchBodies: ["revisionAfterReadRaceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(revisionAfterReadRaceFailure,[{resource:"revisionafterreadracelegacyfixture",cleanup:()=>revisionAfterReadRace.dispose(),},]);',
      ],
      index: 105,
      prefixes: [
        "constrevisionAfterReadRace=createLegacy();",
        "letrevisionAfterReadRaceFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "c9797afa775dd138da5574edb87f6b42742f33d21b1464693e745a0161e80aa7",
    },
    {
      catchBodies: ["invalidRollbackBaselineFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(invalidRollbackBaselineFailure,[{resource:"invalidrollbackbaselinelegacyfixture",cleanup:()=>invalidRollbackBaseline.dispose(),},]);',
      ],
      index: 108,
      prefixes: [
        "constinvalidRollbackBaseline=createLegacy();",
        "letinvalidRollbackBaselineFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "5712cb4611686f7ebf2c926c028668c707aa1bfad76732322c2a6760fde2743b",
    },
    {
      catchBodies: ["requiredLegacyDirectoryFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(requiredLegacyDirectoryFailure,[{resource:"requiredlegacydirectorylegacyfixture",cleanup:()=>requiredLegacyDirectory.dispose(),},]);',
      ],
      index: 111,
      prefixes: [
        "constrequiredLegacyDirectory=createLegacy();",
        "letrequiredLegacyDirectoryFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "e1ce196081119c37c2b8cec6f33e11fb24fafb53e223eaa2ee628179885851a9",
    },
    {
      catchBodies: ["collidingCaseFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(collidingCaseFailure,[{resource:"collidingcaselegacyfixture",cleanup:()=>collidingCase.dispose(),},]);',
      ],
      index: 114,
      prefixes: [
        "constcollidingCase=createLegacy();",
        "letcollidingCaseFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "46d1f12bc8c8dcd08612b1dd85fd2373a3cbb6f5b907968c835dceb8ad35db3d",
    },
    {
      catchBodies: ["inventoryRootFileFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(inventoryRootFileFailure,[{resource:"inventoryrootfilelegacyfixture",cleanup:()=>inventoryRootFile.dispose(),},]);',
      ],
      index: 117,
      prefixes: [
        "constinventoryRootFile=createLegacy();",
        "letinventoryRootFileFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "d82037ed1b1db826b3a979ff1b99a8203283c653a19c3e931b059b68584f289f",
    },
    {
      catchBodies: ["specialInventoryEntryFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(specialInventoryEntryFailure,[{resource:"specialinventoryentrylegacyfixture",cleanup:()=>specialInventoryEntry.dispose(),},]);',
      ],
      index: 120,
      prefixes: [
        "constspecialInventoryEntry=createLegacy();",
        "letspecialInventoryEntryFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "696df6a5a95ee17d73f35bbd109137f8af8905111ad15390c4012116ce7ae169",
    },
    {
      catchBodies: ["mismatchedRollbackLockFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(mismatchedRollbackLockFailure,[{resource:"mismatchedrollbacklocklegacyfixture",cleanup:()=>mismatchedRollbackLock.dispose(),},]);',
      ],
      index: 128,
      prefixes: [
        "constmismatchedRollbackLock=createLegacy();",
        "letmismatchedRollbackLockFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "6a88816a6a9787e6e9389f2d01d82c4844998122a2c016e267c19d86e5adff89",
    },
    {
      catchBodies: ["directoryImportPlanFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(directoryImportPlanFailure,[{resource:"directoryimportplanlegacyfixture",cleanup:()=>directoryImportPlan.dispose(),},]);',
      ],
      index: 135,
      prefixes: [
        "constdirectoryImportPlan=createLegacy();",
        "letdirectoryImportPlanFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "04931ede47f188da27a5b6c064d41690b24d0e70ce774809f45279acab6d5461",
    },
    {
      catchBodies: ["specialAppliedStateFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(specialAppliedStateFailure,[{resource:"specialappliedstatelegacyfixture",cleanup:()=>specialAppliedState.dispose(),},]);',
      ],
      index: 138,
      prefixes: [
        "constspecialAppliedState=createLegacy();",
        "letspecialAppliedStateFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "e0e86ba83f0209b0b85c8c5506b171bd4f540b8fad6743070be7357f6a2d1831",
    },
  ],
  rawDisposals: [],
};
