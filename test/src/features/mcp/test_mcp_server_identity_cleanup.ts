import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveServerIdentityCleanup } from "./test_mcp_server_identity";

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

const tokenDigest = (text: string): string => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const tokens: Array<[ts.SyntaxKind, string]> = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  )
    if (
      token !== ts.SyntaxKind.WhitespaceTrivia &&
      token !== ts.SyntaxKind.NewLineTrivia &&
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    )
      tokens.push([token, scanner.getTokenText()]);
  return digestText(JSON.stringify(tokens));
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const serverIdentityCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_server_identity.ts",
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
    (entry) => entry.name === "test_mcp_server_identity",
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
          .includes("preserveServerIdentityCleanup") !== true
      )
        continue;
      const substantive = [0, 2, 4, 5, 6, 7].map(
        (statement) => lifecycle.tryBlock.statements[statement]!,
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
        registrations: [1, 3].map((statement) =>
          compact(lifecycle.tryBlock.statements[statement]!, source),
        ),
        substantiveTokenDigest: tokenDigest(
          substantive.map((statement) => statement.getText(source)).join("\n"),
        ),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveServerIdentityCleanup",
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
        statement.name?.text === "ServerIdentityCleanupError"
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
      await preserveServerIdentityCleanup(
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

export const test_mcp_server_identity_cleanup = async (): Promise<void> => {
  const primaryFailure = { phase: "identity handshake" };
  const clientFailure = { phase: "client close" };
  const serverFailure = { phase: "server close" };
  const fixtureFailure = { phase: "fixture disposal" };
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
    "server-identity cleanup preserves acquisition, phase, and failure order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      ["successFailure", () => success.failure === undefined],
      [
        "successConnectionAttempts",
        () => success.connectionAttempts.join(",") === "1,1",
      ],
      ["successFixtureAttempts", () => success.fixtureAttempts === 1],
      [
        "successOrder",
        () => success.order.join(",") === "connection-0,connection-1,fixture",
      ],
      ["fixtureOnlySetupCaught", () => fixtureOnlySetup.caught],
      [
        "fixtureOnlySetupFailure",
        () => fixtureOnlySetup.failure === primaryFailure,
      ],
      [
        "fixtureOnlySetupCount",
        () => fixtureOnlySetup.connectionAttempts.length === 0,
      ],
      [
        "fixtureOnlySetupFixtureAttempts",
        () => fixtureOnlySetup.fixtureAttempts === 1,
      ],
      [
        "fixtureOnlySetupOrder",
        () => fixtureOnlySetup.order.join(",") === "fixture",
      ],
      ["partialSetupCaught", () => partialSetup.caught],
      ["partialSetupFailure", () => partialSetup.failure === primaryFailure],
      [
        "partialSetupConnectionAttempts",
        () => partialSetup.connectionAttempts.join(",") === "1",
      ],
      ["partialSetupFixtureAttempts", () => partialSetup.fixtureAttempts === 1],
      [
        "partialSetupOrder",
        () => partialSetup.order.join(",") === "connection-0,fixture",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      [
        "primaryOnlyConnectionAttempts",
        () => primaryOnly.connectionAttempts.join(",") === "1,1",
      ],
      ["primaryOnlyFixtureAttempts", () => primaryOnly.fixtureAttempts === 1],
      ["clientStandaloneCaught", () => clientStandalone.caught],
      [
        "clientStandaloneFailure",
        () => clientStandalone.failure === clientFailure,
      ],
      [
        "clientStandaloneConnectionAttempts",
        () => clientStandalone.connectionAttempts.join(",") === "1,1",
      ],
      [
        "clientStandaloneFixtureAttempts",
        () => clientStandalone.fixtureAttempts === 1,
      ],
      ["serverStandaloneCaught", () => serverStandalone.caught],
      [
        "serverStandaloneFailure",
        () => serverStandalone.failure === serverFailure,
      ],
      [
        "serverStandaloneConnectionAttempts",
        () => serverStandalone.connectionAttempts.join(",") === "1,1",
      ],
      [
        "serverStandaloneFixtureAttempts",
        () => serverStandalone.fixtureAttempts === 1,
      ],
      ["fixtureStandaloneCaught", () => fixtureStandalone.caught],
      [
        "fixtureStandaloneFailure",
        () => fixtureStandalone.failure === fixtureFailure,
      ],
      [
        "fixtureStandaloneConnectionAttempts",
        () => fixtureStandalone.connectionAttempts.join(",") === "1,1",
      ],
      [
        "fixtureStandaloneFixtureAttempts",
        () => fixtureStandalone.fixtureAttempts === 1,
      ],
      ["multipleCleanupCaught", () => multipleCleanup.caught],
      [
        "aggregateContainsExactlyMultipleCleanup",
        () =>
          aggregateContainsExactly(multipleCleanup.failure, [
            clientFailure,
            serverFailure,
            fixtureFailure,
          ]),
      ],
      [
        "multipleCleanupConnectionAttempts",
        () => multipleCleanup.connectionAttempts.join(",") === "1,1",
      ],
      [
        "multipleCleanupFixtureAttempts",
        () => multipleCleanup.fixtureAttempts === 1,
      ],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            clientFailure,
            serverFailure,
            fixtureFailure,
          ]),
      ],
      [
        "combinedConnectionAttempts",
        () => combined.connectionAttempts.join(",") === "1,1",
      ],
      ["combinedFixtureAttempts", () => combined.fixtureAttempts === 1],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryConnectionAttempts",
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
        "undefinedStandaloneConnectionAttempts",
        () => undefinedStandalone.connectionAttempts.join(",") === "1,1",
      ],
      [
        "undefinedStandaloneFixtureAttempts",
        () => undefinedStandalone.fixtureAttempts === 1,
      ],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombined",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedConnectionAttempts",
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
      successConnectionAttempts: true,
      successFixtureAttempts: true,
      successOrder: true,
      fixtureOnlySetupCaught: true,
      fixtureOnlySetupFailure: true,
      fixtureOnlySetupCount: true,
      fixtureOnlySetupFixtureAttempts: true,
      fixtureOnlySetupOrder: true,
      partialSetupCaught: true,
      partialSetupFailure: true,
      partialSetupConnectionAttempts: true,
      partialSetupFixtureAttempts: true,
      partialSetupOrder: true,
      primaryOnlyCaught: true,
      primaryOnlyFailure: true,
      primaryOnlyConnectionAttempts: true,
      primaryOnlyFixtureAttempts: true,
      clientStandaloneCaught: true,
      clientStandaloneFailure: true,
      clientStandaloneConnectionAttempts: true,
      clientStandaloneFixtureAttempts: true,
      serverStandaloneCaught: true,
      serverStandaloneFailure: true,
      serverStandaloneConnectionAttempts: true,
      serverStandaloneFixtureAttempts: true,
      fixtureStandaloneCaught: true,
      fixtureStandaloneFailure: true,
      fixtureStandaloneConnectionAttempts: true,
      fixtureStandaloneFixtureAttempts: true,
      multipleCleanupCaught: true,
      aggregateContainsExactlyMultipleCleanup: true,
      multipleCleanupConnectionAttempts: true,
      multipleCleanupFixtureAttempts: true,
      combinedCaught: true,
      aggregateContainsExactlyCombined: true,
      combinedConnectionAttempts: true,
      combinedFixtureAttempts: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryConnectionAttempts: true,
      undefinedPrimaryFixtureAttempts: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneConnectionAttempts: true,
      undefinedStandaloneFixtureAttempts: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombined: true,
      undefinedCombinedConnectionAttempts: true,
      undefinedCombinedFixtureAttempts: true,
    },
  );
  TestValidator.equals(
    "server-identity test owns every acquired resource and cleanup phase",
    serverIdentityCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_server_identity.ts"),
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
            catchBodies: ["serverIdentityFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            connectionHolder:
              "constconnectionCleanups:IServerIdentityConnectionCleanup[]=[];",
            failureHolder:
              "letserverIdentityFailure:IServerIdentityFailure|undefined;",
            finallyBodies: [
              "awaitpreserveServerIdentityCleanup(serverIdentityFailure,connectionCleanups,()=>fixture.dispose(),);",
            ],
            index: 3,
            ownerParameters: [],
            registrations: [
              'connectionCleanups.push({resource:"MCPserver",cleanup:()=>server.close(),});',
              'connectionCleanups.unshift({resource:"MCPclient",cleanup:()=>client.close(),});',
            ],
            substantiveTokenDigest:
              "1809e899b6d13f5023664b84abf4b1b815be701b9f9d4cf58c62bcf25c614dd7",
            tryDigest:
              "955d8f0c06f428f46fe1613867263d20b0526b2c5bc360525676eecf6e32b873",
            tryStatements: 8,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        async: [true],
        bodies: [
          '{constresults=awaitPromise.allSettled(connections.map((resource)=>Promise.resolve().then(resource.cleanup)),);constcleanupFailures:Array<{error:unknown;resource:string}>=results.flatMap((result,index)=>result.status==="fulfilled"?[]:[{error:result.reason,resource:connections[index]!.resource}],);try{fixtureCleanup();}catch(error){cleanupFailures.push({error,resource:"productionfixture"});}if(cleanupFailures.length===0)return;if(failure===undefined&&cleanupFailures.length===1)throwcleanupFailures[0]!.error;thrownewServerIdentityCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Server-identitycleanupfailed$' +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        bodyDigests: [
          "a950c1c74e87bec79685beac388eae5366a16fb29aa3ce88af3694c972537b3e",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IServerIdentityFailure|undefined",
            "connections:readonlyIServerIdentityConnectionCleanup[]",
            "fixtureCleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
