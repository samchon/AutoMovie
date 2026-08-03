import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { throwLegacyFixtureConstructionFailure } from "./test_mcp_production_legacy_import";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const legacyFixtureConstructionContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
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
  const owners = arrows.filter((entry) => entry.name === "createLegacy");
  const policies = arrows.filter(
    (entry) => entry.name === "throwLegacyFixtureConstructionFailure",
  );
  return {
    owner: {
      bodies: owners.map((entry) => compact(entry.arrow.body, source)),
      count: owners.length,
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "LegacyFixtureConstructionCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
      returnTypes: policies.flatMap((entry) =>
        entry.arrow.type === undefined
          ? []
          : [compact(entry.arrow.type, source)],
      ),
    },
  };
};

const captureConstructionFailure = (
  primaryFailure: unknown,
  cleanupFailure?: unknown,
): { attempts: number; failure: unknown } => {
  let attempts = 0;
  let failure: unknown;
  try {
    throwLegacyFixtureConstructionFailure(primaryFailure, () => {
      ++attempts;
      if (cleanupFailure !== undefined) throw cleanupFailure as Error;
    });
  } catch (error) {
    failure = error;
  }
  return { attempts, failure };
};

export const test_mcp_legacy_fixture_construction_cleanup = (): void => {
  const primaryFailure = { phase: "legacy fixture construction" };
  const cleanupFailure = { phase: "partial-root removal" };
  const primaryOnly = captureConstructionFailure(primaryFailure);
  const combined = captureConstructionFailure(primaryFailure, cleanupFailure);
  TestValidator.predicate(
    "legacy fixture construction cleanup preserves failure identity and order",
    primaryOnly.failure === primaryFailure &&
      primaryOnly.attempts === 1 &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        cleanupFailure,
      ]) &&
      combined.attempts === 1,
  );
  TestValidator.equals(
    "legacy fixture owns its temporary root from creation through handoff",
    legacyFixtureConstructionContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        bodies: [
          '{constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-import-test-"));try{constproject=AutoMovieProject.open(root);project.saveSlate(slate);project.registerAsset("assets/reference.bin",Buffer.from("legacy-asset"));fs.mkdirSync(path.join(root,"actors/archive"),{recursive:true});fs.writeFileSync(path.join(root,"actors/archive/README.txt"),"legacy");return{root,dispose:()=>fs.rmSync(root,{force:true,recursive:true}),};}catch(error){returnthrowLegacyFixtureConstructionFailure(error,()=>fs.rmSync(root,{force:true,recursive:true}),);}}',
        ],
        count: 1,
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){thrownewLegacyFixtureConstructionCleanupError([failure,cleanupFailure],"Legacyfixtureconstructionandpartial-rootcleanupfailed.",);}throwfailureasError;}',
        ],
        classes: ["AggregateError"],
        parameters: [["failure:unknown", "cleanup:()=>unknown"]],
        returnTypes: ["never"],
      },
    },
  );
};
