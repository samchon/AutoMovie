import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveBenchmarkRunnerResidentCleanup } from "./test_benchmark_runner";

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

const benchmarkResidentCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_benchmark_runner.ts",
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
        "preserveBenchmarkRunnerResidentCleanup(",
      ) &&
      (compact(node.finallyBlock, source).match(/resource:/g)?.length ?? 0) >
        1 &&
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
    (entry) => entry.name === "preserveBenchmarkRunnerResidentCleanup",
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
        statement.name?.text === "BenchmarkRunnerResidentCleanupError"
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
      preserveBenchmarkRunnerResidentCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 3 }, (_, index) => ({
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

const captureMarker = (props: {
  restorationFailure?: unknown;
  transientFailure?: unknown;
}): {
  caught: unknown;
  marker: string | null;
  order: string[];
  parked: boolean;
} => {
  let caught: unknown;
  let marker: string | null = "parked";
  const order: string[] = [];
  let parked = true;
  try {
    preserveBenchmarkRunnerResidentCleanup(undefined, [
      {
        resource: "transient",
        cleanup: () => {
          order.push("transient");
          if (props.transientFailure !== undefined)
            throw props.transientFailure as Error;
        },
      },
      {
        resource: "resident",
        cleanup: () => {
          order.push("resident");
          if (props.restorationFailure !== undefined)
            throw props.restorationFailure as Error;
          parked = false;
        },
      },
      {
        resource: "marker",
        cleanup: () => {
          order.push("marker");
          if (parked === false) marker = null;
        },
      },
    ]);
  } catch (error) {
    caught = error;
  }
  return { caught, marker, order, parked };
};

export const test_benchmark_runner_resident_cleanup = (): void => {
  const primaryFailure = { phase: "benchmark resident guard" };
  const transientFailure = { phase: "transient removal" };
  const residentFailure = { phase: "resident restoration" };
  const cleanupFailures = [
    { error: transientFailure, present: true as const },
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
  const markerCleared = captureMarker({
    transientFailure,
  });
  const markerRetained = captureMarker({
    restorationFailure: residentFailure,
  });
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
  TestValidator.predicate(
    "benchmark resident cleanup preserves failure, resource, and marker order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === transientFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        transientFailure,
        residentFailure,
      ]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-2") &&
      multiple.message.includes("resource-1") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        transientFailure,
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
      undefinedCombined.order.join(",") === fullOrder &&
      markerCleared.caught === transientFailure &&
      markerCleared.marker === null &&
      markerCleared.parked === false &&
      markerCleared.order.join(",") === "transient,resident,marker" &&
      markerRetained.caught === residentFailure &&
      markerRetained.marker === "parked" &&
      markerRetained.parked &&
      markerRetained.order.join(",") === "transient,resident,marker",
  );
  TestValidator.equals(
    "benchmark runner owns four resident-swap cleanup lifecycles",
    benchmarkResidentCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_benchmark_runner.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["archiveTaskReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 8,
          failureHolder:
            "letarchiveTaskReadFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "edf70ae867060d11205235e11987292b735d4cb1b34a6c3cd3b38d9be9eba165",
          finallySubstantive: {
            digest:
              "2f348ec3cb32e3e3fe95d6bce927f44c1e7c968248fa3f90e06d4286a19401e4",
            tokens: 78,
          },
          index: 7,
          substantive: {
            digest:
              "cd543d5857f558123ee15a49dd87bf7f27ef1feb7b16b75c6d9131a3e952b8a1",
            tokens: 17,
          },
          tryBody:
            "{returnReflect.apply(nativeArchiveRead,fs,[file,...args]);}",
          tryDigest:
            "9ad1ee88942ffe3e902f0937dde02be321648eddf3c8b3d0f29f1fdb28669c30",
        },
        {
          catchBodies: ["archiveRunFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 2,
          failureHolder:
            "letarchiveRunFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "4650c3135fb654202d46342712f708bf3ae409c328c453f88771efc9b084a65d",
          finallySubstantive: {
            digest:
              "dbde0609477ccd30878dd8f149012dc117c75c99966d578ad6861844505cdea3",
            tokens: 143,
          },
          index: 1,
          substantive: {
            digest:
              "45cfdaa50ebf69e1ce67949c3941d44c55c842d89b42b6973a44c914c5e1cae6",
            tokens: 44,
          },
          tryBody:
            '{returnawaitrunAutoMovieBenchmark({taskId:current.taskId,lane:"deterministic",campaign:"redesign-cycle-1",runRoot:root,repositoryRoot,identity,mcpTarget,inventoryBaselines:[archivedBaseline],agent,collect:collectCompleteEvidence,});}',
          tryDigest:
            "2bceb39dc4be47c6e5bd84c4fab1ab18f1528cf22be49cac1a4db79553903726",
        },
        {
          catchBodies: ["snapshotReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 5,
          failureHolder:
            "letsnapshotReadFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "30a89d83305c41ff147ee4e3ee75da4e8f5a89859b008c28c34d029f474c0db1",
          finallySubstantive: {
            digest:
              "1d92d1252f159c228861757ca44521dd0e80ee9a4680adf6e01149c3d259a47a",
            tokens: 48,
          },
          index: 4,
          substantive: {
            digest:
              "f3666079f40240e4e8dd97c5fbc3875233910fe89934b5efdffc5473300c7d4e",
            tokens: 17,
          },
          tryBody: "{returnReflect.apply(nativeRead,fs,[file,...args]);}",
          tryDigest:
            "cce60cf8787d6dec308512e8a1a07e8a04c76e96f608a08b18ac2afe6b6c3e25",
        },
        {
          catchBodies: ["snapshotFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 2,
          failureHolder:
            "letsnapshotFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "a9411f615db8c6b44140d3d1f6903c46b3612a9ee2153f00a4b09aca72c84230",
          finallySubstantive: {
            digest:
              "fd5a836fe9ae1553e214af19542db1ffe6717baa78a0331bbc041e0a4fe668d5",
            tokens: 99,
          },
          index: 1,
          substantive: {
            digest:
              "6503d657ae5fb373a4c4e49d5256255c548bcdf08fce09ec40eaf920680a0ccb",
            tokens: 6,
          },
          tryBody: "{returnsnapshotAutoMovieBenchmarkProject(project);}",
          tryDigest:
            "fcb5eb4efa91590a6435aeb35e33522832a4530211bd2ee7104181a7871fdde4",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewBenchmarkRunnerResidentCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Benchmarkrunnerresidentcleanupfailed$" +
            '{failure===undefined?"":"aftertheguardedoperationfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IBenchmarkRunnerFixtureFailure|undefined",
            "resources:readonlyIBenchmarkRunnerResidentCleanup[]",
          ],
        ],
      },
    },
  );
};
