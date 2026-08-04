import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveFilmSourceFixtureCleanup } from "./test_mcp_production_film_timeline";

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

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const filmSourceFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_film_timeline.ts",
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
    (entry) => entry.name === "test_mcp_production_film_timeline",
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
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveFilmSourceFixtureCleanup") === true &&
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
    visit(owner.arrow.body);
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveFilmSourceFixtureCleanup",
  );
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.arrow.body)
          ? [owner.arrow.body.statements.length]
          : [],
      ),
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "FilmSourceFixtureCleanupError"
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

interface IFailureInput {
  error: unknown;
  present: true;
}

const captureCleanup = (props: {
  filmRemovalFailure?: IFailureInput;
  outsideRemovalFailure?: IFailureInput;
  primaryFailure?: IFailureInput;
  sourceWriteFailure?: IFailureInput;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveFilmSourceFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      [
        {
          resource: "resident film source",
          cleanup: (): void => {
            order.push("remove-link");
            if (props.filmRemovalFailure !== undefined)
              throw props.filmRemovalFailure.error;
            order.push("write-source");
            if (props.sourceWriteFailure !== undefined)
              throw props.sourceWriteFailure.error;
          },
        },
        {
          resource: "outside root",
          cleanup: (): void => {
            order.push("remove-outside");
            if (props.outsideRemovalFailure !== undefined)
              throw props.outsideRemovalFailure.error;
          },
        },
      ],
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_film_source_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "film-source regression" };
  const linkRemovalFailure = { phase: "resident link removal" };
  const sourceWriteFailure = { phase: "resident source publication" };
  const outsideRemovalFailure = { phase: "outside root removal" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const dependencyFailure = captureCleanup({
    filmRemovalFailure: { error: linkRemovalFailure, present: true },
  });
  const standaloneWrite = captureCleanup({
    sourceWriteFailure: { error: sourceWriteFailure, present: true },
  });
  const multiple = captureCleanup({
    outsideRemovalFailure: { error: outsideRemovalFailure, present: true },
    sourceWriteFailure: { error: sourceWriteFailure, present: true },
  });
  const combined = captureCleanup({
    outsideRemovalFailure: { error: outsideRemovalFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
    sourceWriteFailure: { error: sourceWriteFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    filmRemovalFailure: { error: undefined, present: true },
  });
  const undefinedCombined = captureCleanup({
    outsideRemovalFailure: { error: undefined, present: true },
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "film-source cleanup preserves dependencies and exact failure order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successOrder",
        () =>
          success.order.join(",") === "remove-link,write-source,remove-outside",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      [
        "primaryOnlyOrder",
        () =>
          primaryOnly.order.join(",") ===
          "remove-link,write-source,remove-outside",
      ],
      ["dependencyFailureCaught", () => dependencyFailure.caught],
      [
        "dependencyFailureFailure",
        () => dependencyFailure.failure === linkRemovalFailure,
      ],
      [
        "dependencyFailureOrder",
        () =>
          dependencyFailure.order.join(",") === "remove-link,remove-outside",
      ],
      ["standaloneWriteCaught", () => standaloneWrite.caught],
      [
        "standaloneWriteFailure",
        () => standaloneWrite.failure === sourceWriteFailure,
      ],
      [
        "standaloneWriteOrder",
        () =>
          standaloneWrite.order.join(",") ===
          "remove-link,write-source,remove-outside",
      ],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultiple",
        () =>
          aggregateContainsExactly(multiple.failure, [
            sourceWriteFailure,
            outsideRemovalFailure,
          ]),
      ],
      [
        "multipleOrder",
        () =>
          multiple.order.join(",") ===
          "remove-link,write-source,remove-outside",
      ],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            sourceWriteFailure,
            outsideRemovalFailure,
          ]),
      ],
      [
        "combinedOrder",
        () =>
          combined.order.join(",") ===
          "remove-link,write-source,remove-outside",
      ],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrder",
        () =>
          undefinedPrimary.order.join(",") ===
          "remove-link,write-source,remove-outside",
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrder",
        () =>
          undefinedStandalone.order.join(",") === "remove-link,remove-outside",
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
          "remove-link,write-source,remove-outside",
      ],
    ]),
    {
      successCaught: true,
      successOrder: true,
      primaryOnlyCaught: true,
      primaryOnlyFailure: true,
      primaryOnlyOrder: true,
      dependencyFailureCaught: true,
      dependencyFailureFailure: true,
      dependencyFailureOrder: true,
      standaloneWriteCaught: true,
      standaloneWriteFailure: true,
      standaloneWriteOrder: true,
      multipleCaught: true,
      aggregateContainsExactlyMultiple: true,
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
    "film timeline owns dependency-safe source restoration",
    filmSourceFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_film_timeline.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["filmSourceFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 148,
            finallyBodies: [
              'preserveFilmSourceFixtureCleanup(filmSourceFixtureFailure,[{resource:"residentfilmsource",cleanup:():void=>{fs.rmSync(filmPath,{force:true});fs.writeFileSync(filmPath,originalSource);},},{resource:"outsidefilm-sourceroot",cleanup:()=>fs.rmSync(outsideFilmRoot,{force:true,recursive:true}),},]);',
            ],
            index: 42,
            prefixes: [
              'constoutsideFilmRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-film-source-outside-"),);',
              "letfilmSourceFixtureFailure:IFilmSourceFixtureFailure|undefined;",
            ],
            tryDigest:
              "b2983702a57d8938aaf162ed3f62f020ceb48834f2393262bed21c379d7845dc",
          },
        ],
        statementCounts: [3],
      },
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewFilmSourceFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Film-sourcefixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IFilmSourceFixtureFailure|undefined",
            "resources:readonlyIFilmSourceFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
