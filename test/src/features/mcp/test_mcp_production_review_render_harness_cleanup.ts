import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionReviewRenderHarnessCleanup } from "./test_mcp_production_review_render_edges";

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

const reviewRenderHarnessCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_review_render_edges.ts",
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
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
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
        "preserveProductionReviewRenderHarnessCleanup(",
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
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionReviewRenderHarnessCleanup",
  );
  const inventories = arrows.filter(
    (entry) => entry.name === "inventoryRaceCleanup",
  );
  return {
    inventory: {
      bodies: inventories.map((entry) => compact(entry.arrow.body, source)),
      count: inventories.length,
      parameters: inventories.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionReviewRenderHarnessCleanupError"
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
      preserveProductionReviewRenderHarnessCleanup(
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

export const test_mcp_production_review_render_harness_cleanup = (): void => {
  const primaryFailure = { phase: "review-render harness guard" };
  const hookFailure = { phase: "hook restoration" };
  const physicalFailure = { phase: "physical cleanup" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    undefined,
    undefined,
    undefined,
    { error: physicalFailure, present: true as const },
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
    "review-render harness cleanup preserves failure and resource order",
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
        physicalFailure,
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
        physicalFailure,
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
    "production review-render owns five harness cleanup lifecycles",
    reviewRenderHarnessCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_review_render_edges.ts"),
        "utf8",
      ),
    ),
    {
      inventory: {
        bodies: [
          '[{resource:"inventoryactiveroot",cleanup:()=>fs.rmSync(race.directory,{recursive:true,force:true}),},{resource:"inventoryparkedroot",cleanup:()=>fs.rmSync(race.parked,{recursive:true,force:true}),},{resource:"inventoryexternalroot",cleanup:()=>fs.rmSync(race.external,{recursive:true,force:true}),},]',
        ],
        count: 1,
        parameters: [
          ["race:{directory:string;parked:string;external:string;}"],
        ],
      },
      lifecycles: [
        {
          catchBodies: ["postVerificationFailureState={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 170,
          failureHolder:
            "letpostVerificationFailureState:|IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "75e81c82871453b5067c28fbddbed02f3ec05d1d8202791f84beaedb4d8e6dd0",
          finallySubstantive: {
            digest:
              "94d18f60f4bce1d56d56f16e5db8842d457ebf1651ed7c89b2247c6a760fcb3f",
            tokens: 61,
          },
          index: 125,
          substantive: {
            digest:
              "ac5fa1b660b2af91b237e7c90302bef9d4259e2bec09f3bc40b2cc28b1ea131c",
            tokens: 93,
          },
          tryBody:
            '{TestValidator.predicate("post-verificationbytechangesremainactionable",review.prepare({target}).diagnostics.some((item)=>item.code==="render-frame-invalid"&&item.message.includes("framebyteschangedafterrendererownershipverification",),),);ownershipVerified=false;postVerificationFailure="non-error";TestValidator.predicate("post-verificationnon-Errorframefailuresremainactionable",review.prepare({target}).diagnostics.some((item)=>item.code==="render-frame-invalid"&&item.message.includes("non-errorframeread"),),);}',
          tryDigest:
            "f5800373ed22193dfe7573ae5e6e8fdaaf212ad8cdafac6953582f85f9ace015",
        },
        {
          catchBodies: ["escapedFrameFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 170,
          failureHolder:
            "letescapedFrameFailure:|IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "70d3c5095311e034b639850466e22129412c6b07321c03423f20e59eab8e4075",
          finallySubstantive: {
            digest:
              "617f08f0632f85980161edb06b001c0ac8bbb4cb1044624a2fec940131f6a15b",
            tokens: 72,
          },
          index: 134,
          substantive: {
            digest:
              "ccb4ad1447a3f5771c89b019f7cb1a1a1b06b94b38f767a0d0fab84fab852e73",
            tokens: 97,
          },
          tryBody:
            '{TestValidator.equals("verifiedframepathscannotescapetheircontent-addressedbundle",[[path.resolve(outsideRacedFrame),"mustbebundle-relative"],["../outside.png","escapesitsbundle"],["linked.png","frameescapesitsbundlethroughasymlink"],].map(([framePath,message])=>{injectedFramePath=framePath!;returnreview.prepare({target}).diagnostics.some((item)=>item.code==="render-frame-invalid"&&item.message.includes(message!),);}),[true,true,true],);}',
          tryDigest:
            "16066e0260a44ba6d84223acd9c6e06cfe18a78a067525fc5777602747b72b53",
        },
        {
          catchBodies: ["disappearingManifestFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 170,
          failureHolder:
            "letdisappearingManifestFailure:|IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "25231ca3548437117c62fe095242dae359517d4a694b8a8c435db5f7a5a8b151",
          finallySubstantive: {
            digest:
              "339ca243137c88bf53a20443bbedd1e53cc27f6b8f96b8f217994204e6933f74",
            tokens: 35,
          },
          index: 144,
          substantive: {
            digest:
              "c76c304fc1a701723f2c80643b31bf6c8e4b46f0b0506027c8b0ff2bf975f34b",
            tokens: 32,
          },
          tryBody:
            '{TestValidator.predicate("adisappearingmanifestisinvalidratherthanabsent",review.prepare({target}).diagnostics.some((item)=>item.code==="render-bundle-invalid"),);}',
          tryDigest:
            "069dcb1909826b0df9c9cb92adcbd9e100c789dc9a77f219f62b84262606a799",
        },
        {
          catchBodies: ["postReadRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 8,
          failureHolder:
            "letpostReadRaceFailure:|IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "072c5be7899ec83551f2e4801539f2d1b4dd343c000d27d5f9ae366f5919c76a",
          finallySubstantive: {
            digest:
              "3f915f5c7381b2480a6a4f60deeca8313d1282bbaa9feba185bab048d1732140",
            tokens: 40,
          },
          index: 6,
          substantive: {
            digest:
              "8847b6af73db7e446b26302a142ec881db85389a201bdbab4943e02c4aec39f3",
            tokens: 33,
          },
          tryBody:
            '{try{review.prepare({target});}catch(error){rejected=errorinstanceofError&&error.message.includes("Renderinventorydirectory");}}',
          tryDigest:
            "5b81936a21cacb3bcbea3e36bb3cff6a1b6b88ff655dc76747a196d8d4ccb528",
        },
        {
          catchBodies: ["lstatRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 9,
          failureHolder:
            "letlstatRaceFailure:IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "56c44f232ac08b01a00a929f9870691f3d881eb17688b10cc0c6787f14a1b015",
          finallySubstantive: {
            digest:
              "27a6788b288a0e395dd76b733c8ca838e224fb0b83236553954b140298ff450b",
            tokens: 40,
          },
          index: 7,
          substantive: {
            digest:
              "ab58b6bcc74e7c6a9278546ff51b6bafd9db61206cb698ec88d48fd5659a5190",
            tokens: 33,
          },
          tryBody:
            "{try{review.prepare({target});}catch(error){rejected=errorinstanceofError&&error.message.includes(fragment);}}",
          tryDigest:
            "72e3f6640fe40cbb1d00d98d6c9846bc127adafaa757fc1861702c2d8ae5a043",
        },
        {
          catchBodies: ["lateBundleFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 170,
          failureHolder:
            "letlateBundleFailure:IProductionReviewRenderFixtureFailure|undefined;",
          finallyDigest:
            "4e456b60709662c11a446be7c6351b3b9529113cb64798a9ad25a8aa84d8f842",
          finallySubstantive: {
            digest:
              "03caf4b593cdab078e5fa0b3fe0f0ba1fecc125d06fa940ef170a166d7135fdd",
            tokens: 151,
          },
          index: 169,
          substantive: {
            digest:
              "93cd8f733e25b8d390a3ad64b90dbce0525c168dcd062387b2f1b16faa33eed1",
            tokens: 123,
          },
          tryBody:
            '{constprepared=review.prepare({target});TestValidator.equals("abundlereplacedafterinventorycannotbecomereviewevidence",namedFacts([["lateSwapped",()=>lateSwapped],["preparedFramesFrame",()=>prepared.frames.every((frame)=>frame.digest!==lateDigest),],["preparedDiagnosticsItem",()=>prepared.diagnostics.some((item)=>item.code==="render-bundle-unowned"&&path.resolve(fixture.root,item.path??"")===path.resolve(lateManifestPath),),],]),{lateSwapped:true,preparedFramesFrame:true,preparedDiagnosticsItem:true,},);}',
          tryDigest:
            "dd951b7eff47460215278fd53c784149b3066901fe91d9b5946c54bc0e18cc9d",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionReviewRenderHarnessCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Productionreview-renderharnesscleanupfailed$" +
            '{failure===undefined?"":"aftertheguardedcheckfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProductionReviewRenderFixtureFailure|undefined",
            "resources:readonlyIProductionReviewRenderHarnessCleanup[]",
          ],
        ],
      },
    },
  );
};
