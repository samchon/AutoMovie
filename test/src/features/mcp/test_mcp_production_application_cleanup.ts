import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionApplicationCleanup } from "./test_mcp_production_application";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenDigest = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): string => {
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
  return digestText(JSON.stringify(tokens));
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const productionApplicationCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_application.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [
                {
                  arrow: declaration.initializer,
                  name: declaration.name.text,
                },
              ]
            : [],
        )
      : [],
  );
  const owners = arrows.filter(
    (entry) => entry.name === "test_mcp_production_application",
  );
  const lifecycles: Array<{
    acquisition: string;
    async: boolean;
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    connectionHolder: string;
    failureHolder: string;
    finallyBodies: string[];
    index: number;
    ownerParameters: string[];
    registrations: string[];
    substantiveStatements: number;
    substantiveTokenDigest: string;
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) continue;
    for (const [index, lifecycle] of [...body.statements].entries()) {
      if (
        ts.isTryStatement(lifecycle) === false ||
        lifecycle.catchClause === undefined ||
        lifecycle.finallyBlock
          ?.getText(source)
          .includes("preserveProductionApplicationCleanup") !== true
      )
        continue;
      const substantive = lifecycle.tryBlock.statements.filter(
        (_, statement) => statement !== 157 && statement !== 159,
      );
      lifecycles.push({
        acquisition: compact(body.statements[2]!, source),
        async:
          owner.arrow.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) ?? false,
        bodyStatements: body.statements.length,
        catchBodies: lifecycle.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        connectionHolder: compact(body.statements[0]!, source),
        failureHolder: compact(body.statements[1]!, source),
        finallyBodies: lifecycle.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        registrations: [157, 159].map((statement) =>
          compact(lifecycle.tryBlock.statements[statement]!, source),
        ),
        substantiveStatements: substantive.length,
        substantiveTokenDigest: leafTokenDigest(substantive, source),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionApplicationCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      async: policies.map(
        (entry) =>
          entry.arrow.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) ?? false,
      ),
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      bodyDigests: policies.map((entry) =>
        digestText(entry.arrow.body.getText(source)),
      ),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionApplicationCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = async (props: {
  connectionFailures?: readonly (
    | { error: unknown; present: true }
    | undefined
  )[];
  connections?: number;
  fixtureFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): Promise<{
  caught: boolean;
  connectionAttempts: number[];
  failure: unknown;
  fixtureAttempts: number;
  order: string[];
}> => {
  const count = props.connections ?? 2;
  const connectionAttempts = Array.from({ length: count }, () => 0);
  const order: string[] = [];
  let caught = false;
  let failure: unknown;
  let fixtureAttempts = 0;
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      await preserveProductionApplicationCleanup(
        primaryState,
        connectionAttempts.map((_, index) => ({
          resource: `connection-${index}`,
          cleanup: async (): Promise<void> => {
            ++connectionAttempts[index]!;
            order.push(`connection-${index}`);
            const connectionFailure = props.connectionFailures?.[index];
            if (connectionFailure !== undefined) throw connectionFailure.error;
          },
        })),
        (): void => {
          ++fixtureAttempts;
          order.push("fixture");
          if (props.fixtureFailure !== undefined)
            throw props.fixtureFailure.error;
        },
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, connectionAttempts, failure, fixtureAttempts, order };
};

export const test_mcp_production_application_cleanup =
  async (): Promise<void> => {
    const primaryFailure = { phase: "production-application assertion" };
    const clientFailure = { phase: "application client close" };
    const serverFailure = { phase: "application server close" };
    const fixtureFailure = { phase: "application fixture disposal" };
    const success = await captureCleanup({});
    const fixtureOnlySetup = await captureCleanup({
      connections: 0,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const partialSetup = await captureCleanup({
      connections: 1,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const primaryOnly = await captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const clientStandalone = await captureCleanup({
      connectionFailures: [{ error: clientFailure, present: true }],
    });
    const serverStandalone = await captureCleanup({
      connectionFailures: [undefined, { error: serverFailure, present: true }],
    });
    const fixtureStandalone = await captureCleanup({
      fixtureFailure: { error: fixtureFailure, present: true },
    });
    const multipleCleanup = await captureCleanup({
      connectionFailures: [
        { error: clientFailure, present: true },
        { error: serverFailure, present: true },
      ],
      fixtureFailure: { error: fixtureFailure, present: true },
    });
    const combined = await captureCleanup({
      connectionFailures: [
        { error: clientFailure, present: true },
        { error: serverFailure, present: true },
      ],
      fixtureFailure: { error: fixtureFailure, present: true },
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = await captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    const undefinedStandalone = await captureCleanup({
      connectionFailures: [{ error: undefined, present: true }],
    });
    const undefinedCombined = await captureCleanup({
      connectionFailures: [{ error: undefined, present: true }],
      fixtureFailure: { error: undefined, present: true },
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "production-application cleanup preserves acquisition and failure order",
      namedFacts([
        ["successCaught", () => success.caught === false],
        [
          "successFailure",
          () => success.caught === false && success.failure === undefined,
        ],
        [
          "successConnectionAttemptsJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.connectionAttempts.join(",") === "1,1",
        ],
        ["successFixtureAttempts", () => success.fixtureAttempts === 1],
        [
          "successOrderJoin",
          () => success.order.join(",") === "connection-0,connection-1,fixture",
        ],
        ["fixtureOnlySetupCaught", () => fixtureOnlySetup.caught],
        [
          "fixtureOnlySetupFailurePrimaryFailure",
          () => fixtureOnlySetup.failure === primaryFailure,
        ],
        [
          "fixtureOnlySetupConnectionAttemptsLength",
          () => fixtureOnlySetup.connectionAttempts.length === 0,
        ],
        [
          "fixtureOnlySetupFixtureAttempts",
          () => fixtureOnlySetup.fixtureAttempts === 1,
        ],
        [
          "fixtureOnlySetupOrderJoin",
          () => fixtureOnlySetup.order.join(",") === "fixture",
        ],
        ["partialSetupCaught", () => partialSetup.caught],
        [
          "partialSetupFailurePrimaryFailure",
          () => partialSetup.failure === primaryFailure,
        ],
        [
          "partialSetupConnectionAttemptsJoin",
          () => partialSetup.connectionAttempts.join(",") === "1",
        ],
        [
          "partialSetupFixtureAttempts",
          () => partialSetup.fixtureAttempts === 1,
        ],
        [
          "partialSetupOrderJoin",
          () => partialSetup.order.join(",") === "connection-0,fixture",
        ],
        ["primaryOnlyCaught", () => primaryOnly.caught],
        [
          "primaryOnlyFailurePrimaryFailure",
          () => primaryOnly.failure === primaryFailure,
        ],
        [
          "primaryOnlyConnectionAttemptsJoin",
          () => primaryOnly.connectionAttempts.join(",") === "1,1",
        ],
        ["primaryOnlyFixtureAttempts", () => primaryOnly.fixtureAttempts === 1],
        ["clientStandaloneCaught", () => clientStandalone.caught],
        [
          "clientStandaloneFailureClientFailure",
          () => clientStandalone.failure === clientFailure,
        ],
        [
          "clientStandaloneConnectionAttemptsJoin",
          () => clientStandalone.connectionAttempts.join(",") === "1,1",
        ],
        [
          "clientStandaloneFixtureAttempts",
          () => clientStandalone.fixtureAttempts === 1,
        ],
        ["serverStandaloneCaught", () => serverStandalone.caught],
        [
          "serverStandaloneFailureServerFailure",
          () => serverStandalone.failure === serverFailure,
        ],
        [
          "serverStandaloneConnectionAttemptsJoin",
          () => serverStandalone.connectionAttempts.join(",") === "1,1",
        ],
        [
          "serverStandaloneFixtureAttempts",
          () => serverStandalone.fixtureAttempts === 1,
        ],
        ["fixtureStandaloneCaught", () => fixtureStandalone.caught],
        [
          "fixtureStandaloneFailureFixtureFailure",
          () => fixtureStandalone.failure === fixtureFailure,
        ],
        [
          "fixtureStandaloneConnectionAttemptsJoin",
          () => fixtureStandalone.connectionAttempts.join(",") === "1,1",
        ],
        [
          "fixtureStandaloneFixtureAttempts",
          () => fixtureStandalone.fixtureAttempts === 1,
        ],
        ["multipleCleanupCaught", () => multipleCleanup.caught],
        [
          "aggregateContainsExactlyMultipleCleanupFailure",
          () =>
            aggregateContainsExactly(multipleCleanup.failure, [
              clientFailure,
              serverFailure,
              fixtureFailure,
            ]),
        ],
        [
          "multipleCleanupConnectionAttemptsJoin",
          () => multipleCleanup.connectionAttempts.join(",") === "1,1",
        ],
        [
          "multipleCleanupFixtureAttempts",
          () => multipleCleanup.fixtureAttempts === 1,
        ],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombinedFailure",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              clientFailure,
              serverFailure,
              fixtureFailure,
            ]),
        ],
        [
          "combinedConnectionAttemptsJoin",
          () => combined.connectionAttempts.join(",") === "1,1",
        ],
        ["combinedFixtureAttempts", () => combined.fixtureAttempts === 1],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryConnectionAttemptsJoin",
          () => undefinedPrimary.connectionAttempts.join(",") === "1,1",
        ],
        [
          "undefinedPrimaryFixtureAttempts",
          () => undefinedPrimary.fixtureAttempts === 1,
        ],
        ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
        [
          "undefinedStandaloneFailure",
          () => undefinedStandalone.failure === undefined,
        ],
        [
          "undefinedStandaloneConnectionAttemptsJoin",
          () => undefinedStandalone.connectionAttempts.join(",") === "1,1",
        ],
        [
          "undefinedStandaloneFixtureAttempts",
          () => undefinedStandalone.fixtureAttempts === 1,
        ],
        ["undefinedCombinedCaught", () => undefinedCombined.caught],
        [
          "aggregateContainsExactlyUndefinedCombinedFailure",
          () =>
            aggregateContainsExactly(undefinedCombined.failure, [
              undefined,
              undefined,
              undefined,
            ]),
        ],
        [
          "undefinedCombinedConnectionAttemptsJoin",
          () => undefinedCombined.connectionAttempts.join(",") === "1,1",
        ],
        [
          "undefinedCombinedFixtureAttempts",
          () => undefinedCombined.fixtureAttempts === 1,
        ],
      ]),
      {
        successCaught: true,
        successFailure: true,
        successConnectionAttemptsJoin: true,
        successFixtureAttempts: true,
        successOrderJoin: true,
        fixtureOnlySetupCaught: true,
        fixtureOnlySetupFailurePrimaryFailure: true,
        fixtureOnlySetupConnectionAttemptsLength: true,
        fixtureOnlySetupFixtureAttempts: true,
        fixtureOnlySetupOrderJoin: true,
        partialSetupCaught: true,
        partialSetupFailurePrimaryFailure: true,
        partialSetupConnectionAttemptsJoin: true,
        partialSetupFixtureAttempts: true,
        partialSetupOrderJoin: true,
        primaryOnlyCaught: true,
        primaryOnlyFailurePrimaryFailure: true,
        primaryOnlyConnectionAttemptsJoin: true,
        primaryOnlyFixtureAttempts: true,
        clientStandaloneCaught: true,
        clientStandaloneFailureClientFailure: true,
        clientStandaloneConnectionAttemptsJoin: true,
        clientStandaloneFixtureAttempts: true,
        serverStandaloneCaught: true,
        serverStandaloneFailureServerFailure: true,
        serverStandaloneConnectionAttemptsJoin: true,
        serverStandaloneFixtureAttempts: true,
        fixtureStandaloneCaught: true,
        fixtureStandaloneFailureFixtureFailure: true,
        fixtureStandaloneConnectionAttemptsJoin: true,
        fixtureStandaloneFixtureAttempts: true,
        multipleCleanupCaught: true,
        aggregateContainsExactlyMultipleCleanupFailure: true,
        multipleCleanupConnectionAttemptsJoin: true,
        multipleCleanupFixtureAttempts: true,
        combinedCaught: true,
        aggregateContainsExactlyCombinedFailure: true,
        combinedConnectionAttemptsJoin: true,
        combinedFixtureAttempts: true,
        undefinedPrimaryCaught: true,
        undefinedPrimaryFailure: true,
        undefinedPrimaryConnectionAttemptsJoin: true,
        undefinedPrimaryFixtureAttempts: true,
        undefinedStandaloneCaught: true,
        undefinedStandaloneFailure: true,
        undefinedStandaloneConnectionAttemptsJoin: true,
        undefinedStandaloneFixtureAttempts: true,
        undefinedCombinedCaught: true,
        aggregateContainsExactlyUndefinedCombinedFailure: true,
        undefinedCombinedConnectionAttemptsJoin: true,
        undefinedCombinedFixtureAttempts: true,
      },
    );
    TestValidator.equals(
      "production-application test owns every acquired cleanup phase",
      productionApplicationCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_application.ts"),
          "utf8",
        ),
      ),
      {
        owner: {
          count: 1,
          lifecycles: [
            {
              acquisition: "constfixture=productionFixture();",
              async: true,
              bodyStatements: 4,
              catchBodies: [
                "productionApplicationFailure={error};",
                "throwerror;",
              ],
              catchVariables: ["error"],
              connectionHolder:
                "constconnectionCleanups:IProductionApplicationConnectionCleanup[]=[];",
              failureHolder:
                "letproductionApplicationFailure:IProductionApplicationFailure|undefined;",
              finallyBodies: [
                "awaitpreserveProductionApplicationCleanup(productionApplicationFailure,connectionCleanups,()=>fixture.dispose(),);",
              ],
              index: 3,
              ownerParameters: [],
              registrations: [
                'constclient=newClient({name:"five-tool-schema-test",version:"0.0.0",});',
                "const[clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();",
              ],
              substantiveStatements: 164,
              substantiveTokenDigest:
                "c3df72275492bf106a4efbbe82ac7affc8d41fd22e86ad0973f65e30eac1158b",
              tryDigest:
                "b3a603099954553f83324aa3b1cde0eb62fa6a765803416fa3cb0f28fb6cea49",
              tryStatements: 166,
            },
          ],
        },
        parseDiagnostics: [],
        policy: {
          async: [true],
          bodies: [
            '{constresults=awaitPromise.allSettled(connections.map((resource)=>Promise.resolve().then(resource.cleanup)),);constcleanupFailures:Array<{error:unknown;resource:string}>=results.flatMap((result,index)=>result.status==="fulfilled"?[]:[{error:result.reason,resource:connections[index]!.resource}],);try{fixtureCleanup();}catch(error){cleanupFailures.push({error,resource:"productionfixture"});}if(cleanupFailures.length===0)return;if(failure===undefined&&cleanupFailures.length===1)throwcleanupFailures[0]!.error;thrownewProductionApplicationCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Production-applicationcleanupfailed$' +
              '{failure===undefined?"":"afterthetestfailed"}:$' +
              '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
          ],
          bodyDigests: [
            "434b9f9106b6035711eeadce0a6c9425558b5f18366add0c219c05b1a338fe43",
          ],
          classes: ["AggregateError"],
          parameters: [
            [
              "failure:IProductionApplicationFailure|undefined",
              "connections:readonlyIProductionApplicationConnectionCleanup[]",
              "fixtureCleanup:()=>unknown",
            ],
          ],
        },
      },
    );
  };
